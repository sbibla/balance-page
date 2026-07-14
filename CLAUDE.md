# Bibla Apps — Claude Context

## What This Project Is

A personal family web app deployed on Cloudflare Pages. It has two mini-apps behind a login screen:

- **Balance** — tracks a shared money balance with a transaction history
- **Chores** — tracks personal and shared household chores with streaks and push notifications

## Project Files

| File | Purpose |
|---|---|
| `index.html` | Login page |
| `home.html` | Home screen (app tile launcher) |
| `balance.html` | Balance tracker page |
| `chores.html` | Chores tracker page |
| `app.src.js` | **Readable source — edit this file** |
| `app.js` | Obfuscated build — regenerated from `app.src.js`, do not edit directly |
| `style.css` | All visual styling |
| `sw.js` | Service worker for push notifications |
| `version.txt` | App version string displayed in the footer |
| `wrangler.jsonc` | Cloudflare Worker config (push notifications) |
| `_headers` | Cloudflare Pages HTTP response headers |

## Key Technologies

- **Firebase Firestore** — database (no Firebase Auth; custom SHA-256 hash login)
- **Cloudflare Pages** — static site hosting
- **Cloudflare Workers** — push notification relay (`bibla-push.saar-bibla.workers.dev`)
- **Web Push / VAPID** — browser push notifications

## Project Rules

- **Always edit `app.src.js`**, never `app.js` directly
- **Bump `version.txt` before every push** — increment the patch number (e.g. `v0.143` → `v0.144`)
- **Regenerate `app.js` after editing `app.src.js`** using:
  ```
  npx javascript-obfuscator app.src.js --output app.js --compact true --string-array true --string-array-encoding base64 --string-array-threshold 0.75 --string-array-shuffle true --string-array-rotate true --split-strings true --split-strings-chunk-length 5 --transform-object-keys true --numbers-to-expressions true
  ```
- Do not add external JS libraries or frameworks
- `app.src.js` is in `.gitignore` — it stays local only

## Firestore Collections

| Collection | Documents | Shape |
|---|---|---|
| `users` | `{usernameHash}` | `{ passwordHash, alias, canAdd, apps }` |
| `balanceData` | `{userHash}` | `{ list: [ { id, date, amount, comment, originalComment } ] }` |
| `choresData` | `{userHash}`, `shared`, `config` | `{ list, streak }` / `{ list }` / `{ categories }` |
| `config` | `adminPush` | `{ subscription }` |

## Authentication Model

- Username and password are hashed client-side with SHA-256
- The username hash is the Firestore document ID in the `users` collection
- Session stored in `sessionStorage` — clears on tab close
- Admin users have `canAdd: true` in their user document

## Commit Style

Follow the existing pattern: `v0.NNN: short description of change`
