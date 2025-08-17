import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter as BrowserRouter, Routes, Route } from 'react-router-dom'
import Host from './pages/Host'
import Join from './pages/Join'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Host />} />
        <Route path="/host" element={<Host />} />
        <Route path="/join" element={<Join />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)

