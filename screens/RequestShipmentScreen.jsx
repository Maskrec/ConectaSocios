import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  StatusBar
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/MapShim';
import * as Location from 'expo-location';
import apiClient from '../api';
import Alert from '../components/AlertPolyfill';
import { Ionicons } from '@expo/vector-icons';

const THEME_COLOR = '#1ABC9C'; // Ocean Teal
const THEME_LIGHT = '#E8F8F5';
const THEME_DARK_TEXT = '#0E6655';

// Helper: Fórmula Haversine para calcular distancia exacta en km
const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
const deg2rad = (deg) => deg * (Math.PI / 180);

const RequestShipmentScreen = ({ navigation }) => {
  const [commerce, setCommerce] = useState(null);
  const [initialRegion, setInitialRegion] = useState(null);
  const [destinationLocation, setDestinationLocation] = useState(null);
  
  // Form Estados
  const [addressText, setAddressText] = useState('');
  const [notesText, setNotesText] = useState('');
  
  // Costos y Distancia
  const [distanceKm, setDistanceKm] = useState(null);
  const [costs, setCosts] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calcError, setCalcError] = useState(null);

  useEffect(() => {
    const fetchCommerceData = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Ubicación requerida", "Se necesitan permisos de ubicación para mostrar el mapa.");
      }

      try {
        const response = await apiClient.get('/mi-comercio/');
        const commerceData = response.data;
        setCommerce(commerceData);
        
        if (commerceData.latitude && commerceData.longitude) {
          const lat = parseFloat(commerceData.latitude);
          const lon = parseFloat(commerceData.longitude);
          
          setInitialRegion({
            latitude: lat,
            longitude: lon,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          });
          // Ubicación inicial del destino por defecto (un poco corrida para que se vea)
          setDestinationLocation({
            latitude: lat + 0.002,
            longitude: lon + 0.002,
          });
        } else {
          Alert.alert(
            "Ubicación del Negocio Requerida",
            "Debes establecer la ubicación de tu comercio en tu perfil antes de poder solicitar envíos.",
            [{ text: "Entendido", onPress: () => navigation.goBack() }]
          );
        }
      } catch (error) {
        console.error("Error al cargar comercio:", error);
        Alert.alert("Error", "No se pudo cargar la información del comercio.");
        navigation.goBack();
      }
    };

    fetchCommerceData();
  }, []);

  // Calcular costo en tiempo real cuando cambia el destino
  useEffect(() => {
    if (commerce && destinationLocation) {
      const commLat = parseFloat(commerce.latitude);
      const commLon = parseFloat(commerce.longitude);
      const destLat = destinationLocation.latitude;
      const destLon = destinationLocation.longitude;

      const dist = getDistanceFromLatLonInKm(commLat, commLon, destLat, destLon);
      const formattedDist = parseFloat(dist.toFixed(2));
      setDistanceKm(formattedDist);
      calculateCosts(formattedDist);
    }
  }, [destinationLocation]);

  const calculateCosts = async (distance) => {
    setIsCalculating(true);
    setCalcError(null);
    try {
      const response = await apiClient.post('/pedidos/calcular-costos/', {
        commerce_id: commerce.id,
        distance_km: distance,
        items: [],
        is_mercado: false
      });
      setCosts(response.data);
    } catch (error) {
      console.error("Error al calcular costos:", error);
      setCosts(null);
      if (error.response && error.response.data && (error.response.data.error || error.response.data.detail)) {
        setCalcError(error.response.data.error || error.response.data.detail);
      } else {
        setCalcError("Error al calcular la tarifa de envío.");
      }
    } finally {
      setIsCalculating(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!addressText.trim()) {
      Alert.alert("Dirección Requerida", "Por favor ingresa la dirección de entrega en texto.");
      return;
    }
    if (!costs) {
      Alert.alert("Error", "No se ha podido calcular el costo del envío. Por favor reubica el destino.");
      return;
    }

    setIsSubmitting(true);
    try {
      const shipmentData = {
        commerce: commerce.id,
        distance_km: distanceKm,
        items: [],
        special_instructions: notesText.trim() || 'Envío de paquete',
        is_mercado: false,
        is_commerce_shipment: true,
        shipment_destination_text: addressText.trim(),
        shipment_destination_latitude: parseFloat(destinationLocation.latitude).toFixed(7),
        shipment_destination_longitude: parseFloat(destinationLocation.longitude).toFixed(7)
      };

      await apiClient.post('/pedidos/crear/', shipmentData);
      Alert.alert(
        "¡Envío Solicitado! 📦",
        "El envío ha sido registrado. Un repartidor aceptará tu solicitud en breve.",
        [{ text: "Aceptar", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error("Error al solicitar envío:", error);
      Alert.alert("Error", error.response?.data?.error || "No se pudo registrar la solicitud de envío.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!initialRegion || !destinationLocation) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={THEME_COLOR} />
        <Text style={{ marginTop: 10, color: '#666' }}>Cargando mapa y comercio...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* Cabecera Flotante */}
      <View style={styles.headerOverlay}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Solicitar Envío Especial</Text>
      </View>

      <MapView
        style={styles.map}
        initialRegion={initialRegion}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={true}
        onPress={(e) => setDestinationLocation(e.nativeEvent.coordinate)}
      >
        {/* Marcador del Comercio (Origen) */}
        <Marker
          coordinate={{
            latitude: parseFloat(commerce.latitude),
            longitude: parseFloat(commerce.longitude),
          }}
          title="Tu Comercio (Origen)"
          pinColor="blue"
        >
          <View style={[styles.markerIcon, { backgroundColor: '#3498DB' }]}>
            <Ionicons name="storefront" size={16} color="#fff" />
          </View>
        </Marker>

        {/* Marcador del Destino */}
        <Marker
          coordinate={destinationLocation}
          title="Destino de Entrega"
          pinColor={THEME_COLOR}
          draggable
          onDragEnd={(e) => setDestinationLocation(e.nativeEvent.coordinate)}
        >
          <View style={[styles.markerIcon, { backgroundColor: THEME_COLOR }]}>
            <Ionicons name="location" size={18} color="#fff" />
          </View>
        </Marker>
      </MapView>

      {/* Formulario y Detalles de Costo */}
      <View style={styles.formContainer}>
        <ScrollView contentContainerStyle={styles.scrollContent} nestedScrollEnabled={true}>
          
          <Text style={styles.sectionTitle}>Datos del Envío</Text>
          
          <View style={styles.inputContainer}>
            <Ionicons name="map-outline" size={20} color={THEME_COLOR} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Dirección del destinatario (ej. Calle Juárez #123)"
              placeholderTextColor="#999"
              value={addressText}
              onChangeText={setAddressText}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="document-text-outline" size={20} color={THEME_COLOR} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Indicaciones / Qué se envía (ej. Bolsa de comida caliente, cobrar al recibir)"
              placeholderTextColor="#999"
              value={notesText}
              onChangeText={setNotesText}
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.divider} />

          {/* Información del Cálculo */}
          <View style={styles.costsBox}>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Distancia estimada:</Text>
              <Text style={styles.costValue}>
                {distanceKm !== null ? `${distanceKm} km` : 'Calculando...'}
              </Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Costo de envío (repartidor):</Text>
              {isCalculating ? (
                <ActivityIndicator size="small" color={THEME_COLOR} />
              ) : (
                <Text style={[styles.costValue, styles.costHighlight]}>
                  {costs ? `$${costs.delivery_fee}` : 'No disponible'}
                </Text>
              )}
            </View>
            {calcError && (
              <Text style={{ color: '#E74C3C', fontSize: 12, marginTop: 8, fontWeight: '600', textAlign: 'center' }}>
                ⚠️ {calcError}
              </Text>
            )}
          </View>

          <View style={styles.helpBox}>
            <Ionicons name="information-circle-outline" size={16} color={THEME_DARK_TEXT} />
            <Text style={styles.helpText}>
              Puedes ajustar la ubicación del destino tocando en el mapa o arrastrando el pin verde.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.disabledButton]}
            onPress={handleCreateShipment}
            disabled={isSubmitting || isCalculating}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Solicitar Envío Especial</Text>
                <Ionicons name="paper-plane" size={18} color="#fff" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1.2 },
  
  headerOverlay: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 45 : 60,
    left: 20, right: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 5,
    zIndex: 10
  },
  backButton: { marginRight: 15, padding: 5 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },

  markerIcon: {
    padding: 6,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000', shadowOpacity: 0.2
  },

  formContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    marginTop: -20,
    paddingHorizontal: 20,
    paddingTop: 20,
    elevation: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 25
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginBottom: 12,
    paddingHorizontal: 12
  },
  inputIcon: {
    marginRight: 10
  },
  input: {
    flex: 1,
    height: 48,
    color: '#333',
    fontSize: 14
  },
  multilineInput: {
    height: 60,
    textAlignVertical: 'top',
    paddingTop: 10
  },
  divider: {
    height: 1,
    backgroundColor: '#E9ECEF',
    marginVertical: 12
  },
  costsBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4
  },
  costLabel: {
    fontSize: 13,
    color: '#666'
  },
  costValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333'
  },
  costHighlight: {
    fontSize: 16,
    color: THEME_COLOR
  },
  helpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME_LIGHT,
    padding: 10,
    borderRadius: 8,
    marginBottom: 15
  },
  helpText: {
    flex: 1,
    marginLeft: 8,
    color: THEME_DARK_TEXT,
    fontSize: 11,
    lineHeight: 15
  },
  submitButton: {
    backgroundColor: THEME_COLOR,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16
  },
  disabledButton: {
    backgroundColor: '#BDC3C7'
  }
});

export default RequestShipmentScreen;
