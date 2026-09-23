# EMO1 · $12N3B evaluation console

Fail-closed evaluation runtime with a 12-evaluator, 3-bank registry.

**Deploy target: Firebase App Hosting** on project [`n3b-5db0f`](https://console.firebase.google.com/project/n3b-5db0f/apphosting).  
This is an SSR app (TanStack Start + Nitro). Do **not** deploy it as static Firebase Hosting.

## Branch

GitHub: [Mythosblock/12N3B-live-demo](https://github.com/Mythosblock/12N3B-live-demo)  
Live branch: **`emo1-firebase`**

## Deploy from the Firebase console

1. Open [App Hosting](https://console.firebase.google.com/project/n3b-5db0f/apphosting) (Blaze plan required).
2. Create a backend (or connect this repo to backend id `emo1`).
3. Import `Mythosblock/12N3B-live-demo`, live branch `emo1-firebase`, root `/`.
4. Automatic rollouts: on. Finish & deploy.

Cloud Build runs `npm run build` with `NITRO_PRESET=firebase_app_hosting` and starts `node .output/server/index.mjs`.

Optional secret: `DATABASE_URL` (Postgres). If unset, PGLite is in-memory per instance.

## Deploy with Gemini CLI (Firebase agent skills)

From a checkout of this branch:

```sh
npm install -g firebase-tools @google/gemini-cli
gemini extensions install https://github.com/firebase/agent-skills
npx skills add firebase/agent-skills
firebase login
firebase use n3b-5db0f
gemini
```

Then paste the prompt in `GEMINI.md` / the skill prompt shipped with this repo.

## Local

```sh
npm install
npm run dev
```

Production-shaped build:

```sh
NITRO_PRESET=firebase_app_hosting npm run build
npm start
```

## Runtime

- Runtime: EMO1
- Registry: $12N3B (12 evaluators, 3 banks, 3-of-4 quorum)
- Terminal states: SHIP / HOLD / REJECT
- No terminal decision without a durable audit write
- Demonstration environment — not an operational production control plane
