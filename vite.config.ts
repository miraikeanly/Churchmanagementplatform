import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  base: '/',
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    nodePolyfills({
      include: ['buffer', 'stream', 'process'],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom', 'react-router'],
          // Animation library
          'vendor-motion': ['motion', 'framer-motion', 'motion-dom'],
          // MUI components (heavy — split separately)
          'vendor-mui': ['@mui/material', '@mui/icons-material', '@mui/utils', '@emotion/react', '@emotion/styled'],
          // Charts & data viz
          'vendor-charts': ['recharts'],
          // Radix UI primitives
          'vendor-radix': [
            '@radix-ui/react-accordion', '@radix-ui/react-alert-dialog',
            '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select', '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip', '@radix-ui/react-popover',
          ],
          // Utility libs
          'vendor-utils': ['date-fns', 'lucide-react', 'clsx', 'tailwind-merge', 'class-variance-authority'],
        },
      },
    },
    // Raise the warning threshold (chunks up to 1MB are fine for Cloudflare Pages)
    chunkSizeWarningLimit: 1000,
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
