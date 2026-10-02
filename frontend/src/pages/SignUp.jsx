import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthLayout, TextField, PasswordField } from '../components/AuthLayout.jsx'

const API_URL = import.meta.env.VITE_API_URL

function SignUp() {
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const navigate = useNavigate()

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')

        try {
            const res = await fetch(`${API_URL}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password }),
            })
            const data = await res.json()

            if (res.status === 409) {
                setError('That username or email is already taken')
                return
            }

            if (!res.ok) {
                setError(data.message)
                return
            }

            localStorage.setItem('token', data.token)
            localStorage.setItem('user', JSON.stringify(data.user))
            navigate('/')
        } catch {
            setError('Could not reach the server')
        }
    }

    return (
        <AuthLayout
            title="Create your account"
            subtitle="Join ember and start talking in seconds."
        >
            <form className="login__form" onSubmit={handleSubmit}>
                <TextField
                    id="username"
                    label="Username"
                    type="text"
                    placeholder="Pick a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={3}
                    maxLength={30}
                    autoComplete="username"
                />

                <TextField
                    id="email"
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                />

                <PasswordField
                    id="password"
                    label="Password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete="new-password"
                />

                {error && <p className="login__error" role="alert">{error}</p>}

                <button type="submit" className="login__submit">Create account</button>
            </form>

            <p className="login__switch">
                Already on ember? <Link to="/login">Sign in</Link>
            </p>
        </AuthLayout>
    )
}

export default SignUp
