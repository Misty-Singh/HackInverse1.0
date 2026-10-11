const express = require("express");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const { publicUser, requireAuth, requireRole } = require("../auth");

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

router.get("/users", (req, res) => {
  const users = db.data.users
    .map(publicUser)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  res.json({ users });
});

router.patch("/users/:id", (req, res) => {
  const user = db.data.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  const { role, status } = req.body;
  if (user.id === req.user.id && (role || status)) {
    return res.status(400).json({ error: "You can't change your own role or status" });
  }
  if (role !== undefined) {
    if (!["student", "teacher", "admin"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    user.role = role;
    if (role === "student" && !user.branch) user.branch = "CSE";
  }
  if (status !== undefined) {
    if (!["active", "pending", "disabled"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    user.status = status;
  }
  db.save();
  res.json({ user: publicUser(user) });
});

router.delete("/users/:id", (req, res) => {
  const user = db.data.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  if (user.id === req.user.id) return res.status(400).json({ error: "You can't delete your own account" });
  db.data.users = db.data.users.filter((u) => u.id !== user.id);
  db.data.attempts = db.data.attempts.filter((a) => a.studentId !== user.id);
  db.data.interviews = db.data.interviews.filter((i) => i.studentId !== user.id);
  db.save();
  res.json({ ok: true });
});

router.get("/stats", (req, res) => {
  const d = db.data;
  const count = (r) => d.users.filter((u) => u.role === r && u.status === "active").length;
  res.json({
    students: count("student"),
    teachers: count("teacher"),
    admins: count("admin"),
    pendingTeachers: d.users.filter((u) => u.role === "teacher" && u.status === "pending").length,
    quizzes: d.quizzes.length,
    attempts: d.attempts.length,
    materials: d.materials.length,
    interviews: d.interviews.length,
  });
});

module.exports = router;
