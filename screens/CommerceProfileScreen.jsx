import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Button,
  Modal,
  FlatList,
  Linking,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import Alert from '../components/AlertPolyfill';

// --- PALETA COMERCIO (Ocean Teal) ---
const THEME_COLOR = '#1ABC9C';
const THEME_LIGHT = '#E8F8F5';
const THEME_BORDER = '#A3E4D7';
const DANGER_COLOR = '#E74C3C';

// --- TU NÚMERO DE WHATSAPP ---
const WHATSAPP_NUMBER = '524463168380';

const CommerceProfileScreen = () => {
  const { user, logout, setUser } = useAuth();
  const navigation = useNavigation();

  const [commerceData, setCommerceData] = useState({ name: '', address: '', logo: null, category: null });
  const [loading, setLoading] = useState(false);

  // Estados Categorías
  const [categories, setCategories] = useState([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  // Carga inicial
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [commerceRes, categoryRes] = await Promise.all([
          apiClient.get('/mi-comercio/'),
          apiClient.get('/categorias/')
        ]);

        setCommerceData({
          name: commerceRes.data.name,
          address: commerceRes.data.address,
          logo: commerceRes.data.logo,
          category: commerceRes.data.category
        });

        // Extraer datos si viene paginado (como objeto con .results) o si es un arreglo directo
        const catData = Array.isArray(categoryRes.data) ? categoryRes.data : (categoryRes.data.results || []);
        setCategories(catData);

      } catch (error) {
        console.error(error);
      }
    };
    fetchData();
  }, []);

  // --- LÓGICA CATEGORÍA (Intacta) ---
  const handleChangeCategory = (newCategory) => {
    setShowCategoryModal(false);
    if (newCategory.id === commerceData.category) return;

    Alert.alert(
      "Cambio de Categoría",
      `Al cambiar a "${newCategory.name}", tu comercio pasará a estado INACTIVO hasta validación.\n\nSe abrirá WhatsApp para notificar.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, Cambiar",
          onPress: () => processCategoryChange(newCategory)
        }
      ]
    );
  };

  const processCategoryChange = async (newCategory) => {
    setLoading(true);
    try {
      await apiClient.patch('/mi-comercio/', { category: newCategory.id });
      setCommerceData(prev => ({ ...prev, category: newCategory.id }));

      const message = `Hola, soy el comercio "${commerceData.name}" (Usuario: ${user.username}).\n\nSolicito cambio de categoría a: ${newCategory.name}.`;
      const url = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(message)}`;
      Linking.openURL(url);

      Alert.alert("Solicitud Enviada", "Tu comercio está pendiente de revisión.");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo actualizar la categoría.");
    } finally {
      setLoading(false);
    }
  };

  // --- IMÁGENES ---
  const pickImage = async (type) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permiso denegado", "Se requiere acceso a la galería.");

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5,
    });

    if (!result.canceled) {
      if (type === 'user') uploadUserImage(result.assets[0].uri);
      else uploadCommerceLogo(result.assets[0].uri);
    }
  };

  const uploadUserImage = async (uri) => {
      const formData = new FormData();
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;
      formData.append('profile_image', { uri, name: filename, type });
      try {
        const response = await apiClient.patch('/perfil/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setUser(response.data); // Actualizar contexto
        Alert.alert("Éxito", "Foto de perfil actualizada.");
      } catch (error) { Alert.alert("Error", "Fallo al subir imagen."); }
  };

  const uploadCommerceLogo = async (uri) => {
      const formData = new FormData();
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;
      formData.append('logo', { uri, name: filename, type });
      try {
        const response = await apiClient.patch('/mi-comercio/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setCommerceData(prev => ({ ...prev, logo: response.data.logo }));
        Alert.alert("Éxito", "Logo del negocio actualizado.");
      } catch (error) { Alert.alert("Error", "Fallo al subir logo."); }
  };

  const handleSaveInfo = async () => {
      setLoading(true);
      try {
        await apiClient.patch('/mi-comercio/', { name: commerceData.name, address: commerceData.address });
        Alert.alert("Éxito", "Información guardada correctamente.");
      } catch (error) { Alert.alert("Error", "No se pudo guardar."); }
      finally { setLoading(false); }
  };

  const getCurrentCategoryName = () => {
      // Validación de seguridad extra por si las categorías aún no cargan
      if (!Array.isArray(categories)) return "Seleccionar Categoría";
      const cat = categories.find(c => c.id === commerceData.category);
      return cat ? cat.name : "Seleccionar Categoría";
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor={THEME_COLOR} />

      {/* HEADER */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <Text style={styles.headerSubtitle}>Datos del Socio y comercio</Text>
      </View>

      {/* TARJETA BLANCA */}
      <View style={styles.whiteCard}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* 1. SECCIÓN USUARIO (Avatar) */}
          <View style={styles.userSection}>
            <TouchableOpacity onPress={() => pickImage('user')} style={styles.avatarContainer}>
              <Image source={{ uri: user?.profile_image || 'https://via.placeholder.com/100' }} style={styles.avatar} />
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={{flex: 1}}>
                <Text style={styles.userName}>{user?.first_name} {user?.last_name}</Text>
                <Text style={styles.userEmail}>Usuario: {user?.username}</Text>
                <Text style={styles.userRole}>Socio Comercial</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* 2. SECCIÓN COMERCIO (Logo) */}
          <Text style={styles.sectionTitle}>Datos del Negocio</Text>

          <TouchableOpacity onPress={() => pickImage('commerce')} style={styles.logoWrapper}>
            {commerceData.logo ? (
                <Image source={{ uri: commerceData.logo }} style={styles.logoImage} />
            ) : (
                <View style={styles.logoPlaceholder}>
                    <Ionicons name="storefront-outline" size={40} color="#ccc" />
                    <Text style={{color:'#999', marginTop: 5}}>Subir Logo del Negocio</Text>
                </View>
            )}
            <View style={styles.editIconOverlay}>
                <Ionicons name="pencil" size={16} color="#fff" />
            </View>
          </TouchableOpacity>

          {/* Inputs */}
          <Text style={styles.label}>Nombre del Comercio</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="briefcase-outline" size={20} color="#666" style={{marginRight: 10}} />
            <TextInput
              style={styles.input}
              value={commerceData.name}
              onChangeText={t => setCommerceData({...commerceData, name: t})}
            />
          </View>

          <Text style={styles.label}>Dirección (Texto)</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="location-outline" size={20} color="#666" style={{marginRight: 10}} />
            <TextInput
              style={styles.input}
              value={commerceData.address}
              onChangeText={t => setCommerceData({...commerceData, address: t})}
            />
          </View>

          {/* Selector Categoría */}
          <Text style={styles.label}>Categoría / Giro</Text>
          <TouchableOpacity style={styles.selectorButton} onPress={() => setShowCategoryModal(true)}>
             <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <Ionicons name="grid-outline" size={20} color={THEME_COLOR} style={{marginRight: 10}} />
                <Text style={styles.selectorText}>{getCurrentCategoryName()}</Text>
             </View>
             <Ionicons name="chevron-down" size={20} color="#999" />
          </TouchableOpacity>

          {/* Botón Mapa */}
          <TouchableOpacity style={styles.mapButton} onPress={() => navigation.navigate('SetCommerceLocation')}>
              <Ionicons name="map" size={20} color="#fff" />
              <Text style={styles.mapButtonText}>Ajustar Ubicación en Mapa</Text>
          </TouchableOpacity>

          {/* Botón Guardar */}
          <TouchableOpacity
            style={[styles.saveButton, loading && {backgroundColor: '#ccc'}]}
            onPress={handleSaveInfo}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.saveButtonText}>Guardar Cambios</Text>
            )}
          </TouchableOpacity>

          {/* Botón Cerrar Sesión */}
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color={DANGER_COLOR} style={{marginRight: 5}} />
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </TouchableOpacity>

          <View style={{height: 30}}/>

        </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* --- MODAL CATEGORÍA --- */}
      <Modal visible={showCategoryModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Seleccionar Categoría</Text>
                <FlatList
                    data={categories}
                    keyExtractor={item => item.id.toString()}
                    renderItem={({item}) => (
                        <TouchableOpacity style={styles.categoryItem} onPress={() => handleChangeCategory(item)}>
                            <View style={[styles.catIconBox, {backgroundColor: THEME_LIGHT}]}>
                                <Ionicons name={item.icon_name || 'apps'} size={20} color={THEME_COLOR} />
                            </View>
                            <Text style={styles.categoryText}>{item.name}</Text>
                            {item.id === commerceData.category && <Ionicons name="checkmark" size={20} color={THEME_COLOR}/>}
                        </TouchableOpacity>
                    )}
                />
                <TouchableOpacity style={styles.closeModalButton} onPress={() => setShowCategoryModal(false)}>
                    <Text style={styles.closeModalText}>Cancelar</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: THEME_COLOR },
  headerContainer: { paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 60, paddingBottom: 25 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 5 },

  whiteCard: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  scrollContent: { padding: 25 },

  // User Section
  userSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  avatarContainer: { position: 'relative', marginRight: 15 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#f0f0f0' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0, backgroundColor: THEME_COLOR,
    width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff'
  },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  userEmail: { fontSize: 14, color: '#666' },
  userRole: { fontSize: 12, color: THEME_COLOR, fontWeight: 'bold', marginTop: 2 },

  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },

  // Logo
  logoWrapper: { height: 140, borderRadius: 15, marginBottom: 20, overflow: 'hidden', backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee', borderStyle: 'dashed' },
  logoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  logoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  editIconOverlay: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 6, borderRadius: 20 },

  // Inputs
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8, marginTop: 5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 15, height: 50, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  input: { flex: 1, fontSize: 16, color: '#333' },

  // Selector
  selectorButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 15, height: 50, marginBottom: 15, borderWidth: 1, borderColor: '#ccc' },
  selectorText: { fontSize: 16, color: '#333' },

  // Botones
  mapButton: { flexDirection: 'row', backgroundColor: '#34495E', borderRadius: 12, height: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20, marginTop: 10 },
  mapButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },

  saveButton: { backgroundColor: THEME_COLOR, borderRadius: 12, height: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 30, shadowColor: THEME_COLOR, shadowOffset: {width:0, height:4}, shadowOpacity:0.3, elevation: 4 },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },

  logoutButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15 },
  logoutText: { color: DANGER_COLOR, fontWeight: 'bold', fontSize: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 20, padding: 20, width: '100%', maxHeight: '70%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  categoryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  catIconBox: { padding: 8, borderRadius: 8, marginRight: 15 },
  categoryText: { fontSize: 16, color: '#333', flex: 1 },
  closeModalButton: { marginTop: 15, alignItems: 'center', padding: 10 },
  closeModalText: { color: DANGER_COLOR, fontSize: 16, fontWeight: 'bold' }
});

export default CommerceProfileScreen;