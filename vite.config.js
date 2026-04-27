import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
    logLevel: 'info', // Show all logs including startup info
    plugins: [
        react(),
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