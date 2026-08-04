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
  ActivityIndicator,
  Modal,
  TextInput
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

  const [isPrepTimeModalVisible, setIsPrepTimeModalVisible] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [customPrepTime, setCustomPrepTime] = useState('15');

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const [pendingRes, progressRes] = await Promise.all([
        apiClient.get('/mis-pedidos-comercio/'), // Pedidos nuevos (pending)
        apiClient.get('/pedidos-en-preparacion/') // Aceptados/Cocinando (in_progress)
      ]);
      
      const pendingData = Array.isArray(pendingRes.data) ? pendingRes.data : (pendingRes.data.results || []);
      const progressData = Array.isArray(progressRes.data) ? progressRes.data : (progressRes.data.results || []);
      
      setPendingOrders(pendingData);
      setInProgressOrders(progressData);
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

  const handleConfirmOrder = (orderId) => {
    setSelectedOrderId(orderId);
    setCustomPrepTime('15'); // default
    setIsPrepTimeModalVisible(true);
  };

  const submitConfirmOrder = async () => {
    if (!selectedOrderId) return;
    const timeNum = parseInt(customPrepTime);
    if (isNaN(timeNum) || timeNum <= 0) {
      Alert.alert("Error", "Por favor ingresa un tiempo válido en minutos.");
      return;
    }
    setIsPrepTimeModalVisible(false);
    try {
      await apiClient.post(`/pedidos/${selectedOrderId}/confirmar/`, {
        preparation_time_minutes: timeNum
      });
      Alert.alert("¡Pedido Aceptado! 👨‍🍳", "Se ha notificado al repartidor.");
      fetchOrders();
    } catch (error) {
      Alert.alert("Error", "No se pudo confirmar el pedido.");
    }
  };

  // --- RENDERIZADOR DE TARJETA ---
  const renderOrderCard = (item, isPending) => {
    const hasCourier = !!item.courier_name;
    const customerRealName = item.customer_real_name || item.customer_name || 'Cliente';
    const customerUsername = item.customer_username || item.customer_name;
    const customerPhone = item.customer_phone;

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

        {/* Información del Cliente */}
        <View style={styles.customerBox}>
          <View style={styles.customerRow}>
            <Ionicons name="person-circle-outline" size={18} color={THEME_COLOR} style={{marginRight: 6}} />
            <Text style={styles.customerName} numberOfLines={1}>
              {customerRealName}
              {customerUsername ? <Text style={styles.customerUser}> (@{customerUsername})</Text> : null}
            </Text>
          </View>
          {customerPhone ? (
            <View style={[styles.customerRow, { marginTop: 3 }]}>
              <Ionicons name="call-outline" size={14} color="#666" style={{marginRight: 6}} />
              <Text style={styles.customerPhone}>{customerPhone}</Text>
            </View>
          ) : null}
        </View>

        {/* Lista de Productos (Comanda rápida) */}
        {item.items && item.items.length > 0 && (
          <View style={styles.productsBox}>
            {item.items.map((prod, idx) => {
              const pName = prod.product ? prod.product.name : (prod.product_name || "Producto");
              return (
                <View key={`card-prod-${idx}`} style={styles.prodRow}>
                  <Text style={styles.prodQty}>
                    {prod.weight_purchased ? `${prod.weight_purchased} kg` : `${parseInt(prod.quantity || 1)}x`}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.prodName}>{pName}</Text>
                    {prod.selected_variant_name ? (
                      <Text style={styles.prodMeta}>Var: {prod.selected_variant_name}</Text>
                    ) : null}
                    {prod.selected_modifiers_json && prod.selected_modifiers_json.length > 0 ? (
                      <Text style={styles.prodMeta}>
                        Extras: {prod.selected_modifiers_json.map(m => m.name).join(', ')}
                      </Text>
                    ) : null}
                    {prod.customization_details ? (
                      <View style={styles.noteTag}>
                        <Ionicons name="chatbox-ellipses-outline" size={12} color="#D35400" style={{marginRight: 3}} />
                        <Text style={styles.noteTagText}>{prod.customization_details}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Indicaciones generales del pedido si existen */}
        {item.special_instructions ? (
          <View style={styles.specialInstBox}>
            <Ionicons name="information-circle-outline" size={14} color="#D35400" style={{marginRight: 4}} />
            <Text style={styles.specialInstText}>Nota general: {item.special_instructions}</Text>
          </View>
        ) : null}

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
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Gestión de Pedidos</Text>
          <Text style={styles.headerSubtitle}>
            {pendingOrders.length > 0 ? `Tienes ${pendingOrders.length} por confirmar` : "Todo al día"}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.requestShipmentBtn}
          onPress={() => navigation.navigate('RequestShipment')}
          activeOpacity={0.8}
        >
          <Ionicons name="paper-plane" size={14} color={THEME_COLOR} />
          <Text style={styles.requestShipmentBtnText}>Solicitar Envío</Text>
        </TouchableOpacity>
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

      {/* Modal para ingresar tiempo de preparación */}
      <Modal
        visible={isPrepTimeModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsPrepTimeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tiempo de Preparación</Text>
            <Text style={styles.modalSubtitle}>¿En cuántos minutos estará listo el pedido?</Text>

            {/* Opciones rápidas */}
            <View style={styles.quickTimeGrid}>
              {['10', '15', '20', '30', '40', '50'].map((time) => (
                <TouchableOpacity
                  key={`quick-${time}`}
                  style={[
                    styles.quickTimeButton,
                    customPrepTime === time && styles.quickTimeButtonSelected
                  ]}
                  onPress={() => setCustomPrepTime(time)}
                >
                  <Text
                    style={[
                      styles.quickTimeText,
                      customPrepTime === time && styles.quickTimeTextSelected
                    ]}
                  >
                    {time} min
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Input personalizado */}
            <View style={styles.customInputContainer}>
              <Text style={styles.customInputLabel}>Otro tiempo (minutos):</Text>
              <TextInput
                style={styles.customTextInput}
                keyboardType="number-pad"
                value={customPrepTime}
                onChangeText={setCustomPrepTime}
                maxLength={3}
              />
            </View>

            {/* Botones de acción */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelBtn]}
                onPress={() => setIsPrepTimeModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmBtn]}
                onPress={submitConfirmOrder}
              >
                <Text style={styles.confirmBtnText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: THEME_COLOR },

  // Header Pantalla
  headerContainer: {
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 60, paddingBottom: 25,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 5 },

  requestShipmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  requestShipmentBtnText: {
    color: THEME_COLOR,
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 6,
  },

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

  // Cliente info
  customerBox: {
    backgroundColor: THEME_LIGHT,
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME_DARK_TEXT,
    flex: 1,
  },
  customerUser: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#666',
  },
  customerPhone: {
    fontSize: 12,
    color: '#444',
    fontWeight: '500',
  },

  // Productos (Comanda)
  productsBox: {
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  prodRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  prodQty: {
    fontSize: 13,
    fontWeight: 'bold',
    color: THEME_COLOR,
    width: 38,
  },
  prodName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  prodMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 1,
  },
  noteTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  noteTagText: {
    fontSize: 11,
    color: '#D35400',
    fontStyle: 'italic',
  },
  specialInstBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FDF2E9',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F5CBA7',
  },
  specialInstText: {
    fontSize: 12,
    color: '#A04000',
    fontWeight: 'bold',
    flex: 1,
  },

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

  // Estilos del Modal de Tiempo de Preparación
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 }
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20
  },
  quickTimeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15
  },
  quickTimeButton: {
    width: '30%',
    backgroundColor: '#F2F4F4',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E8E8'
  },
  quickTimeButtonSelected: {
    backgroundColor: THEME_LIGHT,
    borderColor: THEME_COLOR
  },
  quickTimeText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '600'
  },
  quickTimeTextSelected: {
    color: THEME_DARK_TEXT
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 25,
    backgroundColor: '#F8F9F9',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E8E8'
  },
  customInputLabel: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500'
  },
  customTextInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#BDC3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    width: 60,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelBtn: {
    backgroundColor: '#BDC3C7',
    marginRight: 10
  },
  cancelBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14
  },
  confirmBtn: {
    backgroundColor: THEME_COLOR
  },
  confirmBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14
  },
});

export default CommerceOrdersScreen;