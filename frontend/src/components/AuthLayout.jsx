import { useState } from 'react'
import './AuthLayout.css'

function Logo({ size, className }) {
    return (
        <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={`login__logo ${className ?? ''}`}>
            <rect className="login__logo-bg" width="32" height="32" rx="10" />
            <path
                className="login__logo-bubble"
                d="M8 10.5A3.5 3.5 0 0 1 11.5 7h9A3.5 3.5 0 0 1 24 10.5v6a3.5 3.5 0 0 1-3.5 3.5H15l-4.6 4.2V20A3.5 3.5 0 0 1 8 16.5Z"
            />
            <circle className="login__logo-dot" cx="20.5" cy="10.5" r="1.6" />
        </svg>
    )
}

// Shared shell for the login and signup pages: hero panel on the left (desktop only),
// form column on the right. `children` is the form + anything below it.
export function AuthLayout({ title, titleSuffix, subtitle, children }) {
    return (
        <div className="login">
            <section className="login__hero">
                <div className="login__brand">
                    <Logo size={32} />
                    <span className="login__brand-name">ember</span>
                </div>

                <div className="login__hero-body">
                    <div className="login__chat" aria-hidden="true">
                        <div className="login__bubble login__bubble--in">you up for ramen tonight?</div>
                        <div className="login__bubble login__bubble--out">always. what time?</div>
                        <div className="login__typing">
                            <span />
                            <span />
                            <span />
                        </div>
                    </div>

                    <div className="login__pitch">
                        <h2 className="login__headline">Messages with a little more warmth.</h2>
                        <p className="login__pitch-text">
                            Fast, private conversations with the people you care about, on every screen you use.
                        </p>
                    </div>
                </div>

                <p className="login__copyright">© 2026 Ember</p>
            </section>

            <main className="login__main">
                <div className="login__card">
                    <Logo size={48} className="login__mobile-logo" />

                    <div className="login__intro">
                        <h1 className="login__title">
                            {title}
                            {titleSuffix && <span className="login__title-brand">{titleSuffix}</span>}
                        </h1>
                        <p className="login__subtitle">{subtitle}</p>
                    </div>

                    {children}
                </div>
            </main>
        </div>
    )
}

export function TextField({ id, label, ...inputProps }) {
    return (
        <div className="login__field">
            <label className="login__label" htmlFor={id}>{label}</label>
            <div className="login__input-wrap">
                <input className="login__input" id={id} {...inputProps} />
            </div>
        </div>
    )
}

export function PasswordField({ id, label, ...inputProps }) {
    const [show, setShow] = useState(false)

    return (
        <div className="login__field">
            <label className="login__label" htmlFor={id}>{label}</label>
            <div className="login__input-wrap">
                <input
                    className="login__input login__input--has-toggle"
                    id={id}
                    type={show ? 'text' : 'password'}
                    {...inputProps}
                />
                <button
                    type="button"
                    className="login__toggle"
                    aria-label={show ? 'Hide password' : 'Show password'}
                    onClick={() => setShow((s) => !s)}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                        {show && <path d="M4 4l16 16" />}
                    </svg>
                </button>
            </div>
        </div>
    )
}
