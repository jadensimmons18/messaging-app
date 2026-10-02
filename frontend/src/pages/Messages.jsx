import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { apiFetch } from '../helpers/api.js'
import { timeLabel } from '../helpers/format.js'
import Avatar from '../components/Avatar.jsx'
import Logo from '../components/Logo.jsx'
import ChatWindow from '../components/ChatWindow.jsx'
import NewMessageDialog from '../components/NewMessageDialog.jsx'
import { disconnectSocket, getSocket } from '../helpers/socket.js'
import './Messages.css'

const PencilIcon = ({ strokeWidth = 1.8 }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
)

async function fetchConversations() {
    const res = await apiFetch('/api/conversation')
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    return data.transformedConversations
}

const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'unknown', label: 'Unknown' },
]

function ConversationRow({ conversation, me, selected, onSelect }) {
    const { otherParticipants: other, lastMessage } = conversation
    const preview = lastMessage
        ? `${lastMessage.sender === me?.id ? 'You: ' : ''}${lastMessage.content}`
        : 'No messages yet'

    return (
        <button
            type="button"
            className={`messages__row ${selected ? 'messages__row--selected' : ''}`}
            onClick={onSelect}
        >
            <Avatar name={other.username} size={52} />
            <span className="messages__row-text">
                <span className="messages__row-top">
                    <span className="messages__row-name">{other.username}</span>
                    <span className="messages__row-time">
                        {timeLabel(lastMessage?.createdAt ?? conversation.updatedAt)}
                    </span>
                </span>
                <span className="messages__row-preview">{preview}</span>
            </span>
        </button>
    )
}

function Messages() {
    const navigate = useNavigate()
    const { conversationId } = useParams()
    const me = JSON.parse(localStorage.getItem('user') ?? 'null')

    const [conversations, setConversations] = useState([])
    const [status, setStatus] = useState('loading') // loading | ready | error
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState('all')
    const [dialogOpen, setDialogOpen] = useState(false)

    useEffect(() => {
        fetchConversations()
            .then((list) => {
                setConversations(list)
                setStatus('ready')
            })
            .catch(() => setStatus('error'))
    }, [])

    // Join the socket room of every conversation in the list, so messages arrive live
    // (rooms are forgotten when the connection drops, so re-join on every connect).
    const conversationIds = conversations.map((c) => c._id).join(',')
    useEffect(() => {
        if (!conversationIds) return
        const socket = getSocket()
        const joinAll = () => conversationIds.split(',').forEach((id) => socket.emit('join_conversation', id))

        joinAll()
        socket.on('connect', joinAll)
        return () => socket.off('connect', joinAll)
    }, [conversationIds])

    // A new message anywhere: update that row's preview and move it to the top.
    useEffect(() => {
        const socket = getSocket()
        const onMessage = (message) => {
            setConversations((prev) => {
                const i = prev.findIndex((c) => c._id === message.conversation)
                if (i === -1) return prev
                const updated = {
                    ...prev[i],
                    lastMessage: { content: message.content, createdAt: message.createdAt, sender: message.sender._id },
                    updatedAt: message.createdAt,
                }
                return [updated, ...prev.slice(0, i), ...prev.slice(i + 1)]
            })
        }

        socket.on('receive_message', onMessage)
        return () => socket.off('receive_message', onMessage)
    }, [])

    // called by the dialog once a conversation exists: refresh the list, then open it
    async function handleCreated(id) {
        setConversations(await fetchConversations())
        setDialogOpen(false)
        navigate(`/c/${id}`)
    }

    function handleLogout() {
        disconnectSocket()
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        navigate('/login')
    }

    const visible = conversations.filter((c) => {
        if (filter === 'contacts' && !c.isContact) return false
        if (filter === 'unknown' && c.isContact) return false
        return c.otherParticipants.username.toLowerCase().includes(query.trim().toLowerCase())
    })

    const profileButton = (
        <button type="button" className="messages__profile" aria-label="Log out" title="Log out" onClick={handleLogout}>
            <Avatar name={me?.username ?? ''} size={40} />
        </button>
    )

    return (
        <div className={`messages ${conversationId ? 'messages--chat-open' : ''}`}>
            <aside className="messages__sidebar">
                <div className="messages__top">
                    <div className="messages__bar">
                        <div className="messages__brand">
                            <Logo size={28} />
                            <span className="messages__brand-name">ember</span>
                        </div>
                        <h1 className="messages__title">Messages</h1>
                        <button type="button" className="messages__new" aria-label="New message" onClick={() => setDialogOpen(true)}>
                            <PencilIcon />
                        </button>
                        {profileButton}
                    </div>

                    <div className="messages__search">
                        <label htmlFor="search" className="messages__sr">Search</label>
                        <svg className="messages__search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="11" cy="11" r="7" />
                            <path d="M20 20l-3.5-3.5" />
                        </svg>
                        <input
                            id="search"
                            type="search"
                            placeholder="Search"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>

                    <div className="messages__chips">
                        {FILTERS.map((f) => (
                            <button
                                key={f.key}
                                type="button"
                                className="messages__chip"
                                aria-pressed={filter === f.key}
                                onClick={() => setFilter(f.key)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <nav className="messages__list" aria-label="Conversations">
                    {status === 'loading' && <p className="messages__note">Loading…</p>}
                    {status === 'error' && <p className="messages__note">Couldn’t load your conversations. Try refreshing.</p>}
                    {status === 'ready' && conversations.length === 0 && (
                        <p className="messages__note">No conversations yet.</p>
                    )}
                    {status === 'ready' && conversations.length > 0 && visible.length === 0 && (
                        <p className="messages__note">No matches.</p>
                    )}
                    {visible.map((c) => (
                        <ConversationRow
                            key={c._id}
                            conversation={c}
                            me={me}
                            selected={c._id === conversationId}
                            onSelect={() => navigate(`/c/${c._id}`)}
                        />
                    ))}
                </nav>
            </aside>

            <main className={`messages__pane ${conversationId ? 'messages__pane--chat' : ''}`}>
                {conversationId ? (
                    <ChatWindow
                        key={conversationId}
                        conversation={conversations.find((c) => c._id === conversationId)}
                        listStatus={status}
                        onBack={() => navigate('/')}
                    />
                ) : (
                    <div className="messages__empty">
                        <div className="messages__ghost" aria-hidden="true">
                            <div className="messages__ghost-bubble messages__ghost-bubble--in" style={{ width: 150 }} />
                            <div className="messages__ghost-bubble messages__ghost-bubble--out" style={{ width: 120 }} />
                            <div className="messages__ghost-bubble messages__ghost-bubble--in" style={{ width: 90 }} />
                        </div>
                        <h2 className="messages__empty-title">Pick up where you left off</h2>
                        <p className="messages__empty-text">Choose a conversation from the list, or start a new one.</p>
                        <button type="button" className="messages__cta" onClick={() => setDialogOpen(true)}>
                            <PencilIcon strokeWidth={2} />
                            New message
                        </button>
                    </div>
                )}
            </main>

            {dialogOpen && <NewMessageDialog onClose={() => setDialogOpen(false)} onCreated={handleCreated} />}
        </div>
    )
}

export default Messages
