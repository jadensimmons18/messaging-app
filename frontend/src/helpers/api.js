const API_URL = import.meta.env.VITE_API_URL

// Fire-and-forget ping so a sleeping free-tier backend starts waking up the moment the site opens
export function wakeServer() {
    fetch(`${API_URL}/api/health`).catch(() => {})
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
