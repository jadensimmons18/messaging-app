const API_URL = import.meta.env.VITE_API_URL

// Is the backend up? Resolves true/false, never throws. A sleeping free-tier server either
// times out or answers its first requests with a 503 while it boots, so both count as "not yet".
export async function checkHealth(timeoutMs = 8000) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
        const res = await fetch(`${API_URL}/api/health`, { signal: controller.signal })
        return res.ok
    } catch {
        return false
    } finally {
        clearTimeout(timer)
    }
}

// fetch wrapper for protected endpoints: attaches the JWT, and if the backend says the
// token is bad/expired (401) clears the stored login and sends the user back to /login.
export async function apiFetch(path, options = {}) {
    const token = localStorage.getItem('token')

    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    })

    if (res.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.assign('/login')
        throw new Error('Unauthorized')
    }

    return res
}
