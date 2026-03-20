import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Token automatisch mitsenden
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Bei 401 ausloggen und Session-Abgelaufen-Hinweis anzeigen
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Nur weiterleiten wenn kein Login-Request selbst fehlgeschlagen ist
      const isLoginRequest = error.config?.url?.includes('/auth/login');
      if (!isLoginRequest) {
        localStorage.removeItem('token');
        localStorage.removeItem('benutzer');
        window.location.href = '/login?grund=sitzung-abgelaufen';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
