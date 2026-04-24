import axios from 'axios';
import SecureStorage from './services/SecureStorage';
import CONFIG from './config';

const API_URL = CONFIG.API_URL;

const apiClient = axios.create({
  baseURL: `${API_URL}/api/`,
  timeout: CONFIG.REQUEST_TIMEOUT,
});

// Interceptor para agregar token de autenticación (desde almacenamiento seguro)
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Token ${token}`;
      }
    } catch (error) {
      console.warn('Error al obtener token del almacenamiento seguro:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas con errores 401 (token expirado)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado o inválido - Limpiar storage y redirigir a login
      SecureStorage.removeItem('authToken').catch(err => 
        console.error('Error al remover token:', err)
      );
      console.warn('Token expirado, limpiando almacenamiento');
      // El AuthContext cuidará de redirigir al usuario
    }
    return Promise.reject(error);
  }
);

export default apiClient;