# Study copilot (stages 1 and 2)

Upload a test paper, mark your answers, see your mistakes grouped by idea.

## Run it on this laptop

1. In this folder, create a file named `.env.local` with one line:
   `ANTHROPIC_API_KEY=` followed by the key. Never share the key or put it in chat.
2. Start the app: `npm run dev`
3. Open http://localhost:3000

## Where things are kept

- Uploaded papers and results: `data/papers/` on this computer only.
- Every paid AI call, with its cost: `data/usage.jsonl`.

## What stage 1 does and does not do

Built: upload (PDF or photos), reading the questions, picking up answers marked on the paper,
answer grid, answer key (printed key if the paper has one, otherwise two independent AI solves that must agree),
marks, mistakes grouped by idea, "this looks wrong", continue after a failure.
Fixing an idea: small steps on the student's own question with a nudge and a hint, a new question to try alone,
a second go at the other questions from the same idea, and a doubt box.

Which AI model does which job is set in `models.json`.

Not built yet: mistake notebook and rechecks (stage 3),
written-answer questions, accounts, hosting.

The plan and decisions are in `../06-COPILOT-DIRECTION-v1.8.md`.
