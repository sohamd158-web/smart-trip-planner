import axios from 'axios';

const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const baseURL = isLocal ? 'http://localhost:5000/api' : 'https://onrender.com';

const api = axios.create({
  baseURL,
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;
    if (!config) return Promise.reject(err);

    config._retryCount = config._retryCount || 0;
    const shouldRetry = !err.response || err.response.status >= 500;

    if (shouldRetry && config._retryCount < 6) {
      config._retryCount += 1;
      await new Promise((resolve) => setTimeout(resolve, config._retryCount * 3500));
      return api(config);
    }
    return Promise.reject(err);
  }
);

export default api;
