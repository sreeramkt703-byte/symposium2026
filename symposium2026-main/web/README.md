# Exam app deployment

## Deploy to Vercel

1. Import the repository into Vercel and set **Root Directory** to `web`.
2. Select Node.js `22.x`, use `npm run build` as the build command, and `dist` as the output directory (the build settings are also in `vercel.json`).
3. Create/connect an Upstash Redis database. Add its REST URL and token as the Vercel project environment variables `KV_REST_API_URL` and `KV_REST_API_TOKEN`. If the integration provides `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, set the `KV_` variables to those same values.
4. Add a strong, private `ADMIN_SECRET` environment variable. Do not use the exam code as this secret.
5. Leave `VITE_API` unset so the app calls its same-origin Vercel Functions.
6. Redeploy after adding or changing environment variables.

The student app is served at `/`; the admin dashboard is at `/admin.html`. The dashboard uses `ADMIN_SECRET` for sign-in. Exam state, team records, locks, violations, and submissions are stored in KV so they persist between serverless invocations. The sample questions are in `data/questions.json`.

## Local development

Run the existing Express backend from `backend` and set `VITE_API` to its URL when the frontend is served from a different host. When running Vite on port 5173, the frontend defaults to the backend on port 5000. The Vercel KV API routes require KV credentials and `ADMIN_SECRET`; set those in the local environment to exercise them.
