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
            registerType: 'autoUpdate',
            includeAssets: ['logo.png', 'logo.svg'],
            manifest: {
                name: 'PMS JCAR LABS',
                short_name: 'PMS JCAR LABS',
                description: 'Sistema de Gestión Hotelera - PMS JCAR LABS',
                theme_color: '#1d4ed8',
                background_color: '#ffffff',
                display: 'standalone',
                start_url: '/',
                icons: [
                    {
                        src: 'logo.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'logo.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'supabase-api-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 60 * 24 // 24 horas
                            },
                            networkTimeoutSeconds: 5,
                        }
                    }
                ]
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
                        'gsap',
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