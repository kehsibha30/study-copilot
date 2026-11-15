# Study copilot (stages 1 and 2)

Upload a test paper, mark your answers, see your mistakes grouped by idea.

## Run it on this laptop

1. Copy `.env.example` to `.env.local` and fill in the three values (Anthropic key, Supabase secret key,
   family password). Never share the keys or put them in chat.
2. Start the app: `npm run dev`
3. Open http://localhost:3000 and sign in with the family password.

## Where things are kept

- Everything lives in the Supabase project "Study copilot" (see `supabase/schema.sql`):
  papers, self-tests and topic questions in tables, uploaded pages in the private `papers` bucket.
- Every paid AI call, with its cost: the `usage` table.
- The laptop and the hosted version use the same database.

## Hosting (Vercel)

Set `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` and `APP_PASSWORD` in the Vercel project's
environment variables, then redeploy. Each background step is its own request (the host stops a request
after 5 minutes) and the next step is started by a call back to `/api/papers/<id>/continue`.

## What stage 1 does and does not do

Built: upload (PDF or photos), reading the questions, picking up answers marked on the paper,
answer grid, answer key (printed key if the paper has one, otherwise two independent AI solves that must agree),
marks, mistakes grouped by idea, "this looks wrong", continue after a failure.
Fixing an idea: small steps on the student's own question with a nudge and a hint, a new question to try alone,
a second go at the other questions from the same idea, and a doubt box.

Which AI model does which job is set in `models.json`.

Not built yet: mistake notebook and rechecks (stage 3),
written-answer questions, separate accounts per student.

The plan and decisions are in `../06-COPILOT-DIRECTION-v1.8.md`.
