import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Platform,
  TextInput,
  Switch,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api';
import { Ionicons } from '@expo/vector-icons';
import Alert from '../../components/AlertPolyfill';

const THEME_COLOR = '#FFCC00'; // Safety Yellow

const DriverProfileScreen = ({ navigation }) => {
  const { user, setUser, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [availability, setAvailability] = useState(true);
  
  // Estados Formulario Liquidación (Administrador)
  const [clearingDebt, setClearingDebt] = useState(false);
  const [debtConfirmation, setDebtConfirmation] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [formData, setFormData] = useState({
    car_brand: user?.car_brand || '',
    car_model: user?.car_model || '',
    license_plate: user?.license_plate || '',
    is_taxi_driver: user?.is_taxi_driver || false,
    driver_license: user?.driver_license || '',
    vehicle_registration: user?.vehicle_registration || '',
  });

  const [stats, setStats] = useState({
    total_trips: 0,
    weekly_trips: 0,
    total_earnings: 0,
    weekly_earnings: 0,
    average_rating: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/viajes/mis-ganancias/');
      
      // Extraer los viajes y calcular el rating promedio real
      const tripsData = response.data.trips || [];
      const ratedTrips = tripsData.filter(t => t.trip_rating);
      let avgRating = 0;
      if (ratedTrips.length > 0) {
        const totalRating = ratedTrips.reduce((sum, t) => sum + t.trip_rating, 0);
        avgRating = (totalRating / ratedTrips.length).toFixed(1);
      }

      setStats({
        total_trips: response.data.total_trips || 0,
        weekly_trips: 0, // Calcular desde el backend
        total_earnings: parseFloat(response.data.total_earnings) || 0,
        weekly_earnings: 0, // Calcular desde el backend
        average_rating: avgRating > 0 ? avgRating : 'Nuevo',
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    // Validar campos requeridos
    if (!formData.car_brand.trim()) {
      Alert.alert('Error', 'La marca del vehículo es requerida');
      return;
    }
    if (!formData.car_model.trim()) {
      Alert.alert('Error', 'El modelo del vehículo es requerido');
      return;
    }
    if (!formData.license_plate.trim()) {
      Alert.alert('Error', 'La placa del vehículo es requerida');
      return;
    }
    if (formData.is_taxi_driver && !formData.vehicle_registration.trim()) {
      Alert.alert('Error', 'La matrícula es requerida para taxistas');
      return;
    }

    try {
      setIsSaving(true);
      const response = await apiClient.patch('/auth/perfil-conductor/', formData);
      setUser(response.data);
      setIsEditing(false);
      Alert.alert('Éxito', 'Información de vehículo actualizada correctamente');
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Error al guardar los cambios';
      Alert.alert('Error', errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  // --- LÓGICA DE DEUDA Y COMISIONES ---
  // La deuda en la base de datos se refleja como un saldo negativo en la billetera
  const debtAmount = user?.wallet_balance && parseFloat(user.wallet_balance) < 0 
    ? Math.abs(parseFloat(user.wallet_balance)) 
    : 0;
  
  const isBlocked = debtAmount >= 700; // Límite de bloqueo para taxistas
  const isWarning = debtAmount >= 600; // Límite de advertencia

  const handleOpenClearDebt = () => {
    if (debtAmount <= 0) {
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
        // Refrescar perfil para ver la deuda en 0
        const resProfile = await apiClient.get('/perfil/');
        setUser(resProfile.data);
    } catch (error) {
        const errorMsg = error.response?.data?.error || "Credenciales de administrador inválidas o error de conexión.";
        Alert.alert("Error", errorMsg);
    } finally {
        setClearingDebt(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          onPress: logout,
          style: 'destructive',
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME_COLOR} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Mi Perfil</Text>
          <Text style={styles.subtitle}>Conductor de Taxi</Text>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setIsEditing(!isEditing)}
        >
          <Ionicons name={isEditing ? 'close' : 'pencil'} size={20} color="#333" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={THEME_COLOR} />
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Personal Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información Personal</Text>
            <View style={styles.infoBox}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nombre</Text>
                <Text style={styles.infoValue}>{user?.first_name} {user?.last_name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user?.username}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Teléfono</Text>
                <Text style={styles.infoValue}>{user?.phone_number || 'Sin definir'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Rating Promedio</Text>
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={[styles.infoValue, { marginLeft: 6 }]}>{stats.average_rating} ({stats.total_trips} viajes)</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Vehicle Info Section - Editable */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Información del Vehículo</Text>
            {isEditing ? (
              <View style={styles.formBox}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Marca del Vehículo *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: Toyota"
                    value={formData.car_brand}
                    onChangeText={(text) => handleInputChange('car_brand', text)}
                    editable={!isSaving}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Modelo *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: Corolla 2020"
                    value={formData.car_model}
                    onChangeText={(text) => handleInputChange('car_model', text)}
                    editable={!isSaving}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Placa del Vehículo *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: ABC-123"
                    value={formData.license_plate}
                    onChangeText={(text) => handleInputChange('license_plate', text.toUpperCase())}
                    editable={!isSaving}
                  />
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.switchRow}>
                    <Text style={styles.formLabel}>¿Soy Taxista Oficial?</Text>
                    <Switch
                      value={formData.is_taxi_driver}
                      onValueChange={(value) => handleInputChange('is_taxi_driver', value)}
                      disabled={isSaving}
                      trackColor={{ false: '#ccc', true: THEME_COLOR }}
                    />
                  </View>
                </View>

                {formData.is_taxi_driver && (
                  <>
                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Número de Licencia</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: LIC-123456"
                        value={formData.driver_license}
                        onChangeText={(text) => handleInputChange('driver_license', text)}
                        editable={!isSaving}
                      />
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.formLabel}>Matrícula del Vehículo *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: REG-123456"
                        value={formData.vehicle_registration}
                        onChangeText={(text) => handleInputChange('vehicle_registration', text)}
                        editable={!isSaving}
                      />
                    </View>
                  </>
                )}

                {/* Save Button */}
                <TouchableOpacity
                  style={[styles.saveButton, isSaving && { opacity: 0.6 }]}
                  onPress={handleSaveProfile}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#333" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={18} color="#333" />
                      <Text style={styles.saveButtonText}>GUARDAR CAMBIOS</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.infoBox}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Marca</Text>
                  <Text style={styles.infoValue}>{formData.car_brand || 'Sin definir'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Modelo</Text>
                  <Text style={styles.infoValue}>{formData.car_model || 'Sin definir'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Placa</Text>
                  <Text style={styles.infoValue}>{formData.license_plate || 'Sin definir'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Tipo</Text>
                  <Text style={styles.infoValue}>
                    {formData.is_taxi_driver ? 'Taxista Oficial' : 'Conductor Particular'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Finance Section - Deuda */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Finanzas</Text>
            <View style={[
                styles.walletCardFull,
                {
                  backgroundColor: isBlocked ? '#FDEDEC' : isWarning ? '#FEF9E7' : '#F8F9FA',
                  borderColor: isBlocked ? '#F5B7B1' : isWarning ? '#F1C40F' : '#EEE',
                }
            ]}>
                <View style={styles.rowBetween}>
                    <View style={{flex: 1}}>
                        <Text style={styles.walletLabel}>Deuda a Oficina (Comisiones)</Text>
                        <Text style={[
                            styles.walletValue,
                            {color: isBlocked ? '#E74C3C' : isWarning ? '#F39C12' : '#333'}
                        ]}>
                            ${debtAmount.toFixed(2)}
                        </Text>
                        {isBlocked && (
                            <Text style={{color: '#E74C3C', fontSize: 10, fontWeight: 'bold', marginTop: 4}}>
                                ⚠️ LÍMITE ALCANZADO ($700). CUENTA SUSPENDIDA.
                            </Text>
                        )}
                        {!isBlocked && isWarning && (
                            <Text style={{color: '#F39C12', fontSize: 10, fontWeight: 'bold', marginTop: 4}}>
                                ⚠️ TE ACERCAS AL LÍMITE PERMITIDO ($700).
                            </Text>
                        )}
                        <Text style={styles.walletSub}>Comisión acumulada por viajes</Text>
                    </View>
                    <TouchableOpacity style={styles.payButton} onPress={handleOpenClearDebt} disabled={clearingDebt}>
                        <Text style={styles.payButtonText}>{clearingDebt ? 'PROCESANDO...' : 'LIQUIDAR'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
          </View>

          {/* Statistics Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Estadísticas</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="car" size={24} color={THEME_COLOR} />
                <Text style={styles.statValue}>{stats.total_trips}</Text>
                <Text style={styles.statLabel}>Viajes Totales</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="cash" size={24} color={THEME_COLOR} />
                <Text style={styles.statValue}>${stats.total_earnings.toFixed(2)}</Text>
                <Text style={styles.statLabel}>Ganancias Totales</Text>
              </View>
            </View>
          </View>

          {/* Settings Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Configuración</Text>
            <View style={styles.settingsBox}>
              <View style={styles.settingRow}>
                <View>
                  <Text style={styles.settingLabel}>Disponible para Viajes</Text>
                  <Text style={styles.settingSubtitle}>Acepta o rechaza nuevos viajes</Text>
                </View>
                <Switch
                  value={availability}
                  onValueChange={setAvailability}
                  trackColor={{ false: '#ccc', true: THEME_COLOR }}
                />
              </View>
            </View>
          </View>

          {/* Logout Button */}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out" size={18} color="#E74C3C" />
            <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* --- MODAL PARA LIQUIDAR DEUDA (ADMIN) --- */}
      <Modal visible={debtConfirmation} transparent={true} animationType="fade">
         <KeyboardAvoidingView
             behavior={Platform.OS === 'ios' ? 'padding' : undefined}
             style={styles.modalOverlay}
         >
             <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                 <View style={styles.modalContent}>
                     <View style={{alignItems: 'center', marginBottom: 15}}>
                         <View style={{backgroundColor: '#FDEDEC', padding: 10, borderRadius: 25, marginBottom: 10}}>
                             <Ionicons name="wallet" size={30} color="#E74C3C" />
                         </View>
                         <Text style={styles.modalTitle}>Liquidar Deuda</Text>
                     </View>

                     <Text style={styles.modalDesc}>
                         Vas a liquidar la deuda de <Text style={{fontWeight:'bold', color: '#E74C3C'}}>${debtAmount.toFixed(2)}</Text>.
                     </Text>
                     
                     <Text style={{color: '#888', fontSize: 12, marginBottom: 15, textAlign: 'center'}}>
                         El administrador de la oficina debe ingresar sus credenciales para autorizar este corte de caja.
                     </Text>

                     <TextInput
                         style={styles.adminInput}
                         placeholder="Usuario del Administrador"
                         value={adminUsername}
                         onChangeText={setAdminUsername}
                         autoCapitalize="none"
                         editable={!clearingDebt}
                     />
                     
                     <TextInput
                         style={styles.adminInput}
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
                                 <Text style={{color:'white', fontWeight:'bold'}}>Autorizar</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: THEME_COLOR,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666', // Gris para subtítulo sobre amarillo
    marginTop: 4,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 15,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  infoBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  infoLabel: {
    fontSize: 13,
    color: '#999',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: 'bold',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  formBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  formGroup: {
    marginBottom: 15,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: '#F9F9F9',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: THEME_COLOR,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  saveButtonText: {
    color: '#333',
    fontSize: 13,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  settingsBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  settingSubtitle: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  logoutButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E74C3C',
    marginBottom: 15,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  walletCardFull: { padding: 20, borderRadius: 15, borderWidth: 1, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  walletLabel: { fontSize: 14, color: '#555', marginBottom: 5 },
  walletValue: { fontSize: 28, fontWeight: 'bold' },
  walletSub: { fontSize: 11, color: '#999', marginTop: 5 },
  payButton: { backgroundColor: '#E74C3C', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, elevation: 2 },
  payButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 20, padding: 25, elevation: 10, width: '100%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  modalDesc: { textAlign: 'center', color: '#666', marginTop: 10 },
  adminInput: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 12, marginBottom: 15, fontSize: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, gap: 10 },
  cancelBtn: { padding: 15, flex: 1, alignItems: 'center' },
  cancelBtnText: { color: '#666', fontWeight: 'bold' },
  confirmBtn: { backgroundColor: '#E74C3C', padding: 15, borderRadius: 12, flex: 1, alignItems: 'center' },
});

export default DriverProfileScreen;
