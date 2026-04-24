import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Alert,
  StatusBar, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, Modal, Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native'; 

const WHATSAPP_NUMBER = '524463168380'; // Número de WhatsApp del soporte (con código de país)

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showInactiveModal, setShowInactiveModal] = useState(false);
  const navigation = useNavigation();

  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert("Atención", "Ingresa tus credenciales.");
    }
    setIsLoading(true);
    const result = await login(email, password);
    setIsLoading(false);

    if (result && result.error === 'account_inactive') {
      setShowInactiveModal(true);
    }
  };

  const contactOffice = () => {
    const message = `Hola, mi cuenta (${email}) aparece como inactiva. Solicito revisión para poder ingresar a la plataforma.`;
    const url = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "WhatsApp no está instalado en este dispositivo.");
    });
  };

  return (
    <LinearGradient colors={['#FF6B6B', '#FF8E53']} style={styles.gradient}>
      <StatusBar barStyle="light-content" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header de bienvenida */}
          <View style={styles.headerContainer}>
            <Text style={styles.welcomeTitle}>Bienvenido</Text>
            <Text style={styles.welcomeSubtitle}>Inicia sesión para continuar</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tabContainer}>
              <View style={styles.tabItem}>
                <Text style={[styles.tab, styles.tabActive]}>Login</Text>
              </View>
              <TouchableOpacity
                style={styles.tabItem}
                onPress={() => navigation.navigate('RegisterPartner')}
              >
                <Text style={styles.tab}>Sign up</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#999" style={styles.icon} />
              <TextInput
                placeholder="Usuario o Email"
                placeholderTextColor="#999"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.icon} />
              <TextInput
                placeholder="Contraseña"
                placeholderTextColor="#999"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && { opacity: 0.8 }]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="white" />
                : <Ionicons name="arrow-forward" size={28} color="white" />
              }
            </TouchableOpacity>

            <Text style={styles.legalText}>
              Al presionar "Entrar" aceptas nuestros{"\n"}
              <Text style={styles.linkText}>términos y condiciones</Text>.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL DE CUENTA INACTIVA */}
      <Modal visible={showInactiveModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.iconCircle}>
              <Ionicons name="time" size={42} color="#FF6B6B" />
            </View>

            <Text style={styles.modalTitle}>Verificación en Proceso</Text>

            <View style={styles.infoBox}>
              <Text style={styles.modalText}>
                Tu cuenta está siendo revisada por nuestro equipo de seguridad.
                Este proceso suele tardar menos de 24 horas.
              </Text>
            </View>

            <Text style={styles.helpText}>¿Necesitas agilizar tu activación?</Text>

            <TouchableOpacity
              style={styles.whatsappButton}
              onPress={contactOffice}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-whatsapp" size={26} color="white" style={{ marginRight: 12 }} />
              <Text style={styles.whatsappButtonText}>Contactar con Soporte</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowInactiveModal(false)}
            >
              <Text style={styles.closeModalText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 25,
    paddingVertical: 40
  },
  headerContainer: {
    width: '100%',
    marginBottom: 20,
  },
  welcomeTitle: { fontSize: 38, fontWeight: 'bold', color: 'white' },
  welcomeSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.8)', marginTop: 5 },
  card: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 25,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  tabContainer: { flexDirection: 'row', marginBottom: 25, width: '100%' },
  tabItem: { flex: 1, alignItems: 'center' },
  tab: { fontSize: 18, color: '#999' },
  tabActive: {
    fontWeight: 'bold',
    color: '#333',
    borderBottomWidth: 3,
    borderColor: '#FF6B6B',
    paddingBottom: 5
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 55,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15
  },
  icon: { marginRight: 10 },
  input: { flex: 1, height: '100%', fontSize: 16, color: '#333' },
  loginButton: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    elevation: 4,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5
  },
  legalText: { fontSize: 12, color: '#999', textAlign: 'center', marginTop: 25, lineHeight: 18 },
  linkText: { color: '#FF6B6B', fontWeight: 'bold' },

  // Estilos del Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 35,
    padding: 30,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 10
  },
  iconCircle: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
    backgroundColor: '#FFF0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10
  },
  infoBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    padding: 20,
    marginBottom: 20,
    width: '100%'
  },
  modalText: {
    textAlign: 'center',
    color: '#555',
    fontSize: 15,
    lineHeight: 22
  },
  helpText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 15
  },
  whatsappButton: {
    flexDirection: 'row',
    backgroundColor: '#25D366',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
    elevation: 3
  },
  whatsappButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 17
  },
  closeModalButton: {
    marginTop: 20,
    padding: 10
  },
  closeModalText: {
    color: '#999',
    fontWeight: '700',
    fontSize: 15
  }
});

export default LoginPage;