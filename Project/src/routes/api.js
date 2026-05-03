const express = require("express");
const { randomUUID } = require("crypto");
const { getDb } = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { isNonEmpty, normalizeDate, isValidStatus, isValidEmail } = require("../validators");

const router = express.Router();

function ensureProjectMember(db, projectId, userId) {
  return db
    .prepare("SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?")
    .get(projectId, userId);
}

router.use(requireAuth({ asJson: true }));

router.get("/dashboard", (req, res) => {
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
      LIMIT 10
      `
    )
    .all(req.user.id);

  return res.json({ summary, tasks });
});

router.get("/projects", (req, res) => {
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

  return res.json({ projects });
});

router.post("/projects", requireAdmin({ asJson: true }), (req, res) => {
  const name = (req.body.name || "").trim();
  const description = (req.body.description || "").trim() || null;

  if (!isNonEmpty(name)) {
    return res.status(400).json({ error: "Project name is required." });
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

  return res.status(201).json({ id: projectId });
});

router.get("/projects/:id", (req, res) => {
  const db = getDb();
  const projectId = req.params.id;

  const member = ensureProjectMember(db, projectId, req.user.id);
  if (!member) {
    return res.status(404).json({ error: "Project not found." });
  }

  const project = db
    .prepare("SELECT id, name, description, owner_id, created_at FROM projects WHERE id = ?")
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

  return res.json({ project, members, tasks });
});

router.patch("/projects/:id", requireAdmin({ asJson: true }), (req, res) => {
  const projectId = req.params.id;
  const name = (req.body.name || "").trim();
  const description = (req.body.description || "").trim() || null;

  if (!isNonEmpty(name)) {
    return res.status(400).json({ error: "Project name is required." });
  }

  const db = getDb();
  const member = ensureProjectMember(db, projectId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: "Not a project member." });
  }

  db.prepare("UPDATE projects SET name = ?, description = ? WHERE id = ?").run(
    name,
    description,
    projectId
  );

  return res.json({ ok: true });
});

router.delete("/projects/:id", requireAdmin({ asJson: true }), (req, res) => {
  const projectId = req.params.id;
  const db = getDb();
  const member = ensureProjectMember(db, projectId, req.user.id);

  if (!member) {
    return res.status(403).json({ error: "Not a project member." });
  }

  db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
  return res.json({ ok: true });
});

router.post("/projects/:id/members", requireAdmin({ asJson: true }), (req, res) => {
  const projectId = req.params.id;
  const email = (req.body.email || "").trim().toLowerCase();

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email is required." });
  }

  const db = getDb();
  const member = ensureProjectMember(db, projectId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: "Not a project member." });
  }

  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (!user) {
    return res.status(404).json({ error: "User not found." });
  }

  try {
    db.prepare(
      "INSERT INTO project_members (id, project_id, user_id, created_at) VALUES (?, ?, ?, ?)"
    ).run(randomUUID(), projectId, user.id, new Date().toISOString());
  } catch (error) {
    return res.status(400).json({ error: "User already in project." });
  }

  return res.status(201).json({ ok: true });
});

router.delete(
  "/projects/:id/members/:userId",
  requireAdmin({ asJson: true }),
  (req, res) => {
    const projectId = req.params.id;
    const userId = req.params.userId;

    const db = getDb();
    const member = ensureProjectMember(db, projectId, req.user.id);
    if (!member) {
      return res.status(403).json({ error: "Not a project member." });
    }

    db.prepare("DELETE FROM project_members WHERE project_id = ? AND user_id = ?").run(
      projectId,
      userId
    );

    return res.json({ ok: true });
  }
);

router.get("/tasks", (req, res) => {
  const db = getDb();
  const projectId = (req.query.projectId || "").trim();

  if (projectId) {
    const member = ensureProjectMember(db, projectId, req.user.id);
    if (!member) {
      return res.status(403).json({ error: "Not a project member." });
    }

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

    return res.json({ tasks });
  }

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

  return res.json({ tasks });
});

router.post("/tasks", (req, res) => {
  const projectId = (req.body.projectId || "").trim();
  const title = (req.body.title || "").trim();
  const description = (req.body.description || "").trim() || null;
  const status = (req.body.status || "todo").trim();
  const dueDate = normalizeDate(req.body.dueDate);
  const assigneeId = (req.body.assigneeId || "").trim() || req.user.id;

  if (!isNonEmpty(projectId) || !isNonEmpty(title)) {
    return res.status(400).json({ error: "Project and title are required." });
  }
  if (!isValidStatus(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  const db = getDb();
  const member = ensureProjectMember(db, projectId, req.user.id);
  if (!member) {
    return res.status(403).json({ error: "Not a project member." });
  }

  const assigneeMember = ensureProjectMember(db, projectId, assigneeId);
  if (!assigneeMember) {
    return res.status(400).json({ error: "Assignee must be a project member." });
  }

  const now = new Date().toISOString();
  const taskId = randomUUID();

  db.prepare(
    `
    INSERT INTO tasks
      (id, project_id, title, description, status, due_date, assignee_id, created_by, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  ).run(taskId, projectId, title, description, status, dueDate, assigneeId, req.user.id, now, now);

  return res.status(201).json({ id: taskId });
});

router.patch("/tasks/:id", (req, res) => {
  const taskId = req.params.id;
  const updates = {};

  if (req.body.title !== undefined) {
    const title = (req.body.title || "").trim();
    if (!isNonEmpty(title)) {
      return res.status(400).json({ error: "Title is required." });
    }
    updates.title = title;
  }

  if (req.body.description !== undefined) {
    updates.description = (req.body.description || "").trim() || null;
  }

  if (req.body.status !== undefined) {
    const status = (req.body.status || "").trim();
    if (!isValidStatus(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }
    updates.status = status;
  }

  if (req.body.dueDate !== undefined) {
    const dueDate = normalizeDate(req.body.dueDate);
    if (req.body.dueDate && !dueDate) {
      return res.status(400).json({ error: "Invalid due date." });
    }
    updates.due_date = dueDate;
  }

  if (req.body.assigneeId !== undefined) {
    updates.assignee_id = (req.body.assigneeId || "").trim() || null;
  }

  const db = getDb();
  const task = db
    .prepare("SELECT id, project_id, assignee_id FROM tasks WHERE id = ?")
    .get(taskId);

  if (!task) {
    return res.status(404).json({ error: "Task not found." });
  }

  const member = ensureProjectMember(db, task.project_id, req.user.id);
  if (!member) {
    return res.status(403).json({ error: "Not a project member." });
  }

  if (req.user.role !== "Admin" && task.assignee_id !== req.user.id) {
    return res.status(403).json({ error: "Not allowed." });
  }

  if (updates.assignee_id) {
    const assigneeMember = ensureProjectMember(db, task.project_id, updates.assignee_id);
    if (!assigneeMember) {
      return res.status(400).json({ error: "Assignee must be a project member." });
    }
  }

  const fields = [];
  const values = [];
  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = ?`);
    values.push(value);
  });

  if (!fields.length) {
    return res.json({ ok: true });
  }

  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(taskId);

  db.prepare(`UPDATE tasks SET ${fields.join(", ")} WHERE id = ?`).run(...values);

  return res.json({ ok: true });
});

router.delete("/tasks/:id", requireAdmin({ asJson: true }), (req, res) => {
  const taskId = req.params.id;
  const db = getDb();

  const task = db
    .prepare("SELECT id, project_id FROM tasks WHERE id = ?")
    .get(taskId);

  if (!task) {
    return res.status(404).json({ error: "Task not found." });
  }

  const member = ensureProjectMember(db, task.project_id, req.user.id);
  if (!member) {
    return res.status(403).json({ error: "Not a project member." });
  }

  db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
  return res.json({ ok: true });
});

module.exports = router;
