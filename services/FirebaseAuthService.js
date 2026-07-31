import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider 
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyA-R__ZMXLnWt0Q5pH5Cfh0z4XIwgyJLxw",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "conectalocal-7c4e4.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "conectalocal-7c4e4",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "conectalocal-7c4e4.firebasestorage.app",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export async function signInWithGoogleFirebase() {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    let result;
    try {
      result = await signInWithPopup(auth, provider);
    } catch (popupErr) {
      if (
        popupErr.code === 'auth/popup-blocked' ||
        popupErr.code === 'auth/cancelled-popup-request' ||
        popupErr.message?.includes('Cross-Origin-Opener-Policy')
      ) {
        console.warn('⚠️ Ventana emergente bloqueada por el navegador o política COOP. Intentando con redirección...');
        await signInWithRedirect(auth, provider);
        return { pendingRedirect: true };
      }
      throw popupErr;
    }
    const idToken = await result.user.getIdToken();
    return { success: true, idToken, user: result.user };
  } catch (error) {
    console.error('❌ Error en Google Auth:', error);
    return { success: false, error: error.message || 'Error en inicio de sesión con Google' };
  }
}

export async function checkGoogleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      const idToken = await result.user.getIdToken();
      return { success: true, idToken, user: result.user };
    }
  } catch (error) {
    console.error('❌ Error recuperando resultado de redirección Google:', error);
  }
  return null;
}
