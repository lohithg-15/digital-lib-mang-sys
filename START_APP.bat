@echo off
REM Librarium — Digital Library Management System - Startup Script

echo.
echo ============================================================
echo       LIBRARIUM - DIGITAL LIBRARY MANAGEMENT SYSTEM
echo                    STARTUP SCRIPT
echo ============================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    pause
    exit /b 1
)

echo [1/3] Checking database...
cd /d "%~dp0BACKEND"
python -c "from database import get_all_books; books = get_all_books(); print(f'Database ready: {len(books)} books found')"

if errorlevel 1 (
    echo ERROR: Database check failed
    pause
    exit /b 1
)

echo.
echo [2/3] Starting BACKEND (FastAPI on port 8000)...
echo         Running: uvicorn main:app --reload --host 127.0.0.1 --port 8000
echo.
start "Librarium - BACKEND" cmd /k "cd /d %~dp0BACKEND && uvicorn main:app --reload --host 127.0.0.1 --port 8000"

REM Wait for backend to start
echo [3/3] Waiting for backend to start (10 seconds)...
timeout /t 10 /nobreak

echo.
echo Opening Frontend in browser...
start "" "%~dp0Frontend\index.html"

echo.
echo ============================================================
echo          ✅ LIBRARIUM IS STARTING
echo ============================================================
echo.
echo BACKEND:  http://127.0.0.1:8000
echo FRONTEND: Open Frontend\index.html in your browser
echo.
echo ============================================================
echo           💡 TIPS
echo ============================================================
echo.
echo 1. One new window will open:
echo    - BACKEND window (Python/Uvicorn)
echo.
echo 2. Keep the BACKEND window open while using the application
echo.
echo 3. To stop:
echo    - Type Ctrl+C in the BACKEND window OR close it
echo.
echo 4. If you see "Address already in use":
echo    - Close the existing application
echo    - Or change the port number (8000)
echo.
echo 5. The browser will open automatically with Frontend\index.html
echo    If not, manually open: Frontend\index.html
echo.
echo 6. Login: admin / admin123 (or use Guest mode)
echo.
echo ============================================================
echo.

pause
