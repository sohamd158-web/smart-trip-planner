import axios from 'axios';

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const baseURL = isLocalhost ? 'http://localhost:5000/api' : 'https://onrender.com';

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
    if (config && !config._retried && (!err.response || err.response.status >= 500)) {
      config._retried = true;
      await new Promise((r) => setTimeout(r, 3000));
      return api(config);
    }
    return Promise.reject(err);
  }
);

export default api;
