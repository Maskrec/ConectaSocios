import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  Platform
} from 'react-native';
import apiClient from '../api';
import { Ionicons } from '@expo/vector-icons';
import Alert from '../components/AlertPolyfill';

// --- PALETA DE COLORES COMERCIO ---
const THEME_COLOR = '#1ABC9C';      // Teal Principal
const THEME_LIGHT = '#E8F8F5';      // Fondo Suave
const DANGER_COLOR = '#E74C3C';     // Rojo para Cancelar

const CommerceOrderDetailScreen = ({ route, navigation }) => {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrderDetails = async () => {
    try {
      const response = await apiClient.get(`/pedidos/${orderId}/`);
      setOrder(response.data);
    } catch (error) {
      Alert.alert("Error", "No se pudo cargar el pedido.");
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, []);

  const handleCancelOrder = () => {
    Alert.alert(
      "¿Cancelar Pedido?",
      "Esta acción es irreversible y notificará al cliente.",
      [
        { text: "No, mantener", style: "cancel" },
        { text: "Sí, Cancelar Pedido", style: "destructive", onPress: async () => {
            try {
              await apiClient.post(`/pedidos/${orderId}/cancelar-comercio/`);
              Alert.alert("Cancelado", "El pedido ha sido cancelado exitosamente.");
              navigation.goBack();
            } catch (error) {
              Alert.alert("Error", "No se pudo cancelar el pedido.");
            }
          }
        }
      ]
    );
  };

  // --- HELPER: Estilos de Estado ---
  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending': return { color: '#F39C12', bg: '#FDEBD0', label: 'Pendiente', icon: 'time' };
      case 'in_progress': return { color: '#3498DB', bg: '#D6EAF8', label: 'En Preparación', icon: 'flame' };
      case 'ready_for_pickup': return { color: '#27AE60', bg: '#D5F5E3', label: 'Listo para Recoger', icon: 'bicycle' };
      case 'delivered': return { color: '#2ECC71', bg: '#EAFAF1', label: 'Entregado', icon: 'checkmark-circle' };
      case 'cancelled': return { color: '#C0392B', bg: '#FADBD8', label: 'Cancelado', icon: 'close-circle' };
      default: return { color: '#7F8C8D', bg: '#F2F3F4', label: status, icon: 'help-circle' };
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.mainContainer, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={{color: '#fff', marginTop: 10}}>Cargando pedido...</Text>
      </View>
    );
  }

  if (!order) return null;

  const statusConfig = getStatusConfig(order.status);

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor={THEME_COLOR} />

      {/* HEADER */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pedido #{order.id}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* TARJETA BLANCA */}
      <View style={styles.whiteCard}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* 1. SECCIÓN DE ESTADO */}
          <View style={styles.statusSection}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
              <Ionicons name={statusConfig.icon} size={20} color={statusConfig.color} style={{marginRight: 8}} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>
            <Text style={styles.dateText}>{new Date(order.created_at).toLocaleString()}</Text>
          </View>

          <View style={styles.divider} />

          {/* 2. DATOS DE LOGÍSTICA */}
          <Text style={styles.sectionTitle}>Detalles de Entrega</Text>
          <View style={styles.infoCard}>
            {/* Cliente */}
            <View style={styles.infoRow}>
              <View style={styles.iconBox}>
                <Ionicons name="person" size={18} color={THEME_COLOR} />
              </View>
              <View>
                <Text style={styles.infoLabel}>Cliente</Text>
                <Text style={styles.infoValue}>{order.customer_name}</Text>
              </View>
            </View>

            {/* Separador interno */}
            <View style={[styles.divider, { marginVertical: 10, width: '100%' }]} />

            {/* Repartidor */}
            <View style={styles.infoRow}>
              <View style={[styles.iconBox, { backgroundColor: order.courier_name ? THEME_LIGHT : '#f9f9f9' }]}>
                <Ionicons name="bicycle" size={18} color={order.courier_name ? THEME_COLOR : '#ccc'} />
              </View>
              <View>
                <Text style={styles.infoLabel}>Repartidor</Text>
                <Text style={[styles.infoValue, !order.courier_name && { color: '#999', fontStyle: 'italic' }]}>
                  {order.courier_name || 'Buscando repartidor...'}
                </Text>
              </View>
            </View>
          </View>

          {/* 3. PRODUCTOS (COMANDA) */}
          <Text style={styles.sectionTitle}>Comanda (Cocina)</Text>
          <View style={styles.productsContainer}>
            {order.items.map((item, index) => (
              <View key={index} style={styles.productRow}>
                {/* Cantidad */}
                <View style={styles.qtyBox}>
                  <Text style={styles.qtyText}>{item.quantity}x</Text>
                </View>

                {/* Detalles */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{item.product.name}</Text>
                  {/* Notas de personalización destacadas */}
                  {item.customization_details ? (
                    <View style={styles.noteContainer}>
                      <Ionicons name="alert-circle-outline" size={14} color="#D35400" style={{marginTop: 2, marginRight: 4}}/>
                      <Text style={styles.noteText}>{item.customization_details}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Precio */}
                <Text style={styles.priceText}>${item.price_at_purchase}</Text>
              </View>
            ))}

            {/* Total */}
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total del Pedido</Text>
              <Text style={styles.totalValue}>${order.final_total}</Text>
            </View>
          </View>

          {/* 4. BOTONES DE ACCIÓN */}
          <View style={styles.actionsContainer}>
            {order.status !== 'cancelled' && order.status !== 'delivered' && (
              <TouchableOpacity style={styles.cancelButton} onPress={handleCancelOrder}>
                <Ionicons name="close-circle-outline" size={24} color="#fff" />
                <Text style={styles.cancelButtonText}>Cancelar Pedido</Text>
              </TouchableOpacity>
            )}

            {/* Aquí podrías agregar un botón de "Contactar Soporte" o "Imprimir" en el futuro */}
          </View>

        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: THEME_COLOR },
  headerContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 60, paddingBottom: 20
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  backButton: { padding: 5 },

  whiteCard: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  scrollContent: { padding: 25, paddingBottom: 40 },

  // Estados
  statusSection: { alignItems: 'center', marginBottom: 10 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 8,
    borderRadius: 20, marginBottom: 5
  },
  statusText: { fontWeight: 'bold', fontSize: 16 },
  dateText: { color: '#999', fontSize: 12 },

  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10, marginTop: 5 },

  // Info Cards (Cliente/Repartidor)
  infoCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#eee',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 1
  },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: THEME_LIGHT,
    justifyContent: 'center', alignItems: 'center', marginRight: 12
  },
  infoLabel: { fontSize: 12, color: '#999' },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#333' },

  // Productos
  productsContainer: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 15 },
  productRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 15 },
  qtyBox: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2, marginRight: 10
  },
  qtyText: { fontWeight: 'bold', color: THEME_COLOR },
  productName: { fontSize: 15, color: '#333', fontWeight: '500' },
  priceText: { fontWeight: 'bold', color: '#555', marginLeft: 10 },

  // Notas
  noteContainer: {
    flexDirection: 'row', marginTop: 4, backgroundColor: '#FFF3E0', // Fondo naranja suave para alerta
    padding: 6, borderRadius: 6, alignSelf: 'flex-start'
  },
  noteText: { color: '#D35400', fontSize: 12, fontStyle: 'italic', flexShrink: 1 },

  // Total
  totalContainer: {
    borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15, marginTop: 5,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  totalLabel: { fontSize: 16, fontWeight: 'bold', color: '#555' },
  totalValue: { fontSize: 20, fontWeight: 'bold', color: THEME_COLOR },

  // Botones
  actionsContainer: { marginTop: 30 },
  cancelButton: {
    backgroundColor: DANGER_COLOR, borderRadius: 15, height: 50,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    shadowColor: DANGER_COLOR, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, elevation: 4
  },
  cancelButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 8 },
});

export default CommerceOrderDetailScreen;