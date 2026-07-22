/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  corePlugins: {
    // Disable Preflight so Tailwind's CSS reset doesn't wipe out
    // the existing globals.css styles.
    preflight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          green: "#16a34a",
          dark:  "#1e293b",
          navy:  "#0f172a",
        },
      },
    },
  },
  plugins: [],
};
