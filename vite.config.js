import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/react/main.jsx'],
            refresh: true,
        }),
        react(),
        tailwindcss(),
    ],
    build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('exceljs') || id.includes('xlsx') || id.includes('fast-csv') || id.includes('archiver')) {
                            return 'excel-libs';
                        }
                        if (id.includes('lucide-react')) {
                            return 'icons';
                        }
                        return 'vendor';
                    }
                }
            }
        }
    }
});
