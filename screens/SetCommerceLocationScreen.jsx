import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Button, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker } from '../components/MapShim';
import * as Location from 'expo-location';
import apiClient from '../api';
import Alert from '../components/AlertPolyfill';

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

  if (!initialRegion) return <ActivityIndicator size="large" style={{flex: 1}} />;

  return (
    <View style={{flex: 1}}>
      <MapView style={{flex: 1}} initialRegion={initialRegion}>
        <Marker
            coordinate={selectedLocation}
            draggable
            onDragEnd={(e) => setSelectedLocation(e.nativeEvent.coordinate)}
        />
      </MapView>
      <Button title="Confirmar Ubicación del Negocio" onPress={handleSave} />
    </View>
  );
};
export default SetCommerceLocationScreen;