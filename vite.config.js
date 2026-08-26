import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'


// https://vite.dev/config/
export default defineConfig({
    server: { host: true },
    logLevel: 'info', // Show all logs including startup info
    worker: {
        format: 'es'
    },
    plugins: [
        react(),
        // Genera reporte de bundle: ANALYZE=true pnpm build
        process.env.ANALYZE === 'true' && visualizer({
            filename: 'bundle-report.html',
            open: true,
            gzipSize: true,
            brotliSize: true,
        }),
        VitePWA({
            disable: process.env.SKIP_PWA === 'true',
            registerType: 'prompt',
            manifest: {
                name: 'PMS JCAR LABS',
                short_name: 'PMS JCAR LABS',
                description: 'Sistema de Gestión Hotelera - PMS JCAR LABS',
                lang: 'es-PE',
                theme_color: '#1d4ed8',
                background_color: '#ffffff',
                display: 'standalone',
                start_url: '/',
                scope: '/',
                icons: [
                    {
                        src: 'icon.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'any'
                    },
                    {
                        src: 'icon-maskable.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'maskable'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,jpg,jpeg,png,svg,woff,woff2}'],
                cleanupOutdatedCaches: true,
                clientsClaim: false,
                skipWaiting: false,
                navigateFallbackDenylist: [/^\/api\//, /^\/functions\//],
                // SECURITY: No cachear respuestas de Supabase REST API.
                // Las respuestas autenticadas no deben sobrevivir al Service Worker
                // porque pueden filtrar datos entre sesiones o servir estados de
                // autorización obsoletos. (Hallazgo #9 de auditoría)
                runtimeCaching: []
            }
        }),
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-core': [
                        'react',
                        'react-dom',
                        'react-router-dom',
                    ],
                    'vendor-app': [
                        '@tanstack/react-query',
                        '@supabase/supabase-js',
                        'zustand',
                        'lucide-react',
                        'sonner',
                    ],
                    'vendor-charts': [
                        'recharts',
                    ],
                    'vendor-libs': [
                        'date-fns',
                    ],
                },
            },
        },
        chunkSizeWarningLimit: 1000,
        reportCompressedSize: true,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
