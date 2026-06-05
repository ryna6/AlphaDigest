import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0B0F14",
        sidebar: "#080B10",
        panel: "#111821",
        panelHover: "#151E2A",
        border: "#223041",
        primaryText: "#E6EDF3",
        secondaryText: "#B7C0CC",
        mutedText: "#8B98A8",
        accent: "#4F8CFF",
        positive: "#21C67A",
        negative: "#F05252",
        warning: "#F5B84B",
        neutral: "#9CA3AF"
      },
      fontFamily: {
        sans: ["Inter", "Geist", "IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "SFMono-Regular", "ui-monospace", "monospace"]
      },
      boxShadow: {
        panel: "0 10px 30px rgba(0,0,0,.18)"
      }
    }
  },
  plugins: []
};

export default config;
