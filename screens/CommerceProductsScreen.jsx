import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
  Platform,
  ScrollView
} from 'react-native';
import apiClient from '../api';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

// --- PALETA COMERCIO ---
const THEME_COLOR = '#1ABC9C'; // Ocean Teal
const THEME_LIGHT = '#E8F8F5';

const normalizeText = (text) => {
  if (!text) return '';
  try {
    return text.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  } catch (e) {
    return text.toLowerCase();
  }
};

const groupProducts = (productsList) => {
  const groups = {
    'Promociones': [],
    'Entradas': [],
    'Tacos': [],
    'Hamburguesas': [],
    'Pizzas': [],
    'Calzones': [],
    'Alitas': [],
    'Pastas': [],
    'Bebidas': [],
    'Postres': [],
    'Otros': []
  };

  productsList.forEach(product => {
    const name = normalizeText(product.name || '');
    
    if (/prom|comb|paq|descu|especi/i.test(name)) {
      groups['Promociones'].push(product);
    } else if (/hamburg|hambur|amborg|burg|doble\s*ques/i.test(name)) {
      groups['Hamburguesas'].push(product);
    } else if (/taco|taqu|taki|gring|quesad|kesad|muli|volc|burri|burit/i.test(name)) {
      groups['Tacos'].push(product);
    } else if (/calzon|calzong|calzone|calzoni|calzonic|calson|calsone|calsoni|calsson|calssone|calzzone|calzzon/i.test(name)) {
      groups['Calzones'].push(product);
    } else if (/pizz|piz|picz|pica|piza/i.test(name)) {
      groups['Pizzas'].push(product);
    } else if (/alita|alitta|allita|halit|halita|wing|uings|wins|bonel|bonles|bonele/i.test(name)) {
      groups['Alitas'].push(product);
    } else if (/pasta|spaghe|spagu|espague|espagu|fettuc|fetuc|lasagn|lazan|raviol|rabiol|macarron|macaroni|penne|penna|alfredo|bolognes|bolones|carbonara|pesto/i.test(name)) {
      groups['Pastas'].push(product);
    } else if (/coca|refres|soda|agua|jugo|hugo|bebid|cerve|cheve|mich|clam|\bte\b|\bcafe\b|caf\b|malte|licua|lata|litro/i.test(name)) {
      groups['Bebidas'].push(product);
    } else if (/pastel|pasteli|pasteler|pastit|pay|pie\b|post|flan|elad|helad|crep|dulc|gelat/i.test(name)) {
      groups['Postres'].push(product);
    } else if (/papas|nach|dedo|entra|snack|aro/i.test(name)) {
      groups['Entradas'].push(product);
    } else {
      groups['Otros'].push(product);
    }
  });

  return groups;
};

const CommerceProductsScreen = () => {
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [isLoading, setIsLoading] = useState(true);
  const navigation = useNavigation();

  // Categorización y ordenamiento
  const grouped = groupProducts(products);
  const activeCategories = Object.keys(grouped).filter(cat => grouped[cat].length > 0);
  const showTabs = activeCategories.length > 1;

  const filteredProducts = selectedCategory === 'Todos'
    ? products
    : (grouped[selectedCategory] || []);

  // Función de carga
  const fetchProducts = async () => {
    try {
      const response = await apiClient.get('/mis-productos/');
      
      // Extraer datos si viene paginado (como objeto con .results) o si es un arreglo directo
      const productsData = Array.isArray(response.data) ? response.data : (response.data.results || []);
      
      setProducts(productsData);
    } catch (error) {
      console.error("Error al cargar productos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // Recargar al volver de "Editar" o "Agregar"
    const unsubscribe = navigation.addListener('focus', () => {
      fetchProducts();
    });
    return unsubscribe;
  }, [navigation]);

  // --- RENDER CATEGORIES TABS ---
  const renderCategoriesTabs = () => {
    if (!showTabs) return null;
    const tabs = ['Todos', ...activeCategories];
    return (
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {tabs.map((category) => {
            const isActive = selectedCategory === category;
            const count = category === 'Todos' ? products.length : grouped[category].length;
            return (
              <TouchableOpacity
                key={category}
                onPress={() => setSelectedCategory(category)}
                style={[
                  styles.tabButton,
                  isActive ? styles.tabButtonActive : styles.tabButtonInactive
                ]}
              >
                <Text style={[
                  styles.tabText,
                  isActive ? styles.tabTextActive : styles.tabTextInactive
                ]}>
                  {category} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // --- RENDER ITEM (Tarjeta de Producto) ---
  const renderProduct = ({ item }) => {
    // Definimos color y texto según disponibilidad
    const statusColor = item.is_available ? '#2ECC71' : '#E74C3C'; // Verde o Rojo
    const statusText = item.is_available ? 'Disponible' : 'Agotado';
    const statusBg = item.is_available ? '#EAFAF1' : '#FADBD8';

    // Formatear el precio y la etiqueta según el tipo de unidad (kg, litro, gramo)
    const getPriceDisplay = (product) => {
      if (!product.unit_type || product.unit_type === 'unit') {
        return `$${parseFloat(product.price).toFixed(2)}`;
      }
      const uPrice = product.unit_price ? parseFloat(product.unit_price).toFixed(2) : parseFloat(product.price).toFixed(2);
      const unitLabels = { kg: 'kg', liter: 'L', gram: 'g' };
      return `$${uPrice} / ${unitLabels[product.unit_type] || 'ud'}`;
    };

    const isWeightBased = item.unit_type && item.unit_type !== 'unit';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('EditProduct', { productId: item.id })}
      >
        {/* Imagen */}
        <Image
          source={{ uri: item.image || 'https://via.placeholder.com/100' }}
          style={styles.image}
        />

        {/* Info Central */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.price, isWeightBased && { marginBottom: 2 }]}>
            {getPriceDisplay(item)}
          </Text>

          {/* Si se vende por peso, mostrar el rango permitido */}
          {isWeightBased && (
            <Text style={styles.weightInfo}>
              Mín: {item.min_weight_kg || 0} kg - Máx: {item.max_weight_kg || '∞'} kg
            </Text>
          )}

          {/* Badge de Estado */}
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>

        {/* Flecha "Editar" */}
        <View style={styles.iconContainer}>
            <Ionicons name="create-outline" size={22} color="#ccc" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor={THEME_COLOR} />

      {/* HEADER */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Mi Catálogo</Text>
        <Text style={styles.headerSubtitle}>Administra tu menú</Text>
      </View>

      {/* CONTENEDOR BLANCO */}
      <View style={styles.whiteCard}>
        {renderCategoriesTabs()}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME_COLOR} />
            <Text style={styles.loadingText}>Cargando productos...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredProducts}
            renderItem={renderProduct}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBg}>
                   <Ionicons name="fast-food-outline" size={50} color="#ccc" />
                </View>
                <Text style={styles.emptyTitle}>Tu catalogo está vacío</Text>
                <Text style={styles.emptySubtitle}>
                    Toca el botón "+" para agregar tu primer producto.
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* --- BOTÓN FLOTANTE (FAB) --- */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('AddProduct')}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: THEME_COLOR },

  // Header
  headerContainer: {
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 60, paddingBottom: 25,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 5 },

  // White Card
  whiteCard: {
    flex: 1, backgroundColor: '#fff',
    borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden'
  },
  listContent: { padding: 20, paddingBottom: 100 }, // Espacio para el FAB

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#999' },

  // Product Card
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 15, padding: 10, marginBottom: 15,
    // Sombras
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 3,
    borderWidth: 1, borderColor: '#f9f9f9'
  },
  image: {
    width: 75, height: 75, borderRadius: 12, backgroundColor: '#f0f0f0', marginRight: 15
  },
  info: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  price: { fontSize: 16, color: THEME_COLOR, fontWeight: 'bold', marginBottom: 6 },
  weightInfo: { fontSize: 11, color: '#7f8c8d', marginBottom: 6 },

  // Status Badge
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  statusText: { fontSize: 11, fontWeight: 'bold' },

  iconContainer: { padding: 5 },

  // FAB
  fab: {
    position: 'absolute', right: 20, bottom: 30,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: THEME_COLOR,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8
  },

  // Empty State
  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
  emptyIconBg: {
    width: 100, height: 100, backgroundColor: '#f9f9f9', borderRadius: 50,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20
  },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  emptySubtitle: { color: '#888', textAlign: 'center' },

  // Tabs Styles
  tabsWrapper: {
    width: '100%',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 5,
  },
  tabsContainer: {
    paddingVertical: 5,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: THEME_COLOR,
    borderColor: THEME_COLOR,
    shadowColor: THEME_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  tabButtonInactive: {
    backgroundColor: '#F5F5F5',
    borderColor: '#EAEAEA',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextInactive: {
    color: '#666666',
  },
});

export default CommerceProductsScreen;