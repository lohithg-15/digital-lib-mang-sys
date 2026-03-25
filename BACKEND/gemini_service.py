"""
Google Gemini Vision API Service for Book Cover Analysis
Extracts book metadata (title, author, publisher, ISBN) from book cover images.
"""

import base64
import json
import os
from typing import Dict, Optional
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")


def extract_book_metadata_with_gemini(image_path: str, max_retries: int = 2) -> Optional[Dict[str, str]]:
    """
    Use Google Gemini 1.5 Pro/Flash to intelligently extract book metadata from cover image.
    
    Args:
        image_path: Path to the book cover image
        max_retries: Number of retry attempts if extraction fails
    
    Returns:
        Dictionary with keys: title, author, subtitle, publisher, isbn, confidence
        Returns None if extraction fails
    """
    
    if not GEMINI_API_KEY:
        print("❌ GEMINI_API_KEY not set in .env file")
        print("   Get a key at: https://aistudio.google.com/apikey")
        return None
    
    # Verify image file exists
    if not os.path.exists(image_path):
        print(f"❌ Image file not found: {image_path}")
        return None
    
    # Check file size
    file_size = os.path.getsize(image_path)
    print(f"   📁 Image file: {image_path} ({file_size} bytes)")
    
    if file_size == 0:
        print(f"❌ Image file is empty (0 bytes)")
        return None
    
    if file_size > 20 * 1024 * 1024:  # 20MB limit
        print(f"❌ Image file too large ({file_size} bytes, max 20MB)")
        return None
    
    print(f"   ✅ Image file valid ({file_size} bytes)")
    
    # Try latest models - always use most recent versions
    # gemini-2.5-pro: Most capable, slow but accurate
    # gemini-2.5-flash: Faster, ideal for book extraction
    models_to_try = ["gemini-2.5-pro", "gemini-2.5-flash"]
    
    for model_name in models_to_try:
        for attempt in range(max_retries):
            try:
                print(f"   🔄 Attempt {attempt + 1}/{max_retries} with {model_name}...")
                result = _extract_with_gemini_model(image_path, model_name)
                
                if result and result.get("title") and result.get("title").lower() != "unknown":
                    return result
                elif attempt < max_retries - 1:
                    print(f"   ⚠️ {model_name} returned invalid result, retrying...")
                    continue
                    
            except requests.exceptions.Timeout:
                if attempt < max_retries - 1:
                    print(f"   ⚠️ {model_name} timeout, retrying...")
                    continue
                print(f"   ⚠️ {model_name} timeout after {max_retries} attempts")
                
            except Exception as e:
                error_msg = str(e)[:100]
                print(f"   ⚠️ {model_name} failed: {error_msg}")
                if attempt < max_retries - 1:
                    continue
                break
    
    print("   ❌ All Gemini models failed or returned invalid results")
    return None


def _extract_with_gemini_model(image_path: str, model_name: str) -> Optional[Dict[str, str]]:
    """
    Extract book fields using a specific Gemini model.
    
    Args:
        image_path: Path to book cover image
        model_name: Gemini model name (gemini-1.5-pro or gemini-1.5-flash)
    
    Returns:
        Dictionary with extracted book metadata or None on failure
    """
    try:
        # Read and encode image as base64
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        
        # Detailed prompt for accurate book cover analysis
        prompt = """You are an expert book cover analyzer with exceptional attention to detail. Analyze this book cover image systematically.

STEP-BY-STEP ANALYSIS PROCESS:

STEP 1: IDENTIFY ALL TEXT ELEMENTS
- Scan the entire image carefully
- Note the position, size, and prominence of each text element
- Identify which text appears largest/most prominent (likely title)
- Identify which text appears at top/center (likely title)
- Identify which text appears at bottom (likely author/publisher)

STEP 2: DETERMINE THE BOOK TITLE
- The TITLE is typically:
  * The LARGEST text on the cover
  * Positioned at the TOP or CENTER of the cover
  * The main name of the book
  * May include a subtitle (smaller text directly below)
- Examples: "Bhagavad Gita", "Python Programming: Beginners Guide", "The Lord of the Rings"
- If there's a subtitle, combine it with main title: "Main Title: Subtitle"
- IMPORTANT: Do NOT confuse author names with the title. Author names are usually at bottom.

STEP 3: DETERMINE THE AUTHOR(S)
- The AUTHOR is typically:
  * Smaller text than the title
  * Positioned at the BOTTOM of the cover
  * May say "By", "Written by", "Author:", or just show names
  * Can be one or multiple authors (separated by commas, "and", or "&")
- Examples: "Vyasa", "J.K. Rowling", "Mark Lutz, David Ascher"
- Extract ALL author names exactly as they appear
- If multiple authors, separate by commas

STEP 4: EXTRACT ADDITIONAL INFORMATION
- Publisher: Usually small text at bottom, may say "Published by"
- ISBN: Usually 10 or 13 digit number, labeled "ISBN"
- Subtitle: Only if clearly separate from main title

STEP 5: VALIDATION
- Ensure title is NOT author names
- Ensure author is NOT the book title
- Title should be meaningful (not just "BOOK" or generic words)
- Author should be person names (not book titles)

CRITICAL: Read ALL text carefully. Extract EXACT text as it appears, fix obvious OCR errors if identified.

Return ONLY a valid JSON object with no additional text:
{
  "title": "Complete book title exactly as it appears, including subtitle if present",
  "author": "All author names exactly as they appear, separated by commas",
  "subtitle": "Subtitle only if clearly separate from main title, otherwise empty string",
  "publisher": "Publisher name exactly as appears, or 'Unknown' if not visible",
  "isbn": "ISBN number exactly as appears, or 'Unknown' if not visible",
  "confidence": "high/medium/low based on clarity of text"
}"""

        # Determine MIME type based on file extension
        img_ext = os.path.splitext(image_path)[1].lower()
        mime_type_map = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }
        mime_type = mime_type_map.get(img_ext, 'image/png')
        
        # Build request payload
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": b64,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,  # Low temperature for accurate extraction
                "topK": 1,
                "topP": 0.8,
            }
        }

        print(f"   📡 Calling Gemini API ({model_name})...")
        print(f"   🔑 API Key validation: {'✅ Present' if GEMINI_API_KEY else '❌ Missing'}")
        
        try:
            res = requests.post(url, json=payload, params={"key": GEMINI_API_KEY}, timeout=60)
            
            # Print full response for debugging
            if res.status_code != 200:
                print(f"   ❌ API Error: {res.status_code}")
                print(f"   Response: {res.text[:500]}")
            
            res.raise_for_status()
            data = res.json()

        except requests.exceptions.HTTPError as http_err:
            print(f"   ❌ HTTP Error {res.status_code}")
            error_body = res.text
            if "INVALID_ARGUMENT" in error_body:
                print(f"   ⚠️ Invalid image format or corrupted image")
            elif "PERMISSION_DENIED" in error_body or "UNAUTHENTICATED" in error_body:
                print(f"   ⚠️ API Key invalid or expired: {GEMINI_API_KEY[:20]}...")
            elif "RESOURCE_EXHAUSTED" in error_body:
                print(f"   ⚠️ API Rate limit exceeded. Try again in a moment.")
            else:
                print(f"   ⚠️ API Error: {error_body[:200]}")
            return None
        except requests.exceptions.ConnectionError:
            print(f"   ❌ Connection error. Check internet connection.")
            return None
        except requests.exceptions.Timeout:
            print(f"   ⚠️ Gemini API timeout (30+ seconds)")
            return None
        except Exception as e:
            print(f"   ❌ Unexpected error during API call: {str(e)[:100]}")
            return None

        # Parse Gemini response
        candidates = data.get("candidates", [])
        if not candidates:
            print("   ⚠️ Gemini returned no candidates")
            return None

        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts:
            print("   ⚠️ Gemini returned no parts")
            return None

        response_text = parts[0].get("text", "").strip()
        print(f"   📝 Gemini response: {response_text[:200]}...")
        
        # Extract JSON from response (handle markdown code blocks)
        json_str = _extract_json_from_response(response_text)
        
        if not json_str:
            print(f"   ⚠️ No JSON found in response")
            return None
        
        try:
            parsed = json.loads(json_str)
            
            # Validate and clean extracted values
            title = (parsed.get("title") or "").strip()
            author = (parsed.get("author") or "").strip()
            subtitle = (parsed.get("subtitle") or "").strip()
            publisher = (parsed.get("publisher") or "Unknown").strip()
            isbn = (parsed.get("isbn") or "Unknown").strip()
            
            # Combine title and subtitle if needed
            if subtitle and subtitle.lower() not in title.lower() and subtitle.lower() != "unknown":
                if len(subtitle) > 2:  # Valid subtitle
                    title = f"{title}: {subtitle}".strip()
            
            # Clean up author: fix common OCR errors
            if author:
                author = author.replace("$", "S")
                author = " ".join(author.split())  # Normalize whitespace
                author = author.strip()
            
            # Clean up title
            if title:
                title = " ".join(title.split())  # Normalize whitespace
                title = title.strip()
            
            # Validate title is not empty
            if not title or title.lower() == "unknown" or len(title) < 2:
                print(f"   ⚠️ Gemini returned invalid/empty title: '{title}'")
                return None
            
            # Set default author if empty
            if not author or author.lower() == "unknown" or len(author) < 2:
                author = "Unknown Author"
            
            result = {
                "title": title,
                "author": author,
                "subtitle": subtitle,
                "publisher": publisher,
                "isbn": isbn,
                "extraction_method": f"gemini-{model_name}"
            }
            
            print(f"   ✅ Gemini ({model_name}): Title='{result['title'][:60]}', Author='{result['author'][:60]}'")
            return result
            
        except json.JSONDecodeError as e:
            print(f"   ⚠️ Failed to parse JSON: {str(e)[:100]}")
            return None

    except Exception as e:
        print(f"   ❌ Unexpected error in Gemini extraction: {type(e).__name__}: {str(e)[:150]}")
        return None


def _extract_json_from_response(response_text: str) -> Optional[str]:
    """
    Extract JSON object from Gemini response text.
    Handles markdown code blocks and raw JSON.
    
    Args:
        response_text: Raw response text from Gemini
    
    Returns:
        JSON string or None if not found
    """
    json_str = None
    
    # Try to extract from markdown code blocks
    if "```json" in response_text:
        start = response_text.find("```json") + 7
        end = response_text.find("```", start)
        if end > start:
            json_str = response_text[start:end].strip()
    elif "```" in response_text:
        start = response_text.find("```") + 3
        end = response_text.find("```", start)
        if end > start:
            json_str = response_text[start:end].strip()
    else:
        # Find JSON object by looking for curly braces
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        if json_start >= 0 and json_end > json_start:
            json_str = response_text[json_start:json_end]
    
    return json_str


def validate_image_quality(image_path: str, max_retries: int = 1) -> Dict[str, any]:
    """
    Validate if an image is a real book cover with good quality.
    Detects: blurry images, non-book items, corrupted images, unclear images.
    
    Args:
        image_path: Path to the image file
        max_retries: Number of retry attempts
    
    Returns:
        Dictionary with format:
        {
            "is_valid": True/False,
            "quality": "high/medium/low",
            "issues": ["list of detected issues"],
            "message": "Human-readable validation message"
        }
    """
    
    if not GEMINI_API_KEY:
        return {
            "is_valid": False,
            "quality": "unknown",
            "issues": ["API key not configured"],
            "message": "❌ Cannot validate: Gemini API not configured"
        }
    
    if not os.path.exists(image_path):
        return {
            "is_valid": False,
            "quality": "unknown",
            "issues": ["Image file not found"],
            "message": "❌ Image file not found"
        }
    
    # Check file size
    file_size = os.path.getsize(image_path)
    if file_size == 0:
        return {
            "is_valid": False,
            "quality": "unknown",
            "issues": ["Image file is empty"],
            "message": "❌ Image file is empty (0 bytes)"
        }
    
    if file_size > 20 * 1024 * 1024:
        return {
            "is_valid": False,
            "quality": "unknown",
            "issues": ["Image file too large"],
            "message": f"❌ Image file too large ({file_size} bytes, max 20MB)"
        }
    
    # Try to validate with Gemini
    models_to_try = ["gemini-2.5-flash"]  # Use fast model for validation
    
    for model_name in models_to_try:
        for attempt in range(max_retries):
            try:
                result = _validate_image_with_gemini(image_path, model_name)
                if result:
                    return result
            except Exception as e:
                print(f"   ⚠️ Validation attempt {attempt + 1} failed: {str(e)[:100]}")
                if attempt < max_retries - 1:
                    continue
                break
    
    return {
        "is_valid": False,
        "quality": "unknown",
        "issues": ["Validation service temporarily unavailable"],
        "message": "❌ Could not validate image (API error). Please try again."
    }


def _validate_image_with_gemini(image_path: str, model_name: str) -> Optional[Dict[str, any]]:
    """
    Use Gemini to validate if an image is a valid book cover.
    
    Args:
        image_path: Path to image file
        model_name: Gemini model name
    
    Returns:
        Validation result or None on error
    """
    try:
        # Read and encode image
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        
        # Validation prompt
        prompt = """Analyze this image and validate if it's a real, valid book cover. Check for:

1. IS IT A BOOK COVER? Must have text (title, author visible)
2. IMAGE QUALITY: Is it clear or blurry?
3. CONTENT: Is it appropriate (not completely black, white, corrupted)?
4. CLARITY: Can text be read clearly?

Return ONLY a JSON response with this exact format (no additional text):
{
  "is_book_cover": true/false,
  "is_clear": true/false,
  "is_valid": true/false,
  "quality": "high/medium/low",
  "issues": ["list of any problems found"],
  "reason": "Brief explanation"
}

Rules:
- is_valid should be true ONLY if: is_book_cover=true AND is_clear=true AND image is not corrupted
- Mark as "low" quality if: blurry, hard to read text, poor lighting
- Mark as "medium" quality if: readable but not perfect
- Mark as "high" quality if: clear, crisp, readable
- List specific issues: "blurry", "not a book cover", "text unreadable", "corrupted image", "completely blank/black", "not a book item"
"""

        # Determine MIME type
        img_ext = os.path.splitext(image_path)[1].lower()
        mime_type_map = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }
        mime_type = mime_type_map.get(img_ext, 'image/png')
        
        # Build request
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": b64,
                            }
                        },
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "topK": 1,
                "topP": 0.8,
            }
        }
        
        print(f"   📡 Validating image with {model_name}...")
        res = requests.post(url, json=payload, params={"key": GEMINI_API_KEY}, timeout=30)
        
        if res.status_code != 200:
            print(f"   ⚠️ Validation API error: {res.status_code}")
            return None
        
        res.raise_for_status()
        data = res.json()
        
        # Extract response
        candidates = data.get("candidates", [])
        if not candidates:
            return None
        
        parts = candidates[0].get("content", {}).get("parts", [])
        if not parts:
            return None
        
        response_text = parts[0].get("text", "").strip()
        json_str = _extract_json_from_response(response_text)
        
        if not json_str:
            return None
        
        parsed = json.loads(json_str)
        
        # Format result
        is_valid = parsed.get("is_valid", False)
        quality = parsed.get("quality", "low")
        issues = parsed.get("issues", [])
        reason = parsed.get("reason", "")
        
        if is_valid:
            message = f"✅ Valid book cover detected (Quality: {quality})"
        else:
            message = f"❌ Invalid image: {reason}"
            if issues:
                message += f"\nIssues: {', '.join(issues)}"
        
        return {
            "is_valid": is_valid,
            "quality": quality,
            "issues": issues,
            "message": message
        }
        
    except json.JSONDecodeError:
        return None
    except Exception as e:
        print(f"   ⚠️ Validation error: {str(e)[:100]}")
        return None


def validate_gemini_api_key() -> bool:
    """
    Validate that GEMINI_API_KEY is set.
    
    Returns:
        True if API key is set, False otherwise
    """
    if not GEMINI_API_KEY:
        print("⚠️ GEMINI_API_KEY not set in .env file")
        print("   Get a free key at: https://aistudio.google.com/apikey")
        return False
    return True
