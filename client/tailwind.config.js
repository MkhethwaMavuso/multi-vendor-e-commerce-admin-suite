/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14211c",
        muted: "#65736c",
        canvas: "#f4f7f5",
        brand: "#167d5a",
        "brand-dark": "#0e6245",
        line: "#e5ebe7"
      },
      boxShadow: { panel: "0 8px 30px rgba(20, 33, 28, .05)" }
    }
  },
  plugins: []
};
