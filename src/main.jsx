import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { prepareTabSession } from './lib/tab-session.js';

prepareTabSession(window.location.pathname);

createRoot(document.getElementById('root')).render(
  <StrictMode>
      <App />
  </StrictMode>
)
