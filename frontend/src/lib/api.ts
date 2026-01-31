import axios from 'axios';

// Use environment variable or fallback to production URL
const API_URL = import.meta.env.VITE_API_URL || 'https://firebase-683518334177.asia-northeast3.run.app';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 60000, // 60 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});
