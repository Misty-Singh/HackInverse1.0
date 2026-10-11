// Fills the app with demo accounts and content so you can show judges a full flow in seconds.
// Run: npm run seed      (safe to run twice)
require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./db");

const now = () => new Date().toISOString();
function user(name, email, role, branch) {
  let u = db.data.users.find((x) => x.email === email);
  if (!u) {
    u = { id: db.id(), name, email, passwordHash: bcrypt.hashSync("demo1234", 10), role, status: "active", branch, createdAt: now() };
    db.data.users.push(u);
  }
  return u;
}

const teacher = user("Prof. Sen", "teacher@gnit.demo", "teacher", null);
const s1 = user("Riya Das", "riya@gnit.demo", "student", "CSE");
const s2 = user("Arjun Mehta", "arjun@gnit.demo", "student", "CSE");
user("Sneha Roy", "sneha@gnit.demo", "student", "IT");

if (!db.data.quizzes.length) {
  const q = {
    id: db.id(), title: "DSA Basics — Placement Warm-up", description: "Arrays, complexity and linked lists.",
    branch: "All", published: true, createdBy: teacher.id, createdAt: now(),
    questions: [
      { text: "What is the time complexity of binary search on a sorted array?", options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"], correct: 1 },
      { text: "Which data structure uses LIFO order?", options: ["Queue", "Stack", "Heap", "Graph"], correct: 1 },
      { text: "Which technique detects a cycle in a linked list in O(1) extra space?", options: ["Hash set", "Recursion", "Floyd's tortoise and hare", "Sorting"], correct: 2 },
    ],
  };
  db.data.quizzes.push(q);
  const day = 86400000;
  [[s1, 2, 6], [s1, 3, 3], [s2, 1, 4]].forEach(([s, score, ago]) =>
    db.data.attempts.push({ id: db.id(), quizId: q.id, quizTitle: q.title, studentId: s.id, score, total: 3, submittedAt: new Date(Date.now() - ago * day).toISOString() }));
  [[s1, 54, 7], [s1, 71, 2], [s2, 62, 3]].forEach(([s, conf, ago]) =>
    db.data.interviews.push({ id: db.id(), studentId: s.id, branch: "CSE", role: "Software Engineer", results: [{ question: "Tell me about a project.", fillerCount: 5, wpm: 130, contentScore: conf + 5, confidence: conf, feedback: "Demo data.", suggestion: "Be concise." }], avgConfidence: conf, totalFillers: 5, avgWpm: 130, createdAt: new Date(Date.now() - ago * day).toISOString() }));
}
if (!db.data.materials.length) {
  db.data.materials.push({ id: db.id(), title: "GeeksforGeeks — Placement preparation", description: "Curated DSA and core CS topics.", branch: "All", type: "link", url: "https://www.geeksforgeeks.org/", createdBy: teacher.id, createdAt: now() });
}
if (!db.data.bank.length) {
  [["CSE", "Explain how you would design a URL shortener, and what you'd do about collisions."],
   ["All", "Tell me about a time you led a team or took initiative during a college project."],
   ["IT", "What happens, step by step, when you type a URL into a browser and press Enter?"]]
    .forEach(([branch, text]) => db.data.bank.push({ id: db.id(), text, branch, createdBy: teacher.id, createdAt: now() }));
}
db.save();
console.log("Demo data ready. All demo passwords: demo1234\n  teacher@gnit.demo / riya@gnit.demo / arjun@gnit.demo / sneha@gnit.demo");
