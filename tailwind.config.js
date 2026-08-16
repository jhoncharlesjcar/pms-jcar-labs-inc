/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
    theme: {
        extend: {
            fontFamily: {
                inter: ['Manrope', 'Inter', 'sans-serif'],
                display: ['Playfair Display', 'serif'],
            },
            borderRadius: {
                '2xl': '1.25rem',
                'xl': '0.875rem',
                'lg': '0.625rem',   // 10px — estándar iOS
                'md': '0.5rem',
                'sm': '0.25rem'
            },
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))'
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))'
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                state: {
                    disponible: {
                        bg: 'hsl(var(--state-disponible-bg))',
                        fg: 'hsl(var(--state-disponible-fg))',
                        border: 'hsl(var(--state-disponible-border))',
                    },
                    ocupada: {
                        bg: 'hsl(var(--state-ocupada-bg))',
                        fg: 'hsl(var(--state-ocupada-fg))',
                        border: 'hsl(var(--state-ocupada-border))',
                    },
                    reservada: {
                        bg: 'hsl(var(--state-reservada-bg))',
                        fg: 'hsl(var(--state-reservada-fg))',
                        border: 'hsl(var(--state-reservada-border))',
                    },
                    mantenimiento: {
                        bg: 'hsl(var(--state-mantenimiento-bg))',
                        fg: 'hsl(var(--state-mantenimiento-fg))',
                        border: 'hsl(var(--state-mantenimiento-border))',
                    },
                    limpieza: {
                        bg: 'hsl(var(--state-limpieza-bg))',
                        fg: 'hsl(var(--state-limpieza-fg))',
                        border: 'hsl(var(--state-limpieza-border))',
                    },
                },
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                },
                sidebar: {
                    DEFAULT: 'hsl(var(--sidebar-background))',
                    foreground: 'hsl(var(--sidebar-foreground))',
                    primary: 'hsl(var(--sidebar-primary))',
                    'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
                    accent: 'hsl(var(--sidebar-accent))',
                    'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
                    border: 'hsl(var(--sidebar-border))',
                    ring: 'hsl(var(--sidebar-ring))'
                }
            },
            keyframes: {
                'accordion-down': {
                    from: {
                        height: '0'
                    },
                    to: {
                        height: 'var(--radix-accordion-content-height)'
                    }
                },
                'accordion-up': {
                    from: {
                        height: 'var(--radix-accordion-content-height)'
                    },
                    to: {
                        height: '0'
                    }
                }
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out'
            },
            boxShadow: {
                'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                'sm': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
                'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
                'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                'enterprise': '0 0 0 1px rgba(255,255,255,0.04), 0 8px 30px rgba(0,0,0,0.25)',
            }
        }
    },
    plugins: [require("tailwindcss-animate")],
}
