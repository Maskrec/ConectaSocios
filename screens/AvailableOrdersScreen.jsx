import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  RefreshControl
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext'; // <--- IMPORTANTE: Para obtener la deuda del usuario
import apiClient from '../api';
import { Ionicons } from '@expo/vector-icons';
import Alert from '../components/AlertPolyfill';

// --- PALETA REPARTIDOR (Indigo) ---
const THEME_COLOR = '#5D5FEF';
const PENDING_COLOR = '#F39C12';
const DANGER_COLOR = '#E74C3C'; // Rojo para bloqueo

const AvailableOrdersScreen = () => {
  const { user, setUser } = useAuth(); // <--- Obtenemos al usuario y la función para actualizarlo
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acceptingOrderId, setAcceptingOrderId] = useState(null); // Track orden siendo aceptada
  const navigation = useNavigation();

  // --- Función para obtener pedidos y actualizar perfil ---
  const fetchAvailableOrders = async () => {
    setIsLoading(true);
    try {
      // 1. Actualizamos los datos del usuario para tener la deuda al día
      const resProfile = await apiClient.get('/auth/perfil/');
      setUser(resProfile.data);

      // 2. Si la deuda es menor a 400, buscamos pedidos
      const debtAmount = resProfile.data.amount_to_deliver ? parseFloat(resProfile.data.amount_to_deliver) : 0;
      if (debtAmount < 400) {
        const response = await apiClient.get('/pedidos/disponibles/');
        const ordersData = Array.isArray(response.data) ? response.data : (response.data.results || []);
        const sortedOrders = [...ordersData].sort((a, b) => {
          if (a.status === 'accepted_by_commerce' && b.status !== 'accepted_by_commerce') return -1;
          if (b.status === 'accepted_by_commerce' && a.status !== 'accepted_by_commerce') return 1;
          return 0;
        });
        setOrders(sortedOrders);
      }
    } catch (error) {
      console.error("Error al obtener pedidos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    Alert.alert(
      "🛡️ Seguridad Primero",
      "• Usa siempre tu casco.\n• Respeta las leyes de transito.\n• No uses el celular en movimiento.",
      [{ text: "Entendido, iniciar turno" }]
    );
    fetchAvailableOrders();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAvailableOrders();
    }, [])
  );

  // --- Lógica de Aceptación con validación extra y prevención de race conditions ---
  const handleAcceptOrder = async (orderId) => {
    // Prevención de doble-clic: Si alguna orden está siendo procesada, no permitir otra
    if (acceptingOrderId !== null) {
        Alert.alert('Espera', 'Por favor espera a que se procese la orden anterior.');
        return;
    }

    const currentDebt = user?.amount_to_deliver ? parseFloat(user.amount_to_deliver) : 0;
    if (currentDebt >= 400) {
        Alert.alert("Bloqueo de Cuenta", "No puedes aceptar pedidos hasta liquidar tu deuda de $400.");
        return;
    }

    setAcceptingOrderId(orderId); // Lock: Marcar que estamos procesando esta orden
    
    try {
      // Realizar la aceptación en el servidor
      const response = await apiClient.post(`/pedidos/${orderId}/aceptar/`);
      
      // Solo si el servidor respondió exitosamente (status 2xx)
      if (response.status === 200 || response.status === 201) {
        Alert.alert('¡Viaje Asignado! 🏍️', 'Ve a la pestaña "Mis Entregas" para ver la ruta.');
        // Remover la orden de la lista local
        setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
      }
    } catch (error) {
      // Errores comunes:
      // 409: Conflicto - Alguien más ya aceptó la orden
      // 404: No encontrada - La orden ya no existe
      // 400: Bad request - Validación fallida
      if (error.response?.status === 409) {
        Alert.alert('¡Ups!', 'Este pedido ya fue tomado por otro repartidor. Se actualizarán los pedidos disponibles.');
      } else if (error.response?.status === 404) {
        Alert.alert('¡Ups!', 'Este pedido ya no está disponible.');
      } else {
        Alert.alert('Error', error.response?.data?.detail || 'No se pudo aceptar el pedido. Intenta nuevamente.');
      }
      
      // Re-fetch pedidos para sincronizar estado con servidor
      await fetchAvailableOrders();
    } finally {
      setAcceptingOrderId(null); // Unlock: Permitir procesar otra orden
    }
  };

  // --- RENDERIZADO DE TARJETA ---
  const renderOrderItem = ({ item }) => {
    const isPendingAtCommerce = item.status === 'pending';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.commerceInfo}>
             <Ionicons name="storefront" size={18} color={THEME_COLOR} style={{marginRight: 8}}/>
             <Text style={styles.commerceName}>{item.commerce_name}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isPendingAtCommerce ? '#FFF3E0' : '#E8F8F5' }]}>
             <Text style={{color: isPendingAtCommerce ? PENDING_COLOR : '#1ABC9C', fontWeight: 'bold', fontSize: 11}}>
                {isPendingAtCommerce ? '⏳ ESPERANDO' : '👨‍🍳 COCINANDO'}
             </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardBody}>
            <View style={styles.row}>
                <Ionicons name="location-outline" size={16} color="#666" />
                <Text style={styles.addressText} numberOfLines={2}>{item.commerce_address}</Text>
            </View>
            <View style={styles.row}>
                <Ionicons name="cash-outline" size={16} color="green" />
                <Text style={styles.totalText}>Cobrar al cliente: <Text style={{fontWeight: 'bold', color: 'green'}}>${item.final_total}</Text></Text>
            </View>
        </View>

        <TouchableOpacity
            style={[
              styles.acceptButton, 
              { 
                backgroundColor: isPendingAtCommerce ? PENDING_COLOR : THEME_COLOR,
                opacity: acceptingOrderId === item.id ? 0.6 : 1
              }
            ]}
            onPress={() => handleAcceptOrder(item.id)}
            disabled={acceptingOrderId !== null}
            activeOpacity={0.8}
        >
            {acceptingOrderId === item.id ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.acceptButtonText}>{isPendingAtCommerce ? 'ACEPTAR Y AVISAR AL LOCAL' : 'ACEPTAR VIAJE'}</Text>
                <Ionicons name="arrow-forward-circle" size={24} color="#fff" style={{marginLeft: 10}} />
              </>
            )}
        </TouchableOpacity>
      </View>
    );
  };

  // --- VISTA DE BLOQUEO POR DEUDA ---
  const currentDebt = user?.amount_to_deliver ? parseFloat(user.amount_to_deliver) : 0;
  if (user && currentDebt >= 400) {
      return (
          <View style={styles.container}>
              <StatusBar barStyle="light-content" backgroundColor={DANGER_COLOR} />
              <View style={[styles.header, { backgroundColor: DANGER_COLOR }]}>
                <Text style={styles.headerTitle}>Cuenta Suspendida</Text>
                <Text style={styles.headerSubtitle}>Límite de deuda alcanzado</Text>
              </View>
              <View style={styles.blockContainer}>
                  <Ionicons name="lock-closed" size={80} color={DANGER_COLOR} />
                  <Text style={styles.blockTitle}>Debe liquidar su deuda</Text>
                  <Text style={styles.blockText}>
                      Tu deuda actual es de <Text style={{fontWeight: 'bold'}}>${currentDebt.toFixed(2)}</Text>.
                      El límite permitido es de $400.00.
                  </Text>
                  <TouchableOpacity
                    style={styles.profileButton}
                    onPress={() => navigation.navigate('Perfil')}
                  >
                      <Text style={styles.profileButtonText}>VER DETALLES EN PERFIL</Text>
                  </TouchableOpacity>
              </View>
          </View>
      );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME_COLOR} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pedidos Disponibles</Text>
        <Text style={styles.headerSubtitle}>Zona Centro</Text>
      </View>

      {isLoading && orders.length === 0 ? (
        <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={THEME_COLOR} />
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchAvailableOrders} colors={[THEME_COLOR]} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
                <Ionicons name="bicycle" size={60} color="#ccc" />
                <Text style={styles.emptyTitle}>Todo tranquilo por aquí</Text>
                <Text style={styles.emptyText}>Buscando nuevos pedidos...</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F7' },
  header: {
    backgroundColor: THEME_COLOR,
    paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: '#E0E0FF', marginTop: 2 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 15 },
  card: { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginBottom: 15, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commerceInfo: { flexDirection: 'row', alignItems: 'center' },
  commerceName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 10 },
  cardBody: { marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  addressText: { color: '#555', fontSize: 14, marginLeft: 8, flex: 1 },
  totalText: { color: '#333', fontSize: 14, marginLeft: 8 },
  acceptButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
  acceptButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#555', marginTop: 15 },
  emptyText: { textAlign: 'center', color: '#999', marginTop: 5 },

  // Estilos de Bloqueo
  blockContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  blockTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 20 },
  blockText: { textAlign: 'center', color: '#666', marginTop: 10, lineHeight: 22 },
  profileButton: { backgroundColor: THEME_COLOR, marginTop: 30, paddingVertical: 15, paddingHorizontal: 30, borderRadius: 12 },
  profileButtonText: { color: 'white', fontWeight: 'bold' }
});

export default AvailableOrdersScreen;