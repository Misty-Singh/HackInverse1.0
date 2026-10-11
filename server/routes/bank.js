// Teacher-curated placement question bank. These feed the AI mock interview, which is
// what makes it GNIT-specific: real questions from your college come first.
const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../auth");

const router = express.Router();
router.use(requireAuth, requireRole("teacher", "admin"));
const BRANCH_OPTIONS = ["All", "CSE", "IT", "ECE"];

router.get("/", (req, res) => {
  const list = db.data.bank
    .map((b) => ({ ...b, authorName: (db.data.users.find((u) => u.id === b.createdBy) || {}).name || "Unknown" }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ questions: list });
});

router.post("/", (req, res) => {
  const text = String(req.body.text || "").trim().slice(0, 500);
  const branch = BRANCH_OPTIONS.includes(req.body.branch) ? req.body.branch : "All";
  if (text.length < 10) return res.status(400).json({ error: "Write the full interview question (at least 10 characters)" });
  const q = { id: db.id(), text, branch, createdBy: req.user.id, createdAt: new Date().toISOString() };
  db.data.bank.push(q);
  db.save();
  res.status(201).json({ question: q });
});

router.delete("/:id", (req, res) => {
  const q = db.data.bank.find((b) => b.id === req.params.id);
  if (!q) return res.status(404).json({ error: "Not found" });
  if (req.user.role !== "admin" && q.createdBy !== req.user.id) return res.status(403).json({ error: "Not your question" });
  db.data.bank = db.data.bank.filter((b) => b.id !== q.id);
  db.save();
  res.json({ ok: true });
});

module.exports = router;
