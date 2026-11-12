import sqlite3
from schemes import schemes

DB_NAME = "yojana.db"


def get_connection():
    return sqlite3.connect(DB_NAME)


def initialize_database():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""CREATE TABLE IF NOT EXISTS schemes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        description TEXT,
        benefits TEXT,
        eligibility TEXT,
        documents TEXT,
        application TEXT,
        category TEXT DEFAULT 'General',
        keywords TEXT DEFAULT '',
        official_url TEXT DEFAULT ''
    )""")
    existing = {row[1] for row in cursor.execute("PRAGMA table_info(schemes)").fetchall()}
    for column, definition in [("category", "TEXT DEFAULT 'General'"), ("keywords", "TEXT DEFAULT ''"), ("official_url", "TEXT DEFAULT ''")]:
        if column not in existing:
            cursor.execute(f"ALTER TABLE schemes ADD COLUMN {column} {definition}")
    cursor.execute("DELETE FROM schemes WHERE name IN (?, ?, ?, ?)", ("PM-KISAN", "Ayushman Bharat", "PM Awas Yojana", "PM Ujjwala Yojana"))
    for scheme in schemes:
        cursor.execute("""INSERT INTO schemes (name, description, benefits, eligibility, documents, application, category, keywords, official_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET description=excluded.description, benefits=excluded.benefits,
            eligibility=excluded.eligibility, documents=excluded.documents, application=excluded.application,
            category=excluded.category, keywords=excluded.keywords, official_url=excluded.official_url""",
            (scheme["name"], scheme["description"], scheme["benefits"], scheme["eligibility"], scheme["documents"], scheme["application"], scheme["category"], scheme["keywords"], scheme["official_url"]))
    conn.commit()
    conn.close()


def get_all_schemes(query=""):
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    if query:
        search = f"%{query}%"
        cursor.execute("""SELECT * FROM schemes WHERE name LIKE ? OR description LIKE ? OR benefits LIKE ? OR category LIKE ? OR keywords LIKE ? ORDER BY name""", (search, search, search, search, search))
    else:
        cursor.execute("SELECT * FROM schemes ORDER BY category, name")
    result = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return result


def get_scheme_by_id(scheme_id):
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM schemes WHERE id = ?", (scheme_id,))
    result = cursor.fetchone()
    conn.close()
    return dict(result) if result else None
