# CLAUDE.md — Real-Time Messaging App

This file is the persistent context for this project. Read it fully before making any suggestions or writing any code. It exists so that a new session (even on a different machine, with no prior conversation history) can pick up exactly where the last one left off.

## Project Summary

A real-time messaging application built on the **MERN stack**, where users can:
- Create an account and log in
- Search for and add other users as contacts
- Exchange text messages in real time (live delivery, not manual refresh)

This is a **learning project**. The developer (Jaden) is a junior developer, comfortable with MERN from a prior finance manager app, but new to real-time/WebSocket-based systems. Real-time communication initially felt daunting because it was assumed to require peer-to-peer networking — this was clarified early on: **the app uses a client-server-client model, not true P2P.** Every message flows Client A → Server → Client B. This clarification meaningfully reduced perceived complexity and should be reinforced in any future explanations.

## Learning & Teaching Approach — Read This First

**Priority: conceptual understanding over code delivery.** When helping on this project:
- Act as a senior/tutor explaining *why*, not just *what* — architectural reasoning first, code second.
- Don't just hand over full code blocks by default. Walk through the concept, then build the code collaboratively, checking understanding along the way.
- Correct imprecise mental models explicitly (e.g., "schema fields are not variables — no data exists until a document is created from the schema"). Jaden actively wants these distinctions caught and explained, not glossed over.
- Explain built-in behaviors precisely — e.g., clarify what `unique: true` actually does under the hood (a MongoDB index constraint, not a JS-level validator function) rather than letting assumptions slide.
- Follow the phase order below — don't skip ahead to sockets before REST/data modeling is solid, and don't introduce Redis/scaling concerns until the relevant phase.

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Database | MongoDB | Via Mongoose ODM |
| Server | Express (Node.js) | REST API layer |
| Real-time | **Socket.io** | New for Jaden — the only unfamiliar core technology. Wraps the existing HTTP server; not a replacement for Express. |
| Client | React | `socket.io-client` on the frontend, paired with backend `socket.io` |
| Auth | JWT (`jsonwebtoken`) + `bcrypt` | Reused for both REST route protection AND Socket.io handshake authentication |
| Module system | **ESM** (`import`/`export`), not CommonJS | Backend was converted from CommonJS to ESM mid-project (Jaden's request) so backend syntax matches the React frontend's module syntax. `backend/package.json` has `"type": "module"`. Enables top-level `await` (used in `server.js` for `mongoose.connect()`). Relative imports **require the explicit `.js` extension** (`./models/User.js`, not `./models/User`) — Jaden has hit this exact error twice already omitting it; flag it proactively whenever a new relative import is added. |

### Backend dependencies (finalized list)

Core:
```
express mongoose dotenv cors
```
Real-time:
```
socket.io
```
Auth:
```
jsonwebtoken bcrypt
```
Validation & security hardening:
```
express-validator express-rate-limit helmet
```
Dev-only:
```
nodemon  (installed with -D)
```
Optional / future (not installed yet):
- `multer` — only if/when file/image attachments are added to messages
- `@socket.io/redis-adapter` + `redis` — only needed if deploying across multiple server instances (Phase 9 concern, not needed for single-instance deployment)

Frontend will additionally need `socket.io-client` (not yet detailed in this doc — ask if a full frontend dependency list is needed).

## Core Architectural Principle: Dual-Channel Design

Two parallel communication channels between client and server:

1. **REST API** — for anything non-live: auth (signup/login), contact management (search, request, accept), fetching message history, loading a conversation on open.
2. **Socket.io (WebSocket)** — for anything live: new incoming messages, typing indicators, online/offline presence.

Rule of thumb given to Jaden: *if it needs to happen instantly without a refresh, it's a socket event; if it's a one-time fetch/save, it's REST.*

## Data Models (MongoDB / Mongoose)

Four collections, finalized design:

### User — `backend/models/User.js`
```js
{
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 30 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, minlength: 8, select: false },
  avatarUrl: { type: String, default: '' },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true }
```
Status: **finalized and written, including the `pre('save')` password-hashing hook** (bcrypt, salt round 10, only re-hashes when `isModified('password')`). Field names differ slightly from the original design doc (`isOnline` not `online`, added `avatarUrl`, `password` has `select: false` so it's excluded from queries by default). `password` is also marked `select: false` — a query like `User.find()` won't return the hash unless explicitly requested with `.select('+password')`.

No manual `userId` field — MongoDB's auto-generated `_id` (ObjectId) is used as the user identifier everywhere (contacts, conversations, messages, JWT payload).

### Contact — `backend/models/Contact.js`
```js
{
  requestedBy: { type: ObjectId, ref: 'User', required: true },
  recipient: { type: ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted'], default: 'pending' },
}, { timestamps: true }
```
Status: **written.** Diverged from the original `userA`/`userB` sketch after a design discussion: a plain `userA`/`userB` pair can't express *who initiated* the request, which is needed for accept/reject flows. Jaden's first instinct was a boolean flag, corrected to two explicitly-named `ObjectId` refs instead (`requestedBy` / `recipient`) — avoids the redundancy of storing the same person's ID in two different fields, and avoids an implicit "true means which person?" convention. Still a separate collection rather than an array field on `User`, since querying "who has requested me" needs to work bidirectionally.

### Conversation — `backend/models/Conversation.js`
```js
{
  participants: { type: [ObjectId] /* ref: 'User' */, required: true }, // validated: length >= 2
  isGroup: { type: Boolean, default: false },
  groupName: { type: String, trim: true, required: function() { return this.isGroup; } },
  groupAdmin: { type: ObjectId, ref: 'User', required: function() { return this.isGroup; } },
  lastMessage: { type: ObjectId, ref: 'Message' },
}, { timestamps: true }
```
Status: **written**, and expanded beyond the original design — group-chat scaffolding (`isGroup`, `groupName`, `groupAdmin`) and a `lastMessage` ref (useful later for rendering a conversation list preview without a separate query) were added while coding it, not just the plain `participants` array originally sketched.

### Message — `backend/models/Message.js`
```js
{
  conversation: { type: ObjectId, ref: 'Conversation', required: true },
  sender: { type: ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, trim: true, maxlength: 5000 },
  readBy: [{ type: ObjectId, ref: 'User' }],
}, { timestamps: true }
```
Status: **written**, including the compound index `messageSchema.index({ conversation: 1, createdAt: 1 })`. Note the field names ended up as `conversation`/`sender`/`content` rather than the originally sketched `conversationId`/`senderId`/`text` — keep this in mind when writing routes/queries against this model.

## Nine-Phase Build Plan

1. **Auth** — signup/login, JWT issuance, protected REST routes. (Familiar territory, refresher of finance-app pattern.)
2. **Contacts** — REST endpoints: search users, send/accept/reject contact requests, list contacts.
3. **REST messaging (no sockets yet)** — get-or-create conversation, fetch message history, send a message — all via plain REST first, with manual refresh. Deliberately built before sockets to isolate bugs (data layer vs. real-time layer).
4. **Socket.io integration** — the core new-concept phase. Covers:
   - Handshake authentication (verifying JWT at socket connection time, not per-message)
   - Rooms (grouping connected clients by conversation ID for targeted broadcasting)
   - Emit/listen pattern (`send_message` → server persists to MongoDB → `receive_message` broadcast to the room)
5. **Presence & typing indicators** — more socket events layered on the same connection; introduces debouncing for typing events.
6. **Read receipts** — updating the `readBy` array on ack from recipient; introduces race-condition/idempotency thinking.
7. **Frontend chat UI** — message list, input, conversation sidebar; merging REST-fetched history with live socket events into one deduplicated state array.
8. **Security hardening** — rate-limiting message sends, sanitizing message text, verifying conversation participancy before allowing room join or history fetch, never trusting client-supplied `senderId`.
9. **Deployment** — single Node/Express + Socket.io instance is sufficient for this scope; noted limitation that multi-instance scaling requires a Redis adapter for Socket.io to broadcast correctly across instances (not needed now).

## Current Progress Status

- [x] Architecture decided: client-server-client, dual-channel (REST + Socket.io)
- [x] Full data model design discussed for all 4 collections
- [x] `User` Mongoose schema written, **including password hashing `pre('save')` hook**
- [x] `Conversation` schema written (expanded with group-chat fields, see above)
- [x] `Message` schema written, including the compound index
- [x] Backend dependency list finalized and installed
- [x] Repo git hygiene fixed: `.gitignore` actually populated (`.env`, `node_modules`), `node_modules` fully untracked from git history (was accidentally committed early on — verify with `git ls-files | grep -c node_modules` → should be `0`)
- [x] `backend/.env` created (`MONGO_URI`, `JWT_SECRET`, `PORT`) — not committed, correctly gitignored
- [x] JWT taught in depth conceptually: header.payload.signature structure, payload is base64-encoded (readable) not encrypted, signature verifies integrity not confidentiality, stateless verification is why the same token works for both REST middleware and the Socket.io handshake. No need to re-teach from scratch — a quick refresher is enough if Jaden asks.
- [x] `Contact` schema written — all 4 models complete
- [x] Backend converted from CommonJS to ESM (`"type": "module"`, all `require`/`module.exports` replaced with `import`/`export`) — see Tech Stack row above
- [x] `server.js` fully built and tested: `dotenv` → middleware (`express.json`, `cors`, `helmet`) → `mongoose.connect()` (top-level `await`, no wrapper function needed thanks to ESM) → `app.listen()` nested inside the connection's success path so the server never accepts requests before the DB is ready. Boots cleanly, confirmed connecting to the real Atlas cluster.
- [x] `npm run dev` script added (`"dev": "nodemon server.js"`) for auto-restart during development
- [x] **Phase 1 (Auth) — complete.** `POST /api/auth/signup` and `POST /api/auth/login` both built, debugged, and verified working end-to-end against the real database (see build notes below).
- [ ] Phase 2 (Contacts) — not started. This is the next work to pick up.
- [ ] Everything from Phase 3 onward — not started

### Phase 1 (Auth) build notes

**Structure:** Route/Controller separation, established as a standing convention going forward (Jaden's request, for organization) — `backend/routes/authRoutes.js` stays thin (just `router.post('/signup', signup)` style wiring, named imports from the controller), all actual logic lives in `backend/controllers/authController.js`. Mounted in `server.js` via `app.use('/api/auth', authRoutes)`.

**`signup`:** destructures `{ username, email, password }` from `req.body`, calls `User.create(...)` (triggers the password-hashing `pre('save')` hook automatically), signs a JWT (`{ userId }` payload, `expiresIn: '7d'`), responds `201` with `{ token, user: { id, username } }` — never the raw document. `catch` block differentiates `11000` (duplicate key → `409`) from `ValidationError` (→ `400`) from anything else (→ `500`, logged with `console.error`).

**`login`:** destructures `{ email, password }`, looks up the user with `User.findOne({ email }).select('+password')` (required since `password` has `select: false` — the `+` prefix overrides that default for this one query), compares with `bcrypt.compare(password, user.password)`. **Both "no such user" and "wrong password" return the identical generic `401` message** — deliberate, to avoid letting an attacker enumerate which emails are registered by comparing error text. On success: same JWT-issuing pattern as `signup`, `200` (not `201` — nothing new is created).

**Real bugs hit and fixed while building this, worth knowing about since they could resurface in similar code later:**
1. **`pre('save')` hook crashed on the very first real signup** (`TypeError: next is not a function`) — the hook was declared `async function (next)` and still called `next()` inside. Mixing Mongoose's two middleware styles (callback-style `next` vs. promise-style `async`, no `next` param at all) doesn't work — an `async` hook must not take or call `next`, just `return`/throw. This bug passed `node --check` and even a working server boot without issue — it was only exposed the moment a real `.save()` actually executed the hook, which is a good reminder that syntax-checking and booting don't guarantee every runtime path is correct.
2. **Missing `return` after an early-exit response inside `login`** caused `ERR_HTTP_HEADERS_SENT` — sending a `401` for "no user found" without `return`ing let execution fall through to `bcrypt.compare(password, user.password)` against a `null` user, throwing, which then hit the `catch` block and tried to send a *second* response. Standing rule now: any conditional response sent before the end of a handler must `return` immediately after.
3. Verified via live `curl`/Postman tests against the real database at each step, not just code review — caught both bugs above this way.

## Conventions Established So Far

- Model files: one Mongoose model per file, `export default mongoose.model('Name', schema)` pattern (ESM), filename PascalCase matching the model name exactly (`User.js`, not `user.js` — matters for portability, since macOS's default filesystem is case-insensitive but Linux/production typically isn't).
- `{ timestamps: true }` used on every schema for automatic `createdAt`/`updatedAt`.
- Route/Controller separation: route files (`backend/routes/*.js`) only wire `router.<method>(path, handlerFn)` using named imports; all actual logic lives in `backend/controllers/*.js`, exported as named exports (not default) since each controller file holds multiple handlers.
- HTTP status code conventions, now concretely established via `signup`/`login`: `200` success (nothing created), `201` success + a resource was created, `400` validation failure, `401` auth failure (deliberately identical message for every failure reason on `login`, to avoid user enumeration — see Security Practices), `409` duplicate key, `500` unexpected server error (always `console.error`-logged server-side even though the client just gets a generic message).
- Duplicate-key errors (Mongo error code `11000`, from `unique: true` indexes) are handled explicitly in route `catch` blocks with a 409 response — not left as generic 500s.
- Reference fields use `mongoose.Schema.Types.ObjectId` with `ref: 'ModelName'` to enable `.populate()` later.
- JWT payload is kept minimal — just `{ userId }`, signed with `process.env.JWT_SECRET`, `expiresIn: '7d'`. Same token-issuing snippet used in both `signup` and `login`.
- Never send a raw Mongoose document back to the client in a response — `select: false` only hides a field from future *queries*, not from a document already in hand (e.g. right after `.create()` or a `.select('+password')` lookup). Always build an explicit response object listing only the intended fields.
- Any conditional early-exit response inside a route handler (e.g. "user not found") must `return` immediately after sending it — otherwise execution keeps running and can attempt to send a second response later, throwing `ERR_HTTP_HEADERS_SENT`.

## Anti-Patterns to Avoid (established via corrections in earlier sessions)

- Don't store contacts as an embedded array on the User document — use a separate Contact/Relationship collection.
- Don't build Phase 4 (sockets) before Phase 3 (REST messaging) is working — isolate the real-time layer from the data layer for easier debugging.
- Don't confuse `unique: true` (a MongoDB index constraint, enforced at insert time, surfaces as error code 11000) with Mongoose validators like `required`/`minlength` (enforced in the JS layer before the DB is touched, surface as `ValidationError`).
- Don't add a manual `userId` field — use MongoDB's native `_id`.
- Don't confuse `express.Router()` with `express()` — `Router()` builds a mountable sub-set of routes meant to be attached to an app via `app.use()`; it has no `.listen()` and cannot serve as the main application object. Jaden made this exact mistake once; corrected.
- Don't trust a git commit message as proof a fix landed — verify. An earlier session committed "removed node_modules from tracking and added .gitignore" but the `.gitignore` was actually empty and `node_modules` was still fully tracked; it looked done but wasn't. Always confirm with `git status` / `git ls-files` after git-hygiene changes, not just the commit log.
- Don't give a Mongoose `pre('save')` hook both an `async` signature *and* a `next` parameter it calls — pick one middleware style. `async function (next) { ...; next(); }` throws `TypeError: next is not a function` at the first real `.save()`, because Mongoose doesn't pass a working callback to an async hook (it expects you to just `return`/throw). This exact bug shipped silently through `node --check` and a working server boot — it only surfaced the first time a real document was actually saved.
- Don't send a response inside an `if` guard without `return`ing right after — execution otherwise keeps going and can hit a second `res.status().json()` later in the same request, crashing with `ERR_HTTP_HEADERS_SENT`. Hit this exactly in `login`'s "no user found" check.
- Don't use `app.use()` in place of a method-specific route (`app.post()`, etc.) — `.use()` matches *any* HTTP method and path *prefixes*, not exact paths. It's correct for mounting middleware/routers (e.g. `app.use('/api/auth', authRoutes)`), wrong for defining an actual endpoint, since it would let the wrong HTTP method trigger a handler that should be restricted (e.g. a `GET` accidentally triggering signup logic meant only for `POST`).

## Security Practices Established

- **Any credential committed to git is considered compromised the instant it's committed** — regardless of whether the repo is public/private, or whether the project "matters." Rotate immediately; don't spend time trying to assess actual exposure first.
- Rotating a MongoDB credential happens in **Atlas → your Project → Database Access** (the actual DB user/password used in connection strings) — **not** the Organization-level "Users" page (that's human accounts that log into the Atlas website, a different thing entirely). Jaden mixed these up once; corrected.
- `.env` must actually be listed in a populated `.gitignore` before it's created — verified working (empty gitignore silently defeats the purpose) before any real secrets went into `backend/.env`.
- `login` returns the exact same generic `401` message for "no account with that email" and "wrong password" — deliberately. Distinguishing the two in the response would let an attacker enumerate which emails are registered just by watching which error text comes back.
- Never send a raw Mongoose document (or an unfiltered spread of one) in an API response — `select: false` prevents accidental exposure via a lazy query, but a document already fetched in memory (e.g. via `.select('+password')` for login's comparison step) still has the real password hash sitting on it until the response is deliberately built as an explicit, whitelist-style object.