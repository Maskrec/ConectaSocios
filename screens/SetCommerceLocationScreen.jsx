import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/MapShim';
import * as Location from 'expo-location';
import apiClient from '../api';
import Alert from '../components/AlertPolyfill';
import { Ionicons } from '@expo/vector-icons';

const THEME_COLOR = '#1ABC9C'; // Ocean Teal

const SetCommerceLocationScreen = ({ navigation }) => {
  const [initialRegion, setInitialRegion] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);

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
      {/* Cabecera Flotante */}
      <View style={styles.headerOverlay}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ubicación del Negocio</Text>
      </View>

      <MapView 
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
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
    zIndex: 10
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