/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        urgency: {
          critical: '#ef4444',
          urgent: '#f97316',
          approaching: '#eab308',
          moderate: '#3b82f6',
          safe: '#10b981',
          expired: '#6b7280',
        }
      },
    },
  },
  plugins: [],
};
