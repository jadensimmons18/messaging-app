import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AuthLayout, TextField, PasswordField } from '../components/AuthLayout.jsx'
import DemoButton from '../components/DemoButton.jsx'
import { useDemoLogin } from '../helpers/useDemoLogin.js'

const API_URL = import.meta.env.VITE_API_URL

function Login() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const navigate = useNavigate()
    const { demoLoading, startDemo } = useDemoLogin({ onError: setError })

    async function handleSubmit(e) {
        e.preventDefault()
        setError('')

        try {
            const res = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })
            const data = await res.json()

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
            title="Welcome back"
            titleSuffix=" to ember"
            subtitle="Sign in to pick up your conversations."
        >
            <form className="login__form" onSubmit={handleSubmit}>
                <TextField
                    id="email"
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <PasswordField
                    id="password"
                    label="Password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                {error && <p className="login__error" role="alert">{error}</p>}

                <button type="submit" className="login__submit" disabled={demoLoading}>Sign in</button>

                <DemoButton loading={demoLoading} onClick={startDemo} />
            </form>

            <p className="login__switch">
                New to ember? <Link to="/signup">Create an account</Link>
            </p>
        </AuthLayout>
    )
}

export default Login
