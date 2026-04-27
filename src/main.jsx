import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// PURGA PROFESIONAL DE SERVICE WORKERS Y CACHÉ (ARQUITECTURA CLOUD-FIRST)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
            registration.unregister().then(() => console.log('SW Unregistered'));
        }
    });
}

// Limpiar todas las cachés del navegador para evitar datos corruptos
if ('caches' in window) {
    caches.keys().then((names) => {
        for (const name of names) caches.delete(name);
    });
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
)