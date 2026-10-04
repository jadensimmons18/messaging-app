import { Routes, Route, Navigate } from 'react-router'
import Login from './pages/Login.jsx'
import SignUp from './pages/SignUp.jsx'
import Messages from './pages/Messages.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ServerWakeNotice from './components/ServerWakeNotice.jsx'

function App() {
  const messages = <ProtectedRoute><Messages /></ProtectedRoute>

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/" element={messages} />
        <Route path="/c/:conversationId" element={messages} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ServerWakeNotice />
    </>
  )
}

export default App
