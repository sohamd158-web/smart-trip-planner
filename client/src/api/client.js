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
    const isNetworkOrColdStart = !err.response || [502, 503, 504].includes(err.response.status);

    if (isNetworkOrColdStart && config._retryCount < 5) {
      config._retryCount += 1;
      const waitMs = config._retryCount * 4000;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return api(config);
    }
    return Promise.reject(err);
  }
);

export default api;
