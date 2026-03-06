"""
Check available Gemini models
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

print("\n🔍 Checking available Gemini models...\n")

url = "https://generativelanguage.googleapis.com/v1beta/models"
params = {"key": GEMINI_API_KEY}

try:
    res = requests.get(url, params=params, timeout=10)
    print(f"Status: {res.status_code}\n")
    
    if res.status_code == 200:
        data = res.json()
        models = data.get("models", [])
        
        print(f"📚 Available Models ({len(models)} total):\n")
        
        for model in models:
            name = model.get("name", "N/A")
            display_name = model.get("displayName", "N/A")
            # Extract just the model ID
            model_id = name.split("/")[-1] if "/" in name else name
            
            print(f"   • {model_id}")
            
        print("\n✅ Use one of these model names in the code\n")
    else:
        print(f"Error: {res.text}")
        
except Exception as e:
    print(f"Error: {e}")
