const express = require("express");
const db = require("../db");
const { requireAuth, requireRole, publicUser } = require("../auth");

const router = express.Router();
router.use(requireAuth);

const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

function detailFor(studentId) {
  const attempts = db.data.attempts
    .filter((a) => a.studentId === studentId)
    .map((a) => ({
      id: a.id, quizId: a.quizId, quizTitle: a.quizTitle, score: a.score, total: a.total,
      pct: a.total ? Math.round((a.score / a.total) * 100) : 0, submittedAt: a.submittedAt,
    }))
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const interviews = db.data.interviews
    .filter((i) => i.studentId === studentId)
    .map((i) => ({
      id: i.id, createdAt: i.createdAt, branch: i.branch, role: i.role,
      avgConfidence: i.avgConfidence, totalFillers: i.totalFillers, avgWpm: i.avgWpm,
      questionCount: i.results.length,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const times = [...attempts.map((a) => a.submittedAt), ...interviews.map((i) => i.createdAt)].sort();
  return {
    summary: {
      attempts: attempts.length,
      quizzesTaken: new Set(attempts.map((a) => a.quizId)).size,
      avgQuiz: avg(attempts.map((a) => a.pct)),
      interviews: interviews.length,
      avgConfidence: avg(interviews.map((i) => i.avgConfidence)),
      lastActive: times.length ? times[times.length - 1] : null,
    },
    attempts,
    interviews,
  };
}

router.get("/me", requireRole("student"), (req, res) => res.json(detailFor(req.user.id)));

router.get("/students", requireRole("teacher", "admin"), (req, res) => {
  const students = db.data.users
    .filter((u) => u.role === "student" && u.status === "active")
    .map((u) => ({ id: u.id, name: u.name, email: u.email, branch: u.branch, ...detailFor(u.id).summary }))
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json({ students });
});

router.get("/students/:id", requireRole("teacher", "admin"), (req, res) => {
  const s = db.data.users.find((u) => u.id === req.params.id && u.role === "student");
  if (!s) return res.status(404).json({ error: "Student not found" });
  res.json({ student: publicUser(s), ...detailFor(s.id) });
});

module.exports = router;
