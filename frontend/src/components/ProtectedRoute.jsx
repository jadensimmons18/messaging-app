import { Navigate } from 'react-router'

// Only renders its children if there's a token in localStorage; otherwise sends the user to /login.
// This is a UX convenience, not security — the backend still verifies the JWT on every request.
function ProtectedRoute({ children }) {
    const token = localStorage.getItem('token')

    if (!token) {
        return <Navigate to="/login" replace />
    }

    return children
}

export default ProtectedRoute
