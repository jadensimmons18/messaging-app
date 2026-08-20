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

### User — `backend/models/user.js`
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

### Contact / Relationship
```js
{
  userA: { type: ObjectId, ref: 'User' },
  userB: { type: ObjectId, ref: 'User' },
  status: "pending" | "accepted"
}
```
Status: **designed conceptually, not yet written as code.** This is the next uncoded model. Deliberately a separate collection rather than an array field on User, since querying "who has userA added" bidirectionally gets messy with embedded arrays.

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
- [ ] `Contact` schema — still the only model not yet coded
- [ ] `server.js` — **in progress, see status below**
- [ ] Phase 1 (Auth) routes — not started (blocked on `server.js` being finished first)
- [ ] Everything from Phase 2 onward — not started

### `server.js` build status (in progress)

Being built line-by-line, teaching each piece before it's added. Current contents as of last session:
```js
require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());
```
Already covered: `dotenv` (why it must load first), the `express()` factory vs. `express.Router()` distinction (Jaden initially wrote `express.Router()` for the main app by mistake — corrected; `Router()` is for later, when routes get split into files like `authRoutes.js` and mounted with `app.use('/api/auth', authRoutes)`), and `express.json()` middleware (parses JSON request bodies into `req.body`).

**Next concrete step (as of last session):** add `cors` middleware next — already explained conceptually (same-origin policy, why the React frontend on a different port needs it, `app.use(cors())` with no args for now since it's local dev). Jaden was about to write that line when this session ended. After `cors`: explain and add `helmet`, then `mongoose.connect()`, then `app.listen()`. Only after `server.js` is fully running should Phase 1 auth routes begin.

## Conventions Established So Far

- Model files: one Mongoose model per file, `module.exports = mongoose.model('Name', schema)` pattern, PascalCase model name matching camelCase schema variable (e.g., `userSchema` → `'User'`).
- `{ timestamps: true }` used on every schema for automatic `createdAt`/`updatedAt`.
- Duplicate-key errors (Mongo error code `11000`, from `unique: true` indexes) are handled explicitly in route `catch` blocks with a 409 response — not left as generic 500s.
- Reference fields use `mongoose.Schema.Types.ObjectId` with `ref: 'ModelName'` to enable `.populate()` later.

## Anti-Patterns to Avoid (established via corrections in earlier sessions)

- Don't store contacts as an embedded array on the User document — use a separate Contact/Relationship collection.
- Don't build Phase 4 (sockets) before Phase 3 (REST messaging) is working — isolate the real-time layer from the data layer for easier debugging.
- Don't confuse `unique: true` (a MongoDB index constraint, enforced at insert time, surfaces as error code 11000) with Mongoose validators like `required`/`minlength` (enforced in the JS layer before the DB is touched, surface as `ValidationError`).
- Don't add a manual `userId` field — use MongoDB's native `_id`.
- Don't confuse `express.Router()` with `express()` — `Router()` builds a mountable sub-set of routes meant to be attached to an app via `app.use()`; it has no `.listen()` and cannot serve as the main application object. Jaden made this exact mistake once; corrected.
- Don't trust a git commit message as proof a fix landed — verify. An earlier session committed "removed node_modules from tracking and added .gitignore" but the `.gitignore` was actually empty and `node_modules` was still fully tracked; it looked done but wasn't. Always confirm with `git status` / `git ls-files` after git-hygiene changes, not just the commit log.

## Security Practices Established

- **Any credential committed to git is considered compromised the instant it's committed** — regardless of whether the repo is public/private, or whether the project "matters." Rotate immediately; don't spend time trying to assess actual exposure first.
- Rotating a MongoDB credential happens in **Atlas → your Project → Database Access** (the actual DB user/password used in connection strings) — **not** the Organization-level "Users" page (that's human accounts that log into the Atlas website, a different thing entirely). Jaden mixed these up once; corrected.
- `.env` must actually be listed in a populated `.gitignore` before it's created — verified working (empty gitignore silently defeats the purpose) before any real secrets went into `backend/.env`.