import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Switch,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Alert from '../components/AlertPolyfill';

// --- PALETA REPARTIDOR (Indigo) ---
const THEME_COLOR = '#5D5FEF';
const THEME_LIGHT = '#EFEFFD';
const SUCCESS_COLOR = '#2ECC71';
const DANGER_COLOR = '#E74C3C';

const ProfileScreen = () => {
  const { user, logout, setUser } = useAuth();
  const [isActivo, setIsActivo] = useState(true);
  const [uploading, setUploading] = useState(false);
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  // Estados para datos adicionales
  // const [history, setHistory] = useState([]); // No se usa en esta pantalla simplificada
  // const [loadingHistory, setLoadingHistory] = useState(true); // No se usa

  // Estados para Modales
  const [showEarningsModal, setShowEarningsModal] = useState(false); // Desglose Ganancias

  // Estados Formulario Liquidación
  const [clearingDebt, setClearingDebt] = useState(false);
  const [debtConfirmation, setDebtConfirmation] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');


  // --- CARGA DE DATOS ---
  const fetchProfileData = async () => {
    try {
      // 1. Perfil (Ganancias, Deuda, Datos)
      // Ajusta la ruta si en tu backend es diferente, ej: '/perfil/' o '/auth/perfil/'
      const resProfile = await apiClient.get('/auth/perfil/');
      setUser(resProfile.data);

      // El historial se carga en otra pantalla, no es necesario aquí
    } catch (error) {
      console.error("Error al refrescar perfil:", error);
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProfileData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfileData();
  };

  // --- LÓGICA DE FOTOS ---
  const handleChangePhoto = async () => { pickImage(); };
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5,
    });
    if (!result.canceled) uploadImage(result.assets[0].uri);
  };
  const uploadImage = async (uri) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('profile_image', { uri: uri, name: 'profile.jpg', type: 'image/jpeg' });
    try {
      const response = await apiClient.patch('/auth/perfil/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUser(response.data);
      Alert.alert("Éxito", "Foto actualizada.");
    } catch (error) { Alert.alert("Error", "No se pudo subir."); } finally { setUploading(false); }
  };

  // --- LÓGICA LIQUIDAR DEUDA ---
  const handleOpenClearDebt = () => {
    if (!user.amount_to_deliver || parseFloat(user.amount_to_deliver) <= 0) {
        Alert.alert("Todo en orden", "No tienes deuda pendiente con la oficina.");
        return;
    }
    setAdminUsername('');
    setAdminPassword('');
    setDebtConfirmation(true);
  };

  const submitClearDebt = async () => {
    if (!adminUsername || !adminPassword) {
        Alert.alert("Error", "El administrador debe ingresar sus credenciales.");
        return;
    }
    setClearingDebt(true);
    try {
        const response = await apiClient.post('/liquidar-deuda/', {
            admin_username: adminUsername,
            admin_password: adminPassword
        });
        Alert.alert("¡Corte de Caja Exitoso!", response.data.message || "Tu deuda ha sido liquidada.");
        setDebtConfirmation(false);
        fetchProfileData();
    } catch (error) {
        const errorMsg = error.response?.data?.detail || error.response?.data?.message || "No se pudo procesar tu liquidación. Intenta más tarde.";
        Alert.alert("Error", errorMsg);
    } finally {
        setClearingDebt(false);
    }
  };

  // Cambiar vehículo
  const toggleVehicle = async () => {
      // Si es moto pasa a bici, si es bici pasa a moto. (Automóvil queda excluido)
      const newType = user.vehicle_type === 'moto' ? 'bike' : 'moto';
      try {
          setUser({...user, vehicle_type: newType});
          await apiClient.patch('/auth/perfil/', { vehicle_type: newType });
      }
      catch (error) { console.error(error); }
    };

  if (!user) return <View style={styles.loader}><ActivityIndicator size="large" color={THEME_COLOR} /></View>;

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor={THEME_COLOR} />

      {/* HEADER + AVATAR */}
      <View style={styles.headerBackground}>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
      </View>

      <View style={styles.profileCard}>
         <TouchableOpacity onPress={handleChangePhoto} disabled={uploading} style={styles.avatarContainer}>
            {uploading ? <ActivityIndicator size="large" color={THEME_COLOR} /> : (
              <>
                <Image source={{ uri: user.profile_image || 'https://via.placeholder.com/150' }} style={styles.profileImage} />
                <View style={styles.cameraBadge}><Ionicons name="camera" size={16} color="#fff" /></View>
              </>
            )}
         </TouchableOpacity>
         <Text style={styles.profileName}>{user.first_name} {user.last_name}</Text>
         <Text style={styles.profileRole}>Socio Repartidor</Text>
         <Text style={styles.profileSubText}>@{user.username}</Text>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME_COLOR}/>}
      >

        {/* --- 1. ESTADO --- */}
        <View style={styles.sectionCard}>
            <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Estado: {isActivo ? '🟢 Activo' : '⚫ Inactivo'}</Text>
                <Switch trackColor={{ false: "#ccc", true: THEME_COLOR }} thumbColor={"#fff"} onValueChange={() => setIsActivo(!isActivo)} value={isActivo} />
            </View>
        </View>

        {/* --- 2. FINANZAS --- */}
        <Text style={styles.sectionHeader}>Finanzas</Text>

        {/* Ganancias Semanales (CLICKABLE) */}
        <TouchableOpacity onPress={() => setShowEarningsModal(true)}>
            <View style={[styles.walletCardFull, {backgroundColor: '#EAFAF1', borderColor: '#D5F5E3'}]}>
                <View style={styles.rowBetween}>
                    <View>
                        <Text style={styles.walletLabel}>Ganancias Semana</Text>
                        <Text style={[styles.walletValue, {color: SUCCESS_COLOR}]}>
                            ${user.earnings_weekly || '0.00'}
                        </Text>
                        <Text style={styles.walletHint}>Toca para ver desglose</Text>
                    </View>
                    <Ionicons name="stats-chart" size={30} color={SUCCESS_COLOR} />
                </View>
            </View>
        </TouchableOpacity>

        {/* Deuda con Oficina */}
        <View style={[
            styles.walletCardFull,
            {
              backgroundColor: (user.amount_to_deliver >= 400) ? '#FDEDEC' : '#F8F9FA',
              borderColor: (user.amount_to_deliver >= 400) ? '#F5B7B1' : '#EEE',
              marginTop: 10
            }
        ]}>
            <View style={styles.rowBetween}>
                <View style={{flex: 1}}>
                    <Text style={styles.walletLabel}>Deuda a Oficina (Comisiones)</Text>
                    <Text style={[
                        styles.walletValue,
                        {color: (user.amount_to_deliver >= 400) ? DANGER_COLOR : '#333'}
                    ]}>
                        ${user.amount_to_deliver || '0.00'}
                    </Text>
                    {user.amount_to_deliver >= 400 && (
                        <Text style={{color: DANGER_COLOR, fontSize: 10, fontWeight: 'bold'}}>
                            ⚠️ LÍMITE ALCANZADO. LIQUIDA PARA SEGUIR RECIBIENDO PEDIDOS.
                        </Text>
                    )}
                    <Text style={styles.walletSub}>Comisión acumulada por servicio</Text>
                </View>
                <TouchableOpacity style={styles.payButton} onPress={handleOpenClearDebt} disabled={clearingDebt}>
                    <Text style={styles.payButtonText}>{clearingDebt ? 'PROCESANDO...' : 'LIQUIDAR'}</Text>
                </TouchableOpacity>
            </View>
        </View>

        {/* --- 3. VEHÍCULO --- */}
        <Text style={styles.sectionHeader}>Tu Vehículo</Text>
        <TouchableOpacity style={styles.vehicleCard} onPress={toggleVehicle}>
            <View style={[styles.vehicleIconBox, {backgroundColor: THEME_LIGHT}]}>
               <Ionicons name={user.vehicle_type === 'moto' ? "bicycle" : "bicycle-outline"} size={30} color={THEME_COLOR} />
            </View>
            <View style={{flex: 1}}>
                <Text style={styles.vehicleTitle}>
                    {user.vehicle_type === 'moto' ? 'Motocicleta' : 'Bicicleta'}
                </Text>
                <Text style={styles.vehicleSub}>Toca para cambiar</Text>
            </View>
        </TouchableOpacity>

        {/* --- 4. HISTORIAL (BOTÓN) --- */}
        <Text style={styles.sectionHeader}>Historial</Text>
        <TouchableOpacity
            style={styles.historyButton}
            onPress={() => navigation.navigate('HistoryScreen')}
        >
            <View style={{flexDirection:'row', alignItems:'center'}}>
                <View style={[styles.vehicleIconBox, {backgroundColor: '#FFF3E0'}]}>
                    <Ionicons name="time" size={24} color="#FF9800" />
                </View>
                <Text style={styles.vehicleTitle}>Ver Historial de Entregas</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#ccc" />
        </TouchableOpacity>

        {/* --- CERRAR SESIÓN --- */}
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>

        <View style={{height: 40}} />
      </ScrollView>

      {/* --- MODAL DE DESGLOSE DE GANANCIAS --- */}
      <Modal
        visible={showEarningsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEarningsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.rowBetween}>
                <Text style={styles.modalTitle}>Desglose Semanal</Text>
                <TouchableOpacity onPress={() => setShowEarningsModal(false)}>
                    <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
            </View>

            <View style={{alignItems: 'center', marginVertical: 20}}>
                <Text style={{color:'#666'}}>Total Ganado</Text>
                <Text style={{fontSize: 36, fontWeight:'bold', color: SUCCESS_COLOR}}>${user.earnings_weekly || '0.00'}</Text>
            </View>

            <ScrollView style={{maxHeight: 200}}>
                 <Text style={{textAlign:'center', color:'#888', fontStyle:'italic', padding: 10}}>
                    Este monto corresponde a la suma de las tarifas de envío de todos los pedidos entregados desde el lunes de la semana en curso.
                 </Text>
            </ScrollView>

            <TouchableOpacity
                style={[styles.confirmBtn, {backgroundColor: THEME_COLOR, marginTop: 10}]}
                onPress={() => setShowEarningsModal(false)}
            >
                <Text style={{color:'white', fontWeight:'bold'}}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- MODAL PARA LIQUIDAR DEUDA --- */}
      <Modal visible={debtConfirmation} transparent={true} animationType="fade">
         <KeyboardAvoidingView
             behavior={Platform.OS === 'ios' ? 'padding' : undefined}
             style={styles.modalOverlay}
         >
             <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                 <View style={styles.modalContent}>
                     <View style={{alignItems: 'center', marginBottom: 15}}>
                         <View style={{backgroundColor: '#FDEDEC', padding: 10, borderRadius: 25, marginBottom: 10}}>
                             <Ionicons name="wallet" size={30} color={DANGER_COLOR} />
                         </View>
                         <Text style={styles.modalTitle}>Confirmar Liquidación</Text>
                     </View>

                     <Text style={styles.modalDesc}>
                         ¿Deseas liquidar tu deuda de <Text style={{fontWeight:'bold', color: DANGER_COLOR}}>${user.amount_to_deliver || '0.00'}</Text>? Esta acción requiere confirmación del administrador.
                     </Text>

                     <Text style={{color: '#888', fontSize: 12, marginBottom: 15, textAlign: 'center'}}>
                         El administrador de la oficina debe ingresar sus credenciales para autorizar este corte de caja.
                     </Text>

                     <TextInput
                         style={styles.input}
                         placeholder="Usuario del Administrador"
                         value={adminUsername}
                         onChangeText={setAdminUsername}
                         autoCapitalize="none"
                         editable={!clearingDebt}
                     />
                     
                     <TextInput
                         style={styles.input}
                         placeholder="Contraseña"
                         value={adminPassword}
                         onChangeText={setAdminPassword}
                         secureTextEntry
                         editable={!clearingDebt}
                     />

                     <View style={styles.modalActions}>
                         <TouchableOpacity
                             style={styles.cancelBtn}
                             onPress={() => {
                                 Keyboard.dismiss();
                                 setDebtConfirmation(false);
                             }}
                             disabled={clearingDebt}
                         >
                             <Text style={styles.cancelBtnText}>Cancelar</Text>
                         </TouchableOpacity>
                         <TouchableOpacity
                             style={[styles.confirmBtn, {opacity: clearingDebt ? 0.6 : 1}]}
                             onPress={submitClearDebt}
                             disabled={clearingDebt}
                         >
                             {clearingDebt ? (
                                 <ActivityIndicator size="small" color="white" />
                             ) : (
                                 <Text style={{color:'white', fontWeight:'bold'}}>Solicitar Liquidación</Text>
                             )}
                         </TouchableOpacity>
                     </View>
                 </View>
             </TouchableWithoutFeedback>
         </KeyboardAvoidingView>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  headerBackground: { backgroundColor: THEME_COLOR, height: 160, paddingTop: Platform.OS === 'android' ? 40 : 60, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

  // Profile Card
  profileCard: { backgroundColor: '#fff', marginHorizontal: 20, marginTop: -60, borderRadius: 20, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: {width:0, height:4}, shadowOpacity:0.1, elevation: 5, marginBottom: 20 },
  avatarContainer: { marginBottom: 10, position: 'relative' },
  profileImage: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#eee' },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: THEME_COLOR, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  profileName: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  profileRole: { color: THEME_COLOR, fontWeight: '600', fontSize: 14, marginTop: 2 },
  profileSubText: { color: '#888', fontSize: 12 },

  scrollContainer: { paddingHorizontal: 20 },

  // Cards Generales
  sectionCard: { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 20, elevation: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },

  // Finanzas
  sectionHeader: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15, marginLeft: 5 },
  walletCardFull: { padding: 20, borderRadius: 15, borderWidth: 1, marginBottom: 10, backgroundColor: '#fff' },
  walletLabel: { fontSize: 14, color: '#555', marginBottom: 5 },
  walletValue: { fontSize: 28, fontWeight: 'bold' },
  walletSub: { fontSize: 11, color: '#999', marginTop: 5 },
  walletHint: { fontSize: 11, color: SUCCESS_COLOR, marginTop: 5, fontStyle: 'italic' },

  payButton: { backgroundColor: DANGER_COLOR, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, elevation: 2 },
  payButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  // Vehículo
  vehicleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 15, borderRadius: 15, marginBottom: 25, elevation: 1 },
  vehicleIconBox: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  vehicleTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  vehicleSub: { fontSize: 12, color: THEME_COLOR },

  // Logout
  logoutButton: { alignItems: 'center', padding: 15, marginBottom: 20 },
  logoutText: { color: DANGER_COLOR, fontWeight: 'bold', fontSize: 16 },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 20, padding: 25, elevation: 10 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  modalDesc: { textAlign: 'center', color: '#666', marginBottom: 20, marginTop: 10 },
  input: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 12, marginBottom: 15, fontSize: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, gap: 10 },
  cancelBtn: { padding: 15, flex: 1, alignItems: 'center' },
  confirmBtn: { backgroundColor: DANGER_COLOR, padding: 15, borderRadius: 12, flex: 1, alignItems: 'center' },
  historyButton: {
        backgroundColor: 'white', padding: 15, borderRadius: 15,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, elevation: 1
    }
});

export default ProfileScreen;