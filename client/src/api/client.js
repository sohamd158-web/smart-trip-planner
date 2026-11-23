import axios from 'axios';

const rawUrl = (import.meta.env.VITE_API_URL || 'https://onrender.com').replace(/\/+$/, '');
const baseURL = rawUrl.endsWith('/api') ? rawUrl : rawUrl + '/api';

const api = axios.create({
  baseURL,
  timeout: 45000,
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
    if (config && !config._retried && (!err.response || err.response.status >= 502)) {
      config._retried = true;
      await new Promise((r) => setTimeout(r, 3000));
      return api(config);
    }
    return Promise.reject(err);
  }
);

export default api;
