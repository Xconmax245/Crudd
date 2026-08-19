import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FBF9F4',
        ink: '#1A1A1A',
        paper: '#FFFFFF',
        brand: {
          DEFAULT: '#4F46E5',
          fg: '#FFFFFF',
        },
        muted: '#6B7280',
        line: '#E5E7EB',
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
      },
      fontFamily: {
        display: ['"Space Grotesk Variable"', 'system-ui', 'sans-serif'],
        body: ['"Inter Variable"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
