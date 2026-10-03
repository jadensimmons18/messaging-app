import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar.jsx'
import './ProfileMenu.css'

// Avatar button that opens a small frosted-glass popover: the username, then a log out button.
function ProfileMenu({ username, onLogout, className = '' }) {
    const [open, setOpen] = useState(false)
    const wrapRef = useRef(null)

    // while open: close on a click outside, or on Esc (returning focus to the avatar button)
    useEffect(() => {
        if (!open) return

        const onPointerDown = (e) => {
            if (!wrapRef.current.contains(e.target)) setOpen(false)
        }
        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                setOpen(false)
                wrapRef.current.querySelector('button').focus()
            }
        }

        document.addEventListener('pointerdown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('pointerdown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    return (
        <div className={`profile ${className}`} ref={wrapRef}>
            <button
                type="button"
                className="profile__toggle"
                aria-label="Account menu"
                aria-expanded={open}
                aria-controls="profile-menu"
                onClick={() => setOpen((o) => !o)}
            >
                <Avatar name={username} size={40} />
            </button>

            {open && (
                <div id="profile-menu" className="profile__menu">
                    <p className="profile__name">{username}</p>
                    <button type="button" className="profile__logout" onClick={onLogout}>
                        Log out
                    </button>
                </div>
            )}
        </div>
    )
}

export default ProfileMenu
