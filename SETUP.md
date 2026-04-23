# ⚡ Quick Start — Librarium

## 1. Install dependencies

```powershell
cd BACKEND
pip install -r requirements.txt
```

## 2. Configure Gemini API (REQUIRED)

1. Get a free key: https://aistudio.google.com/apikey  
   - Click "Create API key"
   - Select your Google Cloud project
   - Copy the key
   - **No credit card needed for free tier**
   
2. In `BACKEND/.env`, set:
   ```
   GEMINI_API_KEY=your_actual_key_here
   ```

**Free tier benefits:**
- ✅ 60 API calls per minute
- ✅ Unlimited daily usage
- ✅ Perfect for personal/student projects

## 3. Start backend

```powershell
cd BACKEND
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Wait for: `✅ Gemini API ready! Backend is fully initialized.`

## 4. Open app

Open **`Frontend/index.html`** in your browser (double-click it).

On Windows: Double-click **`START_APP.bat`** to start everything automatically.

**Login:** `admin` / `admin123` — or click "Guest" tab → **Continue as Guest** (no login).

---

## What you can do

**Admin Workflows (via Sidebar Navigation):**

1. **🔍 Search:**
   - Search books by title or author
   - Filter results by category using the category chips
   - Typo-tolerant fuzzy search with "Did you mean?" suggestions

2. **📤 Upload Image:**
   - Upload a book cover image
   - System extracts title/author using **Google Gemini 2.5 Vision API**
   - Review extracted data in an editable card (amber highlight)
   - Edit any field if Gemini made mistakes
   - Click **"Save to Database"** to confirm
   - OR Click **"Cancel"** to discard

3. **✏️ Add Manually:**
   - Enter title, author, quantity, shelf location directly
   - Assign a category from the dropdown (or create a new one)
   - Live preview panel shows book card as you type
   - Click **"Add Book"** to save immediately

4. **📋 Manage Books:**
   - Books load automatically when you navigate to this section
   - Filter books with the inline search bar
   - Click **"Edit"** button on any book → opens edit modal
   - Modify quantity/shelf/title/author/category, click **"Save Changes"**

5. **🔧 Debug Tools:**
   - View all books in database
   - List all registered users
   - Reset database (caution: deletes all books)

**Customer (Guest):** Search by title or author, filter by category. No login needed.

---

## Issues

- **Clicks do nothing:** Ensure backend is running at http://127.0.0.1:8000/ and refresh (Ctrl+Shift+R). Check browser console (F12).  
- **Backend won't start:** Use Python 3.8+; install missing packages; stop other process (Ctrl+C).  
- **Gemini API key error:** Verify `GEMINI_API_KEY` is set correctly in `BACKEND/.env` and is valid.  
- **Extraction fails:** Check that book cover image is clear and text is readable. Try with a different image.
- **Port in use:** Run backend on another port, e.g. `uvicorn main:app --port 8001`, and set `API_URL` in `Frontend/script.js` to `http://127.0.0.1:8001`.
