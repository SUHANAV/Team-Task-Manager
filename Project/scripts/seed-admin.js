require("dotenv").config();

const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { initDb, getDb } = require("../src/db");

const email = (process.env.ADMIN_EMAIL || "admin@example.com").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || "admin123";
const name = process.env.ADMIN_NAME || "Admin User";

if (password.length < 6) {
  console.error("ADMIN_PASSWORD must be at least 6 characters.");
  process.exit(1);
}

initDb();
const db = getDb();

const existing = db.prepare("SELECT id, role FROM users WHERE email = ?").get(email);
if (existing) {
  if (existing.role !== "Admin") {
    db.prepare("UPDATE users SET role = 'Admin' WHERE id = ?").run(existing.id);
    console.log("Existing user promoted to Admin.");
  } else {
    console.log("Admin user already exists.");
  }
  process.exit(0);
}

const id = randomUUID();
const now = new Date().toISOString();
const passwordHash = bcrypt.hashSync(password, 10);

db.prepare(
  "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
).run(id, name, email, passwordHash, "Admin", now);

console.log("Admin user created:");
console.log(`Email: ${email}`);
console.log(`Password: ${password}`);
