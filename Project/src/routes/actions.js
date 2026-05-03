const express = require("express");
const { randomUUID } = require("crypto");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { getDb } = require("../db");
const { isNonEmpty, isValidEmail, normalizeDate, isValidStatus } = require("../validators");

const router = express.Router();

function ensureProjectMember(db, projectId, userId) {
  return db
    .prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
    .get(projectId, userId);
}

router.post("/projects", requireAdmin(), (req, res) => {
  const name = (req.body.name || "").trim();
  const description = (req.body.description || "").trim() || null;

  if (!isNonEmpty(name)) {
    return res.status(400).render("error", { message: "Project name is required." });
  }

  const db = getDb();
  const now = new Date().toISOString();
  const projectId = randomUUID();

  db.prepare(
    "INSERT INTO projects (id, name, description, owner_id, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(projectId, name, description, req.user.id, now);

  db.prepare(
    "INSERT INTO project_members (id, project_id, user_id, created_at) VALUES (?, ?, ?, ?)"
  ).run(randomUUID(), projectId, req.user.id, now);

  return res.redirect(`/projects/${projectId}`);
});

router.post("/projects/:id/members", requireAdmin(), (req, res) => {
  const projectId = req.params.id;
  const email = (req.body.email || "").trim().toLowerCase();

  if (!isValidEmail(email)) {
    return res.status(400).render("error", { message: "Valid email is required." });
  }

  const db = getDb();
  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  if (!project) {
    return res.status(404).render("error", { message: "Project not found." });
  }

  const adminMember = ensureProjectMember(db, projectId, req.user.id);
  if (!adminMember) {
    return res.status(403).render("error", { message: "Not a project member." });
  }

  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!user) {
    return res.status(404).render("error", { message: "User not found." });
  }

  try {
    db.prepare(
      "INSERT INTO project_members (id, project_id, user_id, created_at) VALUES (?, ?, ?, ?)"
    ).run(randomUUID(), projectId, user.id, new Date().toISOString());
  } catch (error) {
    return res.status(400).render("error", { message: "User already in project." });
  }

  return res.redirect(`/projects/${projectId}`);
});

router.post("/projects/:id/tasks", requireAuth(), (req, res) => {
  const projectId = req.params.id;
  const title = (req.body.title || "").trim();
  const description = (req.body.description || "").trim() || null;
  const dueDateRaw = req.body.due_date;
  const dueDate = normalizeDate(dueDateRaw);
  const assigneeId = (req.body.assignee_id || "").trim() || req.user.id;

  if (!isNonEmpty(title)) {
    return res.status(400).render("error", { message: "Task title is required." });
  }

  if (dueDateRaw && !dueDate) {
    return res.status(400).render("error", { message: "Invalid due date." });
  }

  const db = getDb();
  const member = ensureProjectMember(db, projectId, req.user.id);
  if (!member) {
    return res.status(403).render("error", { message: "Not a project member." });
  }

  const assigneeMember = ensureProjectMember(db, projectId, assigneeId);
  if (!assigneeMember) {
    return res
      .status(400)
      .render("error", { message: "Assignee must be a project member." });
  }

  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO tasks
      (id, project_id, title, description, status, due_date, assignee_id, created_by, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(
    randomUUID(),
    projectId,
    title,
    description,
    "todo",
    dueDate,
    assigneeId,
    req.user.id,
    now,
    now
  );

  return res.redirect(`/projects/${projectId}`);
});

router.post("/tasks/:id/status", requireAuth(), (req, res) => {
  const taskId = req.params.id;
  const status = (req.body.status || "").trim();

  if (!isValidStatus(status)) {
    return res.status(400).render("error", { message: "Invalid status." });
  }

  const db = getDb();
  const task = db
    .prepare("SELECT id, project_id, assignee_id FROM tasks WHERE id = ?")
    .get(taskId);

  if (!task) {
    return res.status(404).render("error", { message: "Task not found." });
  }

  const isMember = ensureProjectMember(db, task.project_id, req.user.id);
  if (!isMember) {
    return res.status(403).render("error", { message: "Not a project member." });
  }

  if (req.user.role !== "Admin" && task.assignee_id !== req.user.id) {
    return res.status(403).render("error", { message: "Not allowed." });
  }

  db.prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?").run(
    status,
    new Date().toISOString(),
    taskId
  );

  return res.redirect(req.get("referer") || "/dashboard");
});

router.post("/tasks/:id/delete", requireAdmin(), (req, res) => {
  const taskId = req.params.id;
  const db = getDb();

  const task = db
    .prepare("SELECT id, project_id FROM tasks WHERE id = ?")
    .get(taskId);

  if (!task) {
    return res.status(404).render("error", { message: "Task not found." });
  }

  const isMember = ensureProjectMember(db, task.project_id, req.user.id);
  if (!isMember) {
    return res.status(403).render("error", { message: "Not a project member." });
  }

  db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
  return res.redirect(req.get("referer") || "/dashboard");
});

router.post("/projects/:id/delete", requireAdmin(), (req, res) => {
  const projectId = req.params.id;
  const db = getDb();
  const isMember = ensureProjectMember(db, projectId, req.user.id);

  if (!isMember) {
    return res.status(403).render("error", { message: "Not a project member." });
  }

  db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  return res.redirect("/projects");
});

module.exports = router;
