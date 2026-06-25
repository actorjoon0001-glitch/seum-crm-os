import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        seum: {
          DEFAULT: "#1f6feb",
          dark: "#0b3d91",
          light: "#e8f0fe",
        },
      },
    },
  },
  plugins: [],
};

export default config;
