"""
Simple test script to verify Gemini API configuration
Run this to diagnose API issues
"""

import os
import sys
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

print("\n" + "="*70)
print("🔍 GEMINI API DIAGNOSTIC TEST")
print("="*70 + "\n")

# Test 1: Check if API key is set
print("1️⃣  CHECKING API KEY...")
if not GEMINI_API_KEY:
    print("   ❌ GEMINI_API_KEY is NOT set in .env file")
    print("   ✅ SOLUTION:")
    print("      a) Go to: https://aistudio.google.com/apikey")
    print("      b) Click 'Create API key'")
    print("      c) Copy the key")
    print("      d) Open BACKEND/.env file")
    print("      e) Set: GEMINI_API_KEY=your_key_here")
    sys.exit(1)
else:
    print(f"   ✅ API Key found: {GEMINI_API_KEY[:20]}...")

# Test 2: Check internet connection
print("\n2️⃣  CHECKING INTERNET CONNECTION...")
try:
    response = requests.get("https://www.google.com", timeout=5)
    print("   ✅ Internet connection OK")
except requests.exceptions.RequestException as e:
    print(f"   ❌ Internet connection failed: {e}")
    print("   ✅ SOLUTION: Check your internet connection")
    sys.exit(1)

# Test 3: Test Gemini API with simple request
print("\n3️⃣  TESTING GEMINI API...")
try:
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": "Respond with exactly: GEMINI_API_WORKS"
                    }
                ]
            }
        ]
    }
    
    print(f"   📡 Calling: {url}")
    print(f"   🔑 Using API key: {GEMINI_API_KEY[:20]}...")
    
    res = requests.post(url, json=payload, params={"key": GEMINI_API_KEY}, timeout=30)
    
    print(f"   📊 Response status: {res.status_code}")
    
    if res.status_code == 200:
        print("   ✅ API responded successfully!")
        data = res.json()
        if "candidates" in data:
            print("   ✅ Response format is valid")
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            print(f"   📝 Response: {text[:100]}")
    else:
        print(f"   ❌ API Error: {res.status_code}")
        print(f"   📝 Response: {res.text[:300]}")
        
        if "INVALID_ARGUMENT" in res.text:
            print("\n   ⚠️ INVALID_ARGUMENT - Check image format")
        elif "PERMISSION_DENIED" in res.text or "UNAUTHENTICATED" in res.text:
            print("\n   ⚠️ API Key is invalid or expired")
            print("   ✅ SOLUTION: Get a new key from https://aistudio.google.com/apikey")
        elif "RESOURCE_EXHAUSTED" in res.text:
            print("\n   ⚠️ API rate limit exceeded")
            print("   ✅ SOLUTION: Wait a moment and try again")
        sys.exit(1)
        
except requests.exceptions.Timeout:
    print("   ❌ API request timeout (took more than 30 seconds)")
    print("   ✅ SOLUTION: Check internet speed or try with different image")
    sys.exit(1)
except requests.exceptions.RequestException as e:
    print(f"   ❌ API request failed: {e}")
    sys.exit(1)
except Exception as e:
    print(f"   ❌ Unexpected error: {e}")
    sys.exit(1)

print("\n" + "="*70)
print("✅ ALL TESTS PASSED - API IS WORKING!")
print("="*70 + "\n")
print("🚀 Ready to use Gemini Vision API for book cover extraction.\n")
