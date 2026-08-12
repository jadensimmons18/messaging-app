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

### User
```js
{
  username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true, minlength: 8 },  // hashed via pre('save') hook — not yet implemented
  online: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: true }
```
Status: **finalized and written**. Password hashing via `pre('save')` middleware discussed as the next concept but **not yet implemented in code**.

No manual `userId` field — MongoDB's auto-generated `_id` (ObjectId) is used as the user identifier everywhere (contacts, conversations, messages, JWT payload).

### Contact / Relationship
```js
{
  userA: { type: ObjectId, ref: 'User' },
  userB: { type: ObjectId, ref: 'User' },
  status: "pending" | "accepted"
}
```
Status: **designed conceptually, not yet written as code.** Deliberately a separate collection rather than an array field on User, since querying "who has userA added" bidirectionally gets messy with embedded arrays.

### Conversation
```js
{
  participants: [ObjectId] // ref: 'User'
}
```
Status: **designed conceptually, not yet written as code.** Designed as a participants array (not hardcoded to exactly 2 users) so group chats are a natural extension later, even though the current scope is 1:1 only.

### Message
```js
{
  conversationId: { type: ObjectId, ref: 'Conversation', required: true },
  senderId: { type: ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  readBy: [{ type: ObjectId, ref: 'User' }],
}, { timestamps: true }
```
Status: **designed conceptually, not yet written as code.**
Needs a compound index: `messageSchema.index({ conversationId: 1, createdAt: -1 })` — required for performant history lookups at scale, discussed but not yet added.

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
- [x] `User` Mongoose schema written (see above) — **no password hashing hook yet**
- [x] Backend dependency list finalized
- [ ] `Contact`, `Conversation`, `Message` schemas — designed but not yet coded
- [ ] Password hashing middleware (`pre('save')`) — next concept queued up, not started
- [ ] Phase 1 (Auth) routes — not started
- [ ] Everything from Phase 2 onward — not started

**Next concrete step (as of last session):** either write the `pre('save')` password-hashing hook for the User schema, or move on to coding the `Contact` schema. Confirm with Jaden which he wants to tackle first when resuming.

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