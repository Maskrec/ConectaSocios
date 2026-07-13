import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  TouchableOpacity,
  StatusBar,
  ScrollView
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../components/MapShim';
import MapViewDirections from '../components/MapViewDirectionsShim';
import * as Location from 'expo-location';
import apiClient from '../api';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import Alert from '../components/AlertPolyfill';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- PALETA REPARTIDOR (Indigo) ---
const THEME_COLOR = '#5D5FEF';
const SUCCESS_COLOR = '#2ECC71';
const WARNING_COLOR = '#F39C12';

// API Key de Google Maps
const GOOGLE_MAPS_API_KEY = Platform.OS === 'web'
  ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
  : process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_SERVICES;

// Función Haversine (Calcula distancia en metros entre dos coordenadas)
const getDistanceFromLatLonInMeters = (lat1, lon1, lat2, lon2) => {
  var R = 6371; // Radio de la tierra en km
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c * 1000; // Retorna metros
}
const deg2rad = (deg) => deg * (Math.PI / 180);

const DeliveryTrackingScreen = ({ route, navigation }) => {
  const { orderId } = route.params;

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [courierLocation, setCourierLocation] = useState(null);
  const [distanceToTarget, setDistanceToTarget] = useState(null);
  const [sysConfig, setSysConfig] = useState(null);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const mapRef = useRef(null);

  // Estados de filtros de Mercado
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  // Obtener comercios únicos involucrados en el pedido de mercado
  const getUniqueCommerces = (items) => {
    if (!items) return [];
    const unique = {};
    items.forEach(item => {
      const lat = parseFloat(item.commerce_latitude);
      const lon = parseFloat(item.commerce_longitude);
      if (lat && lon && item.commerce_name) {
        const key = `${lat},${lon}`;
        if (!unique[key]) {
          unique[key] = {
            name: item.commerce_name,
            latitude: lat,
            longitude: lon,
            color: item.commerce_color || '#5D5FEF'
          };
        }
      }
    });
    return Object.values(unique);
  };

  // Obtener secciones únicas en la orden
  const getSectionsInOrder = (items) => {
    if (!items) return [];
    const sections = {};
    items.forEach(item => {
      if (item.mercado_section_id) {
        sections[item.mercado_section_id] = item.mercado_section_name || 'Otros';
      }
    });
    return Object.entries(sections).map(([id, name]) => ({ id: parseInt(id), name }));
  };

  // Obtener categorías únicas en la orden
  const getCategoriesInOrder = (items, sectionId) => {
    if (!items) return [];
    const categories = {};
    items.forEach(item => {
      if (item.mercado_category_id && (!sectionId || item.mercado_section_id === sectionId)) {
        categories[item.mercado_category_id] = {
          name: item.mercado_category_name || 'General',
          sectionId: item.mercado_section_id
        };
      }
    });
    return Object.entries(categories).map(([id, cat]) => ({ id: parseInt(id), name: cat.name, sectionId: cat.sectionId }));
  };

  const handleSelectSection = (sectionId) => {
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null);
      setSelectedCategoryId(null);
    } else {
      setSelectedSectionId(sectionId);
      setSelectedCategoryId(null);
    }
  };

  const handleSelectCategory = (categoryId) => {
    if (selectedCategoryId === categoryId) {
      setSelectedCategoryId(null);
    } else {
      setSelectedCategoryId(categoryId);
    }
  };

  // Filtrado de items por sección/categoría
  const filteredItems = order?.items ? order.items.filter(item => {
    if (selectedSectionId && item.mercado_section_id !== selectedSectionId) return false;
    if (selectedCategoryId && item.mercado_category_id !== selectedCategoryId) return false;
    return true;
  }) : [];

  const filteredCommerces = getUniqueCommerces(filteredItems);

  const handleUpdateItemStatus = async (itemId, status) => {
    try {
      await apiClient.post(`/pedidos/items/${itemId}/actualizar-estado/`, { status });
      // Recargar detalles de la orden para actualizar la UI
      fetchOrderDetails();
    } catch (error) {
      Alert.alert("Error", "No se pudo actualizar el estado del producto.");
    }
  };

  // Cola de acciones para el modo fuera de línea
  const queueAction = async (id, actionType) => {
    try {
      const existingQueue = await AsyncStorage.getItem('pending_order_actions');
      const queue = existingQueue ? JSON.parse(existingQueue) : [];
      const alreadyQueued = queue.some(item => item.orderId === id && item.action === actionType);
      if (!alreadyQueued) {
        queue.push({ orderId: id, action: actionType, timestamp: Date.now() });
        await AsyncStorage.setItem('pending_order_actions', JSON.stringify(queue));
      }
    } catch (err) {
      console.error("Error al encolar acción offline:", err);
    }
  };

  const syncPendingActions = async () => {
    try {
      const existingQueue = await AsyncStorage.getItem('pending_order_actions');
      if (!existingQueue) return;
      const queue = JSON.parse(existingQueue);
      if (queue.length === 0) return;

      console.log(`Intentando sincronizar ${queue.length} acciones pendientes...`);
      const remaining = [];

      for (const item of queue) {
        try {
          let endpoint = '';
          if (item.action === 'recolectar') {
            endpoint = `/pedidos/${item.orderId}/recolectar/`;
          } else if (item.action === 'completar') {
            endpoint = `/pedidos/${item.orderId}/completar/`;
          }

          if (endpoint) {
            await apiClient.post(endpoint);
            console.log(`Acción '${item.action}' sincronizada con éxito para pedido #${item.orderId}`);
          }
        } catch (error) {
          if (!error.response) {
            // Error de red (sin internet), retener en cola
            remaining.push(item);
          } else {
            // Error del servidor (ej. ya completado), descartar
            console.log(`Acción '${item.action}' descartada debido a error de servidor:`, error.response.data);
          }
        }
      }

      await AsyncStorage.setItem('pending_order_actions', JSON.stringify(remaining));
    } catch (err) {
      console.error("Error en syncPendingActions:", err);
    }
  };

  // 1. Cargar Detalles del Pedido
  const fetchOrderDetails = async () => {
    try {
      const response = await apiClient.get(`/mis-entregas/${orderId}/`);
      const orderData = response.data;
      setOrder(orderData);
      setIsOfflineMode(false);

      // Guardar en la caché local
      await AsyncStorage.setItem(`active_order_${orderId}`, JSON.stringify(orderData));

      // Cargar configuración del sistema para la comisión
      const configRes = await apiClient.get('/config/');
      setSysConfig(configRes.data);

      // Intentar sincronizar cualquier acción pendiente al recuperar internet
      await syncPendingActions();
    } catch (error) {
      console.log("Error al cargar detalles en línea, intentando usar caché local:", error.message);

      // Intentar cargar desde caché
      try {
        const cached = await AsyncStorage.getItem(`active_order_${orderId}`);
        if (cached) {
          const parsedOrder = JSON.parse(cached);
          setOrder(parsedOrder);
          setIsOfflineMode(true);
          console.log("Datos cargados desde la caché local exitosamente.");
        } else {
          Alert.alert("Error de red", "No tienes conexión a internet y no hay datos guardados para esta entrega.");
          navigation.goBack();
        }
      } catch (cacheError) {
        Alert.alert("Error", "No se pudo cargar la información del pedido.");
        navigation.goBack();
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  // Sincronizar periódicamente cada 15 segundos
  useEffect(() => {
    const syncInterval = setInterval(() => {
      syncPendingActions();
    }, 15000);
    return () => clearInterval(syncInterval);
  }, []);

  // 2. SEGUIMIENTO GPS Y SINCRONIZACIÓN CON EL SERVIDOR
  useEffect(() => {
    let locationSubscription = null;

    const startTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permiso denegado", "Se necesita ubicación para realizar entregas.");
        return;
      }

      // Obtener ubicación inicial de inmediato para dibujar la ruta sin tener que esperar a que el repartidor se mueva
      try {
        const initialLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCourierLocation({
          latitude: initialLoc.coords.latitude,
          longitude: initialLoc.coords.longitude
        });
      } catch (err) {
        console.log("Ubicación rápida no disponible, esperando al GPS...", err);
      }

      // Configuración: Actualiza cada 5 segundos O cada 10 metros
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 10
        },
        async (location) => {
          const { latitude, longitude } = location.coords;

          // A. Actualizar estado local (para mover el carrito en TU pantalla)
          setCourierLocation({ latitude, longitude });

          // B. Actualizar en el Backend (para que el CLIENTE te vea)
          try {
            // Asegúrate de tener esta URL configurada en Django o usa '/perfil/' si guardas ahí la ubicación
            await apiClient.post('/actualizar-ubicacion/', { latitude, longitude });
          } catch (error) {
            // Silenciamos el error para no interrumpir al conductor, pero lo logueamos
            console.log("Error sincronizando ubicación:", error.message);
          }
        }
      );
    };

    startTracking();

    // Limpieza al salir de la pantalla
    return () => { if (locationSubscription) locationSubscription.remove(); };
  }, []);

  // 3. Calcular Distancia en Tiempo Real
  useEffect(() => {
    if (courierLocation && order) {
      let targetLat, targetLon;

      if (order.status === 'accepted') {
        // Fase 1: Ir al comercio
        if (order.is_mercado) {
          const uniqueComms = getUniqueCommerces(order.items);
          const activeComms = filteredCommerces.length > 0 ? filteredCommerces : uniqueComms;
          if (activeComms.length > 0) {
            targetLat = activeComms[0].latitude;
            targetLon = activeComms[0].longitude;
          }
        } else if (order.commerce) {
          targetLat = parseFloat(order.commerce.latitude);
          targetLon = parseFloat(order.commerce.longitude);
        }
      } else if (order.status === 'in_progress') {
        // Fase 2: Ir al cliente / destinatario
        if (order.is_commerce_shipment) {
          targetLat = parseFloat(order.shipment_destination_latitude);
          targetLon = parseFloat(order.shipment_destination_longitude);
        } else {
          targetLat = parseFloat(order.delivery_address.latitude);
          targetLon = parseFloat(order.delivery_address.longitude);
        }
      }

      if (targetLat && targetLon) {
        const dist = getDistanceFromLatLonInMeters(
          courierLocation.latitude, courierLocation.longitude,
          targetLat, targetLon
        );
        setDistanceToTarget(dist);
      }
    }
  }, [courierLocation, order, selectedSectionId, selectedCategoryId]);

  // --- ACCIONES DEL REPARTIDOR ---

  const openNavigationApp = (lat, lon, label) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lon}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });
    Linking.openURL(url);
  };

  const handleNotifyArrival = async () => {
    try {
      await apiClient.post(`/pedidos/${orderId}/notificar-llegada/`);
      Alert.alert("📣 Notificación Enviada", "Se le avisó al cliente que estás afuera.");
    } catch (error) { Alert.alert("Error", "No se pudo enviar la notificación."); }
  };

  const handlePickUp = async () => {
    if (!order.is_mercado && !distanceToTarget) return;

    // Geocerca: Debe estar a menos de x  metros del comercio (Límite ampliado de 10m a 25m)
    if (!order.is_mercado && distanceToTarget > 30) {
      Alert.alert("Aún estás lejos", `Debes estar en el comercio. Estás a ${Math.round(distanceToTarget)}m.`);
      return;
    }

    // Para pedidos del Mercado, validar que todos los productos estén marcados
    if (order.is_mercado) {
      const hasPending = order.items?.some(item => item.purchase_status === 'pending');
      if (hasPending) {
        Alert.alert("Checklist Incompleto", "Por favor marca todos los productos como Conseguido o No Disponible antes de continuar.");
        return;
      }
    }

    if (order.is_commerce_shipment) {
      Alert.alert(
        "📦 Recolección de Paquete",
        `Dirígete al comercio "${order.commerce?.name || 'Comercio'}" y recolecta su paquete.\n\n¿Confirmas que ya tienes el paquete en tus manos y recibiste indicaciones del comercio?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Confirmar Recolección", onPress: confirmPickUp }
        ]
      );
      return;
    }

    // --- CÁLCULO DE PAGOS (El repartidor paga el 100% del subtotal en todos los pedidos) ---
    const subtotal = parseFloat(order.products_total);
    const totalAPagarAlLocal = subtotal;

    // --- VENTANA EMERGENTE DE CONFIRMACIÓN ---
    Alert.alert(
      "💳 Pago al Comercio",
      `Resumen de cuenta:\n\n` +
      `Subtotal productos: $${subtotal.toFixed(2)}\n\n` +
      `PAGAR AL LOCAL: $${totalAPagarAlLocal.toFixed(2)} (PRECIO COMPLETO DEL PRODUCTO)\n\n` +
      `* Nota: Debes pagar el valor total del producto al comercio, sin descontar ninguna comisión de plataforma.\n\n` +
      `¿Confirmas que ya pagaste esta cantidad al comercio?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar Pago y Recolección",
          onPress: confirmPickUp
        }
      ]
    );
  };

  const confirmPickUp = async () => {
    try {
      await apiClient.post(`/pedidos/${orderId}/recolectar/`);
      Alert.alert("✅ Pedido Recolectado", "La comisión se ha cargado a tu cuenta. Dirígete al cliente.");
      fetchOrderDetails(); // Recargar para cambiar a fase de entrega
    } catch (error) {
      if (!error.response) {
        // Error de red (sin conexión)
        try {
          await queueAction(orderId, 'recolectar');
          const localOrder = { ...order, status: 'in_progress' };
          setOrder(localOrder);
          setIsOfflineMode(true);
          await AsyncStorage.setItem(`active_order_${orderId}`, JSON.stringify(localOrder));
          Alert.alert(
            "✈️ Modo Sin Conexión",
            "La recolección se ha registrado localmente. La sincronización se realizará de forma automática en cuanto recuperes señal."
          );
        } catch (cacheErr) {
          console.error("Error al guardar estado de recogida offline:", cacheErr);
        }
      } else {
        Alert.alert("Error", "No se pudo marcar como recolectado. Intenta de nuevo.");
      }
    }
  };

  const handleCompleteDelivery = () => {
    if (!distanceToTarget) return;
    // Geocerca: Debe estar a menos de 25 metros del cliente (Límite ampliado de 10m a 25m)
    if (distanceToTarget > 70) {
      Alert.alert("Aún estás lejos", `Acércate a la ubicación de entrega. Estás a ${Math.round(distanceToTarget)}m.`);
      return;
    }

    if (order.is_commerce_shipment) {
      Alert.alert(
        "💰 Entregar y Cobrar Envío",
        `Total a Cobrar al Destinatario: $${order.final_total}\n\n¿Ya entregaste el paquete y recibiste el pago correspondiente de esta entrega?`,
        [
          { text: "No", style: "cancel" },
          { text: "Sí, Finalizar", onPress: confirmCompletion }
        ]
      );
      return;
    }

    Alert.alert(
      "💰 Finalizar Entrega",
      `Total a Cobrar: $${order.final_total}\n\n¿Ya entregaste el pedido y recibiste el pago?`,
      [
        { text: "No", style: "cancel" },
        { text: "Sí, Finalizar", onPress: confirmCompletion }
      ]
    );
  };

  const confirmCompletion = async () => {
    try {
      await apiClient.post(`/pedidos/${orderId}/completar/`);
      Alert.alert("🎉 ¡Excelente trabajo!", "Entrega finalizada correctamente.");
      navigation.goBack();
    } catch (error) {
      if (!error.response) {
        // Error de red (sin conexión)
        try {
          await queueAction(orderId, 'completar');
          const localOrder = { ...order, status: 'delivered' };
          await AsyncStorage.setItem(`active_order_${orderId}`, JSON.stringify(localOrder));
          Alert.alert(
            "✈️ Modo Sin Conexión",
            "La entrega se ha finalizado localmente. Se sincronizará en el servidor de forma automática cuando recuperes señal.",
            [{ text: "Aceptar", onPress: () => navigation.goBack() }]
          );
        } catch (cacheErr) {
          console.error("Error al guardar estado de entrega offline:", cacheErr);
          Alert.alert("Error", "No se pudo guardar la acción localmente.");
        }
      } else {
        Alert.alert("Error", "Error al finalizar.");
      }
    }
  };

  // --- RENDERIZADO ---

  if (isLoading || !order) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={THEME_COLOR} />
        <Text style={{ marginTop: 10, color: 'gray' }}>Cargando ruta...</Text>
      </View>
    );
  }

  const uniqueCommerces = getUniqueCommerces(order.items);
  const activeCommerces = filteredCommerces.length > 0 ? filteredCommerces : uniqueCommerces;
  const isPickupPhase = order.status === 'accepted';

  // Validar coordenadas antes de pintar mapa
  if (isPickupPhase && !order.is_mercado && (!order.commerce?.latitude || !order.delivery_address?.latitude)) {
    return <View style={styles.loader}><Text>Error: Faltan coordenadas del comercio en el pedido.</Text></View>;
  }
  if (!isPickupPhase && !order.is_commerce_shipment && !order.delivery_address?.latitude) {
    return <View style={styles.loader}><Text>Error: Faltan coordenadas del cliente en el pedido.</Text></View>;
  }
  if (!isPickupPhase && order.is_commerce_shipment && !order.shipment_destination_latitude) {
    return <View style={styles.loader}><Text>Error: Faltan coordenadas del destino del envío.</Text></View>;
  }
  if (isPickupPhase && order.is_mercado && uniqueCommerces.length === 0) {
    return <View style={styles.loader}><Text>Error: No se encontraron tiendas para este pedido de mercado.</Text></View>;
  }

  // Definir destino actual según fase
  const targetLoc = isPickupPhase
    ? (order.is_mercado && activeCommerces.length > 0
      ? { latitude: activeCommerces[0].latitude, longitude: activeCommerces[0].longitude }
      : { latitude: parseFloat(order.commerce.latitude), longitude: parseFloat(order.commerce.longitude) })
    : (order.is_commerce_shipment
      ? { latitude: parseFloat(order.shipment_destination_latitude), longitude: parseFloat(order.shipment_destination_longitude) }
      : { latitude: parseFloat(order.delivery_address.latitude), longitude: parseFloat(order.delivery_address.longitude) });

  const targetName = isPickupPhase
    ? (order.is_mercado ? "Tiendas del Mercado" : order.commerce.name)
    : (order.is_commerce_shipment ? "Destinatario de Comercio" : order.customer_name);

  const targetAddress = isPickupPhase
    ? (order.is_mercado ? `${activeCommerces.length} locales comerciales` : order.commerce.address)
    : (order.is_commerce_shipment ? order.shipment_destination_text : order.delivery_address.address_string);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {isOfflineMode && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={16} color="#B71C1C" style={{ marginRight: 8 }} />
          <Text style={styles.offlineBannerText}>
            Modo Sin Conexión - Sincronizando al recuperar señal
          </Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: targetLoc.latitude,
          longitude: targetLoc.longitude,
          latitudeDelta: 0.015, longitudeDelta: 0.015,
        }}
        showsUserLocation={true}
        followsUserLocation={true}
        provider={PROVIDER_GOOGLE}
        mapPadding={{ bottom: isCollapsed ? 90 : 380, top: 40 }} // Padding para que los elementos UI no tapen el mapa
      >
        {/* Marcadores del Destino */}
        {!isPickupPhase || !order.is_mercado ? (
          <Marker coordinate={targetLoc} title={targetName} description={isPickupPhase ? "Punto de Recolección" : "Punto de Entrega"}>
            <View style={[styles.markerIcon, { backgroundColor: isPickupPhase ? THEME_COLOR : SUCCESS_COLOR }]}>
              <Ionicons name={isPickupPhase ? "storefront" : "home"} size={20} color="#fff" />
            </View>
          </Marker>
        ) : (
          filteredCommerces.map((comm, idx) => (
            <Marker
              key={`comm-marker-${idx}`}
              coordinate={{ latitude: comm.latitude, longitude: comm.longitude }}
              title={comm.name}
              description="Local del Mercado"
            >
              <View style={[styles.markerIcon, { backgroundColor: comm.color }]}>
                <Ionicons name="storefront" size={20} color="#fff" />
              </View>
            </Marker>
          ))
        )}

        {/* Línea de Ruta (Conexión Activa: por calles, Sin Conexión: línea recta) */}
        {Platform.OS !== 'web' && courierLocation && !isNaN(targetLoc.latitude) && !isNaN(targetLoc.longitude) && (
          !isOfflineMode ? (
            <MapViewDirections
              origin={courierLocation}
              destination={targetLoc}
              apikey={GOOGLE_MAPS_API_KEY}
              strokeWidth={4}
              strokeColor={isPickupPhase ? THEME_COLOR : SUCCESS_COLOR}
              optimizeWaypoints={true}
              onError={(errorMessage) => {
                console.log("Error en MapViewDirections, activando línea recta:", errorMessage);
                setIsOfflineMode(true);
              }}
            />
          ) : (
            <Polyline
              coordinates={[courierLocation, targetLoc]}
              strokeColor={isPickupPhase ? THEME_COLOR : SUCCESS_COLOR}
              strokeWidth={4}
              lineDashPattern={[5, 5]}
            />
          )
        )}
      </MapView>

      {/* --- PANEL INFERIOR (BOTTOM SHEET) --- */}
      <View style={[styles.bottomSheet, isCollapsed && styles.bottomSheetCollapsed]}>

        {/* Agarradera visual / Botón Toggle */}
        <TouchableOpacity onPress={() => setIsCollapsed(!isCollapsed)} style={styles.sheetHandleArea} activeOpacity={0.7}>
          <View style={styles.sheetHandle} />
          <Ionicons 
            name={isCollapsed ? "chevron-up" : "chevron-down"} 
            size={18} 
            color="#999" 
            style={{ alignSelf: 'center', marginTop: 2, marginBottom: 2 }} 
          />
        </TouchableOpacity>

        {isCollapsed ? (
          <TouchableOpacity onPress={() => setIsCollapsed(false)} style={styles.collapsedHeader} activeOpacity={0.8}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.phaseLabel}>
                  {isPickupPhase ? "📍 RECOGER EN:" : "🏁 ENTREGAR A:"}
                </Text>
                <Text style={styles.targetName} numberOfLines={1}>{targetName}</Text>
              </View>
              <View style={styles.collapsedExpandBadge}>
                <Text style={styles.collapsedExpandText}>EXPANDIR</Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : (
          <>
            {/* 1. Información del Destino */}
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.phaseLabel}>
                  {isPickupPhase ? "📍 RECOGER EN:" : "🏁 ENTREGAR A:"}
                </Text>
                {isPickupPhase && (order.is_mercado || order.commerce?.is_affiliated === false) && (
                  <View style={{ backgroundColor: '#FDEDEC', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 5 }}>
                    <Text style={{ color: '#E74C3C', fontWeight: 'bold', fontSize: 10 }}>COMPRA DIRECTA (LOCAL NO AFILIADO)</Text>
                  </View>
                )}
                <Text style={styles.targetName} numberOfLines={1}>{targetName}</Text>
                <Text style={styles.addressText} numberOfLines={2}>{targetAddress}</Text>
              </View>

              {/* Botón Navegar (Waze/Maps) */}
              <TouchableOpacity
                style={styles.navButton}
                onPress={() => openNavigationApp(targetLoc.latitude, targetLoc.longitude, targetName)}
              >
                <Ionicons name="navigate-circle" size={50} color={THEME_COLOR} />
              </TouchableOpacity>
            </View>

            {/* Datos del Cliente */}
            {!order.is_commerce_shipment && (
              <View style={styles.clientDetailsContainer}>
                <View style={styles.clientDetailsRow}>
                  <Ionicons name="person-circle-outline" size={20} color={THEME_COLOR} style={{ marginRight: 6 }} />
                  <Text style={styles.clientNameText} numberOfLines={1}>
                    <Text style={{ fontWeight: 'bold', color: '#555' }}>Cliente: </Text>
                    {order.customer_real_name || order.customer_name || 'Cliente'}
                  </Text>
                  <Text style={styles.clientUsernameText} numberOfLines={1}>
                    (@{order.customer_username || order.customer_name})
                  </Text>
                </View>
                {order.customer_phone && (
                  <View style={styles.clientPhoneRow}>
                    <Ionicons name="phone-portrait-outline" size={14} color="#666" style={{ marginRight: 6 }} />
                    <Text style={styles.clientPhoneText}>
                      <Text style={{ fontWeight: 'bold', color: '#555' }}>Teléfono: </Text>
                      {order.customer_phone}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.divider} />

        {/* 2. Estadísticas y Herramientas */}
        <View style={styles.statsRow}>
          {/* Badge Distancia */}
          <View style={styles.distBadge}>
            <Ionicons name="location-sharp" size={16} color="#555" />
            <Text style={styles.distText}>
              {distanceToTarget
                ? (distanceToTarget > 1000 ? `${(distanceToTarget / 1000).toFixed(1)} km` : `${Math.round(distanceToTarget)} m`)
                : 'Calculando...'}
            </Text>
          </View>

          {/* Botones Secundarios */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Botón Avisar Llegada (Solo en entrega) */}
            {!isPickupPhase && (
              <TouchableOpacity style={[styles.secondaryBtn, { backgroundColor: '#FFF3E0' }]} onPress={handleNotifyArrival}>
                <Ionicons name="notifications" size={20} color={WARNING_COLOR} />
                <Text style={[styles.secondaryBtnText, { color: WARNING_COLOR }]}>Ya llegué</Text>
              </TouchableOpacity>
            )}
            {/* Botón Llamar */}
            <TouchableOpacity
              style={[styles.secondaryBtn, { backgroundColor: '#F5F5F5' }]}
              onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}
            >
              <Ionicons name="call" size={20} color="#333" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filtros en Cascada (Fase de Recogida - Mercado) */}
        {order.is_mercado && isPickupPhase && (
          <View style={styles.filterContainer}>
            <Text style={styles.filterTitle}>Filtrar por Sección/Categoría:</Text>

            {/* Fila de Secciones */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, !selectedSectionId && styles.filterChipActive]}
                onPress={() => handleSelectSection(null)}
              >
                <Text style={[styles.filterChipText, !selectedSectionId && styles.filterChipTextActive]}>Todas</Text>
              </TouchableOpacity>
              {getSectionsInOrder(order.items).map((section) => (
                <TouchableOpacity
                  key={`sec-${section.id}`}
                  style={[styles.filterChip, selectedSectionId === section.id && styles.filterChipActive]}
                  onPress={() => handleSelectSection(section.id)}
                >
                  <Text style={[styles.filterChipText, selectedSectionId === section.id && styles.filterChipTextActive]}>
                    {section.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Fila de Categorías (Sólo si hay una sección seleccionada) */}
            {selectedSectionId && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterRow, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={[styles.subFilterChip, !selectedCategoryId && styles.subFilterChipActive]}
                  onPress={() => handleSelectCategory(null)}
                >
                  <Text style={[styles.subFilterChipText, !selectedCategoryId && styles.subFilterChipTextActive]}>
                    Todo {getSectionsInOrder(order.items).find(s => s.id === selectedSectionId)?.name}
                  </Text>
                </TouchableOpacity>
                {getCategoriesInOrder(order.items, selectedSectionId).map((cat) => (
                  <TouchableOpacity
                    key={`cat-${cat.id}`}
                    style={[styles.subFilterChip, selectedCategoryId === cat.id && styles.subFilterChipActive]}
                    onPress={() => handleSelectCategory(cat.id)}
                  >
                    <Text style={[styles.subFilterChipText, selectedCategoryId === cat.id && styles.subFilterChipTextActive]}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* Checklist del Repartidor para Pedidos de Mercado en recogida */}
        {order.is_mercado && isPickupPhase && (
          <View style={styles.checklistContainer}>
            <Text style={styles.checklistTitle}>Lista de Compras del Mercado ({filteredItems.length} items):</Text>
            <ScrollView style={styles.checklistScroll} nestedScrollEnabled={true}>
              {filteredItems.map((item) => {
                const isPurchased = item.purchase_status === 'purchased';
                const isUnavailable = item.purchase_status === 'unavailable';

                return (
                  <View key={item.id} style={styles.checklistItem}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.product_name}</Text>
                      <View style={styles.itemMetaRow}>
                        <View style={[styles.commBadge, { backgroundColor: item.commerce_color || '#5D5FEF' }]}>
                          <Text style={styles.commBadgeText}>{item.commerce_name || 'Mercado'}</Text>
                        </View>
                        <Text style={styles.itemQty}>
                          Cant: {item.weight_purchased ? `${item.weight_purchased} kg` : item.quantity}
                        </Text>
                      </View>

                      {/* Directiva de Guiado en español */}
                      <Text style={styles.itemInstruction}>
                        👉 Ve al mostrador de <Text style={{ fontWeight: 'bold' }}>{item.commerce_name || 'Mercado'}</Text> y solicita <Text style={{ fontWeight: 'bold' }}>{item.quantity} {item.product?.unit_type && item.product.unit_type !== 'unit' ? (item.product.unit_type === 'kg' ? 'kilo(s)' : item.product.unit_type === 'liter' ? 'litro(s)' : item.product.unit_type) : 'pza(s)'}</Text> de <Text style={{ fontWeight: 'bold' }}>{item.product_name}</Text>.
                      </Text>
                    </View>

                    <View style={styles.itemActions}>
                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          styles.checkBtn,
                          isPurchased && styles.checkBtnActive
                        ]}
                        onPress={() => handleUpdateItemStatus(item.id, isPurchased ? 'pending' : 'purchased')}
                      >
                        <Ionicons
                          name={isPurchased ? "checkmark-circle" : "checkmark-circle-outline"}
                          size={22}
                          color={isPurchased ? "#fff" : "#2ECC71"}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.actionBtn,
                          styles.closeBtn,
                          isUnavailable && styles.closeBtnActive
                        ]}
                        onPress={() => handleUpdateItemStatus(item.id, isUnavailable ? 'pending' : 'unavailable')}
                      >
                        <Ionicons
                          name={isUnavailable ? "close" : "close-circle-outline"}
                          size={22}
                          color={isUnavailable ? "#fff" : "#E74C3C"}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 3. Detalle de Productos (Para pedidos normales, o en fase de entrega para todos) */}
        {(!order.is_mercado || !isPickupPhase) && (
          <View style={styles.productsContainer}>
            <Text style={styles.productsTitle}>
              {order.is_commerce_shipment ? "Paquete / Detalles del Envío:" : "Productos a entregar:"}
            </Text>
            <ScrollView style={styles.productsScroll} nestedScrollEnabled={true}>
              {order.is_commerce_shipment ? (
                <View style={styles.productItem}>
                  <View style={styles.productMainInfo}>
                    <Ionicons name="cube-outline" size={20} color={THEME_COLOR} style={{ marginRight: 10 }} />
                    <View style={styles.productTextContainer}>
                      <Text style={styles.productNameText}>{order.special_instructions || "Envío de Paquete"}</Text>
                      <Text style={styles.productVariantText}>Indicaciones especiales del comercio</Text>
                    </View>
                  </View>
                </View>
              ) : (
                order.items && order.items.map((item) => (
                  <View key={item.id} style={styles.productItem}>
                    <View style={styles.productMainInfo}>
                      <Text style={styles.productQtyText}>
                        {item.weight_purchased ? `${item.weight_purchased} kg` : `${parseInt(item.quantity)} pza(s)`}
                      </Text>
                      <View style={styles.productTextContainer}>
                        <Text style={styles.productNameText}>{item.product_name}</Text>
                        {item.selected_variant_name && (
                          <Text style={styles.productVariantText}>Var: {item.selected_variant_name}</Text>
                        )}
                        {item.selected_modifiers_json && item.selected_modifiers_json.length > 0 && (
                          <Text style={styles.productModifiersText}>
                            Mod: {item.selected_modifiers_json.map(m => m.name).join(', ')}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.productPriceText}>${parseFloat(item.price_at_purchase || 0).toFixed(2)}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        )}

        {/* 4. Botón de Acción Principal (Gigante) */}
        <View style={styles.actionArea}>
          {isPickupPhase ? (
            <TouchableOpacity
              style={[
                styles.mainButton,
                { backgroundColor: THEME_COLOR },
                (order.is_mercado && order.items?.some(item => item.purchase_status === 'pending')) && styles.disabledButton
              ]}
              onPress={handlePickUp}
              activeOpacity={0.8}
              disabled={order.is_mercado && order.items?.some(item => item.purchase_status === 'pending')}
            >
              <Text style={styles.mainButtonText}>MARCAR RECOLECTADO</Text>
              {order.is_mercado && order.items?.some(item => item.purchase_status === 'pending') ? (
                <Text style={styles.geofenceText}>Registra todos los productos primero</Text>
              ) : (
                (!distanceToTarget || distanceToTarget > 25) && !order.is_mercado && (
                  <Text style={styles.geofenceText}>Acércate al local para activar (rango 25m)</Text>
                )
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.mainButton, { backgroundColor: SUCCESS_COLOR }]}
              onPress={handleCompleteDelivery}
              activeOpacity={0.8}
            >
              <Text style={styles.mainButtonText}>COMPLETAR ENTREGA</Text>
              <View style={styles.totalCollectBadge}>
                <Text style={styles.totalCollectText}>Cobrar: ${order.final_total}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },

  markerIcon: {
    padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOpacity: 0.3
  },

  // --- ESTILOS DEL BOTTOM SHEET ---
  bottomSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 25, borderTopRightRadius: 25,
    paddingHorizontal: 25, paddingBottom: Platform.OS === 'ios' ? 40 : 65, paddingTop: 12,
    elevation: 20, shadowColor: '#000', shadowOffset: { height: -4 }, shadowOpacity: 0.1, shadowRadius: 10
  },
  bottomSheetCollapsed: {
    paddingBottom: Platform.OS === 'ios' ? 25 : 30,
  },
  sheetHandleArea: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 2,
    marginBottom: 5,
  },
  sheetHandle: {
    width: 40, height: 5, backgroundColor: '#E0E0E0', borderRadius: 3,
  },
  collapsedHeader: {
    paddingVertical: 10,
  },
  collapsedExpandBadge: {
    backgroundColor: '#F0F0F8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  collapsedExpandText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: THEME_COLOR,
  },
  clientDetailsContainer: {
    marginTop: 10,
    backgroundColor: '#F8F9FA',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ECEFF1',
  },
  clientDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clientNameText: {
    fontSize: 14,
    color: '#333',
    marginRight: 6,
  },
  clientUsernameText: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  clientPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  clientPhoneText: {
    fontSize: 13,
    color: '#555',
  },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  phaseLabel: { fontSize: 12, fontWeight: '900', color: '#999', letterSpacing: 1, marginBottom: 4 },
  targetName: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 2, marginRight: 10 },
  addressText: { fontSize: 15, color: '#666', lineHeight: 20 },
  navButton: { paddingLeft: 5 },

  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 15 },

  // Stats y Botones Secundarios
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  distBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10
  },
  distText: { fontWeight: 'bold', color: '#333', marginLeft: 6, fontSize: 14 },

  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, marginLeft: 8
  },
  secondaryBtnText: { fontWeight: 'bold', fontSize: 12, marginLeft: 6 },

  // Botón Principal
  actionArea: { marginTop: 5 },
  mainButton: {
    height: 70, borderRadius: 18, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, elevation: 5
  },
  mainButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18, letterSpacing: 0.5 },
  geofenceText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

  totalCollectBadge: {
    marginTop: 4, backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 6
  },
  totalCollectText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

  // Checklist Styles
  checklistContainer: {
    marginTop: 5,
    marginBottom: 15,
  },
  checklistTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  checklistScroll: {
    maxHeight: 180,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
  },
  commBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  itemQty: {
    fontSize: 12,
    color: '#666',
  },
  itemActions: {
    flexDirection: 'row',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginLeft: 8,
  },
  checkBtn: {
    borderColor: '#2ECC71',
  },
  checkBtnActive: {
    backgroundColor: '#2ECC71',
    borderColor: '#2ECC71',
  },
  closeBtn: {
    borderColor: '#E74C3C',
  },
  closeBtnActive: {
    backgroundColor: '#E74C3C',
    borderColor: '#E74C3C',
  },
  disabledButton: {
    backgroundColor: '#BDC3C7',
  },
  filterContainer: {
    marginTop: 5,
    marginBottom: 10,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  filterChip: {
    backgroundColor: '#F0F0F8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E2F0',
  },
  filterChipActive: {
    backgroundColor: THEME_COLOR,
    borderColor: THEME_COLOR,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  subFilterChip: {
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#FFD3D3',
  },
  subFilterChipActive: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  subFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E74C3C',
  },
  subFilterChipTextActive: {
    color: '#fff',
  },
  itemInstruction: {
    fontSize: 12,
    color: '#D35400',
    fontStyle: 'italic',
    marginTop: 6,
    backgroundColor: '#FDF6ED',
    padding: 6,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#F39C12',
  },
  productsContainer: {
    marginTop: 5,
    marginBottom: 15,
  },
  productsTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  productsScroll: {
    maxHeight: 120,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9F9F9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  productMainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  productQtyText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: THEME_COLOR,
    marginRight: 10,
    backgroundColor: '#F0F0F8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  productTextContainer: {
    flex: 1,
  },
  productNameText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  productVariantText: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  productModifiersText: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  productPriceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  offlineBanner: {
    backgroundColor: '#FFF3E0',
    paddingVertical: 10,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE0B2',
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 10,
    right: 10,
    zIndex: 1000,
    borderRadius: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  offlineBannerText: {
    color: '#E65100',
    fontWeight: 'bold',
    fontSize: 12,
  },
});

export default DeliveryTrackingScreen;