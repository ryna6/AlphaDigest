import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "#0B0F14",
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
        warning: "#F5B84B"
      },
      fontFamily: {
        sans: ["Inter", "Geist", "IBM Plex Sans", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        panel: "0 12px 40px rgba(0,0,0,0.18)"
      }
    }
  },
  plugins: []
};

export default config;
