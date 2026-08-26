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

Jaden also proposed (twice) storing contacts as an array directly on `User` instead of a separate collection/query — first eliminating `Contact` entirely, then a hybrid (`User.contacts: [ObjectId]` referencing `Contact` docs). Both were talked through and rejected: an array can't represent `pending`/`accepted` state without becoming a nested version of `Contact` anyway, and any array-on-`User` approach reintroduces a dual-write consistency problem (two documents must be updated together for one conceptual change) that a single `Contact` document avoids entirely. The actual fix for his underlying performance concern (`Contact` collection growing large) was **indexing**, not restructuring the schema.

**Indexes added and verified:** `contactSchema.index({ requestedBy: 1 })` and `contactSchema.index({ recipient: 1 })` are both in the file now. Confirmed with `Contact.collection.getIndexes()` (shows `_id_`, `requestedBy_1`, `recipient_1`) and `.explain('executionStats')` on a real query (`executionStages.stage` came back `IXSCAN`, not `COLLSCAN`) — not just assumed, actually verified the index is used. `User.username`/`User.email` did **not** need new indexes — `unique: true` already creates one for each, covering `login`'s exact-match lookup. `searchUser`'s unanchored `$regex` (partial, "contains anywhere" match) would **not** benefit from a normal index regardless — noted as a known limitation, not something worth optimizing at this project's scale.

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
2. **Contacts** — REST endpoints: search users, send/accept/reject contact requests. (**"List all contacts" was deliberately dropped** — see Phase 2 build notes below for the reasoning; a home-screen "list conversations" endpoint replaces it, moved to Phase 3.)
3. **REST messaging (no sockets yet)** — get-or-create conversation, fetch message history, send a message, **list conversations for the home screen (iMessage-style, sorted by recency, using `Conversation.lastMessage`)** — all via plain REST first, with manual refresh. Deliberately built before sockets to isolate bugs (data layer vs. real-time layer).
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
- [x] `backend/middleware/authMiddleware.js` written and tested — verifies JWT on protected routes, sets `req.userId`
- [x] **Phase 2 (Contacts) — complete.** `addFriend`, `searchUser`, `listRequests`, `acceptFriend`, `rejectFriend` all built, debugged, and verified end-to-end (curl + Postman) — see build notes below.
- [x] `Contact` indexed on `requestedBy`/`recipient` — verified actually used via `.explain()`, not just assumed
- [ ] Everything from Phase 3 onward — not started (Phase 3 now includes `listConversations` for the home screen, see Nine-Phase Build Plan above). **This is the next work to pick up.**

### Phase 1 (Auth) build notes

**Structure:** Route/Controller separation, established as a standing convention going forward (Jaden's request, for organization) — `backend/routes/authRoutes.js` stays thin (just `router.post('/signup', signup)` style wiring, named imports from the controller), all actual logic lives in `backend/controllers/authController.js`. Mounted in `server.js` via `app.use('/api/auth', authRoutes)`.

**`signup`:** destructures `{ username, email, password }` from `req.body`, calls `User.create(...)` (triggers the password-hashing `pre('save')` hook automatically), signs a JWT (`{ userId }` payload, `expiresIn: '7d'`), responds `201` with `{ token, user: { id, username } }` — never the raw document. `catch` block differentiates `11000` (duplicate key → `409`) from `ValidationError` (→ `400`) from anything else (→ `500`, logged with `console.error`).

**`login`:** destructures `{ email, password }`, looks up the user with `User.findOne({ email }).select('+password')` (required since `password` has `select: false` — the `+` prefix overrides that default for this one query), compares with `bcrypt.compare(password, user.password)`. **Both "no such user" and "wrong password" return the identical generic `401` message** — deliberate, to avoid letting an attacker enumerate which emails are registered by comparing error text. On success: same JWT-issuing pattern as `signup`, `200` (not `201` — nothing new is created).

**Real bugs hit and fixed while building this, worth knowing about since they could resurface in similar code later:**
1. **`pre('save')` hook crashed on the very first real signup** (`TypeError: next is not a function`) — the hook was declared `async function (next)` and still called `next()` inside. Mixing Mongoose's two middleware styles (callback-style `next` vs. promise-style `async`, no `next` param at all) doesn't work — an `async` hook must not take or call `next`, just `return`/throw. This bug passed `node --check` and even a working server boot without issue — it was only exposed the moment a real `.save()` actually executed the hook, which is a good reminder that syntax-checking and booting don't guarantee every runtime path is correct.
2. **Missing `return` after an early-exit response inside `login`** caused `ERR_HTTP_HEADERS_SENT` — sending a `401` for "no user found" without `return`ing let execution fall through to `bcrypt.compare(password, user.password)` against a `null` user, throwing, which then hit the `catch` block and tried to send a *second* response. Standing rule now: any conditional response sent before the end of a handler must `return` immediately after.
3. Verified via live `curl`/Postman tests against the real database at each step, not just code review — caught both bugs above this way.

### Phase 2 (Contacts) build notes, so far

**`authMiddleware` (`backend/middleware/authMiddleware.js`):** lives in its own folder, not inside `authController.js` — it's a cross-cutting concern reused by every future protected route, not auth-specific business logic. Reads `req.headers.authorization`, splits off the `"Bearer "` prefix, verifies with `jwt.verify(token, process.env.JWT_SECRET)`. Missing header → `401`; invalid/expired token (caught from `jwt.verify` throwing) → `401`; success → `req.userId = decoded.userId` then `next()`. Used as a second argument on protected routes: `router.post('/request', authMiddleware, addFriend)`.

**Route/Controller pattern repeated for Contacts:** `backend/routes/contactRoutes.js` + `backend/controllers/contactController.js`, mounted in `server.js` as `app.use('/api/contact', contactRoutes)` — note it's singular (`/api/contact`), inconsistent with nothing else yet, just worth being aware of for future contact-related routes so they stay consistent with each other.

**`addFriend`:** destructures `recipient` from `req.body`; `requestedBy` comes from `req.userId`. Guards, in order: reject `recipient === req.userId` (self-request, `400`); reject if a `Contact` already exists between the two people in *either* direction via `$or: [{requestedBy: A, recipient: B}, {requestedBy: B, recipient: A}]` (`409`) — each `$or` branch is an implicit AND of both fields, the `$or` combines the two possible directions, not the two fields; otherwise `Contact.create({ requestedBy, recipient })` (`status` defaults to `'pending'`), `201`.

**`searchUser`:** `GET`, reads `req.query.username` (not `req.body` — it's a search, not a mutation). Case-insensitive partial match via `User.find({ username: { $regex: username, $options: 'i' }, _id: { $ne: req.userId } }).select('username avatarUrl')` — excludes the searcher themselves. **Known, deliberately deferred security gap:** `username` is user-controlled and passed directly as a `$regex` pattern — a real regex-injection/ReDoS risk, explicitly deferred to Phase 8 (security hardening) rather than fixed now, consistent with not skipping ahead on security concerns before their phase.

**Design decision — `listContacts` dropped entirely.** Originally planned per the Nine-Phase list, but Jaden pushed back mid-build: this app should behave like iMessage, which has no "browse all your contacts" screen at all — the home screen is driven by *conversations*, not a friends list. The `Contact` model and request/accept flow are still necessary (they gate who can message whom, and track pending/accepted state) — only the dedicated "list all contacts" *endpoint* was cut. Confirmed this aligns with an existing design decision: `Conversation.lastMessage` was added specifically to support a conversation-list home screen without extra queries, so `listConversations` (Phase 3) was already anticipated by the data model even before this conversation happened.

**Real bugs hit and fixed while building this — same "syntax-checks fine, breaks at runtime" pattern as Phase 1:**
1. `const router = express.Router;` (missing parens) and a missing `export default router;` — both in `contactRoutes.js`, both would have broken the route at load/mount time.
2. In `authMiddleware`: reassigning a `const`, calling `.split` without invoking it (`token.split` vs `token.split(' ')`), and initially no guard for a missing header, empty `catch`, and no `next()`/`req.userId` on success — built up incrementally, same "one concept, check, next concept" cadence as Phase 1.
3. In `addFriend`: `req._id` used instead of `req.userId` (middleware doesn't set `_id`); `Contact.create({ requestedBy: "userId", recipient })` — quoted string literal instead of the variable, would have cast-errored since `requestedBy` expects an `ObjectId`, not the literal text `"userId"`.
4. `console.log`/`console.error` placed *after* a `return` in the same block (dead code, never executes) — happened three separate times across this phase; worth double-checking on every new handler.
5. Verified via curl (server-side proof) and Postman (client-side, since that's what Jaden actually uses for manual testing) — a Postman-specific issue came up where every request 404'd because the HTTP method dropdown was left on the default `GET` instead of `POST`; another where "No token provided" turned out to mean the `Authorization` header wasn't attached to the request in Postman at all (Postman doesn't share auth across requests automatically — has to be set per-request, or via environment variables/scripts).

**`listRequests`:** `GET /api/contact/requests`. Finds pending `Contact` docs where `recipient: req.userId` (i.e., requests waiting on *this* user to respond — not ones they sent). First real use of `.populate('requestedBy', 'username avatarUrl')` — the distinction from `.select()` was a point of confusion worth remembering: `.select()` only trims fields on the document you're *directly* querying; `.populate()` is needed when a field is just an `ObjectId` reference into a *different* collection (here, `requestedBy` points into `User`) — it runs a second lookup and substitutes the real document in place of the bare ID. Verified end-to-end: the populated result showed real `username`/`avatarUrl`, and a sender's own `listRequests` call correctly came back empty (they're not a `recipient` of anything).

**`acceptFriend`:** `PATCH /:id/accept`. First use of **route parameters** (`req.params.id`) — a third data source alongside `req.body`/`req.query`, used specifically because this acts on one already-existing resource identified by its own ID in the URL, not a new payload or a filter. Fetches via `Contact.findById(id)` (not a search by the pair of people — the document already exists, so it's looked up directly by primary key). Checks, in order: not found → `404`; **`contact.recipient.toString() !== req.userId` → `403`** (this is an **authorization** check, distinct from **authentication** — `authMiddleware` already confirmed *who* is asking, but says nothing about whether *this* user is allowed to act on *this specific* document; every handler touching an existing resource needs its own ownership check); not `'pending'` → `409`. On success: `contact.status = 'accepted'; await contact.save();` — using the already-fetched document instance directly, not a separate update call. Gotcha worth remembering: `contact.recipient` is a real `ObjectId` object, `req.userId` is a string (from the JWT payload) — comparing them with `===` would always be `false` even when equal, hence the explicit `.toString()`.

**`rejectFriend`:** `DELETE /:id/reject` — **deliberately `DELETE`, not `PATCH`**, since this removes the resource entirely rather than partially updating it (matches strict REST-verb semantics: `POST` create, `PATCH` partial update, `PUT` full replace, `DELETE` remove). Design decision: reject **deletes the `Contact` document** rather than adding a `'rejected'` status to the enum — simpler, no schema change, and it means the same two people can send a fresh request again later with no lingering record. Same 404/403/409 checks as `acceptFriend`, then `await contact.deleteOne()` — the **document-level** version (called on an already-fetched instance, takes no arguments, since the instance already knows its own `_id`) as opposed to the **model-level** `Contact.deleteOne(filter)` (which requires a filter argument and would be the wrong tool here since a specific document is already in hand).

**New status codes introduced this phase:** `403 Forbidden` ("I know who you are, but you're not allowed to do *this*" — distinct from `401`, "I don't know who you are at all") and `404 Not Found` (the resource itself doesn't exist).

**`addFriend`'s response was extended** to include the newly created document (`{ message: "Contact created", contact: newContact }`) rather than just a bare message — matches the same convention already used in `signup` (returning `user: { id, username }`), and is standard REST practice for a `201`: hand back a representation of what was actually created so the client doesn't have to make a separate request to learn its `_id` (needed, for example, to later cancel or reference that exact request).

**More bugs hit and fixed in this stretch:**
1. `Contact.findbyId(id)` — wrong casing (`findbyId` vs `findById`) *and* missing `await` in the same line, in an early draft of `rejectFriend`. The casing typo alone would throw `TypeError: ... is not a function` immediately — worth remembering that a method-name typo isn't caught by anything short of actually running the code.
2. Jaden asked whether `.deleteOne()` needs an argument — good moment to nail down the model-level-vs-document-level distinction above, since conflating them is an easy mistake.
3. Confirmed indexing (`.explain()`) actually gets used automatically by existing `.find()`/`.findOne()` calls with no code changes required — a query's execution plan, not the query syntax, is what changes when an index is added.

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
- Protected routes take `authMiddleware` as a second argument before the real handler: `router.<method>(path, authMiddleware, handlerFn)`. Downstream handlers read the authenticated user's ID from `req.userId` — never re-verify the token themselves.
- Search/query-string endpoints (`GET` with filters) read from `req.query`, not `req.body` — `req.body` is for `POST`/mutation payloads.
- Each resource gets its own `routes/*Routes.js` + `controllers/*Controller.js` pair, following the exact structure established for auth (`authRoutes.js`/`authController.js` → `contactRoutes.js`/`contactController.js`).
- HTTP method choice follows REST-verb semantics, not just "GET vs POST": `POST` creates a new resource, `PATCH` partially updates an existing one, `DELETE` removes one. Route params (`req.params`, e.g. `:id`) identify *which* existing resource an action targets — a third data source alongside `req.body` (mutations) and `req.query` (filters).
- Every handler that acts on a specific, already-existing document must check **authorization**, not just rely on `authMiddleware`'s **authentication**. Being logged in only proves who you are; it says nothing about whether you're allowed to modify *this particular* resource — e.g. `acceptFriend`/`rejectFriend` both verify `contact.recipient.toString() === req.userId` before acting, since `authMiddleware` alone can't know that.
- Once you already have a specific Mongoose document (e.g. from `findById`), act on it directly with instance methods (`.save()`, `.deleteOne()`) rather than a separate model-level call with a repeated filter — the instance already knows its own `_id`.
- `.populate('path', 'fields')` is for pulling in data from a *referenced* document in another collection (a field that's just an `ObjectId`); `.select('fields')` only trims fields already on the document being directly queried. Different tools for "reference to elsewhere" vs. "field on this same document."
- A `201 Created` response includes a representation of the resource that was actually created (e.g. `addFriend` returns `{ contact: newContact }`), not just a bare success message — matches what `signup` already did, and saves the client a follow-up request to learn the new resource's `_id`.

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
- Don't put quotes around a variable when it's meant to be a value reference — `requestedBy: "userId"` is the literal 6-character string `"userId"`, not the variable `userId`. Silent, easy-to-miss typo; surfaces as a Mongoose cast error since the schema expects an `ObjectId`, not arbitrary text.
- Don't assume `authMiddleware` sets `req._id` — it specifically sets `req.userId`. Mixing this up (as happened once in `addFriend`) silently produces `undefined` rather than an obvious error, since JS doesn't complain about reading a property that doesn't exist.
- Don't default to storing a relationship as an array on one of the two related documents just because it "looks more direct" — see the `Contact` model notes above. If the relationship needs its own state (`pending`/`accepted`) or must be queried from either side, model it as its own document and reach for an **index** if the concern is query performance, not a denormalized array.
- Don't assume a method name is right just because it "reads fine" — `Contact.findbyId` (wrong casing) doesn't exist and throws `TypeError` only at the moment it's actually called; nothing catches this ahead of time.
- Don't compare an `ObjectId` field straight to a string with `===` (e.g. `contact.recipient !== req.userId`) — always `false` even when they represent the same ID, since one is an object and the other a string. Convert explicitly with `.toString()` first.
- Don't treat "the user is logged in" (`authMiddleware` passed) as the same thing as "this user is allowed to do this." Every handler acting on a specific existing document needs its own authorization check (e.g. does `req.userId` match the resource's `recipient`/owner field) — authentication and authorization are two different questions.

## Security Practices Established

- **Any credential committed to git is considered compromised the instant it's committed** — regardless of whether the repo is public/private, or whether the project "matters." Rotate immediately; don't spend time trying to assess actual exposure first.
- Rotating a MongoDB credential happens in **Atlas → your Project → Database Access** (the actual DB user/password used in connection strings) — **not** the Organization-level "Users" page (that's human accounts that log into the Atlas website, a different thing entirely). Jaden mixed these up once; corrected.
- `.env` must actually be listed in a populated `.gitignore` before it's created — verified working (empty gitignore silently defeats the purpose) before any real secrets went into `backend/.env`.
- `login` returns the exact same generic `401` message for "no account with that email" and "wrong password" — deliberately. Distinguishing the two in the response would let an attacker enumerate which emails are registered just by watching which error text comes back.
- Never send a raw Mongoose document (or an unfiltered spread of one) in an API response — `select: false` prevents accidental exposure via a lazy query, but a document already fetched in memory (e.g. via `.select('+password')` for login's comparison step) still has the real password hash sitting on it until the response is deliberately built as an explicit, whitelist-style object.