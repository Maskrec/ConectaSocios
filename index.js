import { registerRootComponent } from 'expo';
import App from './App';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance } from '@notifee/react-native';

// Registrar manejador de segundo plano / killed para Firebase (Socio/Comercio)
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Mensaje FCM recibido en segundo plano (Socio/Comercio):', remoteMessage);

  const title = remoteMessage.notification?.title || remoteMessage.data?.title || 'Conecta Socios';
  const body = remoteMessage.notification?.body || remoteMessage.data?.body || 'Tienes una nueva actualización.';
  
  // Para comercios, reproducimos la alarma en bucle si es un nuevo pedido
  const isAlarma = remoteMessage.data?.sound === 'alarma_comercios' || (remoteMessage.data?.title && remoteMessage.data?.title.includes('Pedido'));

  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId: isAlarma ? 'alarma_comercios' : 'default',
      importance: AndroidImportance.HIGH,
      ongoing: isAlarma,
      loopSound: isAlarma,
      pressAction: {
        id: 'default',
      },
    },
  });
});

registerRootComponent(App);
