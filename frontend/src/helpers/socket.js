import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL

let socket = null
let socketToken = null

// One shared connection for the whole app. The JWT goes in `auth` — the backend's
// handshake middleware reads it from socket.handshake.auth.token.
export function getSocket() {
    const token = localStorage.getItem('token')

    // logged in as someone else since the last call -> start over with the new token
    if (socket && socketToken !== token) {
        socket.disconnect()
        socket = null
    }

    if (!socket) {
        socketToken = token
        socket = io(API_URL, { auth: { token } })

        // the backend rejects bad/expired tokens at handshake time
        socket.on('connect_error', (err) => {
            if (err.message.includes('token')) {
                localStorage.removeItem('token')
                localStorage.removeItem('user')
                window.location.assign('/login')
            }
        })
    }

    return socket
}

export function disconnectSocket() {
    socket?.disconnect()
    socket = null
    socketToken = null
}
