import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import MiniHomesPage from './pages/MiniHomesPage'
import RoofingPage from './pages/RoofingPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RoofingPage />} />
        <Route path="/mini-homes" element={<MiniHomesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
