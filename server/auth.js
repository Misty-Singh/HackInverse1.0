const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("./db");

function getSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const f = path.join(db.DIR, ".jwt_secret");
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf-8").trim();
  const s = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}
const SECRET = getSecret();

const sign = (user) => jwt.sign({ id: user.id }, SECRET, { expiresIn: "7d" });

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  status: u.status, branch: u.branch || null, createdAt: u.createdAt,
});

// Role and status are re-read from the DB on every request, so an admin's
// change (promote, disable, approve) takes effect immediately.
function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Please log in" });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = db.data.users.find((u) => u.id === payload.id);
    if (!user || user.status !== "active") return res.status(401).json({ error: "Session expired" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Session expired" });
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: "You don't have permission to do that" });

const isStaff = (u) => u.role === "teacher" || u.role === "admin";

function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const arr = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
    arr.push(now);
    hits.set(req.ip, arr);
    next();
  };
}

module.exports = { sign, publicUser, requireAuth, requireRole, isStaff, rateLimit };
