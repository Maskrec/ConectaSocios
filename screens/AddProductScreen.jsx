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

// --- PALETA DE COLORES COMERCIO ---
const THEME_COLOR = '#1ABC9C';      // Ocean Teal (Principal)
const THEME_LIGHT = '#E8F8F5';      // Fondo Suave (Teal muy claro)
const THEME_BORDER = '#A3E4D7';     // Borde suave
const THEME_DISABLED = '#A2D9CE';   // Color para estados deshabilitados

const AddProductScreen = ({ navigation }) => {
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

  const [loading, setLoading] = useState(false);

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

    if (image) {
      const filename = image.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;
      formData.append('image', { uri: image, name: filename, type });
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
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

            {/* Input Nombre */}
            <Text style={styles.label}>Nombre del Platillo</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="fast-food-outline" size={20} color="#666" style={{marginRight: 10}} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Ej. Hamburguesa Doble"
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
              />
            </View>

            {/* Inputs de Peso (Solo si no es unidad) */}
            {unitType !== 'unit' && (
              <View style={styles.row}>
                <View style={[styles.inputContainer, {flex: 1, marginRight: 5}]}>
                  <TextInput style={styles.input} placeholder="Mínimo (ej. 0.5)" value={minWeight} onChangeText={setMinWeight} keyboardType="numeric" />
                </View>
                <View style={[styles.inputContainer, {flex: 1, marginLeft: 5}]}>
                  <TextInput style={styles.input} placeholder="Máximo (ej. 5)" value={maxWeight} onChangeText={setMaxWeight} keyboardType="numeric" />
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
              />
            </View>

            {/* --- SWITCH DE PERSONALIZACIÓN (Estilo Teal) --- */}
            <View style={styles.switchContainer}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.switchTitle}>¿Es personalizable?</Text>
                <Text style={styles.switchSubtitle}>
                  Activa esto si el cliente puede añadir notas (ej. "Sin cebolla", "Salsa aparte").
                </Text>
              </View>
              <Switch
                trackColor={{ false: "#767577", true: THEME_COLOR }} // Track Teal cuando está activo
                thumbColor={isCustomizable ? "#fff" : "#f4f3f4"}
                onValueChange={setIsCustomizable}
                value={isCustomizable}
              />
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
});

export default AddProductScreen;