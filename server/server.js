require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (req, res) => res.json({ ok: true, aiConfigured: !!process.env.ANTHROPIC_API_KEY }));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/quizzes", require("./routes/quizzes"));
app.use("/api/materials", require("./routes/materials"));
app.use("/api/bank", require("./routes/bank"));
app.use("/api/progress", require("./routes/progress"));
app.use("/api", require("./routes/interview")); // /questions /evaluate /interviews
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.name === "MulterError") {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File is too large (max 10 MB)" : err.message;
    return res.status(400).json({ error: msg });
  }
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON" });
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server" });
});

function seedAdmin() {
  if (db.data.users.some((u) => u.role === "admin")) return;
  const email = (process.env.ADMIN_EMAIL || "admin@campusprep.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "Admin@12345";
  db.data.users.push({
    id: db.id(), name: "Admin", email, passwordHash: bcrypt.hashSync(password, 10),
    role: "admin", status: "active", branch: null, createdAt: new Date().toISOString(),
  });
  db.save();
  console.log(`Created first admin account: ${email}`);
  if (!process.env.ADMIN_PASSWORD) console.warn("⚠ Using the default admin password. Set ADMIN_PASSWORD in .env before sharing this publicly.");
}
seedAdmin();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`CampusPrep AI running at http://localhost:${PORT}`);
    if (!process.env.ANTHROPIC_API_KEY) console.warn("⚠ ANTHROPIC_API_KEY not set — mock interviews will use fallback questions and scoring.");
  });
}
module.exports = app;
