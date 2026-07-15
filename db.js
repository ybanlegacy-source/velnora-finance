// db.js
// Sets up the SQLite database for the demo bank project.
// This is a TEACHING DEMO ONLY: no real money, no real payment processor.
// Balances here are just numbers in a local database file (bank.db).
// Uses Node's BUILT-IN sqlite module (node:sqlite) — no native compilation needed.

const { DatabaseSync } = require('node:sqlite');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'bank.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    full_name TEXT,
    account_number TEXT,
    balance REAL NOT NULL DEFAULT 0,
    total_credit REAL NOT NULL DEFAULT 0,
    total_charge REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS loan_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    term TEXT NOT NULL,
    purpose TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS balance_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    changed_by TEXT NOT NULL,
    field TEXT NOT NULL DEFAULT 'balance',
    old_balance REAL NOT NULL,
    new_balance REAL NOT NULL,
    reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

function tryAlter(sql) {
  try { db.exec(sql); } catch (e) { /* column already exists — fine */ }
}
tryAlter(`ALTER TABLE users ADD COLUMN savings_balance REAL NOT NULL DEFAULT 0`);
tryAlter(`ALTER TABLE users ADD COLUMN savings_account_number TEXT`);
tryAlter(`ALTER TABLE balance_log ADD COLUMN field TEXT NOT NULL DEFAULT 'balance'`);

function seed() {
  const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get();
  if (existing.c > 0) {
    console.log('Users already exist, skipping seed.');
    return;
  }

  const insert = db.prepare(`
    INSERT INTO users (username, password_hash, role, full_name, account_number, balance, total_credit, total_charge, savings_balance, savings_account_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    'admin',
    bcrypt.hashSync('admin123', 10),
    'admin',
    'Bank Administrator',
    null,
    0, 0, 0, 0, null
  );

  insert.run(
    'demo',
    bcrypt.hashSync('demo123', 10),
    'user',
    'Demo User',
    '****1820',
    2000000.00,
    2000000.00,
    0.00,
    500000.00,
    '****2045'
  );

  console.log('Seeded database with:');
  console.log('  admin / admin123  (role: admin)');
  console.log('  demo  / demo123   (role: user)');
}

if (require.main === module) {
  seed();
}

module.exports = db;