import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import apiClient from '../api';
import { Ionicons } from '@expo/vector-icons';
import Alert from '../components/AlertPolyfill';

// --- PALETA COMERCIO (Ocean Teal) ---
const THEME_COLOR = '#1ABC9C';
const THEME_LIGHT = '#E8F8F5';
const THEME_DARK_TEXT = '#0E6655';

const CommerceOrdersScreen = () => {
  const [pendingOrders, setPendingOrders] = useState([]);
  const [inProgressOrders, setInProgressOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation();

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const [pendingRes, progressRes] = await Promise.all([
        apiClient.get('/mis-pedidos-comercio/'), // Pedidos nuevos (pending)
        apiClient.get('/pedidos-en-preparacion/') // Aceptados/Cocinando (in_progress)
      ]);
      setPendingOrders(pendingRes.data);
      setInProgressOrders(progressRes.data);
    } catch (error) {
      console.error("Error al cargar pedidos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Usamos useFocusEffect para recargar siempre que entres a la pantalla
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [])
  );

  const handleConfirmOrder = async (orderId) => {
    try {
      await apiClient.post(`/pedidos/${orderId}/confirmar/`);
      Alert.alert("¡Pedido Aceptado! 👨‍🍳", "Se ha notificado al repartidor.");
      fetchOrders();
    } catch (error) {
      Alert.alert("Error", "No se pudo confirmar el pedido.");
    }
  };

  // --- RENDERIZADOR DE TARJETA ---
  const renderOrderCard = (item, isPending) => {
    const hasCourier = !!item.courier_name;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.card, isPending ? styles.cardPending : styles.cardProgress]}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('CommerceOrderDetail', { orderId: item.id })}
      >
        {/* Header de la Tarjeta */}
        <View style={styles.cardHeader}>
          <View style={styles.idContainer}>
            <Ionicons name="receipt" size={16} color={THEME_COLOR} style={{marginRight: 5}}/>
            <Text style={styles.orderId}>#{item.id}</Text>
          </View>
          <Text style={styles.orderDate}>
            {new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Cuerpo de la Tarjeta */}
        <View style={styles.cardBody}>
          {/* Información del Repartidor */}
          <View style={styles.courierRow}>
             {hasCourier ? (
               <View style={styles.courierBadge}>
                 <Ionicons name="bicycle" size={14} color="#fff" />
                 <Text style={styles.courierBadgeText}>{item.courier_name}</Text>
               </View>
             ) : (
               <View style={styles.waitingBadge}>
                 <ActivityIndicator size="small" color="#F39C12" style={{transform: [{scale: 0.7}]}} />
                 <Text style={styles.waitingText}>Buscando repartidor...</Text>
               </View>
             )}
          </View>

          {/* Total ($) */}
          <Text style={styles.totalText}>${item.final_total}</Text>
        </View>

        {/* Footer: Acción o Estado */}
        {isPending ? (
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => handleConfirmOrder(item.id)}
          >
            <Text style={styles.buttonText}>Confirmar y Cocinar</Text>
            <Ionicons name="flame" size={18} color="#fff" style={{marginLeft: 5}} />
          </TouchableOpacity>
        ) : (
          <View style={styles.statusFooter}>
             {/* Lógica simple para mostrar estado en texto */}
             <Ionicons name={hasCourier ? "checkmark-circle" : "time"} size={16} color={hasCourier ? THEME_COLOR : "#F39C12"} />
             <Text style={[styles.statusFooterText, { color: hasCourier ? THEME_COLOR : "#F39C12" }]}>
                {hasCourier ? "Repartidor Asignado" : "Esperando asignación"}
             </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor={THEME_COLOR} />

      {/* HEADER DE LA PANTALLA */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Gestión de Pedidos</Text>
        <Text style={styles.headerSubtitle}>
          {pendingOrders.length > 0 ? `Tienes ${pendingOrders.length} por confirmar` : "Todo al día"}
        </Text>
      </View>

      {/* CONTENIDO SCROLLABLE */}
      <View style={styles.whiteCard}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchOrders} colors={[THEME_COLOR]} />}
        >

          {/* SECCIÓN 1: NUEVOS (PENDIENTES) */}
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications" size={20} color="#E74C3C" />
            <Text style={styles.sectionTitle}>Nuevos Pedidos ({pendingOrders.length})</Text>
          </View>

          {pendingOrders.length > 0 ? (
            pendingOrders.map(item => renderOrderCard(item, true))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No hay pedidos nuevos por ahora.</Text>
            </View>
          )}

          <View style={styles.sectionDivider} />

          {/* SECCIÓN 2: EN CURSO (COCINA/REPARTO) */}
          <View style={styles.sectionHeader}>
            <Ionicons name="flame" size={20} color="#F39C12" />
            <Text style={styles.sectionTitle}>En Cocina / Curso ({inProgressOrders.length})</Text>
          </View>

          {inProgressOrders.length > 0 ? (
            inProgressOrders.map(item => renderOrderCard(item, false))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>La cocina está tranquila.</Text>
            </View>
          )}

          <View style={{height: 80}} />
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: THEME_COLOR },

  // Header Pantalla
  headerContainer: {
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 60, paddingBottom: 25,
    justifyContent: 'center'
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 5 },

  // Tarjeta Blanca
  whiteCard: {
    flex: 1, backgroundColor: '#F4F6F7', // Un gris muy clarito, mejor que blanco puro para listas
    borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden'
  },
  scrollContent: { padding: 20 },

  // Secciones
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginLeft: 8 },
  sectionDivider: { height: 1, backgroundColor: '#E0E0E0', marginVertical: 20 },

  // Tarjetas de Pedido
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, elevation: 2,
    borderLeftWidth: 5,
  },
  cardPending: { borderLeftColor: '#E74C3C' }, // Borde Rojo para nuevos (Urgencia)
  cardProgress: { borderLeftColor: THEME_COLOR }, // Borde Teal para en curso (Control)

  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  idContainer: { flexDirection: 'row', alignItems: 'center' },
  orderId: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  orderDate: { fontSize: 12, color: '#999' },

  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 10 },

  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },

  // Badges de Repartidor
  courierRow: { flex: 1 },
  courierBadge: {
    flexDirection: 'row', backgroundColor: THEME_COLOR, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, alignSelf: 'flex-start', alignItems: 'center'
  },
  courierBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },

  waitingBadge: {
    flexDirection: 'row', backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, alignSelf: 'flex-start', alignItems: 'center', borderWidth: 1, borderColor: '#FFE0B2'
  },
  waitingText: { color: '#F39C12', fontSize: 12, fontStyle: 'italic', marginLeft: 5 },

  totalText: { fontSize: 18, fontWeight: 'bold', color: THEME_DARK_TEXT },

  // Botones y Footer
  confirmButton: {
    backgroundColor: THEME_COLOR, borderRadius: 8, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center'
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  statusFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    backgroundColor: '#F9F9F9', padding: 8, borderRadius: 8
  },
  statusFooterText: { fontSize: 13, fontWeight: '600', marginLeft: 5 },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 20 },
  emptyText: { color: '#999', fontStyle: 'italic' },
});

export default CommerceOrdersScreen;