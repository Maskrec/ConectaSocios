import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import App from './App';
import registerBackgroundHandler from './registerBackgroundHandler';

// Configurar idioma español y desactivar aviso de traducción automática de Google en Web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  try {
    document.documentElement.lang = 'es';
    document.documentElement.setAttribute('translate', 'no');
    document.documentElement.classList.add('notranslate');
    if (document.body) {
      document.body.classList.add('notranslate');
      document.body.setAttribute('translate', 'no');
    }

    if (!document.querySelector('meta[name="google"][content="notranslate"]')) {
      const metaGoogle = document.createElement('meta');
      metaGoogle.name = 'google';
      metaGoogle.content = 'notranslate';
      document.head.appendChild(metaGoogle);
    }

    if (!document.querySelector('meta[http-equiv="Content-Language"]')) {
      const metaLang = document.createElement('meta');
      metaLang.httpEquiv = 'Content-Language';
      metaLang.content = 'es';
      document.head.appendChild(metaLang);
    }
  } catch (e) {
    console.warn('Error al establecer metadatos de idioma en web:', e);
  }
}

// Registrar manejador de segundo plano
registerBackgroundHandler();

registerRootComponent(App);
