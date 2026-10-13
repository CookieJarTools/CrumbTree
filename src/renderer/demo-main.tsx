import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { mockApi } from './lib/mock'
import { useStore } from './store/store'
import '@fontsource-variable/inter'
import './theme/tokens.css'
import './theme/global.css'

// Inject the mock API so the real UI runs in a plain browser (no Electron).
window.crumb = mockApi

// Demo-only: lets you drive the store from the console when poking at the UI.
;(window as unknown as { store: typeof useStore }).store = useStore

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
