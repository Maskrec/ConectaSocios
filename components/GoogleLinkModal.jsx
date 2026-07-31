import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { signInWithGoogleFirebase } from '../services/FirebaseAuthService';

const GoogleLinkModal = () => {
  const { user, linkGoogleAccount } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Si no hay usuario logueado, ya está vinculado a Google o fue descartado en esta sesión, no mostrar
  if (!user || user.is_google_linked || dismissed) {
    return null;
  }

  const handleLinkGoogle = async () => {
    setLoading(true);
    try {
      const authRes = await signInWithGoogleFirebase();
      if (authRes?.pendingRedirect) {
        return;
      }
      if (authRes.success) {
        const linkRes = await linkGoogleAccount(authRes.idToken);
        if (linkRes.success) {
          Alert.alert("¡Éxito!", "Tu cuenta de socio ha sido vinculada correctamente con Google.");
        } else {
          Alert.alert("Atención", linkRes.error || "No se pudo vincular la cuenta.");
        }
      } else {
        Alert.alert("Atención", authRes.error || "Inicio de sesión con Google cancelado.");
      }
    } catch (e) {
      console.error("Error en vinculación Google:", e);
      Alert.alert("Error", "Ocurrió un error inesperado al vincular tu cuenta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={true} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.iconCircle}>
            <Ionicons name="logo-google" size={36} color="#EA4335" />
          </View>

          <Text style={styles.title}>¡Vincular con Google!</Text>
          <Text style={styles.description}>
            Hola <Text style={styles.boldText}>{user.first_name || user.username}</Text>, vincula tu cuenta de socio con Google para ingresar en un solo clic y proteger tu acceso.
          </Text>

          <TouchableOpacity 
            style={styles.googleButton} 
            onPress={handleLinkGoogle}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#333" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#EA4335" style={{ marginRight: 8 }} />
                <Text style={styles.googleButtonText}>Vincular mi cuenta con Google</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.dismissButton} 
            onPress={() => setDismissed(true)}
            disabled={loading}
          >
            <Text style={styles.dismissText}>Recordármelo más tarde</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FCE8E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#202124',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#5F6368',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#202124',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DADCE0',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    width: '100%',
    marginBottom: 12,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3C4043',
  },
  dismissButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  dismissText: {
    fontSize: 14,
    color: '#70757A',
    fontWeight: '500',
  },
});

export default GoogleLinkModal;
