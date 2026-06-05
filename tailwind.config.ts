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
        borderStrong: "#223041",
        textPrimary: "#E6EDF3",
        textSecondary: "#B7C0CC",
        textMuted: "#8B98A8",
        accentBlue: "#4F8CFF",
        positive: "#21C67A",
        negative: "#F05252",
        warning: "#F5B84B",
        neutral: "#9CA3AF"
      },
      fontFamily: {
        sans: ["Inter", "Geist", "IBM Plex Sans", "system-ui", "sans-serif"]
      },
      boxShadow: {
        panel: "0 10px 35px rgba(0, 0, 0, 0.22)"
      }
    }
  },
  plugins: []
};

export default config;
