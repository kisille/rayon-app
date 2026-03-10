/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        post: {
          gelb: '#FFCC00',
          dunkelgelb: '#E6B800',
        },
      },
    },
  },
  plugins: [],
};
