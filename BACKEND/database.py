import sqlite3
import os
import difflib

# Use absolute path for database in the backend directory
DB_PATH = os.path.join(os.path.dirname(__file__), "books.db")

def get_connection():
    """Get database connection with proper settings for concurrent access"""
    conn = sqlite3.connect(DB_PATH, timeout=5.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def create_table():
    """Create books and categories tables if they don't exist"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            shelf TEXT NOT NULL,
            isbn TEXT,
            book_number TEXT,
            category TEXT
        )
        """)
        # Add columns if table already existed without them
        for col in ["isbn", "book_number", "category"]:
            try:
                cursor.execute(f"ALTER TABLE books ADD COLUMN {col} TEXT")
            except sqlite3.OperationalError:
                pass  # Column already exists
        
        # Categories table for dropdown options
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        )
        """)
        
        # Indexes for fast search
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_books_title ON books(LOWER(title))")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_books_author ON books(LOWER(author))")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_books_isbn ON books(isbn)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_books_book_number ON books(book_number)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_books_category ON books(category)")
        conn.commit()
        conn.close()
        print(f"✅ Database initialized at: {DB_PATH}")
        return True
    except Exception as e:
        print(f"❌ Error creating table: {e}")
        return False

def insert_book(title, author, quantity, shelf, isbn=None, book_number=None, category=None):
    """Insert a new book into the database."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO books (title, author, quantity, shelf, isbn, book_number, category)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (title, author, quantity, shelf, isbn, book_number, category))
        conn.commit()
        conn.close()
        print(f"✅ Book saved: '{title}' by '{author}' (Qty: {quantity}, Shelf: {shelf}, Book#: {book_number}, Cat: {category})")
        return True
    except Exception as e:
        print(f"❌ Error inserting book: {e}")
        return False

def search_books(keyword, category=None):
    """Search for books by title or author (partial match with LIKE), optionally filtered by category"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        if category:
            query = """
            SELECT title, author, quantity, shelf, book_number, category
            FROM books
            WHERE (LOWER(title) LIKE LOWER(?) OR LOWER(author) LIKE LOWER(?))
              AND LOWER(category) = LOWER(?)
            ORDER BY title ASC
            """
            cursor.execute(query, (f"%{keyword}%", f"%{keyword}%", category))
        else:
            query = """
            SELECT title, author, quantity, shelf, book_number, category
            FROM books
            WHERE LOWER(title) LIKE LOWER(?) OR LOWER(author) LIKE LOWER(?)
            ORDER BY title ASC
            """
            cursor.execute(query, (f"%{keyword}%", f"%{keyword}%"))
        results = cursor.fetchall()
        conn.close()
        
        print(f"✅ Search '{keyword}' (cat: {category}) returned {len(results)} results")
        return results
    except Exception as e:
        print(f"❌ Error searching books: {e}")
        return []


# Minimum similarity ratio for fuzzy match (0.0–1.0). 0.5 = typo-tolerant, 0.6 = stricter
FUZZY_CUTOFF = 0.5


def search_books_fuzzy(keyword):
    """
    Typo-tolerant (fuzzy) search using difflib (built-in, no extra install).
    Scores each book by best match of query against title or author.
    Returns (list of rows, suggested_match_string or None).
    """
    if not keyword or not str(keyword).strip():
        return [], None
    keyword = str(keyword).strip().lower()
    books = get_all_books()
    if not books:
        return [], None
    scored = []
    for row in books:
        title = (row[0] or "").strip()
        author = (row[1] or "").strip()
        title_l, author_l = title.lower(), author.lower()
        r_title = difflib.SequenceMatcher(None, keyword, title_l).ratio()
        r_author = difflib.SequenceMatcher(None, keyword, author_l).ratio()
        score = max(r_title, r_author)
        scored.append((score, row))
    scored.sort(key=lambda x: -x[0])
    results = [row for score, row in scored if score >= FUZZY_CUTOFF]
    suggested = scored[0][1][0] if scored and scored[0][0] >= FUZZY_CUTOFF else None
    if results:
        print(f"✅ Fuzzy search '{keyword}' returned {len(results)} result(s), best match: {suggested}")
    return results, suggested

def get_all_books():
    """Get all books from the database"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT title, author, quantity, shelf, isbn, book_number, category FROM books ORDER BY title ASC")
        results = cursor.fetchall()
        conn.close()
        return results
    except Exception as e:
        print(f"❌ Error getting all books: {e}")
        return []
def delete_all_books():
    """Delete all books from database (for testing/reset)"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM books")
        conn.commit()
        conn.close()
        print(f"✅ All books deleted from database")
        return True
    except Exception as e:
        print(f"❌ Error deleting books: {e}")
        return False

def update_book(book_id, title=None, author=None, quantity=None, shelf=None, book_number=None, category=None):
    """Update a book's details"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        updates = []
        params = []
        
        if title is not None:
            updates.append("title = ?")
            params.append(title)
        if author is not None:
            updates.append("author = ?")
            params.append(author)
        if quantity is not None:
            updates.append("quantity = ?")
            params.append(quantity)
        if shelf is not None:
            updates.append("shelf = ?")
            params.append(shelf)
        if book_number is not None:
            updates.append("book_number = ?")
            params.append(book_number)
        if category is not None:
            updates.append("category = ?")
            params.append(category)
        
        if not updates:
            return False  # Nothing to update
        
        params.append(book_id)
        query = f"UPDATE books SET {', '.join(updates)} WHERE id = ?"
        
        cursor.execute(query, params)
        conn.commit()
        
        if cursor.rowcount > 0:
            print(f"✅ Book ID {book_id} updated successfully")
            return True
        else:
            print(f"❌ Book ID {book_id} not found")
            return False
            
    except Exception as e:
        print(f"❌ Error updating book: {e}")
        return False

def get_books_with_ids():
    """Get all books with their IDs (for editing)"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, title, author, quantity, shelf, isbn, book_number, category FROM books ORDER BY title ASC")
        results = cursor.fetchall()
        conn.close()
        return results
    except Exception as e:
        print(f"❌ Error getting books with IDs: {e}")
        return []

# ====================== CATEGORY CRUD ======================

def insert_category(name):
    """Insert a new category. Returns True if inserted, False if already exists or error."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO categories (name) VALUES (?)", (name.strip(),))
        conn.commit()
        conn.close()
        print(f"✅ Category added: '{name}'")
        return True
    except sqlite3.IntegrityError:
        print(f"ℹ️ Category already exists: '{name}'")
        return False
    except Exception as e:
        print(f"❌ Error inserting category: {e}")
        return False

def get_all_categories():
    """Get all categories sorted alphabetically"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name FROM categories ORDER BY name ASC")
        results = cursor.fetchall()
        conn.close()
        return results
    except Exception as e:
        print(f"❌ Error getting categories: {e}")
        return []

def delete_category(category_id):
    """Delete a category by ID"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM categories WHERE id = ?", (category_id,))
        conn.commit()
        deleted = cursor.rowcount > 0
        conn.close()
        if deleted:
            print(f"✅ Category ID {category_id} deleted")
        return deleted
    except Exception as e:
        print(f"❌ Error deleting category: {e}")
        return False

def get_distinct_categories():
    """Get unique categories actually used in the books table (for public display)"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
        SELECT DISTINCT category FROM books
        WHERE category IS NOT NULL AND category != ''
        ORDER BY category ASC
        """)
        results = [row[0] for row in cursor.fetchall()]
        conn.close()
        return results
    except Exception as e:
        print(f"❌ Error getting distinct categories: {e}")
        return []

def get_books_by_category(category):
    """Get all books belonging to a specific category"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
        SELECT title, author, quantity, shelf, book_number, category
        FROM books
        WHERE LOWER(category) = LOWER(?)
        ORDER BY title ASC
        """, (category,))
        results = cursor.fetchall()
        conn.close()
        print(f"✅ Category '{category}' returned {len(results)} books")
        return results
    except Exception as e:
        print(f"❌ Error getting books by category: {e}")
        return []
