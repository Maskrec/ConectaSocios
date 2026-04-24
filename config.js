/**
 * ============================================================================
 * CONFIGURACIÓN CENTRALIZADA SEGURA - CONECTASOCIOS
 * ============================================================================
 * 
 * INSTRUCCIONES:
 * 1. NUNCA comitees este archivo con valores reales
 * 2. Usa variables de entorno de Expo en .env
 * 3. Generar claves con: openssl rand -hex 32
 * 4. En producción, usar un vault seguro (AWS Secrets Manager, etc.)
 */

import Constants from 'expo-constants';

// ============================================================================
// FUNCIONES DE UTILIDAD PARA VALIDACIÓN
// ============================================================================
const validateConfig = () => {
  const errors = [];

  // Validar API URL
  if (!CONFIG.API_URL || !CONFIG.API_URL.startsWith('https://')) {
    errors.push('API_URL debe ser HTTPS');
  }

  // Validar Google Maps Keys
  if (CONFIG.GOOGLE_MAPS_API_KEY === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
    errors.push('Google Maps API Key no configurada');
  }

  // Validar Encryption Key (en producción debe ser fuerte)
  if (CONFIG.ENCRYPTION_KEY === 'default_key_change_in_production') {
    console.warn('⚠️ ADVERTENCIA: Encryption key por defecto - cambiar en producción');
  }

  return errors;
};

// ============================================================================
// CONFIGURACIÓN PRINCIPAL (desde variables de entorno)
// ============================================================================
const CONFIG = {
  // ========== API CONFIGURATION ==========
  API_URL: process.env.EXPO_PUBLIC_API_URL || 'https://api-conectalocalv2-1.onrender.com',

  // ========== GOOGLE MAPS (obtén de Google Cloud Console) ==========
  GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY_HERE',
  GOOGLE_MAPS_API_KEY_ANDROID: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID || 'YOUR_GOOGLE_MAPS_API_KEY_ANDROID_HERE',
  GOOGLE_MAPS_API_KEY_IOS: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS || 'YOUR_GOOGLE_MAPS_API_KEY_IOS_HERE',

  // ========== NETWORK CONFIGURATION ==========
  REQUEST_TIMEOUT: parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT || '30000', 10),
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,

  // ========== ENCRYPTION (para almacenamiento seguro de tokens) ==========
  // IMPORTANTE: Generar con: openssl rand -hex 32
  ENCRYPTION_KEY: process.env.EXPO_PUBLIC_ENCRYPTION_KEY || 'default_key_change_in_production',
  ENCRYPTION_ALGORITHM: process.env.EXPO_PUBLIC_ENCRYPTION_ALGORITHM || 'aes-256-cbc',

  // ========== NOTIFICACIONES ==========
  EXPO_PROJECT_ID: process.env.EXPO_PUBLIC_EXPO_PROJECT_ID || '',

  // ========== APP CONFIGURATION ==========
  APP_VERSION: Constants.manifest?.version || '1.0.0',
  BUILD_NUMBER: Constants.manifest?.extra?.buildNumber || '1',

  // ========== FEATURE FLAGS ==========
  ENABLE_PUSH_NOTIFICATIONS: true,
  ENABLE_LOCATION_TRACKING: true,
  ENABLE_OFFLINE_MODE: true,
};

// ============================================================================
// VALIDACIÓN EN INICIALIACIÓN
// ============================================================================
const configErrors = validateConfig();
if (configErrors.length > 0) {
  console.error('❌ ERRORES DE CONFIGURACIÓN:');
  configErrors.forEach(error => console.error(`  - ${error}`));
  
  if (!process.env.EXPO_PUBLIC_API_URL) {
    console.error('\n⚠️ INSTRUCCIONES: Crea un archivo .env con:');
    console.error(`  EXPO_PUBLIC_API_URL=https://tu-api.com`);
    console.error(`  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=tu_key_aqui`);
  }
}

export default CONFIG;
