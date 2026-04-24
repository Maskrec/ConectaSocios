import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Switch, TouchableOpacity } from 'react-native';
import { DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext'; // Importamos el contexto

const CustomDrawerContent = (props) => {
  const { user, logout } = useAuth(); // Obtenemos el usuario y la función logout
  const [isActivo, setIsActivo] = useState(true);

  return (
    <DrawerContentScrollView {...props} style={styles.container}>
      {/* --- 1. Información del Usuario --- */}
      <View style={styles.profileContainer}>
        <Image
          source={{ uri: user?.profile_image || 'https://via.placeholder.com/100' }}
          style={styles.profileImage}
        />
        <Text style={styles.profileName}>{user?.first_name} {user?.last_name}</Text>
        <Text style={styles.profileUsername}>@{user?.username}</Text>
      </View>

      {/* --- 2. Switch de Estado --- */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>{isActivo ? 'Activo' : 'Inactivo'}</Text>
        <Switch
          trackColor={{ false: "#767577", true: "#81b0ff" }}
          thumbColor={isActivo ? "#f5dd4b" : "#f4f3f4"}
          onValueChange={() => setIsActivo(previousState => !previousState)}
          value={isActivo}
        />
      </View>

      {/* --- 3. Wallet (Simulado) --- */}
      <View style={styles.walletContainer}>
        <Text style={styles.drawerSectionTitle}>Billetera</Text>
        <View style={styles.walletRow}>
          <Text>Ganancias (Hoy):</Text>
          <Text style={styles.walletAmount}>$0.00</Text>
        </View>
        <View style={styles.walletRow}>
          <Text>Monto a entregar (Comisiones):</Text>
          <Text style={styles.walletAmount}>$0.00</Text>
        </View>
      </View>

      {/* --- 4. Vehículo (Simulado) --- */}
      <View style={styles.vehicleContainer}>
        <Text style={styles.drawerSectionTitle}>Vehículo</Text>
        <View style={styles.vehicleRow}>
          <Ionicons name="bicycle-outline" size={24} color="#555" />
          <Text style={styles.vehicleText}>Motocicleta</Text>
          <Ionicons name="chevron-forward" size={20} color="#555" />
        </View>
      </View>

      {/* --- 5. Links de Navegación (Automáticos) --- */}
      <DrawerItemList {...props} />



      {/* --- 7. Cerrar Sesión --- */}
      <DrawerItem
        label="Cerrar Sesión"
        icon={({ color, size }) => <Ionicons name="log-out-outline" size={size} color={color} />}
        onPress={logout}
      />
    </DrawerContentScrollView>
  );
};

// --- Estilos para el Drawer ---
const styles = StyleSheet.create({
  container: { flex: 1 },
  profileContainer: { padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee' },
  profileImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 10 },
  profileName: { fontSize: 18, fontWeight: 'bold' },
  profileUsername: { fontSize: 14, color: 'gray' },
  statusContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  statusText: { fontSize: 16, fontWeight: '500' },
  drawerSectionTitle: { fontSize: 16, fontWeight: 'bold', color: 'gray', marginLeft: 20, marginTop: 10 },
  walletContainer: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  walletRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 5 },
  walletAmount: { fontWeight: 'bold' },
  vehicleContainer: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  vehicleText: { flex: 1, marginLeft: 10, fontSize: 16 },
});

export default CustomDrawerContent;