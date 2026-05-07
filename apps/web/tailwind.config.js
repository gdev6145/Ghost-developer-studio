/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ghost: {
          // Catppuccin Mocha inspired – dark multiplayer palette
          bg: '#1E1E2E',
          surface: '#181825',
          overlay: '#313244',
          muted: '#6C7086',
          subtle: '#9399B2',
          text: '#CDD6F4',
          // Accent colors
          blue: '#89B4FA',
          green: '#A6E3A1',
          yellow: '#F9E2AF',
          orange: '#FAB387',
          red: '#F38BA8',
          purple: '#CBA6F7',
          teal: '#94E2D5',
        },
        // Landing-page specific palette
        land: {
          bg: '#080810',
          card: '#0E0E1A',
          border: '#1A1A2E',
          purple: '#7C3AED',
          'purple-light': '#A855F7',
          'purple-dim': '#2D1B69',
          'purple-glow': '#4C1D95',
          muted: '#6B7280',
          subtle: '#9CA3AF',
          green: '#22C55E',
          'green-dim': '#166534',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.15s ease-in-out',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-8px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
