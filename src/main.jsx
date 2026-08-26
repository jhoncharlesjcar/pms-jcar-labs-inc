import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import '@/styles/gsap.css'
import logger from '@/lib/logger'

import { registerSW } from 'virtual:pwa-register';

window.addEventListener('error', (event) => {
    logger.error('ui.uncaught_error', { error: event.error || event.type });
});

window.addEventListener('unhandledrejection', (event) => {
    logger.error('ui.unhandled_rejection', { error: event.reason });
});

// La actualización exige confirmación para no interrumpir una operación activa.
if ('serviceWorker' in navigator) {
    const updateSW = registerSW({
        immediate: false,
        onNeedRefresh() {
            const accepted = window.confirm('Hay una nueva versión disponible. ¿Actualizar ahora?');
            if (accepted) updateSW(true);
        },
        onOfflineReady() {
            logger.info('pwa.offline_ready');
        },
        onRegisterError(error) {
            logger.error('pwa.registration_failed', { error });
        },
    });
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
)
