import React, { createContext, useState, useContext, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SecureStorage from '../services/SecureStorage';
import apiClient from '../api';
import axios from 'axios';
import CONFIG from '../config';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Alert from '../components/AlertPolyfill';

const API_URL = CONFIG.API_URL;

const AuthContext = createContext(null);

// Configuración global de notificaciones
/*Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});*/

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState(null);

  // --- FUNCIÓN PARA REGISTRAR NOTIFICACIONES ---
  const registerForPushNotificationsAsync = async () => {
    console.log("Notificaciones desactivadas temporalmente para debugging");
      return null;
    let token;
    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        Alert.alert('Permiso denegado', 'No se pudieron activar las notificaciones push.');
        return;
      }
      token = (await Notifications.getExpoPushTokenAsync()).data;

      // ENVÍA EL TOKEN AL BACKEND
      if (token) {
        try {
          // Usamos apiClient porque ya tiene el header de autorización
          await apiClient.post('/guardar-token/', { token });
          console.log("Token push guardado con éxito:", token);
        } catch (error) {
          console.error("Error guardando token push:", error);
        }
      }
    } else {
      console.log('Se necesita un dispositivo físico para notificaciones Push');
    }
    return token;
  };

  // --- EFFECT: CARGAR TOKEN AL INICIO ---
  useEffect(() => {
    const loadToken = async () => {
      try {
        // Usar SecureStorage para obtener el token de forma segura (desencriptado)
        const token = await SecureStorage.getItem('authToken');
        if (token) {
          setAuthToken(token);
          apiClient.defaults.headers.common['Authorization'] = `Token ${token}`;

          const response = await apiClient.get('/perfil/');
          const userRole = response.data.role;

          if (userRole === 'courier' || userRole === 'owner' || userRole === 'driver') {
            setUser(response.data);
            setRole(userRole);
          } else {
            await logout();
          }
        }
      } catch (e) {
        console.error("Fallo al cargar el token", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadToken();
  }, []);

  // --- EFFECT: REGISTRAR NOTIFICACIONES CUANDO HAY TOKEN ---
  useEffect(() => {
    if (authToken) {
      // registerForPushNotificationsAsync();
    }
  }, [authToken]);


  // --- FUNCIÓN LOGIN ---
  const login = async (username, password) => {
    try {
      // 1. Obtener Token
      // Nota: Asegúrate de usar el endpoint correcto según tu urls.py (suele ser /auth/login/)
      const response = await axios.post(`${API_URL}/api/api-token-auth/`, { username, password });
      const token = response.data.token;

      // 2. Guardar Token de forma segura (encriptado) en el dispositivo
      await SecureStorage.setItem('authToken', token);
      setAuthToken(token);
      apiClient.defaults.headers.common['Authorization'] = `Token ${token}`;

      // 3. Obtener los datos del Perfil
      const profileResponse = await apiClient.get('/auth/perfil/'); // Ajusta a '/perfil/' si esa es tu ruta exacta
      const userData = profileResponse.data;
      const userRole = userData.role;

      // 4. Validar Rol
      if (userRole !== 'courier' && userRole !== 'owner' && userRole !== 'driver') {
         Alert.alert('Error', 'Esta cuenta no tiene un rol válido para esta App.');
         await logout(); // Limpiamos si entró un cliente por error
         return { error: 'invalid_role' };
      }

      // 5. Establecer los estados globales
      // Al hacer esto, React Native re-renderiza y tu Navegador debería mandarte a la pantalla correcta
      setRole(userRole);
      setUser(userData);

      return { success: true, role: userRole };

    } catch (error) {
      console.error("Error en el inicio de sesión:", error.response?.data || error.message);

      if (error.response) {
        // CASO 1: Cuenta Inactiva (AQUÍ ES DONDE CONECTAMOS CON EL MODAL DE LOGIN)
        if (error.response.status === 403 && error.response.data.error === 'account_inactive') {
          // En lugar de un Alert, retornamos el error para que LoginPage abra el Modal
          return { error: 'account_inactive' };
        }
        // CASO 2: Credenciales Incorrectas
        else if (error.response.status === 400) {
          Alert.alert("Error", "Usuario o contraseña incorrectos.");
          return { error: 'invalid_credentials' };
        }
        // Otros errores del servidor
        else {
           Alert.alert("Error", "Ocurrió un problema con el servidor.");
           return { error: 'server_error' };
        }
      } else {
        Alert.alert("Error de Conexión", "Revisa tu internet y vuelve a intentarlo.");
        return { error: 'network_error' };
      }
    }
  };

  // --- FUNCIÓN LOGOUT ---
  const logout = async () => {
    try {
      // Remover el token del almacenamiento seguro
      await SecureStorage.removeItem('authToken');
      setAuthToken(null);
      setUser(null);
      setRole(null);
      delete apiClient.defaults.headers.common['Authorization'];
      console.log('✓ Sesión cerrada y token removido');
    } catch (e) {
      console.error("Fallo al cerrar sesión", e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, authToken, role, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);