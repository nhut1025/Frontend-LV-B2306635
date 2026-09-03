/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Chủ đề "bếp mở, nguyên liệu tươi" — cố tình tránh cặp kem/cam đất mặc định.
        porcelain: '#F4F6F1', // nền chính, trắng phớt xanh xám như sứ
        ink: '#1E2321', // chữ chính, gần đen ấm
        basil: {
          50: '#EAF3EC',
          100: '#CFE4D4',
          400: '#4C8F6C',
          500: '#2F6F4E', // màu chính — xanh basil
          600: '#255A3E',
          700: '#1C4530',
        },
        saffron: {
          50: '#FBF1DD',
          400: '#E0B24C',
          500: '#D69A2D', // trạng thái chờ/giữ tạm
          600: '#B57F1F',
        },
        clay: {
          50: '#F6E7E1',
          400: '#C36846',
          500: '#B5482B', // trạng thái bận/lỗi
          600: '#963A22',
        },
        slate: {
          50: '#F1F2F0',
          200: '#DADDD8',
          400: '#8B948C',
          500: '#5B6660',
          700: '#3A423C',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        plate: '1.25rem',
      },
    },
  },
  plugins: [],
};
