import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SecureStorage from '../services/SecureStorage';
import apiClient from '../api';
import axios from 'axios';
import CONFIG from '../config';
import Alert from '../components/AlertPolyfill';
import { navigationRef } from '../App';
import {
  requestUserPermission,
  setupNotificationChannels,
  getFcmToken,
  initializeFcmListeners
} from '../services/FirebaseNotifications';

const API_URL = CONFIG.API_URL;
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [isActivo, setIsActivo] = useState(true);
  const lastWebItemsRef = useRef([]);

  useEffect(() => {
    if (user) {
      setIsActivo(user.is_available ?? true);
    }
  }, [user]);

  const toggleAvailability = async () => {
    const newValue = !isActivo;
    setIsActivo(newValue);
    try {
      const response = await apiClient.patch('/auth/perfil/', { is_available: newValue });
      setUser(response.data);
      console.log("Estado de disponibilidad actualizado en el servidor a:", newValue);
    } catch (error) {
      console.error("Error al actualizar disponibilidad:", error);
      setIsActivo(!newValue);
    }
  };

  // Helper para mostrar notificaciones nativas en el navegador (Web)
  const showWebNotification = (title, body, data = {}) => {
    if (Platform.OS === 'web' && 'Notification' in window && Notification.permission === 'granted') {
      const notification = new window.Notification(title, {
        body: body,
        icon: '/favicon.ico'
      });
      notification.onclick = () => {
        window.focus();
        try {
          if (navigationRef.isReady()) {
            if (data.order_id) {
              if (role === 'owner') {
                navigationRef.navigate('CommerceOrderDetail', { orderId: data.order_id });
              } else if (role === 'courier') {
                navigationRef.navigate('DeliveryTracking', { orderId: data.order_id });
              }
            } else if (data.trip_id) {
              if (role === 'driver') {
                navigationRef.navigate('MainDriver', {
                  screen: 'TripActual',
                  params: { tripId: data.trip_id }
                });
              }
            }
          }
        } catch (err) {
          console.error("Error al redireccionar al presionar la notificación web:", err);
        }
      };
      
      // Sonido en la web
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav');
        audio.play();
      } catch (e) {
        console.log('Audio playback blocked or failed:', e);
      }
    }
  };

  // --- FUNCIÓN PARA REGISTRAR NOTIFICACIONES ---
  const registerForPushNotificationsAsync = async () => {
    try {
      if (Platform.OS === 'web') return null;

      const hasPermission = await requestUserPermission();
      if (!hasPermission) {
        console.warn('⚠️ Permisos de notificación denegados');
        return null;
      }

      await setupNotificationChannels();

      const token = await getFcmToken();
      if (token) {
        try {
          await apiClient.post('/guardar-token/', { token, device_type: Platform.OS });
          console.log("Token push FCM guardado con éxito:", token);
        } catch (error) {
          console.error("Error guardando token push FCM:", error);
        }
      }
      return token;
    } catch (error) {
      console.error('❌ Error en registro de notificaciones FCM:', error);
      return null;
    }
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
      registerForPushNotificationsAsync();
    }
  }, [authToken]);

  // --- EFFECT: WEBSOCKET / POLLING DE NOTIFICACIONES EN WEB ---
  useEffect(() => {
    if (Platform.OS !== 'web' || !authToken || !role) return;

    const checkWebNotifications = async () => {
      try {
        if (role === 'owner') {
          // Comercio: buscar nuevos pedidos pendientes
          const response = await apiClient.get('/mis-pedidos-comercio/');
          const orders = Array.isArray(response.data) ? response.data : (response.data.results || []);
          const pendingOrders = orders.filter(o => o.status === 'pending');
          
          if (pendingOrders.length > 0) {
            // Comparar con el último chequeo
            const newOrders = pendingOrders.filter(
              o => !lastWebItemsRef.current.some(prev => prev.id === o.id)
            );
            if (newOrders.length > 0) {
              const firstOrder = newOrders[0];
              showWebNotification(
                '¡Nuevo Pedido Recibido! 🛍️',
                `Pedido de ${firstOrder.customer_name || 'un cliente'} por $${firstOrder.total || 0}.`,
                { order_id: firstOrder.id }
              );
            }
          }
          lastWebItemsRef.current = pendingOrders;
        } else if (role === 'courier') {
          // Repartidor: buscar pedidos disponibles
          const response = await apiClient.get('/pedidos/disponibles/');
          const orders = Array.isArray(response.data) ? response.data : (response.data.results || []);
          
          if (orders.length > 0) {
            const newOrders = orders.filter(
              o => !lastWebItemsRef.current.some(prev => prev.id === o.id)
            );
            if (newOrders.length > 0) {
              const firstOrder = newOrders[0];
              showWebNotification(
                'Nuevo Pedido Disponible 📦',
                `Pedido listo en ${firstOrder.commerce?.name || 'Comercio'}.`,
                { order_id: firstOrder.id }
              );
            }
          }
          lastWebItemsRef.current = orders;
        } else if (role === 'driver') {
          // Chofer/Taxi: buscar viajes disponibles
          const response = await apiClient.get('/viajes/disponibles-driver/');
          const trips = Array.isArray(response.data) ? response.data : (response.data.results || []);
          
          if (trips.length > 0) {
            const newTrips = trips.filter(
              t => !lastWebItemsRef.current.some(prev => prev.id === t.id)
            );
            if (newTrips.length > 0) {
              const firstTrip = newTrips[0];
              showWebNotification(
                'Nuevo Viaje Disponible 🚖',
                `Viaje de ${firstTrip.distance_km}km por $${firstTrip.estimated_price}.`,
                { trip_id: firstTrip.id }
              );
            }
          }
          lastWebItemsRef.current = trips;
        }
      } catch (err) {
        console.error('Error al consultar notificaciones en web:', err);
      }
    };

    // Ejecutar inicial y luego cada 30 segundos
    checkWebNotifications();
    const interval = setInterval(checkWebNotifications, 30000);
    return () => {
      clearInterval(interval);
      lastWebItemsRef.current = [];
    };
  }, [authToken, role]);

  // --- EFFECT: ESCUCHA DE NOTIFICACIONES PUSH (MÓVIL NATIVO) ---
  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Inicializar listeners nativos de Firebase/Notifee
    // Pasamos el rol para poder reproducir alarmas
    const unsubscribeFcm = initializeFcmListeners(navigationRef, role);

    return () => {
      if (unsubscribeFcm) unsubscribeFcm();
    };
  }, [role]);

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
      const profileResponse = await apiClient.get('/perfil/'); // Unificado con loadToken()
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
    <AuthContext.Provider value={{ user, setUser, authToken, role, isLoading, login, logout, isActivo, toggleAvailability }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);