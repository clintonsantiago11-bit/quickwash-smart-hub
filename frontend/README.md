# QuickWash Smart Hub — dashboard (Next.js)

Next.js 16 App Router front-end for the QuickWash Smart Hub. Talks to the Laravel
API (`NEXT_PUBLIC_API_URL`) and, optionally, the Socket.IO edge bridge
(`NEXT_PUBLIC_WS_URL`).

```bash
npm run dev      # http://localhost:3000
npm run build    # production build (what the PaaS runs)
npm run start    # serve the production build
npm run lint     # eslint
npx tsc --noEmit # type check
```

Environment: copy `.env.production.example` for hosted deployments; local dev uses
`.env.local` (both are gitignored — the `.example` templates are the documentation).

Repo-wide docs: see `../README.md` (architecture, local demo) and `../DEPLOY.md`
(Railway deployment steps, env vars, health checks).
