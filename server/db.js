// Tiny JSON-file database: zero setup, good enough for a hackathon demo.
// Swap for SQLite/Mongo later by replacing this one file's usage.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const FILE = path.join(DIR, "db.json");
const UPLOADS = path.join(DIR, "uploads");

const EMPTY = { users: [], quizzes: [], attempts: [], materials: [], interviews: [], bank: [] };

fs.mkdirSync(UPLOADS, { recursive: true });

let data;
try {
  data = { ...EMPTY, ...JSON.parse(fs.readFileSync(FILE, "utf-8")) };
} catch (e) {
  if (fs.existsSync(FILE)) fs.copyFileSync(FILE, FILE + ".corrupt-" + Date.now());
  data = JSON.parse(JSON.stringify(EMPTY));
}

function save() {
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE); // atomic replace so a crash can't corrupt the DB
}

const id = () => crypto.randomUUID();

module.exports = { data, save, id, DIR, UPLOADS };
