import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Modal, Linking, FlatList,
  KeyboardAvoidingView, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import Alert from '../components/AlertPolyfill';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const WHATSAPP_NUMBER = '524463168380'; // Número de WhatsApp del administrador (con código de país)

const RegisterPartnerScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [role, setRole] = useState('courier');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formData, setFormData] = useState({
    username: '', password: '', first_name: '', last_name: '', phone_number: '',
    car_brand: '', car_model: '', license_plate: '', is_taxi_driver: false
  });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        console.log('Cargando categorías desde:', `${API_URL}/api/categorias/`);
        const response = await axios.get(`${API_URL}/api/categorias/`);
        console.log('Categorías cargadas:', response.data);
        
        const catData = Array.isArray(response.data) ? response.data : (response.data.results || []);
        setCategories(catData);
      } catch (error) {
        console.error("Error cargando categorías", error);
        console.error("Error response:", error.response?.data);
        console.error("Error status:", error.response?.status);
        // No mostrar alert, solo loggear para no molestar al usuario
      }
    };
    fetchCategories();
  }, []);

  const handleChange = (name, value) => setFormData({ ...formData, [name]: value });

  const handleRegister = async () => {
    console.log('=== INICIANDO REGISTRO ===');
    console.log('API_URL:', API_URL);
    console.log('Role:', role);
    console.log('FormData:', formData);
    
    if (!formData.username || !formData.password || !formData.first_name || !confirmPassword) {
        console.log('Campos incompletos:', { 
          username: formData.username, 
          password: formData.password, 
          first_name: formData.first_name, 
          confirmPassword 
        });
        return Alert.alert("Campos incompletos", "Por favor completa todos los campos obligatorios.");
    }
    if (!acceptedTerms) {
        return Alert.alert("Términos y Condiciones", "Debes aceptar los términos y condiciones para continuar.");
    }
    if (role === 'owner' && !selectedCategory) {
        return Alert.alert("Falta Categoría", "Por favor selecciona el giro de tu comercio.");
    }
    if (formData.password !== confirmPassword) {
      return Alert.alert("Error", "Las contraseñas no coinciden.");
    }

    if (!API_URL) {
      return Alert.alert("Error", "No se pudo cargar la configuración de la app. Reinicia e intenta nuevamente.");
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        role: role,
        category_id: role === 'owner' ? selectedCategory?.id : null
      };
      console.log('Enviando payload:', payload);
      console.log('URL solicitada:', `${API_URL}/api/registro-socio/`);
      
      const response = await axios.post(`${API_URL}/api/registro-socio/`, payload);
      console.log('Respuesta exitosa:', response.data);
      setShowVerificationModal(true);
    } catch (error) {
      console.error('Error en registro:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      const errorMsg = error.response?.data?.username ? "Este usuario ya existe." : error.message || "Error al crear la cuenta.";
      Alert.alert("Error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = () => {
    let customMessage = "";
    if (role === 'courier') {
      customMessage = `Hola, solicito activación de Repartidor.\nUsuario: ${formData.username}\nAdjunto: Foto fondo blanco, Licencia Tipo C y foto de mi moto.`;
    } else if (role === 'driver') {
      customMessage = `Hola, solicito activación como Conductor${formData.is_taxi_driver ? ' Oficial' : ''}.\nUsuario: ${formData.username}\nVehículo: ${formData.car_brand} ${formData.car_model}\nPlaca: ${formData.license_plate}`;
    } else {
      customMessage = `Hola, solicito activación de mi Comercio: ${selectedCategory?.name || ''}.\nUsuario: ${formData.username}\nSolicito información para activar mi cuenta.`;
    }
    const url = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(customMessage)}`;
    Linking.openURL(url).catch(() => Alert.alert("Error", "Asegúrate de tener WhatsApp instalado."));
  };

  const closeAndGoToLogin = () => { setShowVerificationModal(false); navigation.navigate('Login'); };

  return (
    <LinearGradient colors={['#FF6B6B', '#FF8E53']} style={styles.gradient}>
      {/* DETALLE 1: KeyboardAvoidingView para que el teclado no tape los campos */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.title}>Crear Cuenta</Text>
            <Text style={styles.subtitle}>Únete como socio</Text>

            <View style={styles.roleContainer}>
              <TouchableOpacity style={[styles.roleButton, role === 'courier' && styles.roleActive]} onPress={() => setRole('courier')}>
                  <Ionicons name="bicycle" size={24} color={role === 'courier' ? 'white' : 'gray'} />
                  <Text style={[styles.roleText, role === 'courier' && styles.roleTextActive]}>Repartidor</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.roleButton, role === 'owner' && styles.roleActive]} onPress={() => setRole('owner')}>
                  <Ionicons name="storefront" size={24} color={role === 'owner' ? 'white' : 'gray'} />
                  <Text style={[styles.roleText, role === 'owner' && styles.roleTextActive]}>Comercio</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.roleButton, role === 'driver' && styles.roleActive]} onPress={() => setRole('driver')}>
                  <Ionicons name="car" size={24} color={role === 'driver' ? 'white' : 'gray'} />
                  <Text style={[styles.roleText, role === 'driver' && styles.roleTextActive]}>Conductor</Text>
              </TouchableOpacity>
            </View>

            {role === 'owner' && (
              <TouchableOpacity style={styles.categorySelector} onPress={() => setShowCategoryModal(true)}>
                  <Ionicons name={selectedCategory ? selectedCategory.icon_name : "grid-outline"} size={20} color="gray" style={styles.icon} />
                  <Text style={[styles.input, {textAlignVertical: 'center', color: selectedCategory ? 'black' : '#999'}]}>
                      {selectedCategory ? selectedCategory.name : "Selecciona el Giro del Negocio"}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="gray" />
              </TouchableOpacity>
            )}

            {role === 'driver' && (
              <>
                <View style={styles.sectionLabel}>
                  <Text style={{fontSize: 12, color: '#666', marginBottom: 10}}>Información del Vehículo</Text>
                </View>
                <View style={styles.row}>
                  <View style={[styles.inputContainer, {flex: 1, marginRight: 5}]}>
                    <TextInput placeholder="Marca" style={styles.input} onChangeText={(t) => handleChange('car_brand', t)} />
                  </View>
                  <View style={[styles.inputContainer, {flex: 1, marginLeft: 5}]}>
                    <TextInput placeholder="Modelo" style={styles.input} onChangeText={(t) => handleChange('car_model', t)} />
                  </View>
                </View>
                <View style={styles.inputContainer}>
                  <Ionicons name="document-outline" size={20} color="gray" style={styles.icon} />
                  <TextInput placeholder="Placa (ej: ABC-123)" style={styles.input} onChangeText={(t) => handleChange('license_plate', t)} />
                </View>
                <View style={styles.checkboxContainer}>
                  <TouchableOpacity 
                    style={[styles.checkbox, formData.is_taxi_driver && styles.checkboxChecked]}
                    onPress={() => handleChange('is_taxi_driver', !formData.is_taxi_driver)}
                  >
                    {formData.is_taxi_driver && <Ionicons name="checkmark" size={16} color="white" />}
                  </TouchableOpacity>
                  <Text style={{marginLeft: 10, color: '#333'}}>Soy Taxista Oficial</Text>
                </View>
              </>
            )}

            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="gray" style={styles.icon} />
              <TextInput placeholder="Nombre de Usuario" style={styles.input} autoCapitalize="none" onChangeText={(t) => handleChange('username', t)} />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="gray" style={styles.icon} />
              <TextInput placeholder="Contraseña" style={styles.input} secureTextEntry onChangeText={(t) => handleChange('password', t)} />
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="gray" style={styles.icon} />
              <TextInput placeholder="Confirmar Contraseña" style={styles.input} secureTextEntry onChangeText={setConfirmPassword} />
            </View>
            <View style={styles.row}>
              <View style={[styles.inputContainer, {flex: 1, marginRight: 5}]}>
                  <TextInput placeholder="Nombre" style={styles.input} onChangeText={(t) => handleChange('first_name', t)} />
              </View>
              <View style={[styles.inputContainer, {flex: 1, marginLeft: 5}]}>
                  <TextInput placeholder="Apellido" style={styles.input} onChangeText={(t) => handleChange('last_name', t)} />
              </View>
            </View>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="gray" style={styles.icon} />
              <TextInput placeholder="Teléfono" style={styles.input} keyboardType="phone-pad" onChangeText={(t) => handleChange('phone_number', t)} />
            </View>

            {/* Checkbox de Términos y Condiciones */}
            <View style={styles.termsContainer}>
              <TouchableOpacity
                style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}
                onPress={() => setAcceptedTerms(!acceptedTerms)}
              >
                {acceptedTerms && <Ionicons name="checkmark" size={16} color="white" />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation.navigate('Terms')} style={{flex: 1}}>
                <Text style={styles.termsText}>
                  He leído y acepto los <Text style={{fontWeight: 'bold', textDecorationLine: 'underline'}}>términos y condiciones</Text>.
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text style={styles.registerButtonText}>CONTINUAR</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{marginTop: 20}}>
              <Text style={styles.linkText}>¿Ya tienes cuenta? Inicia Sesión</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL CATEGORÍAS */}
      <Modal visible={showCategoryModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContentList}>
                <Text style={styles.modalTitle}>Selecciona una Categoría</Text>
                <FlatList
                    data={categories}
                    keyExtractor={item => item.id.toString()}
                    renderItem={({item}) => (
                        <TouchableOpacity style={styles.categoryItem} onPress={() => { setSelectedCategory(item); setShowCategoryModal(false); }}>
                            <Ionicons name={item.icon_name} size={24} color="#FF6B6B" style={{marginRight: 15}} />
                            <Text style={styles.categoryText}>{item.name}</Text>
                        </TouchableOpacity>
                    )}
                />
                <TouchableOpacity style={styles.closeButton} onPress={() => setShowCategoryModal(false)}>
                    <Text style={{color:'red', fontWeight: 'bold'}}>Cancelar</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

      {/* DETALLE 2: MODAL DE VERIFICACIÓN DINÁMICO */}
      <Modal visible={showVerificationModal} transparent={true} animationType="slide">
         <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="shield-checkmark" size={60} color="#FF6B6B" style={{marginBottom: 10}} />
            <Text style={styles.modalTitle}>¡Cuenta Creada!</Text>

            <View style={styles.infoBox}>
              {role === 'courier' ? (
                <Text style={styles.modalText}>
                  Para activarte como repartidor envía por WhatsApp:{"\n\n"}
                  • Foto de tu rostro (fondo blanco, de frente, sin gorra/lentes){"\n"}
                  • Licencia de manejo Tipo C{"\n"}
                  • Foto de tu motocicleta{"\n"}
                  • Si no se cumple con los requisitos la cuenta no sera activada
                </Text>
              ) : role === 'driver' ? (
                <Text style={styles.modalText}>
                  Para activarte como conductor envía por WhatsApp:{"\n\n"}
                  • Foto de tu rostro (fondo blanco, de frente){"\n"}
                  • Licencia de conducción válida{"\n"}
                  • Foto del vehículo (frente y costados){"\n"}
                  • Documentación del vehículo{"\n"}
                  • Tu información será verificada por nuestro equipo
                </Text>
              ) : (
                <Text style={styles.modalText}>
                  Para activar tu comercio, envía un mensaje al administrador para validar tu giro y ubicación.
                </Text>
              )}
            </View>

            <TouchableOpacity style={styles.whatsappButton} onPress={openWhatsApp}>
              <Ionicons name="logo-whatsapp" size={24} color="white" style={{marginRight: 10}} />
              <Text style={styles.whatsappButtonText}>Contactar Administrador</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={closeAndGoToLogin} style={{marginTop: 15}}>
              <Text style={{color: 'gray'}}>Ir al inicio de sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20, paddingTop: 50 },
  card: { backgroundColor: 'white', borderRadius: 20, padding: 25, elevation: 5 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', color: '#333' },
  subtitle: { fontSize: 16, color: 'gray', textAlign: 'center', marginBottom: 20 },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  roleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#eee', marginHorizontal: 5 },
  roleActive: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
  roleText: { marginLeft: 8, color: 'gray', fontWeight: 'bold' },
  roleTextActive: { color: 'white' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', height: 50, backgroundColor: '#f0f0f0', borderRadius: 10, paddingHorizontal: 15, marginBottom: 15 },
  row: { flexDirection: 'row', marginBottom: 15 },
  icon: { marginRight: 10 },
  input: { flex: 1, height: '100%', fontSize: 16, color: '#333' },
  registerButton: { backgroundColor: '#FF6B6B', borderRadius: 10, paddingVertical: 15, alignItems: 'center', marginTop: 10 },
  registerButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  linkText: { color: '#FF6B6B', textAlign: 'center', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 25, padding: 25, alignItems: 'center', width: '100%' },
  modalTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, color: '#333' },
  infoBox: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 15, marginBottom: 20, width: '100%' },
  modalText: { textAlign: 'left', color: '#444', fontSize: 15, lineHeight: 22 },
  whatsappButton: { flexDirection: 'row', backgroundColor: '#25D366', paddingVertical: 15, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', width: '100%', justifyContent: 'center' },
  whatsappButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  categorySelector: { flexDirection: 'row', alignItems: 'center', height: 50, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: '#FF6B6B' },
  modalContentList: { backgroundColor: 'white', borderRadius: 20, padding: 20, width: '90%', maxHeight: '70%' },
  categoryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  categoryText: { fontSize: 16, color: '#333' },
  closeButton: { marginTop: 15, alignItems: 'center', padding: 10 },
  sectionLabel: { paddingHorizontal: 0, marginBottom: 10, marginTop: 10 },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 15 },
  termsContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingHorizontal: 5 },
  termsText: { fontSize: 13, color: '#666', marginLeft: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#FF6B6B', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#FF6B6B' }
});

export default RegisterPartnerScreen;