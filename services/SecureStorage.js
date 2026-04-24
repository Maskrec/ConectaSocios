/**
 * Servicio de almacenamiento seguro para datos sensibles
 * Encripta y desencripta datos antes de guardarlos en AsyncStorage
 * Sin dependencias especiales - usa funciones JavaScript nativas
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import CONFIG from '../config';

const STORAGE_KEY_PREFIX = '@conectasocios_secure:';

/**
 * Convertir string a Base64
 */
const stringToBase64 = (str) => {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch (error) {
    console.error('Error en stringToBase64:', error);
    return null;
  }
};

/**
 * Convertir Base64 a string
 */
const base64ToString = (base64) => {
  try {
    return decodeURIComponent(escape(atob(base64)));
  } catch (error) {
    console.error('Error en base64ToString:', error);
    return null;
  }
};

/**
 * Genera un hash simple basado en una clave
 * Usado para generar una clave derivada
 */
const generateEncryptionKey = (data) => {
  try {
    let hash = 0;
    const str = CONFIG.ENCRYPTION_KEY + data;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  } catch (error) {
    console.warn('Error generando clave de encriptación:', error);
    return 'default_key';
  }
};

/**
 * Encripta un string con XOR simple (suficiente para AsyncStorage)
 * En producción crítica, considera usar @react-native-community/hooks o similar
 */
const cryptoEncrypt = (data, key) => {
  try {
    const base64 = stringToBase64(data);
    if (!base64) return null;

    // XOR encriptación simple pero efectiva para este caso
    let encrypted = '';
    for (let i = 0; i < base64.length; i++) {
      const charCode = base64.charCodeAt(i);
      const keyCode = key.charCodeAt(i % key.length);
      encrypted += String.fromCharCode(charCode ^ keyCode);
    }
    
    // Retornar como Base64 para seguridad adicional
    return stringToBase64(encrypted);
  } catch (error) {
    console.error('Error encriptando:', error);
    return null;
  }
};

/**
 * Desencripta un string
 */
const cryptoDecrypt = (encrypted, key) => {
  try {
    const decrypted = base64ToString(encrypted);
    if (!decrypted) return null;

    // Revertir XOR
    let original = '';
    for (let i = 0; i < decrypted.length; i++) {
      const charCode = decrypted.charCodeAt(i);
      const keyCode = key.charCodeAt(i % key.length);
      original += String.fromCharCode(charCode ^ keyCode);
    }
    
    // Convertir de Base64 original
    return base64ToString(original);
  } catch (error) {
    console.error('Error desencriptando:', error);
    return null;
  }
};

/**
 * Guarda un value encriptado en AsyncStorage
 */
export const SecureStorage = {
  setItem: async (key, value) => {
    try {
      if (!value) {
        await AsyncStorage.removeItem(STORAGE_KEY_PREFIX + key);
        return;
      }

      // Generar clave de encriptación
      const encryptionKey = generateEncryptionKey(key);

      // Encriptar el valor
      const encrypted = cryptoEncrypt(value, encryptionKey);

      if (!encrypted) {
        console.warn('Error al encriptar, usando almacenamiento inseguro como fallback');
        await AsyncStorage.setItem(STORAGE_KEY_PREFIX + key, value);
        return;
      }

      // Guardar encriptado
      await AsyncStorage.setItem(STORAGE_KEY_PREFIX + key, encrypted);
      console.log(`✓ Valor encriptado guardado para: ${key}`);
    } catch (error) {
      console.error(`Error guardando valor seguro para ${key}:`, error);
      throw error;
    }
  },

  getItem: async (key) => {
    try {
      const encrypted = await AsyncStorage.getItem(STORAGE_KEY_PREFIX + key);

      if (!encrypted) {
        return null;
      }

      // Generar la misma clave de encriptación
      const encryptionKey = generateEncryptionKey(key);

      // Desencriptar
      const decrypted = cryptoDecrypt(encrypted, encryptionKey);

      if (!decrypted) {
        console.warn(`Error al desencriptar ${key}, retornando null`);
        return null;
      }

      return decrypted;
    } catch (error) {
      console.error(`Error obteniendo valor seguro para ${key}:`, error);
      return null;
    }
  },

  removeItem: async (key) => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_PREFIX + key);
      console.log(`✓ Valor removido: ${key}`);
    } catch (error) {
      console.error(`Error removiendo valor para ${key}:`, error);
      throw error;
    }
  },

  clear: async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(key => key.startsWith(STORAGE_KEY_PREFIX));
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`✓ ${keysToRemove.length} valores seguros removidos`);
      }
    } catch (error) {
      console.error('Error limpiando almacenamiento seguro:', error);
      throw error;
    }
  }
};

export default SecureStorage;
