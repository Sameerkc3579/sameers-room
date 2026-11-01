import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './panels.css'
import './book.css'
import App from './App.tsx'
import './taps'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
