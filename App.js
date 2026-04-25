import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, Platform } from 'react-native';

// Importa los Providers y el hook
import { AuthProvider, useAuth } from './context/AuthContext';

// Importa TODAS las pantallas
import LoginPage from './screens/LoginPage';
import AvailableOrdersScreen from './screens/AvailableOrdersScreen';
import MyDeliveriesScreen from './screens/MyDeliveriesScreen';
import MapScreen from './screens/MapScreen';
import ProfileScreen from './screens/ProfileScreen';
import DeliveryTrackingScreen from './screens/DeliveryTrackingScreen';
import EditProductScreen from './screens/EditProductScreen';
import SetCommerceLocationScreen from './screens/SetCommerceLocationScreen';
import RegisterPartnerScreen from './screens/RegisterPartnerScreen';
import HistoryScreen from './screens/HistoryScreen';

// Pantallas de Comercio
import CommerceOrdersScreen from './screens/CommerceOrdersScreen';
import CommerceProductsScreen from './screens/CommerceProductsScreen';
import CommerceOrderDetailScreen from './screens/CommerceOrderDetailScreen';
import CommerceProfileScreen from './screens/CommerceProfileScreen';
import AddProductScreen from './screens/AddProductScreen';

// Pantallas de Conductor (Taxis)
import AvailableTripsScreen from './screens/driver/AvailableTripsScreen';
import CurrentTripScreen from './screens/driver/CurrentTripScreen';
import TripHistoryScreen from './screens/driver/TripHistoryScreen';
import DriverProfileScreen from './screens/driver/DriverProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- 1. Pestañas para REPARTIDOR ---
function CourierTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          paddingBottom: Platform.OS === 'ios' ? 30 : 35,
          height: Platform.OS === 'ios' ? 85 : 85,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Disponibles') iconName = focused ? 'list-circle' : 'list-circle-outline';
          else if (route.name === 'Mis Entregas') iconName = focused ? 'bicycle' : 'bicycle-outline';
          else if (route.name === 'Mapa') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'Perfil') iconName = focused ? 'person-circle' : 'person-circle-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#FF6B6B',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Disponibles" component={AvailableOrdersScreen} />
      <Tab.Screen name="Mis Entregas" component={MyDeliveriesScreen} />
      <Tab.Screen name="Mapa" component={MapScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// --- 2. Pestañas para COMERCIO ---
function CommerceTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          paddingBottom: Platform.OS === 'ios' ? 30 : 35,
          height: Platform.OS === 'ios' ? 85 : 85,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Pedidos') iconName = focused ? 'receipt' : 'receipt-outline';
          else if (route.name === 'Productos') iconName = focused ? 'storefront' : 'storefront-outline';
          else if (route.name === 'Perfil') iconName = focused ? 'person-circle' : 'person-circle-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007BFF', // Un color diferente para el comercio
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Pedidos" component={CommerceOrdersScreen} />
      <Tab.Screen name="Productos" component={CommerceProductsScreen} />
      <Tab.Screen name="Perfil" component={CommerceProfileScreen} />
    </Tab.Navigator>
  );
}

// --- 3. Pestañas para CONDUCTORES (Taxis) ---
function DriverTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          paddingBottom: Platform.OS === 'ios' ? 30 : 35,
          height: Platform.OS === 'ios' ? 85 : 85,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'ViajesDisponibles') iconName = focused ? 'car' : 'car-outline';
          else if (route.name === 'TripActual') iconName = focused ? 'map' : 'map-outline';
          else if (route.name === 'Historial') iconName = focused ? 'time' : 'time-outline';
          else if (route.name === 'Perfil') iconName = focused ? 'person-circle' : 'person-circle-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#FFCC00', // Safety Yellow
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="ViajesDisponibles" component={AvailableTripsScreen} options={{ tabBarLabel: 'Disponibles' }} />
      <Tab.Screen name="TripActual" component={CurrentTripScreen} options={{ tabBarLabel: 'Mapa' }} />
      <Tab.Screen name="Historial" component={TripHistoryScreen} options={{ tabBarLabel: 'Historial' }} />
      <Tab.Screen name="Perfil" component={DriverProfileScreen} options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

// --- 4. Elige qué navegador mostrar ---
function AppNavigator() {
  const { authToken, role, isLoading } = useAuth();

  // Mostramos loading si está validando la sesión O si hay token pero el rol aún no llega
  if (isLoading || (authToken && !role)) {
    return <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}><Text>Cargando...</Text></View>;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {authToken && role ? (
          // El usuario está logueado y ya tenemos su rol
          role === 'courier' ? (
            // --- Stack de Repartidor ---
            <>
              <Stack.Screen name="MainApp" component={CourierTabs} options={{ headerShown: false }} />
              <Stack.Screen name="DeliveryTracking" component={DeliveryTrackingScreen} options={{ title: 'Seguimiento de Entrega' }} />
              <Stack.Screen
                name="HistoryScreen"
                component={HistoryScreen}
                options={{ title: 'Historial de Entregas', headerShown: false }}
              />

            </>
          ) : role === 'driver' ? (
            // --- Stack de Conductor de Taxi ---
            <>
              <Stack.Screen name="MainDriver" component={DriverTabs} options={{ headerShown: false }} />
            </>
          ) : role === 'owner' ? (
            // --- Stack de Comercio ---
            <>
               <Stack.Screen name="MainCommerce" component={CommerceTabs} options={{ headerShown: false }} />
               <Stack.Screen name="CommerceOrderDetail" component={CommerceOrderDetailScreen} options={{ title: 'Detalle del Pedido' }} />
               <Stack.Screen name="AddProduct" component={AddProductScreen} options={{ title: 'Nuevo Producto' }} />
               <Stack.Screen name="EditProduct" component={EditProductScreen} options={{ title: 'Editar Producto' }} />
               <Stack.Screen name="SetCommerceLocation" component={SetCommerceLocationScreen} options={{ title: 'Ubicación del Negocio' }} />
            </>
          ) : (
             // Si tiene token pero el rol no coincide con nada, cerramos la sesión visualmente
            <>
               <Stack.Screen name="Login" component={LoginPage} options={{ headerShown: false }} />
            </>
          )
        ) : (
          // El usuario no está logueado
          <>
            <Stack.Screen name="Login" component={LoginPage} options={{ headerShown: false }} />
            <Stack.Screen name="RegisterPartner" component={RegisterPartnerScreen} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// --- 4. Componente Principal ---
export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}