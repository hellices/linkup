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
        userName TEXT NOT NULL DEFAULT '',
        intent TEXT NOT NULL CHECK (intent IN ('interested', 'join')),
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (postId, userId),
        FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_posts_expires ON posts(expiresAt);
      CREATE INDEX IF NOT EXISTS idx_posts_location ON posts(lat, lng);

      CREATE TABLE IF NOT EXISTS replies (
        id TEXT PRIMARY KEY,
        postId TEXT NOT NULL,
        authorId TEXT NOT NULL,
        authorName TEXT NOT NULL,
        text TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS shared_documents (
        id TEXT PRIMARY KEY,
        postId TEXT NOT NULL,
        sharerId TEXT NOT NULL,
        sharerName TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        sourceType TEXT NOT NULL CHECK (sourceType IN ('onedrive', 'sharepoint', 'email', 'link')),
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
        UNIQUE (postId, url)
      );

      CREATE INDEX IF NOT EXISTS idx_replies_post_created ON replies(postId, createdAt DESC, id);
      CREATE INDEX IF NOT EXISTS idx_shared_docs_post_created ON shared_documents(postId, createdAt ASC, id);
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

    // Migration: add userName column to engagements for existing databases
    const engCols = _db.pragma("table_info(engagements)") as { name: string }[];
    if (!engCols.some((c) => c.name === "userName")) {
      _db.exec(`ALTER TABLE engagements ADD COLUMN userName TEXT NOT NULL DEFAULT ''`);
      console.log("[DB] Migration: added userName column to engagements table");
    }

    // Migration: expand sourceType CHECK to include 'link' for user-shared documents
    // SQLite can't ALTER CHECK constraints, so recreate the table if needed
    try {
      const tableInfo = _db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'shared_documents'`).get() as { sql: string } | undefined;
      if (tableInfo?.sql && !tableInfo.sql.includes("'link'")) {
        const migrateSharedDocuments = _db.transaction(() => {
          _db!.exec(`
            CREATE TABLE shared_documents_new (
              id TEXT PRIMARY KEY,
              postId TEXT NOT NULL,
              sharerId TEXT NOT NULL,
              sharerName TEXT NOT NULL,
              title TEXT NOT NULL,
              url TEXT NOT NULL,
              sourceType TEXT NOT NULL CHECK (sourceType IN ('onedrive', 'sharepoint', 'email', 'link')),
              createdAt TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
              UNIQUE (postId, url)
            );
            INSERT INTO shared_documents_new SELECT * FROM shared_documents;
            DROP TABLE shared_documents;
            ALTER TABLE shared_documents_new RENAME TO shared_documents;
            CREATE INDEX IF NOT EXISTS idx_shared_docs_post_created ON shared_documents(postId, createdAt ASC, id);
          `);
        });
        migrateSharedDocuments();
        console.log("[DB] Migration: expanded shared_documents sourceType CHECK to include 'link'");
      }
    } catch {
      // table may not exist yet or migration already applied
    }

    // Constitution 2.1: Mandatory TTL — "automatic deletion" on expiry.
    // Startup sweep deletes expired posts so data is not retained permanently.
    const deleted = _db
      .prepare(`DELETE FROM posts WHERE expiresAt <= datetime('now')`)
      .run();
    if (deleted.changes > 0) {
      console.log(
        `[DB] Startup cleanup: deleted ${deleted.changes} expired post(s)`
      );
    }
  }
  return _db;
}
