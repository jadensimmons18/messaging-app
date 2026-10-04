import { useEffect, useRef, useState } from 'react'
import { checkHealth } from '../helpers/api.js'
import './ServerWakeNotice.css'

const SHOW_AFTER_MS = 1500 // a healthy server answers well within this, so most visitors never see the popup
const RETRY_EVERY_MS = 2000
const SLOW_AFTER_SECONDS = 90

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60)
    const s = String(totalSeconds % 60).padStart(2, '0')
    return `${m}:${s}`
}

// Free hosting puts the backend to sleep when idle, and waking it takes up to a minute.
// This pings /api/health on page load; if the server doesn't answer quickly, it shows a popup
// with a timer (so the site doesn't look frozen) and keeps retrying until the server is up.
function ServerWakeNotice() {
    const [phase, setPhase] = useState('checking') // checking | waking | ready | hidden
    const [seconds, setSeconds] = useState(0)
    const startedAt = useRef(0) // set when the first ping starts, so the timer counts real waiting time

    // 1. ping until the server answers
    useEffect(() => {
        startedAt.current = Date.now()
        let cancelled = false
        const showTimer = setTimeout(() => {
            if (!cancelled) setPhase((p) => (p === 'checking' ? 'waking' : p))
        }, SHOW_AFTER_MS)

        async function waitForServer() {
            while (!cancelled && !(await checkHealth())) {
                await sleep(RETRY_EVERY_MS)
            }
            if (cancelled) return
            clearTimeout(showTimer)
            // only celebrate if the popup was actually on screen
            setPhase((p) => (p === 'waking' ? 'ready' : 'hidden'))
        }
        waitForServer()

        return () => {
            cancelled = true
            clearTimeout(showTimer)
        }
    }, [])

    // 2. tick the timer while the popup is showing
    useEffect(() => {
        if (phase !== 'waking') return
        const tick = () => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000))
        const interval = setInterval(tick, 1000)
        return () => clearInterval(interval)
    }, [phase])

    // 3. let "ready" linger briefly, then go away
    useEffect(() => {
        if (phase !== 'ready') return
        const timer = setTimeout(() => setPhase('hidden'), 1800)
        return () => clearTimeout(timer)
    }, [phase])

    if (phase === 'checking' || phase === 'hidden') return null

    const ready = phase === 'ready'
    const slow = seconds >= SLOW_AFTER_SECONDS

    return (
        <div className={`wake ${ready ? 'wake--ready' : ''}`} role="status" aria-live="polite">
            {ready ? (
                <svg className="wake__icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
            ) : (
                <span className="wake__spinner" aria-hidden="true" />
            )}

            <div className="wake__text">
                <p className="wake__title">{ready ? 'Server is ready' : 'Waking up the server'}</p>
                {!ready && (
                    <p className="wake__sub">
                        {slow
                            ? 'Taking longer than usual. If this keeps going, try refreshing in a minute.'
                            : 'Free hosting pauses when idle. This usually takes under a minute.'}
                    </p>
                )}
            </div>

            {!ready && <span className="wake__timer">{formatTime(seconds)}</span>}
        </div>
    )
}

export default ServerWakeNotice
