const express = require("express");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { getDb } = require("../db");
const { signToken, setAuthCookie, clearAuthCookie } = require("../middleware/auth");
const { isNonEmpty, isValidEmail } = require("../validators");

const router = express.Router();

function renderAuthError(res, view, message) {
  return res.status(400).render(view, { error: message });
}

router.post("/auth/signup", (req, res) => {
  const name = (req.body.name || "").trim();
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  const role = (req.body.role || "").trim();

  if (!isNonEmpty(name)) {
    return renderAuthError(res, "signup", "Name is required.");
  }
  if (!isValidEmail(email)) {
    return renderAuthError(res, "signup", "Valid email is required.");
  }
  if (password.length < 6) {
    return renderAuthError(res, "signup", "Password must be at least 6 characters.");
  }

  if (role !== "Admin" && role !== "Member") {
    return renderAuthError(res, "signup", "Role selection is required.");
  }

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return renderAuthError(res, "signup", "Email already exists.");
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(
    "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, name, email, passwordHash, role, now);

  const token = signToken({ id, name, email, role });
  setAuthCookie(res, token);

  return res.redirect("/dashboard");
});

router.post("/auth/login", (req, res) => {
  const email = (req.body.email || "").trim().toLowerCase();
  const password = req.body.password || "";
  const role = (req.body.role || "").trim();

  if (!isValidEmail(email) || !isNonEmpty(password)) {
    return renderAuthError(res, "login", "Email and password are required.");
  }

  if (role !== "Admin" && role !== "Member") {
    return renderAuthError(res, "login", "Role selection is required.");
  }

  const db = getDb();
  const user = db
    .prepare("SELECT id, name, email, password_hash, role FROM users WHERE email = ?")
    .get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return renderAuthError(res, "login", "Invalid credentials.");
  }

  if (user.role !== role) {
    return renderAuthError(res, "login", "Role does not match account.");
  }

  const token = signToken(user);
  setAuthCookie(res, token);

  return res.redirect("/dashboard");
});

router.post("/auth/logout", (req, res) => {
  clearAuthCookie(res);
  return res.redirect("/login");
});

module.exports = router;
