import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Import driver screens
import AvailableTripsScreen from '../screens/driver/AvailableTripsScreen';
import CurrentTripScreen from '../screens/driver/CurrentTripScreen';
import TripHistoryScreen from '../screens/driver/TripHistoryScreen';
import DriverProfileScreen from '../screens/driver/DriverProfileScreen';

const Tab = createBottomTabNavigator();

const DriverNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'ViajesDisponibles') {
            iconName = focused ? 'list-circle' : 'list-circle-outline';
          } else if (route.name === 'TripActual') {
            iconName = focused ? 'car' : 'car-outline';
          } else if (route.name === 'Historial') {
            iconName = focused ? 'receipt' : 'receipt-outline';
          } else if (route.name === 'PerfilConductor') {
            iconName = focused ? 'person-circle' : 'person-circle-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#FF6B6B', // Rojo para tema taxi
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#EEE',
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: -8,
        },
      })}
    >
      <Tab.Screen
        name="ViajesDisponibles"
        component={AvailableTripsScreen}
        options={{
          tabBarLabel: 'Viajes',
        }}
      />
      <Tab.Screen
        name="TripActual"
        component={CurrentTripScreen}
        options={{
          tabBarLabel: 'Viaje Actual',
        }}
      />
      <Tab.Screen
        name="Historial"
        component={TripHistoryScreen}
        options={{
          tabBarLabel: 'Historial',
        }}
      />
      <Tab.Screen
        name="PerfilConductor"
        component={DriverProfileScreen}
        options={{
          tabBarLabel: 'Perfil',
        }}
      />
    </Tab.Navigator>
  );
};

export default DriverNavigator;
