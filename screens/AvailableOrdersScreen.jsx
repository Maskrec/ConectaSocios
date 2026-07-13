import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Modal,
  ScrollView
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext'; // <--- IMPORTANTE: Para obtener la deuda del usuario
import apiClient from '../api';
import { Ionicons } from '@expo/vector-icons';
import Alert from '../components/AlertPolyfill';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/MapShim';

// --- PALETA REPARTIDOR (Indigo) ---
const THEME_COLOR = '#5D5FEF';
const PENDING_COLOR = '#F39C12';
const DANGER_COLOR = '#E74C3C'; // Rojo para bloqueo

const AvailableOrdersScreen = () => {
  const { user, setUser } = useAuth(); // <--- Obtenemos al usuario y la función para actualizarlo
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [acceptingOrderId, setAcceptingOrderId] = useState(null); // Track orden siendo aceptada
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const navigation = useNavigation();

  const handleOpenDetails = (order) => {
    setSelectedOrder(order);
    setIsModalVisible(true);
  };

  const handleCloseDetails = () => {
    setSelectedOrder(null);
    setIsModalVisible(false);
  };

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
    const isDirectPurchase = item.is_affiliated === false;
    const isMercadoOrder = item.is_mercado === true;
    const isCommerceShipment = item.is_commerce_shipment === true;

    if (isCommerceShipment) {
      return (
        <TouchableOpacity 
          style={[styles.card, { borderLeftColor: '#2980B9' }]}
          onPress={() => handleOpenDetails(item)}
          activeOpacity={0.9}
        >
          <View style={styles.cardHeader}>
            <View style={styles.commerceInfo}>
               <Ionicons name="cube-outline" size={18} color="#2980B9" style={{marginRight: 8}}/>
               <Text style={styles.commerceName}>{item.commerce_name} (Envío)</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: '#EBF5FB' }]}>
               <Text style={{color: '#2980B9', fontWeight: 'bold', fontSize: 11}}>
                  📦 ENVÍO DE COMERCIO
               </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.cardBody}>
              <View style={[styles.row, { marginBottom: 6 }]}>
                  <Ionicons name="storefront" size={16} color="#666" style={{ marginRight: 6 }} />
                  <Text style={styles.addressText} numberOfLines={2}>
                    <Text style={{ fontWeight: 'bold' }}>Origen: </Text>{item.commerce_address}
                  </Text>
              </View>
              <View style={[styles.row, { marginBottom: 6 }]}>
                  <Ionicons name="location" size={16} color="#E74C3C" style={{ marginRight: 6 }} />
                  <Text style={styles.addressText} numberOfLines={2}>
                    <Text style={{ fontWeight: 'bold' }}>Destino: </Text>{item.shipment_destination_text}
                  </Text>
              </View>
              <View style={styles.row}>
                  <Ionicons name="cash-outline" size={16} color="green" />
                  <Text style={styles.totalText}>Cobrar al entregar: <Text style={{fontWeight: 'bold', color: 'green'}}>${item.final_total}</Text></Text>
              </View>
          </View>

          <TouchableOpacity
              style={[
                styles.acceptButton, 
                { 
                  backgroundColor: '#2980B9',
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
                  <Text style={styles.acceptButtonText}>
                    ACEPTAR ENVÍO DE COMERCIO
                  </Text>
                  <Ionicons name="arrow-forward-circle" size={24} color="#fff" style={{marginLeft: 10}} />
                </>
              )}
          </TouchableOpacity>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => handleOpenDetails(item)}
        activeOpacity={0.9}
      >
        <View style={styles.cardHeader}>
          <View style={styles.commerceInfo}>
             <Ionicons name="storefront" size={18} color={isMercadoOrder ? '#8E44AD' : THEME_COLOR} style={{marginRight: 8}}/>
             <Text style={styles.commerceName}>{isMercadoOrder ? 'Pedido Multi-Mercado' : item.commerce_name}</Text>
          </View>
          <View style={[
            styles.statusBadge, 
            { 
              backgroundColor: isMercadoOrder ? '#F5EEF8' : (isDirectPurchase ? '#FDEDEC' : (isPendingAtCommerce ? '#FFF3E0' : '#E8F8F5')) 
            }
          ]}>
             <Text style={{
               color: isMercadoOrder ? '#8E44AD' : (isDirectPurchase ? '#E74C3C' : (isPendingAtCommerce ? PENDING_COLOR : '#1ABC9C')), 
               fontWeight: 'bold', 
               fontSize: 11
             }}>
                {isMercadoOrder ? '🛒 MULTI-MERCADO' : (isDirectPurchase ? '🔴 COMPRA DIRECTA' : (isPendingAtCommerce ? '⏳ ESPERANDO' : '👨‍🍳 COCINANDO'))}
             </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardBody}>
            <View style={styles.row}>
                <Ionicons name="location-outline" size={16} color="#666" />
                <Text style={styles.addressText} numberOfLines={2}>
                  {isMercadoOrder ? 'Múltiples establecimientos en el Mercado' : item.commerce_address}
                </Text>
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
                backgroundColor: isMercadoOrder ? '#8E44AD' : (isDirectPurchase ? '#E74C3C' : (isPendingAtCommerce ? PENDING_COLOR : THEME_COLOR)),
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
                <Text style={styles.acceptButtonText}>
                  {isMercadoOrder ? 'ACEPTAR COMPRA EN MERCADO' : (isDirectPurchase ? 'ACEPTAR COMPRA DIRECTA' : (isPendingAtCommerce ? 'ACEPTAR Y AVISAR AL LOCAL' : 'ACEPTAR VIAJE'))}
                </Text>
                <Ionicons name="arrow-forward-circle" size={24} color="#fff" style={{marginLeft: 10}} />
              </>
            )}
        </TouchableOpacity>
      </TouchableOpacity>
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

      {/* VENTANA EMERGENTE (MODAL) DE DETALLES */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseDetails}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {/* Cabecera */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Pedido #{selectedOrder?.id}</Text>
              <TouchableOpacity onPress={handleCloseDetails}>
                <Ionicons name="close-circle" size={28} color="#999" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Ubicación de Entrega */}
              <Text style={styles.modalSectionTitle}>📍 Dirección de Entrega</Text>
              <Text style={styles.modalAddressText}>
                {selectedOrder?.is_commerce_shipment 
                  ? selectedOrder.shipment_destination_text 
                  : (selectedOrder?.delivery_address?.address_string || 'Dirección no especificada')}
              </Text>

              {/* Mapa de Entrega */}
              {selectedOrder && (
                <View style={styles.mapContainer}>
                  <MapView
                    style={styles.modalMap}
                    initialRegion={{
                      latitude: parseFloat(selectedOrder.is_commerce_shipment 
                        ? selectedOrder.shipment_destination_latitude 
                        : (selectedOrder.delivery_address?.latitude || selectedOrder.commerce_latitude || 0)),
                      longitude: parseFloat(selectedOrder.is_commerce_shipment 
                        ? selectedOrder.shipment_destination_longitude 
                        : (selectedOrder.delivery_address?.longitude || selectedOrder.commerce_longitude || 0)),
                      latitudeDelta: 0.02,
                      longitudeDelta: 0.02,
                    }}
                    provider={PROVIDER_GOOGLE}
                  >
                    {/* Origen (Recolección) */}
                    {!selectedOrder.is_mercado && selectedOrder.commerce_latitude && (
                      <Marker
                        coordinate={{
                          latitude: parseFloat(selectedOrder.commerce_latitude),
                          longitude: parseFloat(selectedOrder.commerce_longitude),
                        }}
                        title="Origen (Recolección)"
                        pinColor="#5D5FEF"
                      />
                    )}

                    {/* Destino (Entrega) */}
                    <Marker
                      coordinate={{
                        latitude: parseFloat(selectedOrder.is_commerce_shipment 
                          ? selectedOrder.shipment_destination_latitude 
                          : (selectedOrder.delivery_address?.latitude || 0)),
                        longitude: parseFloat(selectedOrder.is_commerce_shipment 
                          ? selectedOrder.shipment_destination_longitude 
                          : (selectedOrder.delivery_address?.longitude || 0)),
                      }}
                      title="Destino (Entrega)"
                      pinColor="#E74C3C"
                    />
                  </MapView>
                </View>
              )}

              <View style={styles.modalDivider} />

              {/* Lista de Productos */}
              <Text style={styles.modalSectionTitle}>📦 Productos en el Pedido</Text>
              {selectedOrder?.is_commerce_shipment ? (
                <View style={styles.modalSpecialShipmentBox}>
                  <Ionicons name="cube-outline" size={24} color="#2980B9" style={{ marginRight: 10 }} />
                  <Text style={styles.modalSpecialShipmentText}>
                    {selectedOrder.special_instructions || "Envío especial de paquete"}
                  </Text>
                </View>
              ) : (
                selectedOrder?.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((prod, idx) => (
                    <View key={`modal-item-${idx}`} style={styles.modalItemRow}>
                      <Text style={styles.modalItemQty}>
                        {prod.weight_purchased ? `${prod.weight_purchased} kg` : `${parseInt(prod.quantity)} pza(s)`}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.modalItemName}>{prod.product_name}</Text>
                        {prod.selected_variant_name && (
                          <Text style={styles.modalItemMeta}>Var: {prod.selected_variant_name}</Text>
                        )}
                        {prod.selected_modifiers_json && prod.selected_modifiers_json.length > 0 && (
                          <Text style={styles.modalItemMeta}>
                            Mod: {prod.selected_modifiers_json.map(m => m.name).join(', ')}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.modalItemPrice}>${parseFloat(prod.price_at_purchase || 0).toFixed(2)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ fontStyle: 'italic', color: '#999', paddingVertical: 10 }}>
                    Sin productos especificados.
                  </Text>
                )
              )}
            </ScrollView>

            {/* Botón Aceptar desde Detalles */}
            {selectedOrder && (
              <TouchableOpacity
                style={[
                  styles.modalAcceptBtn,
                  {
                    backgroundColor: selectedOrder.is_commerce_shipment 
                      ? '#2980B9' 
                      : (selectedOrder.is_mercado ? '#8E44AD' : THEME_COLOR),
                    opacity: acceptingOrderId === selectedOrder.id ? 0.6 : 1
                  }
                ]}
                onPress={() => {
                  const id = selectedOrder.id;
                  handleCloseDetails();
                  handleAcceptOrder(id);
                }}
                disabled={acceptingOrderId !== null}
              >
                <Text style={styles.modalAcceptBtnText}>ACEPTAR VIAJE</Text>
                <Ionicons name="arrow-forward-circle" size={24} color="#fff" style={{ marginLeft: 10 }} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
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
  profileButtonText: { color: 'white', fontWeight: 'bold' },

  // Estilos de Ventana Emergente (Modal)
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 35,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalScroll: {
    marginBottom: 20,
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#555',
    marginTop: 12,
    marginBottom: 6,
  },
  modalAddressText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 10,
  },
  mapContainer: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: '#eee',
  },
  modalMap: {
    flex: 1,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 15,
  },
  modalSpecialShipmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF5FB',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#AED6F1',
  },
  modalSpecialShipmentText: {
    flex: 1,
    color: '#2980B9',
    fontSize: 14,
    fontWeight: '600',
  },
  modalItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f9f9f9',
  },
  modalItemQty: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME_COLOR,
    marginRight: 10,
    minWidth: 40,
  },
  modalItemName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  modalItemMeta: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  modalItemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 10,
  },
  modalAcceptBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    elevation: 2,
  },
  modalAcceptBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default AvailableOrdersScreen;