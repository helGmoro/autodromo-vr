/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./pages/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        pista: {
          negro: "#0b0b0b",
          rojo: "#e10600",
          naranja: "#ff6a00"
        }
      }
    }
  },
  plugins: []
};
