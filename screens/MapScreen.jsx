import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  StatusBar,
  Platform
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Callout } from '../components/MapShim';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api';

// --- PALETA REPARTIDOR (Electric Indigo) ---
const THEME_COLOR = '#5D5FEF'; // Índigo Eléctrico
const THEME_DARK = '#2C3E50';

const MapScreen = () => {
  const [initialRegion, setInitialRegion] = useState(null);
  const [commerces, setCommerces] = useState([]);
  const [loading, setLoading] = useState(true);

  // Referencia al mapa para poder centrarlo programáticamente
  const mapRef = useRef(null);

  useEffect(() => {
    (async () => {
      // 1. Permisos y Ubicación
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permiso de ubicación denegado');
        setLoading(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setInitialRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.04, // Zoom nivel ciudad/barrio
        longitudeDelta: 0.04,
      });

      // 2. Obtener comercios (Hotspots)
      try {
        const response = await apiClient.get('/mapa-estrategico/');
        setCommerces(response.data);
      } catch (error) {
        console.error("Error cargando mapa estratégico:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Función para volver a centrar en el usuario
  const centerMap = async () => {
    let location = await Location.getCurrentPositionAsync({});
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }, 1000);
    }
  };

  if (loading || !initialRegion) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={THEME_COLOR} />
        <Text style={{ marginTop: 10, color: '#666' }}>Cargando mapa estratégico...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={true}
        showsMyLocationButton={false} // Ocultamos el nativo para poner el nuestro estilizado
        provider={PROVIDER_GOOGLE}
        customMapStyle={mapStyle} // Estilo opcional para limpiar el mapa (ver abajo)
      >
        {commerces.map((commerce) => (
            commerce.latitude && commerce.longitude && (
                <Marker
                    key={commerce.id}
                    coordinate={{
                        latitude: parseFloat(commerce.latitude),
                        longitude: parseFloat(commerce.longitude)
                    }}
                    title={commerce.name}
                    description="Punto de alta demanda"
                >
                    {/* Marcador Personalizado Índigo */}
                    <View style={styles.markerContainer}>
                        <View style={styles.markerIconBg}>
                            <Ionicons
                                name={commerce.category_icon || 'restaurant'}
                                size={16}
                                color="#fff"
                            />
                        </View>
                        {/* Triangulito inferior del marcador */}
                        <View style={styles.markerArrow} />
                    </View>

                    <Callout tooltip>
                        <View style={styles.calloutContainer}>
                            <Text style={styles.calloutTitle}>{commerce.name}</Text>
                            <Text style={styles.calloutDesc}>Zona activa</Text>
                        </View>
                    </Callout>
                </Marker>
            )
        ))}
      </MapView>

      {/* Botón Flotante: Centrar Ubicación */}
      <TouchableOpacity style={styles.myLocationButton} onPress={centerMap}>
        <Ionicons name="locate" size={24} color={THEME_COLOR} />
      </TouchableOpacity>

      {/* Tarjeta de Leyenda Inferior */}
      <View style={styles.legendCard}>
         <View style={styles.legendHeader}>
            <Ionicons name="flame" size={24} color="#FF6B6B" style={{marginRight: 8}} />
            <View>
                <Text style={styles.legendTitle}>Mapa de Calor</Text>
                <Text style={styles.legendSubtitle}>Estrategia de posicionamiento</Text>
            </View>
         </View>
         <Text style={styles.legendText}>
            Los iconos azules indican zonas con restaurantes activos. Ubícate cerca de ellos para recibir pedidos más rápido.
         </Text>
      </View>
    </View>
  );
};

// Estilo minimalista para el mapa (Opcional, hace que resalten más los marcadores)
const mapStyle = [
  {
    "featureType": "poi",
    "elementType": "labels.text",
    "stylers": [{ "visibility": "off" }] // Oculta nombres de negocios irrelevantes de Google
  },
  {
    "featureType": "transit",
    "stylers": [{ "visibility": "off" }]
  }
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },

  // Marcador Personalizado
  markerContainer: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40 },
  markerIconBg: {
    backgroundColor: THEME_COLOR,
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, elevation: 4
  },
  markerArrow: {
    width: 0, height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 0, borderTopWidth: 6,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: THEME_COLOR,
    marginTop: -1
  },

  // Callout (Burbuja al tocar marcador)
  calloutContainer: {
    backgroundColor: '#fff', padding: 10, borderRadius: 8, width: 150, alignItems: 'center',
    borderWidth: 1, borderColor: '#eee', elevation: 5
  },
  calloutTitle: { fontWeight: 'bold', fontSize: 14, color: '#333', marginBottom: 2 },
  calloutDesc: { fontSize: 12, color: THEME_COLOR },

  // Botón Centrar
  myLocationButton: {
    position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, right: 20,
    backgroundColor: '#fff', width: 45, height: 45, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, elevation: 5
  },

  // Leyenda Inferior
  legendCard: {
      position: 'absolute', bottom: 30, left: 20, right: 20,
      backgroundColor: 'white', padding: 20, borderRadius: 15,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, elevation: 10
  },
  legendHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  legendTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  legendSubtitle: { fontSize: 12, color: '#999' },
  legendText: { fontSize: 14, color: '#555', lineHeight: 20 }
});

export default MapScreen;