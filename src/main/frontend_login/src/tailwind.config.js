/** @type {import('tailwindcss').Config} */
module.exports = {
  // 이 content 부분이 중요합니다. src 폴더 내의 모든 js, jsx 파일을 바라보게 해야 합니다.
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}