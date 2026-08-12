import { useState, useEffect } from "react";
import { Toaster as Sonner } from "sonner"

/**
 * @param {import("sonner").ToasterProps} props
 */
const Toaster = ({
    ...props
}) => {
    /** @type {any} */
    const initialTheme = () => {
        const stored = localStorage.getItem('theme');
        if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            return 'dark';
        }
        return 'light';
    };
    
    const [theme, setTheme] = useState(initialTheme);

    // Escuchar cambios de tema (disparados por Layout.jsx toggleTheme)
    useEffect(() => {
        const observer = new MutationObserver(() => {
            setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    return (
        (<Sonner
            theme={theme}
            className="toaster group"
            position="top-right"
            richColors
            expand={false}
            closeButton
            duration={4000}
            visibleToasts={5}
            gap={10}
            offset={16}
            toastOptions={{
                classNames: {
                    toast:
                        "group toast group-[.toaster]:bg-card/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-border/60 group-[.toaster]:shadow-premium-lg group-[.toaster]:rounded-2xl group-[.toaster]:px-5 group-[.toaster]:py-4",
                    description: "group-[.toast]:text-muted-foreground/80 group-[.toast]:text-xs group-[.toast]:mt-1",
                    actionButton:
                        "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:text-xs group-[.toast]:font-semibold group-[.toast]:px-4 group-[.toast]:h-8",
                    cancelButton:
                        "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg group-[.toast]:text-xs group-[.toast]:px-4 group-[.toast]:h-8",
                    closeButton:
                        "group-[.toast]:text-muted-foreground/40 group-[.toast]:hover:text-foreground group-[.toast]:transition-colors",
                }
            }}
            {...props} />)
    );
}

export { Toaster }