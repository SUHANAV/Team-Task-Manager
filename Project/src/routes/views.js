const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { getDb } = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  if (req.user) {
    return res.redirect("/dashboard");
  }
  return res.redirect("/login");
});

router.get("/login", (req, res) => {
  if (req.user) {
    return res.redirect("/dashboard");
  }
  return res.render("login", { error: null });
});

router.get("/signup", (req, res) => {
  if (req.user) {
    return res.redirect("/dashboard");
  }
  return res.render("signup", { error: null });
});

router.get("/dashboard", requireAuth(), (req, res) => {
  const db = getDb();

  const summary = db
    .prepare(
      `
      SELECT
        COUNT(*) AS totalCount,
        SUM(CASE WHEN status = 'todo' THEN 1 ELSE 0 END) AS todoCount,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS inProgressCount,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS doneCount,
        SUM(
          CASE
            WHEN status != 'done'
              AND due_date IS NOT NULL
              AND date(due_date) < date('now')
            THEN 1 ELSE 0
          END
        ) AS overdueCount
      FROM tasks
      WHERE assignee_id = ?
      `
    )
    .get(req.user.id);

  const tasks = db
    .prepare(
      `
      SELECT t.*, p.name AS project_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.assignee_id = ?
      ORDER BY
        t.due_date IS NULL,
        t.due_date ASC,
        t.created_at DESC
      LIMIT 8
      `
    )
    .all(req.user.id);

  return res.render("dashboard", { summary, tasks });
});

router.get("/projects", requireAuth(), (req, res) => {
  const db = getDb();

  const projects = db
    .prepare(
      `
      SELECT p.id, p.name, p.description, p.owner_id, p.created_at
      FROM projects p
      JOIN project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = ?
      ORDER BY p.created_at DESC
      `
    )
    .all(req.user.id);

  return res.render("projects", { projects });
});

router.get("/projects/:id", requireAuth(), (req, res) => {
  const db = getDb();
  const projectId = req.params.id;

  const isMember = db
    .prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
    .get(projectId, req.user.id);

  if (!isMember) {
    return res.status(404).render("error", { message: "Project not found." });
  }

  const project = db
    .prepare("SELECT id, name, description, owner_id FROM projects WHERE id = ?")
    .get(projectId);

  const members = db
    .prepare(
      `
      SELECT u.id, u.name, u.email, u.role
      FROM users u
      JOIN project_members pm ON pm.user_id = u.id
      WHERE pm.project_id = ?
      ORDER BY u.name
      `
    )
    .all(projectId);

  const tasks = db
    .prepare(
      `
      SELECT t.*, u.name AS assignee_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.project_id = ?
      ORDER BY t.created_at DESC
      `
    )
    .all(projectId);

  return res.render("project-detail", {
    project,
    members,
    tasks,
  });
});

router.get("/tasks", requireAuth(), (req, res) => {
  const db = getDb();

  const tasks = db
    .prepare(
      `
      SELECT t.*, p.name AS project_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.assignee_id = ?
      ORDER BY
        t.due_date IS NULL,
        t.due_date ASC,
        t.created_at DESC
      `
    )
    .all(req.user.id);

  return res.render("tasks", { tasks });
});

module.exports = router;
