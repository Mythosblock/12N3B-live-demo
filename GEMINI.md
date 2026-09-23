# EMO1 · Firebase App Hosting

This is a TanStack Start (SSR) app. Deploy with **Firebase App Hosting**, not
Firebase Hosting (static). Static Hosting cannot run the EMO1 server functions
or the audit ledger.

## Project

- Firebase project id: `n3b-5db0f`
- GitHub: `Mythosblock/12N3B-live-demo`
- Branch: `emo1-firebase`
- App Hosting backend id: `emo1`
- Node: 22
- Build: `npm run build` (Nitro preset `firebase_app_hosting`)
- Run: `node .output/server/index.mjs`
- Auth is **off**. Do not enable Better Auth or set `VITE_AUTH_ENABLED=true`.
- Optional secret: `DATABASE_URL` (Postgres). Without it, PGLite is in-memory
  and wipes on cold start.

## Agent rules

1. Prefer Firebase App Hosting over Firebase Hosting.
2. Do not add a `hosting.public` SPA rewrite. That would 404 server functions.
3. Do not reintroduce a Vercel / `.vercel` deploy path.
4. Keep `NITRO_PRESET=firebase_app_hosting` for production builds.
5. Never commit `.env`, secrets, `node_modules`, or `.vercel`.

## Paste into Gemini CLI

After `gemini extensions install https://github.com/firebase/agent-skills` and
`firebase use n3b-5db0f`, paste:

```
Use Firebase App Hosting (not Firebase Hosting) to deploy this TanStack Start SSR app.

Firebase project: n3b-5db0f
GitHub repo: Mythosblock/12N3B-live-demo
Branch: emo1-firebase
Backend id: emo1
Region: us-central1
Root directory: .
Node 22.

This app is SSR. Do NOT configure firebase.json hosting.public or SPA rewrites.
Keep firebase.json apphosting.backendId = emo1.
Keep apphosting.yaml scripts.buildCommand = npm run build and
runCommand = node .output/server/index.mjs.
Keep NITRO_PRESET=firebase_app_hosting and VITE_AUTH_ENABLED=false.

If backend emo1 does not exist, create it with:
firebase apphosting:backends:create --backend emo1 --primary-region us-central1 --root-dir . --project n3b-5db0f

Then deploy with Firebase App Hosting and give me the hosted.app URL.
Do not deploy to firebaseapp.com static Hosting.
```
