import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream:  '#FFF4E0',
        ink:    '#16161D',
        purple: '#7C5CFC',
        pink:   '#FF5CA8',
        lime:   '#C6F135',
        cyan:   '#34D6E8',
        yellow: '#FFD23F',
        orange: '#FF8A3D',
        white:  '#FFFFFF',
      },
      fontFamily: {
        display: ['"Space Grotesk Variable"', 'sans-serif'],
        body:    ['"Inter Variable"', 'sans-serif'],
      },
      fontSize: {
        '7xl':  ['4.5rem',  { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        '8xl':  ['6rem',    { lineHeight: '1',    letterSpacing: '-0.04em' }],
      },
      borderRadius: {
        crudd:    '18px',
        'crudd-lg': '28px',
        pill:     '999px',
      },
      borderWidth: {
        '3': '3px',
      },
      ringWidth: {
        '3': '3px',
      },
      boxShadow: {
        'hard-sm': '3px 3px 0px #16161D',
        'hard':    '6px 6px 0px #16161D',
        'hard-lg': '10px 10px 0px #16161D',
        'hard-sm-purple': '3px 3px 0px #7C5CFC',
        'hard-purple':    '6px 6px 0px #7C5CFC',
      },
      keyframes: {
        marquee: {
          '0%':   { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(var(--tw-rotate, 0deg))' },
          '50%':      { transform: 'translateY(-10px) rotate(var(--tw-rotate, 0deg))' },
        },
        'blob-pulse': {
          '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' },
          '50%':      { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%' },
        },
        'bounce-x': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%':      { transform: 'translateX(6px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%':      { transform: 'rotate(2deg)' },
        },
        'score-tick': {
          '0%':   { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-24px)', opacity: '0' },
        },
      },
      animation: {
        marquee:     'marquee 28s linear infinite',
        float:       'float 4s ease-in-out infinite',
        'blob-pulse': 'blob-pulse 8s ease-in-out infinite',
        'bounce-x':  'bounce-x 1.2s ease-in-out infinite',
        wiggle:      'wiggle 0.5s ease-in-out',
        'score-tick': 'score-tick 0.8s ease-out forwards',
      },
    },
  },
  plugins: [],
}

export default config
