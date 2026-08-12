import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/styles/gsap.css'

import { registerSW } from 'virtual:pwa-register';

// Registro de Service Worker para PWA (Offline Support)
if ('serviceWorker' in navigator) {
    registerSW({ immediate: true });
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
)