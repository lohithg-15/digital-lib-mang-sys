# 📚 Librarium — Digital Library Management System

An intelligent book management system with AI-powered book identification using Gemini Vision API, Open Library lookup, fuzzy search, and role-based access control. Features a warm editorial design with sidebar navigation.

## ✨ Features

### Frontend
- Warm editorial design — Playfair Display + DM Sans fonts
- Sidebar navigation with role-based menu items
- Book search with colored spine fallback cards
- Live preview while adding a new book
- Modal-based book editing
- Quick-search genre chips
- Responsive — works on mobile and desktop
- Fuzzy / typo-tolerant search with "Did you mean?" suggestions

### Backend
- FastAPI + SQLite (no extra database setup needed)
- JWT-based authentication with 24-hour tokens
- Role-based access (Admin / Customer)
- AI-powered book cover extraction via Google Gemini Vision API
- Manual book entry support
- Fuzzy search using Python's built-in difflib
- Auto-creates database and default admin on first run

## 🔐 Security

- **DO NOT commit `.env`** — Contains API keys. It's in `.gitignore`.
- Always create `.env` locally with your own keys.
- Change the default admin password in production.

## 📁 Project Structure

```
Librarium/
├── BACKEND/
│   ├── main.py              ← FastAPI app (all routes)
│   ├── database.py          ← SQLite database operations
│   ├── auth.py              ← JWT authentication & users
│   ├── gemini_service.py    ← Google Gemini Vision API integration
│   ├── book_lookup.py       ← Open Library API identification
│   ├── requirements.txt     ← Python dependencies
│   ├── .env                 ← API keys (do not commit)
│   └── uploads/             ← Uploaded images
├── Frontend/
│   ├── index.html           ← Main HTML structure
│   ├── style.css            ← All styling
│   └── script.js            ← All frontend logic
├── START_APP.bat             ← Windows one-click startup
├── SETUP.md                  ← Quick setup instructions
├── .gitignore
└── README.md
```

## 🚀 Quick Start

### 1. Install dependencies

```powershell
cd BACKEND
pip install -r requirements.txt
```

### 2. Configure Gemini API (REQUIRED)

1. Get a FREE key: https://aistudio.google.com/apikey  
2. In `BACKEND/.env`, update: `GEMINI_API_KEY=your_actual_key`
3. No credit card required for free tier (60 calls/min)

### 3. Start backend

```powershell
cd BACKEND
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Wait for: `✅ Gemini API ready! Backend is fully initialized.`

### 4. Open app

Open `Frontend/index.html` in your browser (just double-click it).

On Windows: Double-click `START_APP.bat` to start everything automatically.

## 🔑 Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Guest | — | Click Guest tab → Continue |

## 🛠 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | — | Health check |
| GET | `/status/` | — | Backend status |
| GET | `/search-book/?query=...` | — | Search (partial + fuzzy) |
| POST | `/auth/login/` | — | Login |
| POST | `/auth/register/` | — | Register |
| GET | `/auth/me/` | Bearer | Current user |
| POST | `/validate-image/` | Admin | Validate image quality |
| POST | `/upload-book/` | Admin | Upload & extract from image |
| POST | `/save-extracted-book/` | Admin | Save extracted book (after review) |
| POST | `/add-book-manual/` | Admin | Add book manually |
| GET | `/books-for-edit/` | Admin | Get books with IDs |
| PUT | `/update-book/` | Admin | Update book (qty/shelf) |
| GET | `/debug/all-books/` | Admin | List all books |
| POST | `/debug/reset-database/` | Admin | Reset DB |
| GET | `/debug/list-users/` | Admin | List users |

## 📊 Database

**books:** id, title, author, quantity, shelf, isbn (indexed for search)  
**users:** id, username, password_hash, role, created_at, last_login, is_active  

## 🧰 Tech Stack

- **Backend:** FastAPI, Uvicorn, SQLite3  
- **Frontend:** HTML5, CSS3, JavaScript (Playfair Display + DM Sans)  
- **Vision AI:** Google Gemini 1.5 Vision API  
- **Identification:** Open Library API (free, no key)  
- **Search:** LIKE + difflib fuzzy matching  
- **Auth:** PyJWT, PBKDF2-SHA256  

## 🔧 Troubleshooting

- **Port in use:** Backend `--port 8001`; update `API_URL` in `Frontend/script.js`.  
- **Login/UI issues:** Hard refresh (Ctrl+Shift+R), confirm backend at http://127.0.0.1:8000/  
- **Gemini API key missing:** Set `GEMINI_API_KEY` in `BACKEND/.env`
- **Extraction fails:** Check image quality, ensure cover text is visible, verify API key.  
- **Change JWT secret:** Set `SECRET_KEY` in `BACKEND/.env`.  

## License

MIT.
