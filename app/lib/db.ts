// T012: DB initialization with better-sqlite3
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "linkup.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");

    // Create tables per data-model.md
    _db.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        authorId TEXT NOT NULL,
        authorName TEXT NOT NULL,
        text TEXT NOT NULL,
        tags TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        mode TEXT DEFAULT 'both',
        category TEXT DEFAULT 'discussion' CHECK (category IN ('question', 'discussion', 'share', 'help', 'meetup')),
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        expiresAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS engagements (
        postId TEXT NOT NULL,
        userId TEXT NOT NULL,
        intent TEXT NOT NULL CHECK (intent IN ('interested', 'join')),
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (postId, userId),
        FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_posts_expires ON posts(expiresAt);
      CREATE INDEX IF NOT EXISTS idx_posts_location ON posts(lat, lng);
    `);

    // Migration: add category column for existing databases (FR-009)
    const columns = _db.pragma("table_info(posts)") as { name: string }[];
    if (!columns.some((c) => c.name === "category")) {
      _db.exec(
        `ALTER TABLE posts ADD COLUMN category TEXT DEFAULT 'discussion'
         CHECK (category IN ('question', 'discussion', 'share', 'help', 'meetup'))`
      );
      console.log("[DB] Migration: added category column to posts table");
    }

    // Constitution 2.1: Mandatory TTL — "automatic deletion" on expiry.
    // Startup sweep deletes expired posts so data is not retained permanently.
    const deleted = _db
      .prepare(`DELETE FROM posts WHERE datetime(expiresAt) <= datetime('now')`)
      .run();
    if (deleted.changes > 0) {
      console.log(
        `[DB] Startup cleanup: deleted ${deleted.changes} expired post(s)`
      );
    }
  }
  return _db;
}
