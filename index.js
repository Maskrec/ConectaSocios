import { registerRootComponent } from 'expo';
import App from './App';
import registerBackgroundHandler from './registerBackgroundHandler';

// Registrar manejador de segundo plano
registerBackgroundHandler();

registerRootComponent(App);
