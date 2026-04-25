import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
  TouchableOpacity,
  StatusBar
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/MapShim';
import MapViewDirections from '../components/MapViewDirectionsShim';
import * as Location from 'expo-location';
import apiClient from '../api';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import Alert from '../components/AlertPolyfill';

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
  var dLat = deg2rad(lat2-lat1);
  var dLon = deg2rad(lon2-lon1);
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000; // Retorna metros
}
const deg2rad = (deg) => deg * (Math.PI/180);

const DeliveryTrackingScreen = ({ route, navigation }) => {
  const { orderId } = route.params;

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [courierLocation, setCourierLocation] = useState(null);
  const [distanceToTarget, setDistanceToTarget] = useState(null);
  const [sysConfig, setSysConfig] = useState(null);
  const mapRef = useRef(null);

  // 1. Cargar Detalles del Pedido
  const fetchOrderDetails = async () => {
    try {
      const response = await apiClient.get(`/mis-entregas/${orderId}/`);
      setOrder(response.data);
      
      // Cargar configuración del sistema para la comisión
      const configRes = await apiClient.get('/config/');
      setSysConfig(configRes.data);
    } catch (error) {
      Alert.alert("Error", "No se pudo cargar la información del pedido.");
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchOrderDetails(); }, [orderId]);

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
        targetLat = parseFloat(order.commerce.latitude);
        targetLon = parseFloat(order.commerce.longitude);
      } else if (order.status === 'in_progress') {
        // Fase 2: Ir al cliente
        targetLat = parseFloat(order.delivery_address.latitude);
        targetLon = parseFloat(order.delivery_address.longitude);
      }

      if (targetLat && targetLon) {
        const dist = getDistanceFromLatLonInMeters(
          courierLocation.latitude, courierLocation.longitude,
          targetLat, targetLon
        );
        setDistanceToTarget(dist);
      }
    }
  }, [courierLocation, order]);

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
      if (!distanceToTarget) return;

      // Geocerca: Debe estar a menos de 50 metros del comercio (ajustado de 10m para evitar errores GPS)
      if (distanceToTarget > 50) {
        Alert.alert("Aún estás lejos", `Debes estar en el comercio. Estás a ${Math.round(distanceToTarget)}m.`);
        return;
      }

      // --- CÁLCULO DE PAGOS ---
      const subtotal = parseFloat(order.products_total);
      
      // Obtenemos la comisión desde los parámetros del sistema (si existe 'commerce_commission_percent' o 'platform_fee_percent')
      const commissionRate = sysConfig?.commerce_commission_percent !== undefined 
        ? parseFloat(sysConfig.commerce_commission_percent) 
        : (sysConfig?.platform_fee_percent ? parseFloat(sysConfig.platform_fee_percent) : 0.06);

      const comisionComercio = subtotal * commissionRate;
      const totalAPagarAlLocal = subtotal - comisionComercio;

      // --- VENTANA EMERGENTE DE CONFIRMACIÓN ---
      Alert.alert(
        "💳 Pago al Comercio",
        `Resumen de cuenta:\n\n` +
        `Subtotal productos: $${subtotal.toFixed(2)}\n` +
        `Comisión App (${(commissionRate * 100).toFixed(1)}%): -$${comisionComercio.toFixed(2)}\n\n` +
        `PAGAR AL LOCAL: $${totalAPagarAlLocal.toFixed(2)}\n\n` +
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
        Alert.alert("Error", "No se pudo marcar como recolectado. Intenta de nuevo.");
      }
    };

  const handleCompleteDelivery = () => {
    if (!distanceToTarget) return;
    // Geocerca: Debe estar a menos de 40 metros del cliente
    if (distanceToTarget > 25) {
      Alert.alert("Aún estás lejos", `Acércate a la ubicación de entrega. Estás a ${Math.round(distanceToTarget)}m.`);
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
    } catch (error) { Alert.alert("Error", "Error al finalizar."); }
  };

  // --- RENDERIZADO ---

  if (isLoading || !order) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={THEME_COLOR} />
        <Text style={{marginTop: 10, color: 'gray'}}>Cargando ruta...</Text>
      </View>
    );
  }

  // Validar coordenadas antes de pintar mapa
  if (!order.commerce?.latitude || !order.delivery_address?.latitude) {
     return <View style={styles.loader}><Text>Error: Faltan coordenadas en el pedido.</Text></View>;
  }

  const isPickupPhase = order.status === 'accepted';

  // Definir destino actual según fase
  const targetLoc = isPickupPhase
    ? { latitude: parseFloat(order.commerce.latitude), longitude: parseFloat(order.commerce.longitude) }
    : { latitude: parseFloat(order.delivery_address.latitude), longitude: parseFloat(order.delivery_address.longitude) };

  const targetName = isPickupPhase ? order.commerce.name : order.customer_name;
  const targetAddress = isPickupPhase ? order.commerce.address : order.delivery_address.address_string;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

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
        mapPadding={{ bottom: 320, top: 40 }} // Padding para que los elementos UI no tapen el mapa
      >
        {/* Marcador del Destino */}
        <Marker coordinate={targetLoc} title={targetName} description={isPickupPhase ? "Punto de Recolección" : "Punto de Entrega"}>
           <View style={[styles.markerIcon, {backgroundColor: isPickupPhase ? THEME_COLOR : SUCCESS_COLOR}]}>
              <Ionicons name={isPickupPhase ? "storefront" : "home"} size={20} color="#fff" />
           </View>
        </Marker>

        {/* Línea de Ruta (Solo si tenemos ubicación del repartidor) */}
        {Platform.OS !== 'web' && courierLocation && !isNaN(targetLoc.latitude) && !isNaN(targetLoc.longitude) && (
           <MapViewDirections
             origin={courierLocation}
             destination={targetLoc}
             apikey={GOOGLE_MAPS_API_KEY}
             strokeWidth={4}
             strokeColor={isPickupPhase ? THEME_COLOR : SUCCESS_COLOR}
             optimizeWaypoints={true}
           />
        )}
      </MapView>

      {/* --- PANEL INFERIOR (BOTTOM SHEET) --- */}
      <View style={styles.bottomSheet}>

        {/* Agarradera visual */}
        <View style={styles.sheetHandle} />

        {/* 1. Información del Destino */}
        <View style={styles.headerRow}>
           <View style={{flex: 1}}>
              <Text style={styles.phaseLabel}>
                  {isPickupPhase ? "📍 RECOGER EN:" : "🏁 ENTREGAR A:"}
              </Text>
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

        <View style={styles.divider} />

        {/* 2. Estadísticas y Herramientas */}
        <View style={styles.statsRow}>
           {/* Badge Distancia */}
           <View style={styles.distBadge}>
              <Ionicons name="location-sharp" size={16} color="#555" />
              <Text style={styles.distText}>
                {distanceToTarget
                  ? (distanceToTarget > 1000 ? `${(distanceToTarget/1000).toFixed(1)} km` : `${Math.round(distanceToTarget)} m`)
                  : 'Calculando...'}
              </Text>
           </View>

           {/* Botones Secundarios */}
           <View style={{flexDirection: 'row', gap: 10}}>
              {/* Botón Avisar Llegada (Solo en entrega) */}
              {!isPickupPhase && (
                 <TouchableOpacity style={[styles.secondaryBtn, {backgroundColor: '#FFF3E0'}]} onPress={handleNotifyArrival}>
                    <Ionicons name="notifications" size={20} color={WARNING_COLOR} />
                    <Text style={[styles.secondaryBtnText, {color: WARNING_COLOR}]}>Ya llegué</Text>
                 </TouchableOpacity>
              )}
              {/* Botón Llamar */}
              <TouchableOpacity
                style={[styles.secondaryBtn, {backgroundColor: '#F5F5F5'}]}
                onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}
              >
                 <Ionicons name="call" size={20} color="#333" />
              </TouchableOpacity>
           </View>
        </View>

        {/* 3. Botón de Acción Principal (Gigante) */}
        <View style={styles.actionArea}>
            {isPickupPhase ? (
                <TouchableOpacity
                  style={[styles.mainButton, {backgroundColor: THEME_COLOR}]}
                  onPress={handlePickUp}
                  // Opcional: Deshabilitar visualmente si está lejos
                  activeOpacity={0.8}
                >
                    <Text style={styles.mainButtonText}>MARCAR RECOLECTADO</Text>
                    {(!distanceToTarget || distanceToTarget > 50) && (
                        <Text style={styles.geofenceText}>Acércate al local para activar</Text>
                    )}
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                  style={[styles.mainButton, {backgroundColor: SUCCESS_COLOR}]}
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
    elevation: 20, shadowColor: '#000', shadowOffset: {height: -4}, shadowOpacity: 0.1, shadowRadius: 10
  },
  sheetHandle: {
    width: 40, height: 5, backgroundColor: '#E0E0E0', borderRadius: 3, alignSelf: 'center', marginBottom: 20
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
    shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.2, elevation: 5
  },
  mainButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18, letterSpacing: 0.5 },
  geofenceText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 },

  totalCollectBadge: {
    marginTop: 4, backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 6
  },
  totalCollectText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
});

export default DeliveryTrackingScreen;