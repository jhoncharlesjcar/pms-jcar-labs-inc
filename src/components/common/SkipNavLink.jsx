import { memo } from 'react';

/**
 * Enlace de salto de navegación para accesibilidad (WCAG 2.4.1).
 * Invisible por defecto, aparece al hacer focus con teclado (Tab).
 * Permite a usuarios de lectores de pantalla o teclado saltar al contenido principal.
 */
const SkipNavLink = memo(function SkipNavLink() {
    return (
        <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:text-sm focus:font-bold focus:outline-none focus:ring-2 focus:ring-ring"
        >
            Ir al contenido principal
        </a>
    );
});
SkipNavLink.displayName = 'SkipNavLink';
export default SkipNavLink;
