import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "#4F46E5",
          light: "#6366F1",
          dark: "#3730A3",
        },
        secondary: {
          DEFAULT: "#8B5CF6",
          light: "#A78BFA",
        },
        accent: {
          mint: "#10B981",
          teal: "#0D9488",
          orange: "#F59E0B",
          sky: "#0EA5E9",
          red: "#C53030", // For alerts
        },
        calming: {
          bg: "#F8FAFC",
          card: "#FFFFFF",
          text: "#1E293B",
          muted: "#64748B",
        },
        pro: {
          bg: "#0B0E14", // AI Modeling Pro background
          card: "#161B22",
          border: "#30363D",
          text: "#C9D1D9",
          accent: "#58A6FF",
        }
      },
      backgroundImage: {
        "brain-gradient": "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
      },
      fontFamily: {
        lexend: ["var(--font-lexend)", "sans-serif"],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'soft': '0 4px 20px 0 rgba(0, 0, 0, 0.05)',
        'premium': '0 10px 30px -5px rgba(63, 81, 181, 0.1), 0 8px 10px -6px rgba(63, 81, 181, 0.1)',
      }
    },
  },
  plugins: [],
} satisfies Config;
