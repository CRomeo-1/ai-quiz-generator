const express = require("express");
const { DatabaseSync } = require("node:sqlite");

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static("public"));

const API_URL = process.env.API_URL || "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.MODEL || "meta-llama/llama-3.3-70b-instruct:free";
const PORT = process.env.PORT || 3000;

// database
const db = new DatabaseSync("quizzes.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    questions TEXT,
    best_score INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

function buildPrompt(notes, count) {
  return `Create ${count} multiple choice questions to test a student on these notes.
Return ONLY valid JSON in this format, no other text:
{"title": "short topic title",
 "questions": [{"question": "...", "options": ["A", "B", "C", "D"], "answer": 0, "explanation": "..."}]}
"answer" is the index of the correct option.

Notes:
${notes}`;
}

async function askLLM(prompt) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });
  if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);

  const data = await res.json();
  const text = data.choices[0].message.content;

  // models sometimes wrap the json in ```json ... ``` so take the part between the braces
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json);
}

function isValidQuiz(quiz) {
  return (
    Array.isArray(quiz.questions) &&
    quiz.questions.length > 0 &&
    quiz.questions.every(
      (q) => q.question && Array.isArray(q.options) && q.options.length === 4 && q.answer >= 0 && q.answer < 4
    )
  );
}

// generate a quiz from notes
app.post("/api/quizzes", async (req, res) => {
  const { notes, count = 5 } = req.body;
  if (!notes || notes.trim().length < 50) {
    return res.status(400).json({ error: "Please write at least 50 characters of notes" });
  }

  try {
    const quiz = await askLLM(buildPrompt(notes, Math.min(count, 10)));
    if (!isValidQuiz(quiz)) throw new Error("bad quiz format");

    const result = db
      .prepare("INSERT INTO quizzes (title, questions) VALUES (?, ?)")
      .run(quiz.title || "Untitled quiz", JSON.stringify(quiz.questions));

    res.status(201).json({ id: Number(result.lastInsertRowid), title: quiz.title, questions: quiz.questions });
  } catch (err) {
    console.error(err.message);
    res.status(502).json({ error: "Could not generate the quiz, try again" });
  }
});

// list old quizzes
app.get("/api/quizzes", (req, res) => {
  const rows = db.prepare("SELECT id, title, best_score, created_at FROM quizzes ORDER BY id DESC").all();
  res.json(rows);
});

// open one quiz
app.get("/api/quizzes/:id", (req, res) => {
  const row = db.prepare("SELECT * FROM quizzes WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Quiz not found" });
  res.json({ ...row, questions: JSON.parse(row.questions) });
});

// save the score (keep the best one)
app.post("/api/quizzes/:id/score", (req, res) => {
  const score = Number(req.body.score);
  if (!Number.isInteger(score) || score < 0) return res.status(400).json({ error: "Invalid score" });

  db.prepare("UPDATE quizzes SET best_score = MAX(COALESCE(best_score, 0), ?) WHERE id = ?").run(score, req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
