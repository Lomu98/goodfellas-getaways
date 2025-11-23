/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Inter', 'sans-serif'],
        'serif': ['Lora', 'serif']
      },
      colors: {
        'brand-dark': '#222A3A',
        'brand-light': '#EFEBE0',
        'brand-accent': '#C6A875',
        'brand-action': '#9B2C2C',
        'brand-secondary': '#7A8C99'
      }
    },
  },
  plugins: [],
}