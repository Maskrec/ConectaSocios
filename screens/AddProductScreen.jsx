import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../api';
import { Ionicons } from '@expo/vector-icons';
import Alert from '../components/AlertPolyfill';
import { useAuth } from '../context/AuthContext';

// --- PALETA DE COLORES COMERCIO ---
const THEME_COLOR = '#1ABC9C';      // Ocean Teal (Principal)
const THEME_LIGHT = '#E8F8F5';      // Fondo Suave (Teal muy claro)
const THEME_BORDER = '#A3E4D7';     // Borde suave
const THEME_DISABLED = '#A2D9CE';   // Color para estados deshabilitados
const DANGER_COLOR = '#E74C3C';     // Rojo para cancelar/eliminar

const AddProductScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);

  // Nuevos estados para venta por peso/granel
  const [unitType, setUnitType] = useState('unit'); // 'unit', 'kg', 'liter'
  const [minWeight, setMinWeight] = useState('');
  const [maxWeight, setMaxWeight] = useState('');

  // Estado para el interruptor
  const [isCustomizable, setIsCustomizable] = useState(false);
  const [isCombo, setIsCombo] = useState(false);
  const [saleLocation, setSaleLocation] = useState('feed');

  // Estados para Combos
  const [myProducts, setMyProducts] = useState([]);
  const [comboItems, setComboItems] = useState([]);
  const [selectedComboProduct, setSelectedComboProduct] = useState(null);
  const [comboItemQty, setComboItemQty] = useState('1');
  const [comboItemGroup, setComboItemGroup] = useState('');

  // Estados de Variantes y Modificadores
  const [variantGroupName, setVariantGroupName] = useState('Elige tu tamaño');
  const [modifierGroupName, setModifierGroupName] = useState('Ingredientes Extra');
  const [variants, setVariants] = useState([]);
  const [modifiers, setModifiers] = useState([]);

  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [newModifierName, setNewModifierName] = useState('');
  const [newModifierPrice, setNewModifierPrice] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await apiClient.get('/mis-productos/');
        const list = Array.isArray(res.data) ? res.data : (res.data.results || []);
        setMyProducts(list);
      } catch (e) {
        console.error(e);
      }
    };
    fetchProducts();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const handleCreate = async () => {
    if (!name || !price) return Alert.alert("Faltan datos", "El nombre y el precio son obligatorios.");

    setLoading(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    formData.append('description', description);

    // Agregamos el tipo de unidad
    formData.append('unit_type', unitType);

    if (unitType !== 'unit') {
      formData.append('unit_price', price); // En granel, el precio que escribió es por kilo/litro
      if (minWeight) formData.append('min_weight_kg', minWeight);
      if (maxWeight) formData.append('max_weight_kg', maxWeight);
    }

    // Enviamos el valor del Switch
    formData.append('is_customizable', isCustomizable);
    formData.append('is_combo', isCombo);
    formData.append('sale_location', saleLocation);

    // Variantes, modificadores y combos
    formData.append('variant_group_name', variantGroupName);
    formData.append('modifier_group_name', modifierGroupName);
    formData.append('variants', JSON.stringify(variants));
    formData.append('modifiers', JSON.stringify(modifiers));
    formData.append('combo_items', JSON.stringify(comboItems));

    if (image) {
      if (Platform.OS === 'web') {
        const response = await fetch(image);
        const blob = await response.blob();
        formData.append('image', blob, 'product.jpg');
      } else {
        const filename = image.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;
        formData.append('image', { uri: image, name: filename, type });
      }
    }

    try {
      await apiClient.post('/mis-productos/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert("¡Producto Creado!", "Ya está disponible en tu menú.");
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo subir el producto. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor={THEME_COLOR} />

      {/* ENCABEZADO (Teal) */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nuevo Producto</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* FORMULARIO EN TARJETA BLANCA */}
      <View style={styles.whiteCard}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

            {/* Input Nombre */}
            <Text style={styles.label}>Nombre del Platillo</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="fast-food-outline" size={20} color="#666" style={{marginRight: 10}} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ej. Hamburguesa Doble"
                placeholderTextColor="#999"
              />
            </View>

            {/* Selector de Tipo de Unidad */}
            <Text style={styles.label}>Tipo de Venta</Text>
            <View style={styles.unitTypeContainer}>
               <TouchableOpacity style={[styles.unitBtn, unitType === 'unit' && styles.unitBtnActive]} onPress={() => setUnitType('unit')}>
                   <Text style={[styles.unitBtnText, unitType === 'unit' && styles.unitBtnTextActive]}>Por Unidad</Text>
               </TouchableOpacity>
               <TouchableOpacity style={[styles.unitBtn, unitType === 'kg' && styles.unitBtnActive]} onPress={() => setUnitType('kg')}>
                   <Text style={[styles.unitBtnText, unitType === 'kg' && styles.unitBtnTextActive]}>Por Kilo</Text>
               </TouchableOpacity>
               <TouchableOpacity style={[styles.unitBtn, unitType === 'liter' && styles.unitBtnActive]} onPress={() => setUnitType('liter')}>
                   <Text style={[styles.unitBtnText, unitType === 'liter' && styles.unitBtnTextActive]}>Por Litro</Text>
               </TouchableOpacity>
            </View>

            {/* Input Precio */}
            <Text style={styles.label}>
              {unitType === 'unit' ? 'Precio ($)' : `Precio por ${unitType === 'kg' ? 'Kilo' : 'Litro'} ($)`}
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="cash-outline" size={20} color="#666" style={{marginRight: 10}} />
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#999"
              />
            </View>

            {/* Inputs de Peso (Solo si no es unidad) */}
            {unitType !== 'unit' && (
              <View style={styles.row}>
                <View style={[styles.inputContainer, {flex: 1, marginRight: 5}]}>
                  <TextInput style={styles.input} placeholder="Mínimo (ej. 0.5)" placeholderTextColor="#999" value={minWeight} onChangeText={setMinWeight} keyboardType="numeric" />
                </View>
                <View style={[styles.inputContainer, {flex: 1, marginLeft: 5}]}>
                  <TextInput style={styles.input} placeholder="Máximo (ej. 5)" placeholderTextColor="#999" value={maxWeight} onChangeText={setMaxWeight} keyboardType="numeric" />
                </View>
              </View>
            )}

            {/* Input Descripción */}
            <Text style={styles.label}>Descripción</Text>
            <View style={[styles.inputContainer, { height: 100, alignItems: 'flex-start', paddingTop: 10 }]}>
              <Ionicons name="document-text-outline" size={20} color="#666" style={{marginRight: 10, marginTop: 2}} />
              <TextInput
                style={[styles.input, { height: 80 }]}
                value={description}
                onChangeText={setDescription}
                multiline
                placeholder="Ingredientes, tamaño, detalles..."
                placeholderTextColor="#999"
              />
            </View>

            {/* Selector de Ubicación de Venta (Solo si el comercio está aprobado para Mercado) */}
            {user?.approved_for_mercado ? (
              <>
                <Text style={styles.label}>Destino de Venta (Mercado)</Text>
                <View style={styles.unitTypeContainer}>
                  <TouchableOpacity
                    style={[styles.unitBtn, saleLocation === 'feed' && styles.unitBtnActive]}
                    onPress={() => setSaleLocation('feed')}
                  >
                    <Text style={[styles.unitBtnText, saleLocation === 'feed' && styles.unitBtnTextActive]}>Solo Feed</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.unitBtn, saleLocation === 'mercado' && styles.unitBtnActive]}
                    onPress={() => setSaleLocation('mercado')}
                  >
                    <Text style={[styles.unitBtnText, saleLocation === 'mercado' && styles.unitBtnTextActive]}>Solo Mercado</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.unitBtn, saleLocation === 'both' && styles.unitBtnActive]}
                    onPress={() => setSaleLocation('both')}
                  >
                    <Text style={[styles.unitBtnText, saleLocation === 'both' && styles.unitBtnTextActive]}>Ambos</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            {/* --- SWITCH DE PERSONALIZACIÓN (Estilo Teal) --- */}
            <View style={styles.switchContainer}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.switchTitle}>¿Es personalizable?</Text>
                <Text style={styles.switchSubtitle}>
                  Activa esto si el cliente puede añadir notas (ej. "Sin cebolla", "Salsa aparte").
                </Text>
              </View>
              <Switch
                trackColor={{ false: "#767577", true: THEME_COLOR }}
                thumbColor={isCustomizable ? "#fff" : "#f4f3f4"}
                onValueChange={setIsCustomizable}
                value={isCustomizable}
              />
            </View>

            {/* --- SWITCH DE COMBO / PAQUETE --- */}
            <View style={styles.switchContainer}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.switchTitle}>¿Es un Combo o Paquete? 🎁</Text>
                <Text style={styles.switchSubtitle}>
                  Activa esto para crear un paquete especial agrupando productos de tu menú a un precio único.
                </Text>
              </View>
              <Switch
                trackColor={{ false: "#767577", true: THEME_COLOR }}
                thumbColor={isCombo ? "#fff" : "#f4f3f4"}
                onValueChange={setIsCombo}
                value={isCombo}
              />
            </View>

            {isCombo && (
              <View style={{ backgroundColor: '#F8F9FA', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#EAEAEA' }}>
                <Text style={styles.labelSection}>Productos del Paquete 🎁</Text>

                {comboItems.map((c, i) => (
                  <View key={i} style={styles.itemRowOption}>
                    <Text style={styles.optionText}>
                      {c.quantity}x {c.product_name || c.group_name || 'Opción de Combo'} {c.group_name ? `(${c.group_name})` : ''}
                    </Text>
                    <TouchableOpacity onPress={() => setComboItems(comboItems.filter((_, idx) => idx !== i))}>
                      <Ionicons name="trash-outline" size={20} color={DANGER_COLOR} />
                    </TouchableOpacity>
                  </View>
                ))}

                <Text style={[styles.label, { marginTop: 10 }]}>Agregar Producto al Paquete:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  {myProducts.filter(p => !p.is_combo).map((p) => {
                    const isSelected = selectedComboProduct?.id === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={{
                          backgroundColor: isSelected ? THEME_COLOR : '#fff',
                          borderWidth: 1,
                          borderColor: isSelected ? THEME_COLOR : '#DDD',
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 20,
                          marginRight: 8,
                        }}
                        onPress={() => setSelectedComboProduct(p)}
                      >
                        <Text style={{ color: isSelected ? '#fff' : '#444', fontSize: 12, fontWeight: 'bold' }}>
                          {p.name} (${parseFloat(p.price).toFixed(2)})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <TextInput
                    style={[styles.inlineInput, { flex: 0.3, marginRight: 8 }]}
                    placeholder="Cant."
                    keyboardType="numeric"
                    value={comboItemQty}
                    onChangeText={setComboItemQty}
                  />
                  <TextInput
                    style={[styles.inlineInput, { flex: 0.7 }]}
                    placeholder="Opción/Grupo (ej: Acompañamiento)"
                    value={comboItemGroup}
                    onChangeText={setComboItemGroup}
                  />
                </View>

                <TouchableOpacity
                  style={{
                    backgroundColor: THEME_COLOR,
                    padding: 10,
                    borderRadius: 8,
                    alignItems: 'center'
                  }}
                  onPress={() => {
                    if (!selectedComboProduct && !comboItemGroup) {
                      return Alert.alert("Atención", "Selecciona un producto o escribe un grupo/opción.");
                    }
                    const newComboItem = {
                      product: selectedComboProduct ? selectedComboProduct.id : null,
                      product_name: selectedComboProduct ? selectedComboProduct.name : comboItemGroup,
                      quantity: parseInt(comboItemQty) || 1,
                      group_name: comboItemGroup,
                      allow_modifiers: true
                    };
                    setComboItems([...comboItems, newComboItem]);
                    setSelectedComboProduct(null);
                    setComboItemQty('1');
                    setComboItemGroup('');
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ Añadir al Paquete</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* VARIANTES */}
            <Text style={styles.labelSection}>Variantes (Formatos / Tamaños)</Text>
            <Text style={styles.label}>Nombre del Grupo (ej. Elige tu tamaño)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="options-outline" size={20} color="#666" style={{marginRight: 10}} />
              <TextInput
                style={styles.input}
                value={variantGroupName}
                onChangeText={setVariantGroupName}
                placeholder="Elige tu tamaño"
                placeholderTextColor="#999"
              />
            </View>

            {variants.map((v, i) => (
              <View key={i} style={styles.itemRowOption}>
                <Text style={styles.optionText}>{v.name} - ${parseFloat(v.price).toFixed(2)}</Text>
                <TouchableOpacity onPress={() => setVariants(variants.filter((_, idx) => idx !== i))}>
                  <Ionicons name="trash-outline" size={20} color={DANGER_COLOR} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={{ marginBottom: 15 }}>
              <TextInput
                style={[styles.inlineInput, { width: '100%', marginBottom: 8 }]}
                placeholder="Nombre de la variante (ej. Mediana)"
                value={newVariantName}
                onChangeText={setNewVariantName}
                placeholderTextColor="#999"
              />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.inlineInput, { flex: 1 }]}
                  placeholder="Precio ($)"
                  value={newVariantPrice}
                  onChangeText={setNewVariantPrice}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  style={styles.inlineAddBtn}
                  onPress={() => {
                    if (!newVariantName || !newVariantPrice) return;
                    setVariants([...variants, { name: newVariantName, price: newVariantPrice }]);
                    setNewVariantName('');
                    setNewVariantPrice('');
                  }}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* MODIFICADORES */}
            <Text style={styles.labelSection}>Modificadores (Ingredientes Extra)</Text>
            <Text style={styles.label}>Nombre del Grupo (ej. Ingredientes Extra)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="options-outline" size={20} color="#666" style={{marginRight: 10}} />
              <TextInput
                style={styles.input}
                value={modifierGroupName}
                onChangeText={setModifierGroupName}
                placeholder="Ingredientes Extra"
                placeholderTextColor="#999"
              />
            </View>

            {modifiers.map((m, i) => (
              <View key={i} style={styles.itemRowOption}>
                <Text style={styles.optionText}>{m.name} - +${parseFloat(m.price).toFixed(2)}</Text>
                <TouchableOpacity onPress={() => setModifiers(modifiers.filter((_, idx) => idx !== i))}>
                  <Ionicons name="trash-outline" size={20} color={DANGER_COLOR} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={{ marginBottom: 15 }}>
              <TextInput
                style={[styles.inlineInput, { width: '100%', marginBottom: 8 }]}
                placeholder="Nombre del extra (ej. Pollo)"
                value={newModifierName}
                onChangeText={setNewModifierName}
                placeholderTextColor="#999"
              />
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.inlineInput, { flex: 1 }]}
                  placeholder="Precio extra ($)"
                  value={newModifierPrice}
                  onChangeText={setNewModifierPrice}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  style={styles.inlineAddBtn}
                  onPress={() => {
                    if (!newModifierName || !newModifierPrice) return;
                    setModifiers([...modifiers, { name: newModifierName, price: newModifierPrice }]);
                    setNewModifierName('');
                    setNewModifierPrice('');
                  }}
                >
                  <Ionicons name="add" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Selector de Imagen */}
            <Text style={styles.label}>Foto del Producto</Text>
            <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
              {image ? (
                <Image source={{ uri: image }} style={styles.imagePreview} />
              ) : (
                <View style={styles.placeholderContainer}>
                  <Ionicons name="camera-outline" size={40} color="#ccc" />
                  <Text style={{color: 'gray', marginTop: 5}}>Toca para subir foto</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Botón Guardar (Teal) */}
            <TouchableOpacity
              style={[styles.saveButton, loading && styles.disabledButton]}
              onPress={handleCreate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.saveButtonText}>Guardar Producto</Text>
                  <Ionicons name="checkmark-circle-outline" size={24} color="#fff" style={{marginLeft: 10}}/>
                </>
              )}
            </TouchableOpacity>

            {/* Espacio extra al final */}
            <View style={{height: 30}} />

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: THEME_COLOR }, // Fondo Teal
  headerContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 60, paddingBottom: 20
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  whiteCard: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  scrollContent: { padding: 25 },

  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8, marginTop: 5 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5',
    borderRadius: 12, paddingHorizontal: 15, height: 50, marginBottom: 15,
    borderWidth: 1, borderColor: '#eee'
  },
  input: { flex: 1, fontSize: 16, color: '#333' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },

  // Botones de Unidad
  unitTypeContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  unitBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: THEME_BORDER, alignItems: 'center', backgroundColor: '#f9f9f9' },
  unitBtnActive: { backgroundColor: THEME_COLOR, borderColor: THEME_COLOR },
  unitBtnText: { color: '#666', fontWeight: 'bold', fontSize: 12 },
  unitBtnTextActive: { color: '#fff' },

  // Estilos del Switch (Teal Suave)
  switchContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: THEME_LIGHT, // Fondo Teal muy claro
    padding: 15, borderRadius: 12, marginBottom: 20,
    borderWidth: 1, borderColor: THEME_BORDER
  },
  switchTitle: { fontSize: 16, fontWeight: 'bold', color: THEME_COLOR }, // Texto Teal
  switchSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },

  // Estilos Imagen
  imagePicker: {
    height: 180, backgroundColor: '#F5F5F5', borderRadius: 15,
    justifyContent: 'center', alignItems: 'center', marginBottom: 25,
    borderWidth: 1, borderColor: '#eee', borderStyle: 'dashed', overflow: 'hidden'
  },
  placeholderContainer: { alignItems: 'center' },
  imagePreview: { width: '100%', height: '100%' },

  // Botón (Teal)
  saveButton: {
    backgroundColor: THEME_COLOR, borderRadius: 15, height: 55,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    shadowColor: THEME_COLOR, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, elevation: 5
  },
  disabledButton: { backgroundColor: THEME_DISABLED },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  labelSection: {
    fontSize: 16,
    fontWeight: 'bold',
    color: THEME_COLOR,
    marginTop: 20,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME_LIGHT,
    paddingBottom: 5,
  },
  itemRowOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAF9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  optionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  addOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  inlineInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 45,
    borderWidth: 1,
    borderColor: '#eee',
  },
  inlineAddBtn: {
    backgroundColor: THEME_COLOR,
    width: 45,
    height: 45,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default AddProductScreen;