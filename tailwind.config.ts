import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          300: "#fde68a",
          400: "#fbbf24",
          500: "#f5b301",
          600: "#d97706",
        },
        ink: {
          950: "#05070d",
          900: "#0b1120",
          800: "#111a2e",
          700: "#1a2440",
        },
      },
      fontFamily: {
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
