import { useState } from 'react'
import { useNavigate } from 'react-router'

const API_URL = import.meta.env.VITE_API_URL

// "Try the demo": the backend creates a throwaway guest account filled with sample
// conversations and returns a token, exactly like a normal login. Shared by the login and
// signup pages. `onError` receives a message to show in the page's own error box.
export function useDemoLogin({ onError }) {
    const [demoLoading, setDemoLoading] = useState(false)
    const navigate = useNavigate()

    async function startDemo() {
        onError('')
        setDemoLoading(true)

        try {
            const res = await fetch(`${API_URL}/api/auth/demo`, { method: 'POST' })
            const data = await res.json()

            if (!res.ok) {
                onError(data.message)
                setDemoLoading(false)
                return
            }

            localStorage.setItem('token', data.token)
            localStorage.setItem('user', JSON.stringify(data.user))
            navigate('/')
        } catch {
            onError('Could not reach the server')
            setDemoLoading(false)
        }
    }

    return { demoLoading, startDemo }
}
