const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const db = require("../db");
const { requireAuth, requireRole } = require("../auth");

const router = express.Router();
router.use(requireAuth);

const ALLOWED = [".pdf", ".ppt", ".pptx", ".doc", ".docx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".zip"];
const BRANCH_OPTIONS = ["All", "CSE", "IT", "ECE"];

const upload = multer({
  storage: multer.diskStorage({
    destination: db.UPLOADS,
    // Random on-disk name: the original filename is never used as a path.
    filename: (req, file, cb) => cb(null, db.id() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(path.extname(file.originalname).toLowerCase())) return cb(null, true);
    const err = new Error("That file type isn't allowed. Use PDF, Office docs, text, images or zip.");
    err.status = 400;
    cb(err);
  },
});

const view = (m) => {
  const author = db.data.users.find((u) => u.id === m.createdBy);
  return {
    id: m.id, title: m.title, description: m.description, branch: m.branch, type: m.type,
    url: m.type === "link" ? m.url : undefined, filename: m.filename, size: m.size,
    createdAt: m.createdAt, createdBy: m.createdBy, authorName: author ? author.name : "Unknown",
  };
};

router.get("/", (req, res) => {
  const u = req.user;
  const list = db.data.materials
    .filter((m) => u.role !== "student" || m.branch === "All" || m.branch === u.branch)
    .map(view)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ materials: list });
});

router.post("/", requireRole("teacher", "admin"), upload.single("file"), (req, res) => {
  const discard = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  const title = String(req.body.title || "").trim().slice(0, 120);
  const description = String(req.body.description || "").trim().slice(0, 500);
  const branch = BRANCH_OPTIONS.includes(req.body.branch) ? req.body.branch : "All";
  const link = String(req.body.linkUrl || "").trim().slice(0, 500);

  if (!title) { discard(); return res.status(400).json({ error: "Title is required" }); }
  const m = { id: db.id(), title, description, branch, createdBy: req.user.id, createdAt: new Date().toISOString() };

  if (req.file) {
    Object.assign(m, { type: "file", storedName: req.file.filename, filename: req.file.originalname, size: req.file.size });
  } else if (link) {
    // Only http(s) links, so a "javascript:" URL can never end up in an href.
    if (!/^https?:\/\/[^\s]+$/i.test(link)) return res.status(400).json({ error: "Link must start with http:// or https://" });
    Object.assign(m, { type: "link", url: link });
  } else {
    return res.status(400).json({ error: "Upload a file or paste a link" });
  }
  db.data.materials.push(m);
  db.save();
  res.status(201).json({ material: view(m) });
});

router.get("/:id/download", (req, res) => {
  const m = db.data.materials.find((x) => x.id === req.params.id);
  if (!m || m.type !== "file") return res.status(404).json({ error: "File not found" });
  const u = req.user;
  if (u.role === "student" && m.branch !== "All" && m.branch !== u.branch) return res.status(403).json({ error: "Not available for your branch" });
  const full = path.join(db.UPLOADS, path.basename(m.storedName));
  if (!fs.existsSync(full)) return res.status(404).json({ error: "File is missing on the server" });
  res.download(full, m.filename);
});

router.delete("/:id", requireRole("teacher", "admin"), (req, res) => {
  const m = db.data.materials.find((x) => x.id === req.params.id);
  if (!m) return res.status(404).json({ error: "Not found" });
  if (req.user.role !== "admin" && m.createdBy !== req.user.id) return res.status(403).json({ error: "Not your material" });
  if (m.type === "file") fs.unlink(path.join(db.UPLOADS, path.basename(m.storedName)), () => {});
  db.data.materials = db.data.materials.filter((x) => x.id !== m.id);
  db.save();
  res.json({ ok: true });
});

module.exports = router;
