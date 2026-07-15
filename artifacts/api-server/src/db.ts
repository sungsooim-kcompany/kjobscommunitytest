import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";

const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, "kjobs.db"));

// WAL mode for better concurrency
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    is_blocked INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    view_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Seed master account if not exists. Password comes from the MASTER_PASSWORD
// env var; without it a random one is generated and printed to the log once.
const master = db
  .prepare("SELECT id, password_hash FROM users WHERE username = ?")
  .get("master") as { id: number; password_hash: string } | undefined;

const envMasterPassword = process.env["MASTER_PASSWORD"];

if (!master) {
  const initialPassword =
    envMasterPassword ?? crypto.randomBytes(12).toString("base64url");
  const hash = bcrypt.hashSync(initialPassword, 12);
  db.prepare(
    "INSERT INTO users (username, password_hash, nickname, role) VALUES (?, ?, ?, ?)"
  ).run("master", hash, "운영자", "master");
  if (envMasterPassword) {
    console.log(
      "마스터 계정이 생성되었습니다 (비밀번호: MASTER_PASSWORD 환경변수 값)"
    );
  } else {
    console.log(
      `마스터 계정이 생성되었습니다 — 초기 비밀번호: ${initialPassword}\n` +
        "이 비밀번호는 이 로그에 한 번만 출력됩니다. 고정된 값을 쓰려면 MASTER_PASSWORD 환경변수를 설정하세요."
    );
  }
} else if (
  envMasterPassword &&
  !bcrypt.compareSync(envMasterPassword, master.password_hash)
) {
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(
    bcrypt.hashSync(envMasterPassword, 12),
    master.id
  );
  console.log(
    "마스터 계정 비밀번호를 MASTER_PASSWORD 환경변수 값으로 갱신했습니다"
  );
}

export default db;
