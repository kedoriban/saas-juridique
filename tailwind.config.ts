import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50:  "#f0f5f2",
          100: "#ddeae3",
          200: "#bcd6c8",
          300: "#93bba4",
          400: "#699b7e",
          500: "#4d8063",
          600: "#3a5346", // couleur primaire Figma (sidebar, accents)
          700: "#304539",
          800: "#28382e",
          900: "#222e26",
        },
        sage: {
          50:  "#f4f7f5",
          100: "#e8f0eb",
          200: "#d1e1d7",
          300: "#aec9b8",
          400: "#87ad97",
          500: "#6b9279",  // sidebar active background area
          600: "#567a63",
          700: "#456351",
          800: "#3a5144",
          900: "#304339",
        },
      },
    },
  },
  plugins: [],
};

export default config;
