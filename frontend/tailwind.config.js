/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic theme tokens — values come from CSS variables in index.css
        "th-bg":           "var(--c-bg)",
        "th-panel":        "var(--c-bg-panel)",
        "th-surface":      "var(--c-bg-surface)",
        "th-elevated":     "var(--c-bg-elevated)",
        "th-raised":       "var(--c-bg-raised)",
        "th-border":       "var(--c-border)",
        "th-border-s":     "var(--c-border-strong)",
        "th-text":         "var(--c-text)",
        "th-soft":         "var(--c-text-soft)",
        "th-muted":        "var(--c-text-muted)",
        "th-faint":        "var(--c-text-faint)",
        "th-dim":          "var(--c-text-dim)",
      },
    },
  },
  plugins: [],
};
