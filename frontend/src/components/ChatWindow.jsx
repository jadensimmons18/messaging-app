import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { apiFetch } from '../helpers/api.js'
import { getSocket } from '../helpers/socket.js'
import { clockTime, dayLabel } from '../helpers/format.js'
import Avatar from './Avatar.jsx'
import './ChatWindow.css'

const PAGE_SIZE = 30
const GAP_FOR_DIVIDER = 30 * 60 * 1000 // show a time divider after 30 quiet minutes

// combine two message lists: no duplicates (by _id), oldest first
function mergeMessages(a, b) {
    const byId = new Map()
    for (const m of [...a, ...b]) byId.set(m._id, m)
    return [...byId.values()].sort((x, y) => new Date(x.createdAt) - new Date(y.createdAt))
}

function ChatThread({ conversation, onBack, onAccepted }) {
    const other = conversation.otherParticipants
    const me = JSON.parse(localStorage.getItem('user') ?? 'null')

    const [messages, setMessages] = useState([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [loadingMore, setLoadingMore] = useState(false)
    const [draft, setDraft] = useState('')
    const [sendError, setSendError] = useState('')
    const [connected, setConnected] = useState(() => getSocket().connected)
    const [request, setRequest] = useState(null) // pending contact request FROM the other person, if any
    const [requestBusy, setRequestBusy] = useState(false)
    const [requestError, setRequestError] = useState('')

    const listRef = useRef(null)
    const inputRef = useRef(null)
    const stickToBottom = useRef(true) // is the user reading the latest messages?
    const heightBeforePrepend = useRef(null) // set while loading older messages

    // 1. history over REST (newest page first, then reversed into reading order)
    useEffect(() => {
        let cancelled = false

        async function loadHistory() {
            try {
                const res = await apiFetch(`/api/message/${conversation._id}?limit=${PAGE_SIZE}`)
                const data = await res.json()
                if (!res.ok) throw new Error(data.message)
                if (cancelled) return
                setMessages((prev) => mergeMessages([...data.messages].reverse(), prev))
                setTotal(data.total)
                setStatus('ready')
            } catch {
                if (!cancelled) setStatus('error')
            }
        }
        loadHistory()

        return () => {
            cancelled = true
        }
    }, [conversation._id])

    // If they aren't a contact yet, check whether they're waiting on ME to accept.
    // (If I was the one who started the chat, the request isn't in my list and there's nothing to show.)
    useEffect(() => {
        if (conversation.isContact) return
        let cancelled = false

        async function loadRequest() {
            try {
                const res = await apiFetch('/api/contact/requests')
                const data = await res.json()
                if (!res.ok || cancelled) return
                setRequest(data.requests.find((r) => r.requestedBy._id === other._id) ?? null)
            } catch {
                // no banner is a safe fallback
            }
        }
        loadRequest()

        return () => {
            cancelled = true
        }
    }, [conversation.isContact, other._id])

    // 2. live messages over the socket
    useEffect(() => {
        const socket = getSocket()

        const onMessage = (message) => {
            if (message.conversation === conversation._id) {
                setMessages((prev) => mergeMessages(prev, [message]))
            }
        }
        const onError = (payload) => setSendError(payload.message)
        const onConnect = () => setConnected(true)
        const onDisconnect = () => setConnected(false)

        socket.on('receive_message', onMessage)
        socket.on('error', onError)
        socket.on('connect', onConnect)
        socket.on('disconnect', onDisconnect)

        return () => {
            socket.off('receive_message', onMessage)
            socket.off('error', onError)
            socket.off('connect', onConnect)
            socket.off('disconnect', onDisconnect)
        }
    }, [conversation._id])

    // keep the scroll position sensible whenever messages change
    useLayoutEffect(() => {
        const list = listRef.current
        if (!list) return

        if (heightBeforePrepend.current !== null) {
            // older messages were added on top: keep the same messages in view
            list.scrollTop += list.scrollHeight - heightBeforePrepend.current
            heightBeforePrepend.current = null
            return
        }

        if (stickToBottom.current) list.scrollTop = list.scrollHeight
    }, [messages, status])

    // focus the box on desktop (on a phone that would pop the keyboard open)
    useEffect(() => {
        if (window.matchMedia('(min-width: 761px)').matches) inputRef.current?.focus()
    }, [])

    function handleScroll() {
        const list = listRef.current
        stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80
    }

    async function loadEarlier() {
        setLoadingMore(true)
        try {
            const res = await apiFetch(`/api/message/${conversation._id}?limit=${PAGE_SIZE}&page=${page + 1}`)
            const data = await res.json()
            if (!res.ok) throw new Error(data.message)
            heightBeforePrepend.current = listRef.current.scrollHeight
            setMessages((prev) => mergeMessages([...data.messages].reverse(), prev))
            setPage((p) => p + 1)
        } catch {
            setSendError('Couldn’t load earlier messages.')
        }
        setLoadingMore(false)
    }

    // answer the request: accept = PATCH, reject = DELETE (the backend removes the Contact document)
    async function answerRequest(action) {
        setRequestBusy(true)
        setRequestError('')
        try {
            const res = await apiFetch(`/api/contact/${request._id}/${action}`, {
                method: action === 'accept' ? 'PATCH' : 'DELETE',
            })
            if (!res.ok) throw new Error()
            setRequest(null)
            if (action === 'accept') onAccepted(conversation._id)
            else onBack()
        } catch {
            setRequestError('Something went wrong. Try again.')
        }
        setRequestBusy(false)
    }

    function handleSubmit(e) {
        e.preventDefault()
        const content = draft.trim()
        if (!content) return

        setSendError('')
        stickToBottom.current = true
        getSocket().emit('send_message', { conversationId: conversation._id, content })
        setDraft('')
    }

    // build the visual list: dividers + grouped bubbles
    const items = []
    messages.forEach((m, i) => {
        const prev = messages[i - 1]
        const gap = prev ? new Date(m.createdAt) - new Date(prev.createdAt) : Infinity
        const newDay = prev ? dayLabel(m.createdAt) !== dayLabel(prev.createdAt) : true
        const divider = gap >= GAP_FOR_DIVIDER || newDay
        const startsGroup = divider || prev.sender._id !== m.sender._id

        if (divider) {
            items.push(
                <div className="chat__divider" key={`d-${m._id}`}>
                    <strong>{dayLabel(m.createdAt)}</strong> {clockTime(m.createdAt)}
                </div>
            )
        }

        const mine = m.sender._id === me?.id
        items.push(
            <div
                key={m._id}
                className={`chat__row ${mine ? 'chat__row--out' : 'chat__row--in'} ${startsGroup ? 'chat__row--start' : ''}`}
            >
                <div className="chat__bubble">{m.content}</div>
            </div>
        )
    })

    const hasEarlier = page * PAGE_SIZE < total

    return (
        <div className="chat">
            <header className="chat__header">
                <button type="button" className="chat__back" aria-label="Back to messages" onClick={onBack}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </button>
                <Avatar name={other.username} size={44} />
                <h2 className="chat__name">{other.username}</h2>
            </header>

            {request && !conversation.isContact && (
                <div className="chat__request" role="region" aria-label="Message request">
                    <div className="chat__request-text">
                        <p className="chat__request-title">{other.username} wants to message you</p>
                        <p className="chat__request-sub">
                            {requestError || `Accept to add ${other.username} to your contacts.`}
                        </p>
                    </div>
                    <div className="chat__request-actions">
                        <button type="button" className="chat__request-btn" disabled={requestBusy} onClick={() => answerRequest('reject')}>
                            Reject
                        </button>
                        <button type="button" className="chat__request-btn chat__request-btn--accept" disabled={requestBusy} onClick={() => answerRequest('accept')}>
                            Accept
                        </button>
                    </div>
                </div>
            )}

            <div className="chat__scroll" ref={listRef} onScroll={handleScroll}>
                <div className="chat__messages">
                    {hasEarlier && (
                        <button type="button" className="chat__earlier" disabled={loadingMore} onClick={loadEarlier}>
                            {loadingMore ? 'Loading…' : 'Load earlier messages'}
                        </button>
                    )}
                    {status === 'loading' && <p className="chat__note">Loading messages…</p>}
                    {status === 'error' && <p className="chat__note">Couldn’t load messages. Try refreshing.</p>}
                    {status === 'ready' && messages.length === 0 && (
                        <p className="chat__note">No messages yet — say hi to {other.username}.</p>
                    )}
                    {items}
                </div>
            </div>

            <div className="chat__footer">
                {!connected && <p className="chat__banner" role="status">Reconnecting…</p>}
                {sendError && <p className="chat__banner chat__banner--error" role="alert">{sendError}</p>}
                <form className="chat__composer" onSubmit={handleSubmit}>
                    <label htmlFor="chat-message" className="chat__sr">Message {other.username}</label>
                    <input
                        id="chat-message"
                        ref={inputRef}
                        type="text"
                        placeholder={`Message ${other.username}`}
                        autoComplete="off"
                        maxLength={5000}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                    />
                    <button type="submit" className="chat__send" aria-label="Send" disabled={!draft.trim()}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 19V5" />
                            <path d="M5 12l7-7 7 7" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    )
}

// `conversation` comes from the sidebar's list; undefined until that list has loaded
function ChatWindow({ conversation, listStatus, onBack, onAccepted }) {
    if (conversation) {
        return <ChatThread conversation={conversation} onBack={onBack} onAccepted={onAccepted} />
    }

    if (listStatus === 'ready') {
        return (
            <div className="chat chat--missing">
                <p className="chat__note">This conversation doesn’t exist.</p>
                <button type="button" className="chat__earlier" onClick={onBack}>Back to messages</button>
            </div>
        )
    }

    return <div className="chat" />
}

export default ChatWindow
