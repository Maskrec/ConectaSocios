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
import { useAuth } from '../../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import apiClient from '../../api';
import { Ionicons } from '@expo/vector-icons';
import Alert from '../../components/AlertPolyfill';

const THEME_COLOR = '#FFCC00'; // Safety Yellow

const TripHistoryScreen = () => {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState('today');
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalEarnings: 0,
    averageRating: 0,
  });

  const fetchTripHistory = async () => {
    try {
      const params = {};
      
      // Agregar filtro de fechas según el período seleccionado
      const today = new Date();
      if (filterPeriod === 'week') {
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        params.desde = weekAgo.toISOString().split('T')[0];
      } else if (filterPeriod === 'month') {
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        params.desde = monthAgo.toISOString().split('T')[0];
      } else if (filterPeriod === 'today') {
        params.desde = today.toISOString().split('T')[0];
      }
      
      const response = await apiClient.get('/viajes/mis-ganancias/', { params });
      let tripsData = response.data.trips || [];
      if (tripsData && !Array.isArray(tripsData)) {
        tripsData = tripsData.results || [];
      }

      setTrips(tripsData);
      setStats({
        totalTrips: response.data.total_trips || 0,
        totalEarnings: parseFloat(response.data.total_earnings) || 0,
        averageRating: calculateAverageRating(tripsData),
      });
    } catch (error) {
      console.error('Error fetching trip history:', error);
      Alert.alert('Error', 'No se pudo cargar el historial de viajes');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  const calculateAverageRating = (tripsArray) => {
    const ratedTrips = tripsArray.filter(t => t.trip_rating);
    if (ratedTrips.length === 0) return 0;
    const totalRating = ratedTrips.reduce((sum, t) => sum + t.trip_rating, 0);
    return (totalRating / ratedTrips.length).toFixed(1);
  };

  useEffect(() => {
    fetchTripHistory();
  }, [filterPeriod]);

  useFocusEffect(
    useCallback(() => {
      fetchTripHistory();
    }, [filterPeriod])
  );

  const renderStatCard = (icon, label, value, color = '#333') => (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={24} color={THEME_COLOR} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );

  const renderTrip = ({ item }) => {
    const date = new Date(item.created_at).toLocaleDateString('es-ES');
    const time = new Date(item.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={styles.tripItem}>
        <View style={styles.tripHeader}>
          <View>
            <Text style={styles.tripTime}>{time}</Text>
            <Text style={styles.tripDistance}>{item.distance_km} km</Text>
          </View>
          <View style={styles.tripRoute}>
            <View style={styles.routeDot} />
            <View style={styles.routeLine} />
            <View style={[styles.routeDot, { backgroundColor: '#27AE60' }]} />
          </View>
          <View style={styles.tripEarnings}>
            <Text style={styles.earningsLabel}>Ganancia</Text>
            <Text style={styles.earningsValue}>${parseFloat(item.driver_earnings || 0).toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.tripAddresses}>
          <Text style={styles.address} numberOfLines={1}>{item.pickup_address}</Text>
          <Text style={styles.address} numberOfLines={1}>{item.dropoff_address}</Text>
        </View>

        {(item.trip_rating || item.trip_review) && (
          <View style={styles.ratingSection}>
            {item.trip_rating && (
              <View style={styles.ratingStars}>
                {[...Array(5)].map((_, i) => (
                  <Ionicons
                    key={i}
                    name={i < item.trip_rating ? 'star' : 'star-outline'}
                    size={14}
                    color={i < item.trip_rating ? '#FFD700' : '#DDD'}
                  />
                ))}
              </View>
            )}
            {item.trip_review && <Text style={styles.review}>{item.trip_review}</Text>}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME_COLOR} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historial de Viajes</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={THEME_COLOR} />
        </View>
      ) : (
        <>
          {/* Stats Cards */}
          <View style={styles.statsContainer}>
            {renderStatCard('car', 'VIAJES', stats.totalTrips)}
            {renderStatCard('cash', 'GANANCIAS', `$${stats.totalEarnings.toFixed(2)}`)}
            {renderStatCard('star', 'RATING', stats.averageRating || '—')}
          </View>

          {/* Filter Buttons */}
          <View style={styles.filterContainer}>
            {['today', 'week', 'month'].map((period) => (
              <TouchableOpacity
                key={period}
                style={[
                  styles.filterButton,
                  filterPeriod === period && styles.filterButtonActive,
                ]}
                onPress={() => setFilterPeriod(period)}
              >
                <Text
                  style={[
                    styles.filterText,
                    filterPeriod === period && styles.filterTextActive,
                  ]}
                >
                  {period === 'today' ? 'Hoy' : period === 'week' ? 'Esta Semana' : 'Este Mes'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Trips List */}
          {trips.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="car-outline" size={64} color="#CCC" />
              <Text style={styles.emptyText}>Sin viajes en este período</Text>
            </View>
          ) : (
            <FlatList
              data={trips}
              keyExtractor={(item) => `${item.id}`}
              renderItem={renderTrip}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    fetchTripHistory();
                  }}
                  tintColor={THEME_COLOR}
                />
              }
            />
          )}
        </>
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
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 15,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 6,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingBottom: 12,
    gap: 10,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#fff',
  },
  filterButtonActive: {
    backgroundColor: THEME_COLOR,
    borderColor: THEME_COLOR,
  },
  filterText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    textAlign: 'center',
  },
  filterTextActive: {
    color: '#333',
  },
  listContent: {
    paddingHorizontal: 15,
    paddingBottom: 90,
  },
  tripItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: THEME_COLOR,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tripTime: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  tripDistance: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  tripRoute: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 10,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: THEME_COLOR,
  },
  routeLine: {
    width: 2,
    height: 15,
    backgroundColor: '#DDD',
    marginVertical: 4,
  },
  tripEarnings: {
    alignItems: 'flex-end',
  },
  earningsLabel: {
    fontSize: 11,
    color: '#999',
  },
  earningsValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME_COLOR,
  },
  tripAddresses: {
    gap: 4,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  address: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  ratingSection: {
    gap: 6,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  review: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 15,
    textAlign: 'center',
  },
});

export default TripHistoryScreen;
