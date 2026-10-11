const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { sign, publicUser, requireAuth, rateLimit } = require("../auth");

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const BRANCHES = ["CSE", "IT", "ECE"];
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

router.post("/register", limiter, (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 80);
  const email = String(req.body.email || "").trim().toLowerCase().slice(0, 120);
  const password = String(req.body.password || "");
  const role = req.body.role === "teacher" ? "teacher" : "student"; // admin can never self-register
  const branch = BRANCHES.includes(req.body.branch) ? req.body.branch : "CSE";

  if (!name) return res.status(400).json({ error: "Name is required" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  if (db.data.users.some((u) => u.email === email)) return res.status(409).json({ error: "That email is already registered" });

  const user = {
    id: db.id(), name, email,
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    status: role === "teacher" ? "pending" : "active", // teachers need admin approval
    branch: role === "student" ? branch : null,
    createdAt: new Date().toISOString(),
  };
  db.data.users.push(user);
  db.save();

  if (user.status === "pending") {
    return res.status(202).json({ pending: true, message: "Account created. An admin must approve your teacher account before you can log in." });
  }
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

router.post("/login", limiter, (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.data.users.find((u) => u.email === email);
  const ok = bcrypt.compareSync(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: "Invalid email or password" });
  if (user.status === "pending") return res.status(403).json({ error: "Your teacher account is still awaiting admin approval." });
  if (user.status !== "active") return res.status(403).json({ error: "This account has been disabled. Contact an admin." });
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

module.exports = router;
