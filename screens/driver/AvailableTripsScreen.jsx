import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import apiClient from '../../api';
import { Ionicons } from '@expo/vector-icons';
import Alert from '../../components/AlertPolyfill';

const THEME_COLOR = '#FFCC00'; // Safety Yellow para Conductores
const ACCENT_COLOR = '#333333'; // Gris oscuro para contraste

const AvailableTripsScreen = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [taxiDriverOnly, setTaxiDriverOnly] = useState(false);
  const [acceptingTripId, setAcceptingTripId] = useState(null);

  const fetchAvailableTrips = async () => {
    try {
      const response = await apiClient.get('/viajes/disponibles-driver/', {
        params: { taxi_driver_only: taxiDriverOnly },
      });
      
      const tripsData = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setTrips(tripsData);
    } catch (error) {
      console.error('Error fetching trips:', error);
      Alert.alert('Error', 'No se pudieron cargar los viajes disponibles');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAvailableTrips();
  }, [taxiDriverOnly]);

  useFocusEffect(
    useCallback(() => {
      fetchAvailableTrips();
    }, [taxiDriverOnly])
  );

  const handleAcceptTrip = async (tripId) => {
    if (acceptingTripId !== null) {
      Alert.alert('Espera', 'Por favor espera a que se procese el viaje anterior.');
      return;
    }

    setAcceptingTripId(tripId);
    try {
      await apiClient.post(`/viajes/${tripId}/accion/accept/`);
      Alert.alert('Éxito', '¡Viaje aceptado! Dirígete al punto de recogida.');
      navigation.navigate('TripActual');
      fetchAvailableTrips();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudo aceptar el viaje');
    } finally {
      setAcceptingTripId(null);
    }
  };

  const renderTrip = ({ item }) => {
    // Usamos el precio estimado porque el final aún no se define
    const basePrice = item.estimated_price ? parseFloat(item.estimated_price) : 0;
    const platformFee = item.platform_fee_percent ? parseFloat(item.platform_fee_percent) : 0.15;
    const feePercent = user?.is_taxi_driver ? platformFee / 2 : platformFee;

    // Deconstruir el precio total para encontrar la ganancia del conductor
    // precio_total = ganancia_conductor * (1 + %comision)
    const driverEarnings = basePrice / (1 + feePercent);
    const commission = basePrice - driverEarnings;

    return (
      <View style={styles.tripCard}>
        {/* Trip Type Badge */}
        <View style={styles.headerRow}>
          <View style={[styles.badge, { backgroundColor: item.note === 'REQ_TAXI' ? THEME_COLOR : '#3498DB' }]}>
            <Text style={[styles.badgeText, item.note === 'REQ_TAXI' && { color: '#333' }]}>
              {item.note === 'REQ_TAXI' ? '🚕 SOLICITUD TAXI' : '🚗 SOLICITUD INDEPENDIENTE'}
            </Text>
          </View>
        </View>

        {/* Locations */}
        <View style={styles.locationSection}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={18} color={THEME_COLOR} />
            <Text style={styles.locationText} numberOfLines={2}>
              📍 {item.pickup_address || 'Recogida'}
            </Text>
          </View>
          <View style={styles.arrow}>
            <Ionicons name="arrow-down" size={16} color="#999" />
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={18} color={THEME_COLOR} />
            <Text style={styles.locationText} numberOfLines={2}>
              📍 {item.dropoff_address || 'Destino'}
            </Text>
          </View>
        </View>

        {/* Distance & Price */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="map" size={16} color="#666" />
            <Text style={styles.detailLabel}>Distancia: {item.distance_km} km</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="cash" size={16} color="#666" />
            <Text style={styles.detailLabel}>Estimado: ${parseFloat(item.estimated_price).toFixed(2)}</Text>
          </View>
        </View>

        {/* Commission Breakdown - Highlighted */}
        <View style={[styles.commissionBox, { borderColor: ACCENT_COLOR }]}>
          <Text style={styles.commissionTitle}>💰 DESGLOSE DE GANANCIAS</Text>
          <View style={styles.commissionRow}>
            <Text style={styles.commissionLabel}>Precio Total:</Text>
            <Text style={styles.commissionValue}>${basePrice.toFixed(2)}</Text>
          </View>
          <View style={styles.commissionRow}>
            <Text style={[styles.commissionLabel, { color: '#E74C3C' }]}>Comisión App ({(feePercent * 100).toFixed(1)}%):</Text>
            <Text style={[styles.commissionValue, { color: '#E74C3C' }]}>-${commission.toFixed(2)}</Text>
          </View>
          <View style={[styles.commissionRow, styles.commissionRowHighlight]}>
            <Text style={[styles.commissionLabel, { color: THEME_COLOR, fontWeight: 'bold' }]}>TU GANANCIA:</Text>
            <Text style={[styles.commissionValue, { color: THEME_COLOR, fontWeight: 'bold', fontSize: 16 }]}>
              ${driverEarnings.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Accept Button */}
        <TouchableOpacity
          style={[styles.acceptButton, acceptingTripId === item.id && styles.acceptingButton]}
          onPress={() => handleAcceptTrip(item.id)}
          disabled={acceptingTripId === item.id}
        >
          {acceptingTripId === item.id ? (
            <ActivityIndicator color="#333" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#333" />
              <Text style={styles.acceptButtonText}>ACEPTAR VIAJE</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME_COLOR} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Viajes Disponibles</Text>
        {/* Solo mostramos el filtro si el usuario es un taxista oficial */}
        {user?.is_taxi_driver && (
          <TouchableOpacity
            onPress={() => setTaxiDriverOnly(!taxiDriverOnly)}
            style={[styles.filterButton, taxiDriverOnly && styles.filterButtonActive]}
          >
            <Ionicons name="car-sport" size={18} color={taxiDriverOnly ? THEME_COLOR : '#333'} />
            <Text style={[styles.filterText, taxiDriverOnly && { color: THEME_COLOR }]}>
              Solo Taxis
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Trips List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={THEME_COLOR} />
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="car-outline" size={64} color="#CCC" />
          <Text style={styles.emptyText}>No hay viajes disponibles en este momento</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={fetchAvailableTrips}>
            <Text style={styles.refreshButtonText}>Intentar de nuevo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => `${item.id}`}
          renderItem={renderTrip}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => {
              setRefreshing(true);
              fetchAvailableTrips();
            }} tintColor={THEME_COLOR} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: THEME_COLOR,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 10,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  filterButton: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: '#333',
  },
  filterText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    paddingBottom: 90,
  },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: THEME_COLOR,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  locationSection: {
    marginBottom: 12,
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
  },
  arrow: {
    alignItems: 'center',
    paddingLeft: 18,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
  },
  commissionBox: {
    backgroundColor: '#FFFAF0',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  commissionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: THEME_COLOR,
    marginBottom: 8,
  },
  commissionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  commissionRowHighlight: {
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: ACCENT_COLOR,
  },
  commissionLabel: {
    fontSize: 12,
    color: '#666',
  },
  commissionValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  acceptButton: {
    backgroundColor: THEME_COLOR,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  acceptingButton: {
    opacity: 0.6,
  },
  acceptButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 15,
    textAlign: 'center',
  },
  refreshButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: THEME_COLOR,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
});

export default AvailableTripsScreen;
