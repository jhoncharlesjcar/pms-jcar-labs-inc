import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
    logLevel: 'info', // Show all logs including startup info
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
            manifest: {
                name: 'ANGELICA FREY',
                short_name: 'ANGELICA FREY',
                description: 'Sistema de Gestión de Hospedajes Profesional',
                theme_color: '#f59e0b',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            }
        })
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor': [
                        'react',
                        'react-dom',
                        'react-router-dom',
                        '@tanstack/react-query',
                        '@supabase/supabase-js',
                        'lucide-react',
                        'framer-motion',
                        'date-fns',
                        'recharts',
                    ],
                },
            },
        },
        chunkSizeWarningLimit: 1000,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})