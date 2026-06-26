import messaging from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import notifee, { AndroidImportance, AndroidVisibility } from '@notifee/react-native';

// Solicitar permisos de notificación
export async function requestUserPermission() {
  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }

  const authStatus = await messaging().requestPermission({
    alert: true,
    sound: true,
    badge: true,
  });
  
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}

// Registrar canales de sonido en Android (Notifee)
export async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;

  // Canal General / Por defecto
  await notifee.createChannel({
    id: 'default',
    name: 'General',
    importance: AndroidImportance.DEFAULT,
  });

  // Canal Alarma para Comercios (Pedidos Nuevos)
  try {
    await notifee.deleteChannel('alarma_comercios');
  } catch (err) {
    console.log("Error al borrar canal antiguo:", err);
  }

  await notifee.createChannel({
    id: 'alarma_comercios_v2',
    name: 'Nuevos Pedidos (Alarma)',
    importance: AndroidImportance.HIGH,
    sound: 'alarma_comercio', // Apunta a alarma_comercio.mp3 en android/app/src/main/res/raw/
    visibility: AndroidVisibility.PUBLIC,
    bypassDnd: true,
  });
}

// Obtener Token de Firebase (FCM)
export async function getFcmToken() {
  try {
    if (!messaging().isDeviceRegisteredForRemoteMessages) {
      await messaging().registerDeviceForRemoteMessages();
    }
    const token = await messaging().getToken();
    return token;
  } catch (error) {
    console.error("Error obteniendo token FCM:", error);
    return null;
  }
}

// Navegar a la pantalla correcta al presionar notificación
function handleNotificationNavigation(remoteMessage, navigationRef, role) {
  const data = remoteMessage.data;
  if (!data || !navigationRef || !navigationRef.isReady()) return;

  if (data.order_id) {
    if (role === 'owner') {
      navigationRef.navigate('CommerceOrderDetail', { orderId: data.order_id });
    } else if (role === 'courier') {
      navigationRef.navigate('DeliveryTracking', { orderId: data.order_id });
    }
  } else if (data.trip_id && role === 'driver') {
    navigationRef.navigate('MainDriver', {
      screen: 'TripActual',
      params: { tripId: data.trip_id }
    });
  }
}

// Listeners para primer plano y eventos de click
export function initializeFcmListeners(navigationRef, userRole) {
  const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
    console.log('FCM Foreground recibida (Socios):', remoteMessage);

    const title = remoteMessage.notification?.title || remoteMessage.data?.title || 'Nuevo Pedido 📦';
    const body = remoteMessage.notification?.body || remoteMessage.data?.body || 'Tienes una nueva notificación.';

    // Si es comercio (owner) o tiene flag de sonido de alarma o el título contiene 'Pedido', reproducir alarma looping
    const isAlarma = userRole === 'owner' || 
                     remoteMessage.data?.sound === 'alarma_comercios' || 
                     remoteMessage.data?.sound === 'alarma_comercios_v2' ||
                     (title && title.includes('Pedido'));

    await notifee.displayNotification({
      title,
      body,
      android: {
        channelId: isAlarma ? 'alarma_comercios_v2' : 'default',
        importance: AndroidImportance.HIGH,
        ongoing: isAlarma,
        loopSound: isAlarma,
        pressAction: {
          id: 'default',
        },
      },
    });
  });

  // Notificación presionada en segundo plano
  const unsubscribeNotificationOpened = messaging().onNotificationOpenedApp(remoteMessage => {
    handleNotificationNavigation(remoteMessage, navigationRef, userRole);
  });

  // Notificación presionada desde estado killed
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        setTimeout(() => {
          handleNotificationNavigation(remoteMessage, navigationRef, userRole);
        }, 1500);
      }
    });

  return () => {
    unsubscribeForeground();
    unsubscribeNotificationOpened();
  };
}
