import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../helpers/api.js'
import Avatar from './Avatar.jsx'
import './NewMessageDialog.css'

// The backend feeds the search text straight into a regex, so escape it here —
// otherwise typing something like "(" would make the query invalid.
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function NewMessageDialog({ onClose, onCreated }) {
    const dialogRef = useRef(null)
    const inputRef = useRef(null)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [status, setStatus] = useState('idle') // idle | searching | done | error
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState('')

    // <dialog> gives us the backdrop, focus trapping and Esc-to-close for free.
    // showModal() focuses the first button by default, so focus the search box ourselves.
    useEffect(() => {
        dialogRef.current.showModal()
        inputRef.current.focus()
    }, [])

    // debounced search; `cancelled` throws away responses that arrive after the text changed
    useEffect(() => {
        const text = query.trim()
        if (!text) return

        let cancelled = false
        const timer = setTimeout(async () => {
            setStatus('searching')
            try {
                const res = await apiFetch(`/api/contact/search?username=${encodeURIComponent(escapeRegex(text))}`)
                const data = await res.json()
                if (cancelled) return
                if (!res.ok) throw new Error(data.message)
                setResults(data.users)
                setStatus('done')
            } catch {
                if (!cancelled) setStatus('error')
            }
        }, 250)

        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [query])

    async function startConversation(user) {
        if (creating) return
        setCreating(true)
        setCreateError('')
        try {
            const res = await apiFetch('/api/conversation', {
                method: 'POST',
                body: JSON.stringify({ participantId: user._id }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message)
            const conversation = data.existingConversation ?? data.newConversation
            await onCreated(conversation._id)
        } catch {
            setCreateError('Couldn’t start that conversation. Try again.')
            setCreating(false)
        }
    }

    const hasQuery = query.trim() !== ''

    return (
        <dialog
            ref={dialogRef}
            className="newmsg"
            aria-labelledby="newmsg-title"
            onClose={onClose}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="newmsg__sheet">
                <div className="newmsg__head">
                    <h2 id="newmsg-title" className="newmsg__title">New message</h2>
                    <button type="button" className="newmsg__close" aria-label="Close" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                    </button>
                </div>

                <div className="newmsg__search">
                    <label htmlFor="newmsg-search" className="newmsg__sr">Find a person</label>
                    <svg className="newmsg__search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="7" />
                        <path d="M20 20l-3.5-3.5" />
                    </svg>
                    <input
                        id="newmsg-search"
                        ref={inputRef}
                        type="search"
                        placeholder="Search by username"
                        autoComplete="off"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                <div className="newmsg__results" aria-live="polite">
                    {createError && <p className="newmsg__note newmsg__note--error">{createError}</p>}
                    {!hasQuery && <p className="newmsg__note">Find someone by their username to start a conversation.</p>}
                    {hasQuery && status === 'searching' && <p className="newmsg__note">Searching…</p>}
                    {hasQuery && status === 'error' && <p className="newmsg__note">Search failed. Try again.</p>}
                    {hasQuery && status === 'done' && results.length === 0 && <p className="newmsg__note">No one found.</p>}
                    {hasQuery && status === 'done' && results.map((user) => (
                        <button
                            key={user._id}
                            type="button"
                            className="newmsg__result"
                            disabled={creating}
                            onClick={() => startConversation(user)}
                        >
                            <Avatar name={user.username} size={44} />
                            <span className="newmsg__result-name">{user.username}</span>
                        </button>
                    ))}
                </div>
            </div>
        </dialog>
    )
}

export default NewMessageDialog
