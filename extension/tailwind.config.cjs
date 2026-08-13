/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/pages/campaign/**/*.{html,js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Fira Code", "SFMono-Regular", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
