# AI Quiz Generator

A web app that turns your study notes into a multiple choice quiz using an LLM. You paste your notes, the AI writes the questions, you answer them and the app checks your answers and saves your best score.

I built it to help me study for my courses and to practice working with LLM APIs.

## Features
- Generates 3, 5 or 10 questions from any notes
- Shows the correct answer and an explanation after checking
- Saves every quiz in SQLite so you can retake old ones
- Keeps your best score for each quiz

## Tech
- **Backend:** Node.js, Express
- **Database:** SQLite (built-in `node:sqlite` module)
- **Frontend:** HTML, JavaScript, Tailwind CSS
- **AI:** OpenRouter API (free models, e.g. Llama 3.3 70B)

## How it works
```
Browser --notes--> Express API --prompt--> LLM (OpenRouter)
                        |  <--JSON quiz--
                        v
                     SQLite
```
1. The backend builds a prompt that asks the model to return **only JSON** in a fixed format
2. Models sometimes add text or ```` ```json ```` around the answer, so the server takes only the part between the first `{` and the last `}`
3. The quiz is validated (4 options per question, answer index between 0 and 3) before saving
4. The API key stays on the server in `.env`, the browser never sees it

## API
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/quizzes` | generate a quiz, body: `{ "notes": "...", "count": 5 }` |
| GET | `/api/quizzes` | list saved quizzes |
| GET | `/api/quizzes/:id` | get one quiz |
| POST | `/api/quizzes/:id/score` | save a score, body: `{ "score": 4 }` |

## Run locally
Requires Node.js 22.13 or newer.

1. Get a free API key from [openrouter.ai](https://openrouter.ai)
2. Install and configure:
```bash
npm install
cp .env.example .env     # then put your key in .env
npm start
```
3. Open http://localhost:3000

If the default model stops being free, pick another `:free` model from OpenRouter and set it in `MODEL` in `.env`.
