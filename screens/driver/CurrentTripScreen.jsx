import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
  Linking,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from '../../components/MapShim';
import MapViewDirections from '../../components/MapViewDirectionsShim';
import * as Location from 'expo-location';
import Alert from '../../components/AlertPolyfill';

const THEME_COLOR = '#FFCC00'; // Safety Yellow
const { width, height } = Dimensions.get('window');
const GOOGLE_MAPS_API_KEY = Platform.OS === 'web' 
  ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY 
  : process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_SERVICES;

// Helper: Fórmula Haversine para calcular distancia exacta en metros
const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Radio de la Tierra en metros
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const CurrentTripScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [trip, setTrip] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nextAction, setNextAction] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);

  // --- ANIMACIÓN DE CORTINA DESLIZABLE ---
  const translateY = useRef(new Animated.Value(0)).current;
  const lastY = useRef(0);

  useEffect(() => {
    const listener = translateY.addListener(({ value }) => {
      lastY.current = value;
    });
    return () => translateY.removeListener(listener);
  }, [translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false, // Permite que los botones dentro se puedan presionar
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10, // Solo activar si desliza verticalmente
      onPanResponderGrant: () => {
        translateY.setOffset(lastY.current);
        translateY.setValue(0);
      },
      onPanResponderMove: Animated.event(
        [null, { dy: translateY }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();
        const MAX_DOWN = 280; // Altura a la que se oculta la tarjeta dejando solo el header
        
        // Si desliza rápido hacia abajo o ya pasó la mitad, se oculta. Si no, se expande.
        let toValue = (gestureState.vy > 0.5 || lastY.current > MAX_DOWN / 2) ? MAX_DOWN : 0;

        Animated.spring(translateY, {
          toValue, useNativeDriver: true, bounciness: 5
        }).start();
      }
    })
  ).current;

  // --- SEGUIMIENTO GPS EN TIEMPO REAL ---
  useEffect(() => {
    let locationSubscription = null;

    const startTracking = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Envía ubicación cada 5 segundos
          distanceInterval: 10 // O cada 10 metros
        },
        async (location) => {
          const { latitude, longitude } = location.coords;
          setDriverLocation({ latitude, longitude });
          try {
            await apiClient.post('/actualizar-ubicacion/', { latitude, longitude });
          } catch (error) {}
        }
      );
    };

    startTracking();
    return () => { if (locationSubscription) locationSubscription.remove(); };
  }, []);

  const fetchCurrentTrip = async () => {
    try {
      // Obtener el viaje actual del conductor
      
      const response = await apiClient.get('/viajes/mi-viaje-activo/');
      if (response.status === 200 && response.data) {
        setTrip(response.data);
        determineNextAction(response.data.status);
        
        // Obtener ubicación actual del conductor
        const locationPerm = await Location.requestForegroundPermissionsAsync();
        if (locationPerm.status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setDriverLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          });
        }
      } else {
        setTrip(null);
      }
    } catch (error) {
      console.error('Error fetching current trip:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const determineNextAction = (status) => {
    switch (status) {
      case 'accepted':
        setNextAction({ label: 'Llegué al Pickup', action: 'arrive', icon: 'location' });
        break;
      case 'arrived':
        setNextAction({ label: 'Pasajero Subió', action: 'start', icon: 'play' });
        break;
      case 'in_progress':
        setNextAction({ label: 'Completar Viaje', action: 'complete', icon: 'checkmark' });
        break;
      default:
        setNextAction(null);
    }
  };

  useEffect(() => {
    fetchCurrentTrip();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCurrentTrip();
      const interval = setInterval(fetchCurrentTrip, 10000); // Refrescar cada 10s
      return () => clearInterval(interval);
    }, [])
  );

  const handleTripAction = async () => {
    if (!trip || !nextAction) return;

    // --- VALIDACIÓN DE PROXIMIDAD (MAX 20m + 10m margen error GPS) ---
    if (nextAction.action === 'arrive' || nextAction.action === 'complete') {
      try {
        // Pedimos la ubicación fresca y más precisa justo en el momento de tocar el botón
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const currentLat = loc.coords.latitude;
        const currentLon = loc.coords.longitude;
        
        const targetLat = nextAction.action === 'arrive' ? parseFloat(trip.pickup_latitude) : parseFloat(trip.dropoff_latitude);
        const targetLon = nextAction.action === 'arrive' ? parseFloat(trip.pickup_longitude) : parseFloat(trip.dropoff_longitude);

        const distance = calculateDistanceMeters(currentLat, currentLon, targetLat, targetLon);
        
        // Usamos 30m de límite (20m reales + 10m de tolerancia por el margen de error natural de los chips GPS de los celulares)
        if (distance > 30) {
          Alert.alert(
            'Estás muy lejos 📍',
            `Debes estar a menos de 20 metros de la ubicación para marcar esta acción.\n\nDistancia actual: ${Math.round(distance)} metros.`
          );
          return;
        }
      } catch (e) {
        Alert.alert('Error de GPS', 'No pudimos obtener tu ubicación exacta para validar. Asegúrate de tener buena señal.');
        return;
      }
    }

    // Si pasa la validación, envía la acción al servidor
    const executeAction = async () => {
      try {
        await apiClient.post(`/viajes/${trip.id}/accion/${nextAction.action}/`);
        Alert.alert('Éxito', `Viaje actualizado a ${nextAction.label}`);
        await fetchCurrentTrip();
      } catch (error) {
        Alert.alert('Error', error.response?.data?.error || 'No se pudo actualizar el viaje');
      }
    };

    // Confirmación estricta para iniciar viaje (Abordaje)
    if (nextAction.action === 'start') {
      Alert.alert(
        'Confirmar Abordaje',
        '¿Confirmas que el pasajero ya está a bordo de la unidad para iniciar la ruta hacia el destino?',
        [ { text: 'Aún no', style: 'cancel' }, { text: 'Sí, Iniciar Viaje', onPress: executeAction } ]
      );
    } else { executeAction(); }
  };

  const handleCancelTrip = () => {
    Alert.alert(
      'Cancelar Viaje',
      '¿Estás seguro de que quieres cancelar este viaje?',
      [
        { text: 'Cancelar', onPress: () => {} },
        {
          text: 'Confirmar Cancelación',
          onPress: async () => {
            try {
              await apiClient.post(`/viajes/${trip.id}/accion/cancel/`);
              Alert.alert('Viaje Cancelado', 'El viaje ha sido cancelado');
              navigation.navigate('ViajesDisponibles');
            } catch (error) {
              Alert.alert('Error', 'No se pudo cancelar el viaje');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleCallPassenger = () => {
    if (trip?.customer_phone) {
      Linking.openURL(`tel:${trip.customer_phone}`);
    } else {
      Alert.alert('Aviso', 'El cliente no tiene un teléfono registrado.');
    }
  };

  const handleWhatsAppPassenger = () => {
    if (trip?.customer_phone) {
      // Limpiamos el número de espacios/guiones y agregamos +52 por defecto para México
      const phone = trip.customer_phone.replace(/\D/g, '');
      const message = `Hola ${trip.customer_name}, soy tu conductor de ConectaLocal.`;
      Linking.openURL(`https://wa.me/52${phone}?text=${encodeURIComponent(message)}`);
    } else {
      Alert.alert('Aviso', 'El cliente no tiene un teléfono registrado.');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={THEME_COLOR} />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>No hay viaje activo en este momento</Text>
          <TouchableOpacity
            style={styles.goButton}
            onPress={() => navigation.navigate('ViajesDisponibles')}
          >
            <Text style={styles.goButtonText}>Buscar Viajes</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- BLINDAJE DE COORDENADAS ---
  const pickupLat = parseFloat(trip.pickup_latitude);
  const pickupLon = parseFloat(trip.pickup_longitude);
  const dropoffLat = parseFloat(trip.dropoff_latitude);
  const dropoffLon = parseFloat(trip.dropoff_longitude);

  const hasEssentialCoords = !isNaN(pickupLat) && !isNaN(pickupLon) && !isNaN(dropoffLat) && !isNaN(dropoffLon);

  if (!hasEssentialCoords) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="map-outline" size={50} color="#ccc" />
          <Text style={[styles.emptyText, { paddingHorizontal: 20 }]}>Los datos de ubicación del viaje están incompletos y no se puede mostrar el mapa.</Text>
        </View>
      </View>
    );
  }

  // --- LÓGICA DE LA RUTA ---
  let routeOrigin = { latitude: pickupLat, longitude: pickupLon };
  let routeDestination = { latitude: dropoffLat, longitude: dropoffLon };

  if (driverLocation) {
    if (trip.status === 'accepted') {
      routeOrigin = driverLocation;
      routeDestination = { latitude: pickupLat, longitude: pickupLon };
    } else if (trip.status === 'arrived' || trip.status === 'in_progress') {
      routeOrigin = driverLocation;
      routeDestination = { latitude: dropoffLat, longitude: dropoffLon };
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      {/* Mapa a Pantalla Completa */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: (pickupLat + dropoffLat) / 2,
          longitude: (pickupLon + dropoffLon) / 2,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05
        }}
        showsUserLocation={true}
        mapPadding={{ top: Platform.OS === 'ios' ? 100 : 120, bottom: 120, left: 10, right: 10 }}
      >
        {/* Marcador de Recogida */}
        <Marker coordinate={{ latitude: pickupLat, longitude: pickupLon }} pinColor="blue" title="Recogida" />
        
        {/* Marcador de Destino */}
        <Marker coordinate={{ latitude: dropoffLat, longitude: dropoffLon }} pinColor="green" title="Destino" />

        {/* Ruta dinámica de calle a calle */}
        {Platform.OS !== 'web' && (
          <MapViewDirections
            origin={routeOrigin}
            destination={routeDestination}
            apikey={GOOGLE_MAPS_API_KEY}
            strokeWidth={5}
            strokeColor={THEME_COLOR}
          />
        )}
      </MapView>

      {/* Status Bar Flotante (Arriba) */}
      <View style={styles.floatingTopBar}>
        <Text style={styles.statusText}>
          {trip.status === 'accepted' && '📍 En Camino al Pickup'}
          {trip.status === 'arrived' && '✅ En el Punto de Recogida'}
          {trip.status === 'in_progress' && '🚗 Viaje en Curso'}
        </Text>
      </View>

      {/* Panel Inferior Flotante (Abajo) */}
      <Animated.View 
        style={[styles.bottomSheet, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        {/* Agarradera Visual (Sensible al gesto) */}
        <View style={styles.handleContainer}>
          <View style={styles.sheetHandle} />
          <Text style={styles.swipeHint}>Desliza para expandir/ocultar mapa</Text>
        </View>

        {/* Info del Cliente y Contacto Rápido */}
        <View style={styles.passengerHeader}>
          <View style={styles.passengerInfo}>
            <View style={styles.passengerAvatar}>
              <Ionicons name="person" size={24} color="#333" />
            </View>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={styles.passengerName} numberOfLines={1}>{trip.customer_name}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.ratingText}>4.8 (Cliente)</Text>
              </View>
            </View>
          </View>
          <View style={styles.contactButtonsRow}>
            <TouchableOpacity style={[styles.circleBtn, { backgroundColor: '#3498DB' }]} onPress={handleCallPassenger}>
              <Ionicons name="call" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.circleBtn, { backgroundColor: '#25D366' }]} onPress={handleWhatsAppPassenger}>
              <Ionicons name="logo-whatsapp" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Resumen de la ruta */}
        <View style={styles.locationsSection}>
          <View style={styles.locationBlock}>
            <View style={styles.locationDot} />
            <Text style={styles.locationAddress} numberOfLines={1}>{trip.pickup_address}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.locationBlock}>
            <View style={[styles.locationDot, { backgroundColor: '#27AE60' }]} />
            <Text style={styles.locationAddress} numberOfLines={1}>{trip.dropoff_address}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Trip Details (Compacto) */}
        <View style={styles.detailsRowCompact}>
          <View style={styles.detailItemCompact}>
             <Text style={styles.detailLabel}>Distancia</Text>
             <Text style={styles.detailValue}>{trip.distance_km} km</Text>
          </View>
          <View style={styles.detailItemCompact}>
             <Text style={styles.detailLabel}>A Cobrar</Text>
             <Text style={styles.detailValue}>${parseFloat(trip.estimated_price).toFixed(2)}</Text>
          </View>
          <View style={styles.detailItemCompact}>
             <Text style={[styles.detailLabel, {color: THEME_COLOR}]}>Tu Ganancia</Text>
             <Text style={[styles.detailValue, {color: THEME_COLOR, fontSize: 16}]}>
               ${(() => {
                  const basePrice = parseFloat(trip.estimated_price);
                  const platformFee = trip.platform_fee_percent ? parseFloat(trip.platform_fee_percent) : 0.15;
                  const feePercent = user?.is_taxi_driver ? platformFee / 2 : platformFee;
                  const driverEarning = basePrice / (1 + feePercent);
                  return driverEarning.toFixed(2);
               })()}
             </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          {nextAction && (
            <TouchableOpacity style={styles.primaryButton} onPress={handleTripAction}>
              <Ionicons name={nextAction.icon} size={22} color="#333" />
              <Text style={styles.primaryButtonText}>{nextAction.label}</Text>
            </TouchableOpacity>
          )}
          {trip.status !== 'in_progress' && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelTrip}>
              <Text style={styles.cancelButtonText}>Cancelar Viaje</Text>
            </TouchableOpacity>
          )}
        </View>

      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingTopBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 10,
    alignSelf: 'center',
    backgroundColor: THEME_COLOR,
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  statusText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // BOTTOM SHEET
  bottomSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 40 : 65,
    elevation: 20,
    minHeight: 400, // Asegura que tenga cuerpo suficiente para deslizarse
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  handleContainer: {
    alignItems: 'center',
    paddingBottom: 15,
  },
  sheetHandle: {
    width: 50, height: 6, backgroundColor: '#DDD', borderRadius: 3, marginBottom: 5
  },
  swipeHint: {
    fontSize: 10,
    color: '#AAA',
    textTransform: 'uppercase',
    fontWeight: 'bold'
  },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 },
  
  // PASSENGER HEADER
  passengerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  passengerAvatar: {
    width: 45, height: 45, borderRadius: 25, backgroundColor: THEME_COLOR,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  passengerName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText: { fontSize: 12, color: '#999' },
  contactButtonsRow: { flexDirection: 'row', gap: 10 },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center', elevation: 3,
  },

  // LOCATIONS SUMMARY
  locationsSection: { paddingHorizontal: 5 },
  locationBlock: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: THEME_COLOR },
  locationAddress: { fontSize: 13, color: '#333', flex: 1 },
  routeLine: { height: 15, width: 2, backgroundColor: '#DDD', marginLeft: 4, marginVertical: 2 },

  // DETAILS COMPACT
  detailsRowCompact: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 15
  },
  detailItemCompact: { alignItems: 'center' },
  detailLabel: { fontSize: 11, color: '#999', marginBottom: 2, fontWeight: 'bold', textTransform: 'uppercase' },
  detailValue: { fontSize: 14, fontWeight: 'bold', color: '#333' },

  // BUTTONS
  buttonContainer: { gap: 8 },
  primaryButton: {
    backgroundColor: THEME_COLOR, height: 55, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, elevation: 4,
  },
  primaryButtonText: { color: '#333', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  cancelButton: { 
    height: 40, justifyContent: 'center', alignItems: 'center' 
  },
  cancelButtonText: { color: '#E74C3C', fontSize: 13, fontWeight: '600' },
  
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 15,
    textAlign: 'center',
  },
  goButton: {
    marginTop: 20,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: THEME_COLOR,
    borderRadius: 8,
  },
  goButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
});

export default CurrentTripScreen;
