# Ember

A full-stack, real-time messaging app built with the MERN stack and Socket.io. Sign up, find people, and chat with live delivery and no page refresh. Messages from strangers land in a separate **Unknown** tab with an accept/reject banner, much like iMessage or Instagram message requests.

**Live demo:** [Ember](https://messaging-app-one-teal.vercel.app/)

> The backend runs on a free hosting tier that sleeps when idle. The first visit may show a "Waking up the server" popup for up to a minute while it boots.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Node](https://img.shields.io/badge/Node.js-Express%205-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-4.x-010101?logo=socket.io&logoColor=white)

## Try it without signing up

Click **Try the demo** on the login or signup page. It creates a throwaway guest account pre-loaded with realistic conversations (some with contacts, one from a stranger waiting for you to accept), so you can explore the whole app immediately. Guest accounts and all their data are deleted after 24 hours.

## Features

- **Accounts**: signup and login with JWT authentication and bcrypt-hashed passwords
- **Live messaging**: messages arrive instantly over WebSockets, with a connection indicator
- **Contacts and message requests**: search for people by username, start a conversation with anyone, and accept or reject first contact from strangers
- **Contacts / Unknown tabs**: conversations are filtered by whether you've accepted the other person
- **Conversation list**: sorted by latest activity, with message previews, timestamps, and search
- **Message history**: paginated, newest first, with "load earlier messages" and scroll-position preservation
- **Responsive UI**: a two-pane layout on desktop that collapses to a single pane on mobile
- **Cold-start handling**: a health check and wake-up notice so a sleeping free-tier server never looks like a broken site
- **Protected routes**: unauthenticated users are redirected to login, and expired tokens are cleared automatically

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router, Vite, socket.io-client |
| Backend | Node.js, Express 5 (ES modules) |
| Database | MongoDB, Mongoose |
| Real-time | Socket.io |
| Auth | JSON Web Tokens, bcrypt |
| Security | helmet, locked-down CORS, express-rate-limit |
| Hosting | Vercel (frontend), Render (backend), MongoDB Atlas |

## Architecture

The app uses a **client-server-client** model, not peer-to-peer. Every message goes from one client to the server, which saves it and then pushes it out to everyone in that conversation.

Two channels run side by side:

- **REST API**: anything that is a one-time fetch or save (auth, contacts, conversation list, message history)
- **Socket.io**: anything that must happen instantly (sending and receiving messages)

One JWT secures both. REST routes verify it in middleware, and Socket.io verifies it once during the connection handshake.

```
Client A ──► Server ──► MongoDB
                │
                └──► Client B   (broadcast to the conversation's room)
```

## Project Structure

```
ember/
├── backend/
│   ├── server.js               # Express + Socket.io + MongoDB bootstrap, CORS, health check
│   ├── routes/                 # Route wiring
│   ├── controllers/            # Request logic (auth, contacts, conversations, messages, demo)
│   ├── middleware/             # JWT auth middleware
│   ├── models/                 # User, Contact, Conversation, Message
│   ├── sockets/                # Handshake auth, rooms, send/receive messaging
│   └── demo/                   # Seed data for demo guest accounts
└── frontend/
    └── src/
        ├── pages/              # Login, SignUp, Messages
        ├── components/         # ChatWindow, NewMessageDialog, ProfileMenu, ServerWakeNotice, ...
        └── helpers/            # API wrapper, shared socket connection, formatting
```

## Getting Started

### Prerequisites

- Node.js 18 or newer
- A MongoDB database (a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster works well)

### 1. Clone

```bash
git clone https://github.com/jadensimmons18/messaging-app.git
cd messaging-app
```

### 2. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=5001
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=a_long_random_secret
FRONTEND_URL=http://localhost:5173
```

Start it:

```bash
npm run dev
```

> Run this from inside `backend/`: `dotenv` looks for `.env` in the directory you start the server from.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5001
```

Start it:

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `PORT` | backend | Port the API listens on (default `5001`) |
| `MONGO_URI` | backend | MongoDB connection string |
| `JWT_SECRET` | backend | Secret used to sign and verify JWTs |
| `FRONTEND_URL` | backend | The only origin allowed by CORS (REST and Socket.io) |
| `VITE_API_URL` | frontend | Base URL of the backend API |

## API Reference

Everything except signup, login, demo, and health requires an `Authorization: Bearer <token>` header.

### Auth: `/api/auth`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/signup` | Create an account (`username`, `email`, `password`), returns a JWT |
| POST | `/login` | Log in (`email`, `password`), returns a JWT |
| POST | `/demo` | Create a seeded guest account (rate limited to 10 per hour per network) |

### Contacts: `/api/contact`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/search?username=` | Case-insensitive partial username search (excludes yourself) |
| POST | `/request` | Send a contact request (`{ recipient }`) |
| GET | `/requests` | List pending requests addressed to you |
| PATCH | `/:id/accept` | Accept a request (recipient only) |
| DELETE | `/:id/reject` | Reject and delete a request (recipient only) |

### Conversations: `/api/conversation`

| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Get or create a 1:1 conversation (`{ participantId }`) |
| GET | `/?page=&limit=` | List your conversations by recent activity, each with an `isContact` flag |

### Messages: `/api/message`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/:conversationId?page=&limit=` | Message history, newest first |
| POST | `/:conversationId` | Send a message (`{ content }`) |

### Health

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Returns `{ ok: true }`, used by the frontend to detect a sleeping server |

## Real-Time Events (Socket.io)

The client connects with its JWT in the handshake:

```js
import { io } from 'socket.io-client';

const socket = io(API_URL, { auth: { token } });
```

| Direction | Event | Payload | Description |
|---|---|---|---|
| Client → Server | `join_conversation` | `conversationId` | Join a conversation's room (participants only) |
| Server → Client | `joined_conversation` | `conversationId` | Confirms the join |
| Client → Server | `send_message` | `{ conversationId, content }` | Save a message and broadcast it |
| Server → Client | `receive_message` | populated message | Sent to everyone in the room, including the sender |
| Server → Client | `error` | `{ message }` | Validation, not-found, or authorization failure |

Connections with a missing or invalid token are rejected during the handshake.

## Data Models

- **User**: `username`, `email`, hashed `password`, `avatarUrl`, `isDemo`
- **Contact**: `requestedBy`, `recipient`, `status` (`pending` or `accepted`)
- **Conversation**: `participants`, `lastMessage`, group-chat fields reserved for the future
- **Message**: `conversation`, `sender`, `content`

Design decisions worth knowing:

- **Contacts are their own collection**, not an array on `User`, so a request's direction and `pending`/`accepted` state can be queried from either side. `requestedBy` and `recipient` are indexed.
- **Contacts vs. Unknown is computed when you load the list**, from `Contact.status`, rather than stored on the conversation, so it can never go stale when someone accepts or rejects.
- **Anyone can message anyone.** Starting a conversation with a stranger creates a pending contact request that they can accept or reject.
- **Demo cleanup has no scheduled job.** Each new demo request also deletes expired guest data, and a hard cap on guest accounts keeps a free database from filling up.

## Security

- Passwords hashed with bcrypt and excluded from queries and responses by default
- JWT verified on every protected REST route and on every Socket.io connection
- CORS (REST and WebSockets) restricted to the configured frontend origin
- `helmet` for secure HTTP headers
- Login returns the same error for "unknown email" and "wrong password" to prevent account enumeration
- Authorization checks on every resource: authentication proves who you are, and each handler separately checks that you are allowed to touch *that* contact request or conversation
- Rate limiting on demo account creation, with `trust proxy` configured so limits apply per visitor behind the hosting proxy

## Deployment

- **Frontend**: Vercel, with a rewrite so client-side routes resolve to `index.html` (`frontend/vercel.json`). Set `VITE_API_URL` to the backend URL.
- **Backend**: Render web service running `node server.js`. Set `MONGO_URI`, `JWT_SECRET`, and `FRONTEND_URL` (your Vercel URL).
- **Database**: MongoDB Atlas.

## Possible Next Steps

- Typing indicators, online presence, and read receipts
- Group chats (the schema already reserves the fields)
- Image attachments
- Broader input validation and rate limiting beyond the demo endpoint
