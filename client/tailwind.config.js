/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#FBF9F5', // Warm ivory / eggshell canvas
          subtle: '#F4F0E8',  // Slightly deeper cream for hovering/subtle backgrounds
          dark: '#EBE5D8',    // Strong cream for secondary tags
        },
        surface: {
          DEFAULT: '#FFFFFF', // Clean crisp white functional surface
          elevated: '#FFFFFF',
          subtle: '#FAF8F4',
          muted: '#F0ECE1',
        },
        ink: {
          DEFAULT: '#18181B', // Deep rich charcoal primary typography
          secondary: '#52525B', // Warm muted gray for body/secondary text
          muted: '#71717A',   // Secondary metadata
          faint: '#A1A1AA',   // Inactive / subtle hints
        },
        border: {
          DEFAULT: '#E6E2D8', // Subtle warm neutral hairline border
          subtle: '#EFECE6',  // Ultra faint divider
          strong: '#D5CFBF',  // Active/hover border
          focus: '#18181B',   // High contrast focus border
        },
        accent: {
          DEFAULT: '#C2410C', // Restrained warm terracotta accent
          hover: '#9A3412',
          subtle: '#FFEDD5',
          faint: '#FFF7ED',
        },
        brand: {
          slate: '#334155',
          navy: '#0F172A',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02)',
        'elevated': '0 4px 12px 0 rgba(0, 0, 0, 0.04), 0 2px 4px -1px rgba(0, 0, 0, 0.02)',
        'modal': '0 12px 32px 0 rgba(0, 0, 0, 0.08), 0 4px 12px -2px rgba(0, 0, 0, 0.03)',
      },
      borderRadius: {
        'subtle': '6px',
        'card': '10px',
        'modal': '12px',
      },
      animation: {
        'fade-in': 'fadeIn 0.14s ease-out forwards',
        'slide-up': 'slideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'qr-reveal': 'qrReveal 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'check-settle': 'checkSettle 0.20s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'device-connect': 'deviceConnect 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        qrReveal: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        checkSettle: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        deviceConnect: {
          '0%': { opacity: '0', transform: 'translateX(-3px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        }
      }
    },
  },
  plugins: [],
}
