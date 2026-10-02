import { Routes, Route, Navigate } from 'react-router'
import Login from './pages/Login.jsx'
import SignUp from './pages/SignUp.jsx'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
