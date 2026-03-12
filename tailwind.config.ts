import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
        info: "hsl(var(--info))",
        earth: "hsl(var(--earth))"
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" }
        }
      },
      animation: {
        "fade-up": "fade-up 450ms ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite"
      },
      boxShadow: {
        card: "0 8px 24px -12px rgba(15, 23, 42, 0.28)",
        glow: "0 0 0 1px rgba(31, 122, 99, 0.34), 0 0 20px rgba(31, 122, 99, 0.2)"
      },
      backgroundImage: {
        "dashboard-gradient": "radial-gradient(circle at 10% -20%, rgba(31, 122, 99, 0.28), transparent 40%), radial-gradient(circle at 90% -10%, rgba(244, 185, 66, 0.18), transparent 32%), linear-gradient(140deg, rgba(30, 41, 59, 1), rgba(15, 23, 42, 1))"
      }
    }
  },
  plugins: []
} satisfies Config;
