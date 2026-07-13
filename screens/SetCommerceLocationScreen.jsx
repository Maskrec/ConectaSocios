import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity, Platform, TextInput } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/MapShim';
import * as Location from 'expo-location';
import apiClient from '../api';
import Alert from '../components/AlertPolyfill';
import { Ionicons } from '@expo/vector-icons';

const THEME_COLOR = '#1ABC9C'; // Ocean Teal
const GOOGLE_MAPS_API_KEY = Platform.OS === 'web'
  ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
  : process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_SERVICES;

const SetCommerceLocationScreen = ({ navigation }) => {
  const mapRef = useRef(null);
  const [initialRegion, setInitialRegion] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [isSearchingText, setIsSearchingText] = useState(false);

  const handleSearchAddress = async () => {
    if (!searchText || !searchText.trim()) {
      Alert.alert("Escribe una dirección", "Por favor ingresa un texto para buscar.");
      return;
    }
    setIsSearchingText(true);
    try {
      // 1. Intentar usar la geocodificación nativa de expo-location (Gratuito y sin restricciones de Referer)
      const results = await Location.geocodeAsync(searchText);
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        const newCoords = { latitude, longitude };

        setSelectedLocation(newCoords);

        mapRef.current?.animateToRegion({
          ...newCoords,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 1000);
        return;
      }

      // 2. Fallback a la API de Google Geocoding
      const searchUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchText)}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(searchUrl);
      const data = await response.json();
      if (data.status !== 'OK') {
        throw new Error(data.error_message || data.status);
      }
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        const { lat, lng } = result.geometry.location;
        const newCoords = { latitude: lat, longitude: lng };

        setSelectedLocation(newCoords);

        mapRef.current?.animateToRegion({
          ...newCoords,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }, 1000);
      } else {
        Alert.alert("No Encontrado", "No se encontró ninguna ubicación con ese texto.");
      }
    } catch (error) {
      console.error("Error al buscar dirección:", error);
      Alert.alert("Error", "No se pudo realizar la búsqueda de la dirección.");
    } finally {
      setIsSearchingText(false);
    }
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Intentar cargar la ubicación actual del comercio primero
      try {
        const response = await apiClient.get('/mi-comercio/');
        if (response.data.latitude && response.data.longitude) {
           const region = {
               latitude: parseFloat(response.data.latitude),
               longitude: parseFloat(response.data.longitude),
               latitudeDelta: 0.005, longitudeDelta: 0.005,
           };
           setInitialRegion(region);
           setSelectedLocation(region);
           return;
        }
      } catch (e) {}

      // Si no tiene, usa la ubicación del GPS
      let location = await Location.getCurrentPositionAsync({});
      setInitialRegion({
        latitude: location.coords.latitude, longitude: location.coords.longitude,
        latitudeDelta: 0.005, longitudeDelta: 0.005,
      });
      setSelectedLocation(location.coords);
    })();
  }, []);

  const handleSave = async () => {
    if (!selectedLocation) return;
    try {
      await apiClient.patch('/mi-comercio/', {
        latitude: parseFloat(selectedLocation.latitude).toFixed(7),
        longitude: parseFloat(selectedLocation.longitude).toFixed(7)
      });
      Alert.alert("Éxito", "Ubicación del comercio actualizada.");
      navigation.goBack();
    } catch (error) { Alert.alert("Error", "No se pudo guardar."); }
  };

  if (!initialRegion) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={THEME_COLOR} />
        <Text style={{ marginTop: 10, color: '#666' }}>Cargando mapa...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Cabecera Flotante con Buscador */}
      <View style={styles.headerOverlay}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ubicación del Negocio</Text>
        </View>
        <View style={styles.searchBarContainer}>
          <Ionicons name="search-outline" size={18} color="#666" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar dirección por texto..."
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearchAddress}
            returnKeyType="search"
          />
          {isSearchingText ? (
            <ActivityIndicator size="small" color={THEME_COLOR} />
          ) : (
            <TouchableOpacity onPress={handleSearchAddress} style={{ padding: 4 }}>
              <Ionicons name="arrow-forward" size={18} color={THEME_COLOR} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <MapView 
        ref={mapRef}
        style={styles.map} 
        initialRegion={initialRegion}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={true}
        onPress={(e) => setSelectedLocation(e.nativeEvent.coordinate)} // El pin se mueve al tocar
      >
        <Marker
            coordinate={selectedLocation}
            pinColor={THEME_COLOR}
        />
      </MapView>

      {/* Panel Inferior */}
      <View style={styles.bottomPanel}>
        <View style={styles.instructionBox}>
          <Ionicons name="information-circle" size={20} color={THEME_COLOR} />
          <Text style={styles.instructionText}>Toca en cualquier parte del mapa para ubicar tu local exactamente.</Text>
        </View>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Confirmar Ubicación</Text>
          <Ionicons name="checkmark-circle" size={20} color="#fff" style={{marginLeft: 8}} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  
  headerOverlay: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 40 : 60,
    left: 20, right: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 12,
    elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
    zIndex: 10
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F6F7',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    borderWidth: 1,
    borderColor: '#E5E8E8',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 0,
  },
  backButton: { marginRight: 15, padding: 5 },
  headerTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },

  bottomPanel: {
    position: 'absolute', bottom: 30, left: 20, right: 20,
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 5
  },
  instructionBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F8F5',
    padding: 12, borderRadius: 10, marginBottom: 15
  },
  instructionText: { flex: 1, marginLeft: 10, color: '#0E6655', fontSize: 13, lineHeight: 18 },
  
  saveButton: {
    backgroundColor: THEME_COLOR, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 15, borderRadius: 12
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});

export default SetCommerceLocationScreen;