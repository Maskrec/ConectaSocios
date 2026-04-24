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
import apiClient from '../api';
import { Ionicons } from '@expo/vector-icons';
import Alert from '../components/AlertPolyfill';

// --- PALETA REPARTIDOR (Indigo) ---
const THEME_COLOR = '#5D5FEF'; // Índigo (Recolección)
const DELIVERY_COLOR = '#2ECC71'; // Verde (Entrega)

const MyDeliveriesScreen = () => {
  const [myOrders, setMyOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation();

  // --- Cargar Pedidos ---
  const fetchMyOrders = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/mis-entregas/');
      // Ordenar: Los más recientes arriba
      const sorted = response.data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setMyOrders(sorted);
    } catch (error) {
      console.error("Error al obtener mis entregas:", error);
      Alert.alert("Error de Conexión", "No pudimos cargar tus entregas. Desliza hacia abajo para reintentar.");
    } finally {
      setIsLoading(false);
    }
  };

  // Recargar al entrar a la pantalla
  useFocusEffect(
    useCallback(() => {
      fetchMyOrders();
    }, [])
  );

  // --- RENDERIZADO DE TARJETA ---
  const renderDeliveryItem = useCallback(({ item }) => {
    // Determinar fase: 'accepted' = Ir al Comercio, 'in_progress' = Ir al Cliente
    const isPickupPhase = item.status === 'accepted';

    // Configuración visual dinámica
    const cardColor = isPickupPhase ? THEME_COLOR : DELIVERY_COLOR;
    const statusText = isPickupPhase ? 'Ir a Recolectar' : 'Entregar al Cliente';
    const statusIcon = isPickupPhase ? 'storefront' : 'home';

    // Destino Actual (Lo más importante para el chofer)
    const currentTargetName = isPickupPhase ? item.commerce_name : item.customer_name;
    const currentAddress = isPickupPhase ? item.commerce_address : (item.delivery_address?.address_string || 'Ver mapa');

    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: cardColor }]}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('DeliveryTracking', { orderId: item.id })}
      >
        {/* Cabecera de Tarjeta: ID y Estado */}
        <View style={styles.cardHeader}>
          <Text style={styles.orderId}>Pedido #{item.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: isPickupPhase ? '#E8EAF6' : '#E8F5E9' }]}>
             <Ionicons name={statusIcon} size={14} color={cardColor} style={{marginRight: 5}} />
             <Text style={{color: cardColor, fontWeight: 'bold', fontSize: 12}}>
               {statusText}
             </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Cuerpo: A dónde ir AHORA */}
        <View style={styles.body}>
            <Text style={styles.labelDestination}>
                {isPickupPhase ? "📍 RECOGER EN:" : "🏁 LLEVAR A:"}
            </Text>
            <Text style={styles.targetName}>{currentTargetName}</Text>
            <Text style={styles.addressText} numberOfLines={2}>{currentAddress}</Text>
        </View>

        {/* Footer: Dinero y Acción */}
        <View style={styles.footer}>
           <View>
              <Text style={styles.totalLabel}>Cobrar:</Text>
              <Text style={styles.totalValue}>${item.final_total}</Text>
           </View>

           <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: cardColor }]}
              onPress={() => navigation.navigate('DeliveryTracking', { orderId: item.id })}
           >
              <Text style={styles.actionButtonText}>VER RUTA</Text>
              <Ionicons name="navigate" size={16} color="#fff" style={{marginLeft: 5}}/>
           </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME_COLOR} />

      {/* Header Fijo */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Entregas</Text>
        <Text style={styles.headerSubtitle}>
            {myOrders.length > 0 ? `Tienes ${myOrders.length} curso` : 'Sin entregas activas'}
        </Text>
      </View>

      {/* Lista */}
      <View style={styles.listContainer}>
        {isLoading && myOrders.length === 0 ? (
          <ActivityIndicator size="large" color={THEME_COLOR} style={{marginTop: 50}} />
        ) : (
          <FlatList
            data={myOrders}
            renderItem={renderDeliveryItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={{ padding: 20 }}
            refreshControl={
                <RefreshControl refreshing={isLoading} onRefresh={fetchMyOrders} colors={[THEME_COLOR]} />
            }
            ListEmptyComponent={
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconBg}>
                        <Ionicons name="documents-outline" size={50} color="#ccc" />
                    </View>
                    <Text style={styles.emptyTitle}>No tienes entregas activas</Text>
                    <Text style={styles.emptyText}>Ve a la pestaña "Disponibles" para tomar nuevos pedidos.</Text>
                </View>
            }
          />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },

  // Header
  header: {
    backgroundColor: THEME_COLOR,
    paddingTop: 50, paddingBottom: 20, paddingHorizontal: 20,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    elevation: 5, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity:0.2
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: '#E0E0FF', marginTop: 5 },

  listContainer: { flex: 1 },

  // Tarjeta
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15,
    borderLeftWidth: 6, // El color se define dinámicamente
    elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1,
  },

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 10 },

  // Cuerpo
  body: { marginBottom: 15 },
  labelDestination: { fontSize: 10, color: '#999', fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
  targetName: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  addressText: { fontSize: 14, color: '#666' },

  // Footer
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  totalLabel: { fontSize: 12, color: '#999' },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },

  // Botón Acción
  actionButton: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 8
  },
  actionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

  // Empty State
  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyIconBg: { width: 100, height: 100, backgroundColor: '#fff', borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#555' },
  emptyText: { color: '#999', marginTop: 5, fontSize: 14 },
});

export default MyDeliveriesScreen;