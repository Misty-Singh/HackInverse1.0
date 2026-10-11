const express = require("express");
const db = require("../db");
const { requireAuth, requireRole, isStaff } = require("../auth");

const router = express.Router();
router.use(requireAuth);

const BRANCH_OPTIONS = ["All", "CSE", "IT", "ECE"];
const pct = (a) => (a.total ? Math.round((a.score / a.total) * 100) : 0);

function validateQuiz(body) {
  const title = String(body.title || "").trim().slice(0, 120);
  if (!title) return { error: "Quiz title is required" };
  const description = String(body.description || "").trim().slice(0, 500);
  const branch = BRANCH_OPTIONS.includes(body.branch) ? body.branch : "All";
  if (!Array.isArray(body.questions) || body.questions.length < 1 || body.questions.length > 50) {
    return { error: "Add between 1 and 50 questions" };
  }
  const questions = [];
  for (let i = 0; i < body.questions.length; i++) {
    const q = body.questions[i] || {};
    const text = String(q.text || "").trim().slice(0, 500);
    if (!text) return { error: `Question ${i + 1} has no text` };
    const raw = Array.isArray(q.options) ? q.options : [];
    const correctRaw = Number(q.correct);
    const options = [];
    let correct = -1;
    raw.slice(0, 6).forEach((o, idx) => {
      const t = String(o || "").trim().slice(0, 200);
      if (!t) return;
      if (idx === correctRaw) correct = options.length;
      options.push(t);
    });
    if (options.length < 2) return { error: `Question ${i + 1} needs at least 2 options` };
    if (correct < 0) return { error: `Question ${i + 1}: mark a correct answer (and make sure it isn't blank)` };
    questions.push({ text, options, correct });
  }
  return { value: { title, description, branch, questions, published: !!body.published } };
}

const canManage = (user, quiz) => user.role === "admin" || quiz.createdBy === user.id;
const attemptsFor = (quizId) => db.data.attempts.filter((a) => a.quizId === quizId);

router.get("/", (req, res) => {
  const u = req.user;
  if (isStaff(u)) {
    const list = db.data.quizzes
      .filter((q) => u.role === "admin" || q.createdBy === u.id)
      .map((q) => {
        const at = attemptsFor(q.id);
        return {
          id: q.id, title: q.title, description: q.description, branch: q.branch,
          published: q.published, questionCount: q.questions.length, createdAt: q.createdAt,
          attemptCount: at.length,
          avgPct: at.length ? Math.round(at.reduce((s, a) => s + pct(a), 0) / at.length) : null,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return res.json({ quizzes: list });
  }
  const list = db.data.quizzes
    .filter((q) => q.published && (q.branch === "All" || q.branch === u.branch))
    .map((q) => {
      const mine = attemptsFor(q.id).filter((a) => a.studentId === u.id);
      return {
        id: q.id, title: q.title, description: q.description, branch: q.branch,
        questionCount: q.questions.length, createdAt: q.createdAt,
        attempts: mine.length,
        best: mine.length ? Math.max(...mine.map(pct)) : null,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ quizzes: list });
});

router.get("/:id", (req, res) => {
  const quiz = db.data.quizzes.find((q) => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  if (isStaff(req.user)) {
    if (!canManage(req.user, quiz)) return res.status(403).json({ error: "Not your quiz" });
    return res.json({ quiz });
  }
  if (!quiz.published) return res.status(404).json({ error: "Quiz not found" });
  // Students never receive the answer key.
  res.json({
    quiz: {
      id: quiz.id, title: quiz.title, description: quiz.description,
      questions: quiz.questions.map((q) => ({ text: q.text, options: q.options })),
    },
  });
});

router.post("/", requireRole("teacher", "admin"), (req, res) => {
  const v = validateQuiz(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  const quiz = { id: db.id(), ...v.value, createdBy: req.user.id, createdAt: new Date().toISOString() };
  db.data.quizzes.push(quiz);
  db.save();
  res.status(201).json({ quiz });
});

router.put("/:id", requireRole("teacher", "admin"), (req, res) => {
  const quiz = db.data.quizzes.find((q) => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  if (!canManage(req.user, quiz)) return res.status(403).json({ error: "Not your quiz" });
  const v = validateQuiz(req.body);
  if (v.error) return res.status(400).json({ error: v.error });
  Object.assign(quiz, v.value);
  db.save();
  res.json({ quiz });
});

router.patch("/:id/publish", requireRole("teacher", "admin"), (req, res) => {
  const quiz = db.data.quizzes.find((q) => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  if (!canManage(req.user, quiz)) return res.status(403).json({ error: "Not your quiz" });
  quiz.published = !!req.body.published;
  db.save();
  res.json({ quiz: { id: quiz.id, published: quiz.published } });
});

router.delete("/:id", requireRole("teacher", "admin"), (req, res) => {
  const quiz = db.data.quizzes.find((q) => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  if (!canManage(req.user, quiz)) return res.status(403).json({ error: "Not your quiz" });
  db.data.quizzes = db.data.quizzes.filter((q) => q.id !== quiz.id);
  db.data.attempts = db.data.attempts.filter((a) => a.quizId !== quiz.id);
  db.save();
  res.json({ ok: true });
});

// Student submits answers; grading happens on the server.
router.post("/:id/attempt", requireRole("student"), (req, res) => {
  const quiz = db.data.quizzes.find((q) => q.id === req.params.id && q.published);
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  const answers = req.body.answers;
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length
      || !answers.every((a) => Number.isInteger(a))) {
    return res.status(400).json({ error: "Answer every question before submitting" });
  }
  const review = quiz.questions.map((q, i) => ({
    text: q.text, options: q.options, yourAnswer: answers[i], correctAnswer: q.correct,
    correct: answers[i] === q.correct,
  }));
  const score = review.filter((r) => r.correct).length;
  const attempt = {
    id: db.id(), quizId: quiz.id, quizTitle: quiz.title, studentId: req.user.id,
    score, total: quiz.questions.length, submittedAt: new Date().toISOString(),
  };
  db.data.attempts.push(attempt);
  db.save();
  res.json({ score, total: attempt.total, pct: pct(attempt), review });
});

router.get("/:id/results", requireRole("teacher", "admin"), (req, res) => {
  const quiz = db.data.quizzes.find((q) => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: "Quiz not found" });
  if (!canManage(req.user, quiz)) return res.status(403).json({ error: "Not your quiz" });
  const results = attemptsFor(quiz.id)
    .map((a) => {
      const s = db.data.users.find((u) => u.id === a.studentId);
      return {
        id: a.id, studentName: s ? s.name : "(deleted user)", studentEmail: s ? s.email : "",
        score: a.score, total: a.total, pct: pct(a), submittedAt: a.submittedAt,
      };
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  res.json({ quiz: { id: quiz.id, title: quiz.title }, results });
});

module.exports = router;
