import sqlite3
from pathlib import Path
from schemes import schemes

DB_NAME = Path(__file__).resolve().parent / "yojana.db"


def get_connection():
    return sqlite3.connect(DB_NAME)


def initialize_database():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS schemes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                description TEXT,
                benefits TEXT,
                eligibility TEXT,
                documents TEXT,
                application TEXT,
                category TEXT DEFAULT 'general',
                icon TEXT DEFAULT '🌿'
            )
        """)
        columns = {row[1] for row in cursor.execute("PRAGMA table_info(schemes)").fetchall()}
        if "category" not in columns:
            cursor.execute("ALTER TABLE schemes ADD COLUMN category TEXT DEFAULT 'general'")
        if "icon" not in columns:
            cursor.execute("ALTER TABLE schemes ADD COLUMN icon TEXT DEFAULT '🌿'")
        for scheme in schemes:
            cursor.execute("""
                INSERT INTO schemes (name, description, benefits, eligibility, documents, application, category, icon)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    description=excluded.description,
                    benefits=excluded.benefits,
                    eligibility=excluded.eligibility,
                    documents=excluded.documents,
                    application=excluded.application,
                    category=excluded.category,
                    icon=excluded.icon
            """, (scheme["name"], scheme["description"], scheme["benefits"], scheme["eligibility"], scheme["documents"], scheme["application"], scheme["category"], scheme["icon"]))


def get_all_schemes(query=""):
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        if query:
            search = f"%{query}%"
            rows = conn.execute("""
                SELECT * FROM schemes
                WHERE name LIKE ? OR description LIKE ? OR benefits LIKE ?
                OR eligibility LIKE ? OR category LIKE ?
                ORDER BY name
            """, (search, search, search, search, search)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM schemes ORDER BY name").fetchall()
        return [dict(row) for row in rows]


def get_scheme_by_id(scheme_id):
    with get_connection() as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM schemes WHERE id = ?", (scheme_id,)).fetchone()
        return dict(row) if row else None
