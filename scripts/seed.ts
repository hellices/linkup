// Seed script: Insert sample posts into linkup.db
// Run: npx tsx scripts/seed.ts
import Database from "better-sqlite3";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const DB_PATH = path.join(process.cwd(), "linkup.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Ensure tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    authorId TEXT NOT NULL,
    authorName TEXT NOT NULL,
    text TEXT NOT NULL,
    tags TEXT,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    mode TEXT DEFAULT 'both',
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
`);

const now = new Date();
const expires24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
const expires72h = new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString();
const expires7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

const samples = [
  {
    authorName: "Minsu Kim",
    text: "I have a question about HPA configuration on an AKS cluster. Has anyone tried scaling based on custom metrics and willing to share their experience?",
    tags: ["AKS", "Kubernetes", "HPA"],
    lat: 47.6423,
    lng: -122.1391,
    mode: "online",
    expiresAt: expires72h,
  },
  {
    authorName: "Sarah Chen",
    text: "Looking for someone to pair-program on a React + Azure Maps integration. I have the Maps SDK working but need help with real-time marker updates.",
    tags: ["React", "Azure Maps", "pair-programming"],
    lat: 47.6740,
    lng: -122.1215,
    mode: "both",
    expiresAt: expires7d,
  },
  {
    authorName: "Jiyoung Park",
    text: "I'm starting a study group on Entra ID Conditional Access policy configuration. If you're interested, hit Join!",
    tags: ["Entra ID", "Security", "Study"],
    lat: 47.6500,
    lng: -122.1350,
    mode: "offline",
    expiresAt: expires7d,
  },
  {
    authorName: "Alex Kim",
    text: "Anyone with experience fine-tuning GPT-4o on AI Foundry? I'm curious about best practices for preparing multilingual datasets.",
    tags: ["AI Foundry", "GPT-4o", "Fine-tuning"],
    lat: 47.6800,
    lng: -122.1100,
    mode: "online",
    expiresAt: expires24h,
  },
  {
    authorName: "Haeun Lee",
    text: "Anyone want to grab lunch at the Building 33 cafeteria today? Would love to chat about Kubernetes networking.",
    tags: ["Lunch", "Networking"],
    lat: 47.6455,
    lng: -122.1302,
    mode: "offline",
    expiresAt: expires24h,
  },
  {
    authorName: "David Park",
    text: "Starting a project to automate Azure infrastructure with Terraform. Looking for folks interested in IaC to join!",
    tags: ["Terraform", "IaC", "Azure"],
    lat: 47.6600,
    lng: -122.1400,
    mode: "both",
    expiresAt: expires72h,
  },
  {
    authorName: "Subin Jung",
    text: "Anyone interested in a reading group for the MCP protocol spec? Planning to meet for 1 hour every Tuesday afternoon.",
    tags: ["MCP", "Protocol", "Study"],
    lat: 47.6700,
    lng: -122.1250,
    mode: "offline",
    expiresAt: expires7d,
  },
  {
    authorName: "Emily Zhang",
    text: "Sharing my experience developing GitHub Copilot extensions. I've put together a guide on building custom agents in VS Code.",
    tags: ["Copilot", "VS Code", "Extensions"],
    lat: 47.6550,
    lng: -122.1180,
    mode: "online",
    expiresAt: expires72h,
  },
];

const insert = db.prepare(`
  INSERT INTO posts (id, authorId, authorName, text, tags, lat, lng, mode, createdAt, expiresAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction(() => {
  for (const s of samples) {
    insert.run(
      uuidv4(),
      `sample-${s.authorName.toLowerCase().replace(/\s+/g, "-")}`,
      s.authorName,
      s.text,
      JSON.stringify(s.tags),
      s.lat,
      s.lng,
      s.mode,
      now.toISOString(),
      s.expiresAt
    );
  }
});

insertMany();

console.log(`✅ ${samples.length} sample posts have been inserted.`);
db.close();
