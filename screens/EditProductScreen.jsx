import React, { useState, useEffect } from 'react';
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

// --- PALETA COMERCIO (Ocean Teal) ---
const THEME_COLOR = '#1ABC9C';
const THEME_LIGHT = '#E8F8F5';
const THEME_BORDER = '#A3E4D7';
const DANGER_COLOR = '#E74C3C';

const EditProductScreen = ({ route, navigation }) => {
  const { productId } = route.params;
  const { user } = useAuth();

  // Estados
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState(null);

  // Nuevos estados para venta por peso/granel
  const [unitType, setUnitType] = useState('unit');
  const [minWeight, setMinWeight] = useState('');
  const [maxWeight, setMaxWeight] = useState('');

  // Switches
  const [isAvailable, setIsAvailable] = useState(true);
  const [isCustomizable, setIsCustomizable] = useState(false); // Agregamos este para consistencia
  const [saleLocation, setSaleLocation] = useState('feed');

  // Estados de Variantes y Modificadores
  const [variantGroupName, setVariantGroupName] = useState('Elige tu tamaño');
  const [modifierGroupName, setModifierGroupName] = useState('Ingredientes Extra');
  const [variants, setVariants] = useState([]);
  const [modifiers, setModifiers] = useState([]);

  const [newVariantName, setNewVariantName] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [newModifierName, setNewModifierName] = useState('');
  const [newModifierPrice, setNewModifierPrice] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await apiClient.get(`/mis-productos/${productId}/`);
        const p = response.data;
        setName(p.name);
        
        // Determinar qué precio mostrar
        const displayPrice = p.unit_type && p.unit_type !== 'unit' ? (p.unit_price || p.price) : p.price;
        setPrice(displayPrice ? displayPrice.toString() : '');
        
        setUnitType(p.unit_type || 'unit');
        setMinWeight(p.min_weight_kg ? p.min_weight_kg.toString() : '');
        setMaxWeight(p.max_weight_kg ? p.max_weight_kg.toString() : '');
        
        setDescription(p.description || '');
        setImage(p.image);
        setIsAvailable(p.is_available);
        setIsCustomizable(p.is_customizable || false);
        setSaleLocation(p.sale_location || 'feed');

        // Cargar variantes y modificadores
        setVariantGroupName(p.variant_group_name || 'Elige tu tamaño');
        setModifierGroupName(p.modifier_group_name || 'Ingredientes Extra');
        setVariants(p.variants || []);
        setModifiers(p.modifiers || []);
      } catch (error) {
        Alert.alert("Error", "No se pudo cargar el producto.");
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [4, 3], quality: 0.5,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const handleUpdate = async () => {
    setSaving(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('price', price);
    formData.append('description', description);
    formData.append('is_available', isAvailable);
    formData.append('is_customizable', isCustomizable);
    formData.append('sale_location', saleLocation);

    formData.append('unit_type', unitType);
    
    if (unitType !== 'unit') {
      formData.append('unit_price', price);
      if (minWeight) formData.append('min_weight_kg', minWeight);
      if (maxWeight) formData.append('max_weight_kg', maxWeight);
    }

    // Variantes y modificadores
    formData.append('variant_group_name', variantGroupName);
    formData.append('modifier_group_name', modifierGroupName);
    formData.append('variants', JSON.stringify(variants));
    formData.append('modifiers', JSON.stringify(modifiers));

    // Solo enviamos imagen si es una URI local (no empieza con http)
    if (image && !image.startsWith('http')) {
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
      await apiClient.patch(`/mis-productos/${productId}/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert("¡Actualizado!", "Los cambios se han guardado correctamente.");
      navigation.goBack();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "No se pudo actualizar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Eliminar Producto", "¿Estás seguro? Esta acción no se puede deshacer.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Sí, Eliminar", style: 'destructive', onPress: async () => {
            try {
              setSaving(true);
              await apiClient.delete(`/mis-productos/${productId}/`);
              navigation.goBack();
            } catch (error) {
              Alert.alert("Error", "No se pudo eliminar.");
              setSaving(false);
            }
        }}
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.mainContainer, {justifyContent: 'center', alignItems: 'center'}]}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor={THEME_COLOR} />

      {/* HEADER */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Editar Producto</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* TARJETA BLANCA */}
      <View style={styles.whiteCard}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

            {/* IMAGEN */}
            <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
              <Image source={{ uri: image || 'https://placehold.co/300' }} style={styles.image} />
              <View style={styles.cameraIcon}>
                <Ionicons name="camera" size={20} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* INPUTS */}
            <Text style={styles.label}>Nombre</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="fast-food-outline" size={20} color="#666" style={{marginRight: 10}} />
              <TextInput style={styles.input} value={name} onChangeText={setName} />
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

            <Text style={styles.label}>
              {unitType === 'unit' ? 'Precio ($)' : `Precio por ${unitType === 'kg' ? 'Kilo' : 'Litro'} ($)`}
            </Text>
            <View style={styles.inputContainer}>
              <Ionicons name="cash-outline" size={20} color="#666" style={{marginRight: 10}} />
              <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="numeric" />
            </View>

            {/* Inputs de Peso */}
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

            <Text style={styles.label}>Descripción</Text>
            <View style={[styles.inputContainer, {height: 80, alignItems: 'flex-start', paddingTop: 10}]}>
              <Ionicons name="document-text-outline" size={20} color="#666" style={{marginRight: 10, marginTop: 2}} />
              <TextInput style={[styles.input, {height: 60}]} value={description} onChangeText={setDescription} multiline placeholder="Descripción opcional" placeholderTextColor="#999" />
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

            {/* --- SWITCHES DE ESTADO --- */}

            {/* Disponibilidad */}
            <View style={styles.switchRow}>
                <View style={{flex: 1}}>
                  <Text style={styles.switchLabel}>Disponible en menú</Text>
                  <Text style={styles.switchSubLabel}>{isAvailable ? "Visible para clientes" : "Oculto (Agotado)"}</Text>
                </View>
                <Switch
                  value={isAvailable}
                  onValueChange={setIsAvailable}
                  trackColor={{ false: "#ccc", true: THEME_COLOR }}
                />
            </View>

            {/* Personalizable */}
            <View style={styles.switchRow}>
                <View style={{flex: 1}}>
                  <Text style={styles.switchLabel}>¿Permitir notas?</Text>
                  <Text style={styles.switchSubLabel}>El cliente puede personalizar el pedido</Text>
                </View>
                <Switch
                  value={isCustomizable}
                  onValueChange={setIsCustomizable}
                  trackColor={{ false: "#ccc", true: THEME_COLOR }}
                />
            </View>

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

            {/* BOTONES DE ACCIÓN */}
            <View style={{marginTop: 20}}>
              <TouchableOpacity
                style={[styles.saveButton, saving && {backgroundColor: '#ccc'}]}
                onPress={handleUpdate}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                    <Ionicons name="save-outline" size={20} color="#fff" style={{marginLeft: 10}}/>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteButton, saving && {opacity: 0.5}]}
                onPress={handleDelete}
                disabled={saving}
              >
                <Text style={styles.deleteButtonText}>Eliminar Producto</Text>
                <Ionicons name="trash-outline" size={20} color={DANGER_COLOR} style={{marginLeft: 10}}/>
              </TouchableOpacity>
            </View>

            <View style={{height: 40}} />

          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: THEME_COLOR },
  headerContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 60, paddingBottom: 20
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  whiteCard: { flex: 1, backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, overflow: 'hidden' },
  scrollContent: { padding: 25 },

  // Imagen
  imageContainer: { alignSelf: 'center', marginBottom: 20, position: 'relative' },
  image: { width: 120, height: 120, borderRadius: 15, backgroundColor: '#f0f0f0' },
  cameraIcon: {
    position: 'absolute', bottom: -5, right: -5, backgroundColor: THEME_COLOR,
    width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff'
  },

  // Inputs
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 5, marginTop: 10 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5',
    borderRadius: 12, paddingHorizontal: 15, height: 50, marginBottom: 10, borderWidth: 1, borderColor: '#eee'
  },
  input: { flex: 1, fontSize: 16, color: '#333' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },

  // Botones de Unidad
  unitTypeContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  unitBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: THEME_BORDER, alignItems: 'center', backgroundColor: '#f9f9f9' },
  unitBtnActive: { backgroundColor: THEME_COLOR, borderColor: THEME_COLOR },
  unitBtnText: { color: '#666', fontWeight: 'bold', fontSize: 12 },
  unitBtnTextActive: { color: '#fff' },

  // Switches
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0'
  },
  switchLabel: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  switchSubLabel: { fontSize: 12, color: 'gray', marginTop: 2 },

  // Botones
  saveButton: {
    backgroundColor: THEME_COLOR, borderRadius: 12, height: 55,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    shadowColor: THEME_COLOR, shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, elevation: 5, marginBottom: 15
  },
  saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 },

  deleteButton: {
    backgroundColor: '#FFF5F5', borderRadius: 12, height: 55,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#FEB2B2'
  },
  deleteButtonText: { color: DANGER_COLOR, fontWeight: 'bold', fontSize: 16 },
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

export default EditProductScreen;