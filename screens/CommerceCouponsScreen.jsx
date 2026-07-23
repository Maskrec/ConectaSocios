import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  Switch,
  Platform,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api';
import Alert from '../components/AlertPolyfill';

const THEME_COLOR = '#1ABC9C';

const CommerceCouponsScreen = ({ navigation }) => {
  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  // Form Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    max_discount_amount: '',
    min_order_amount: '',
    max_uses_total: '',
    max_uses_per_user: '1',
    start_date: '',
    end_date: '',
    is_active: true
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get('/coupons/');
      // Si el backend devuelve formato paginado, extraemos results, sino el array
      const data = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setCoupons(data);
    } catch (err) {
      console.error('Error fetching coupons:', err);
      Alert('Error', 'No se pudieron cargar tus cupones.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCoupon(null);
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    setFormData({
      code: '',
      title: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      max_discount_amount: '',
      min_order_amount: '0',
      max_uses_total: '',
      max_uses_per_user: '1',
      start_date: now.toISOString().split('T')[0],
      end_date: nextWeek.toISOString().split('T')[0],
      is_active: true
    });
    setModalVisible(true);
  };

  const handleOpenEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      title: coupon.title,
      description: coupon.description || '',
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value.toString(),
      max_discount_amount: coupon.max_discount_amount ? coupon.max_discount_amount.toString() : '',
      min_order_amount: coupon.min_order_amount.toString(),
      max_uses_total: coupon.max_uses_total ? coupon.max_uses_total.toString() : '',
      max_uses_per_user: coupon.max_uses_per_user.toString(),
      start_date: coupon.start_date.split('T')[0],
      end_date: coupon.end_date.split('T')[0],
      is_active: coupon.is_active
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    if (!formData.code || !formData.title || !formData.discount_value) {
      Alert('Atención', 'Por favor llena los campos requeridos (Código, Título y Valor).');
      return;
    }

    setIsSubmitLoading(true);

    const payload = {
      code: formData.code.trim().toUpperCase(),
      title: formData.title.trim(),
      description: formData.description.trim(),
      discount_type: formData.discount_type,
      discount_value: parseFloat(formData.discount_value),
      max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
      min_order_amount: parseFloat(formData.min_order_amount || '0'),
      max_uses_total: formData.max_uses_total ? parseInt(formData.max_uses_total) : null,
      max_uses_per_user: parseInt(formData.max_uses_per_user || '1'),
      start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date + 'T23:59:59').toISOString(),
      is_active: formData.is_active
    };

    try {
      if (editingCoupon) {
        await apiClient.put(`/coupons/${editingCoupon.id}/`, payload);
        Alert('Éxito', 'Cupón actualizado correctamente.');
      } else {
        await apiClient.post('/coupons/', payload);
        Alert('Éxito', 'Cupón creado correctamente.');
      }
      setModalVisible(false);
      fetchCoupons();
    } catch (err) {
      console.error('Error saving coupon:', err);
      let errMsg = 'Ocurrió un error al guardar el cupón.';
      if (err.response && err.response.data) {
        errMsg = Object.keys(err.response.data)
          .map(key => `${key}: ${JSON.stringify(err.response.data[key])}`)
          .join('\n');
      }
      Alert('Error', errMsg);
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleDelete = (couponId) => {
    Alert('Eliminar Cupón', '¿Estás seguro de que deseas eliminar este cupón de forma permanente?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/coupons/${couponId}/`);
            Alert('Eliminado', 'El cupón ha sido eliminado.');
            fetchCoupons();
          } catch (err) {
            console.error('Error deleting coupon:', err);
            Alert('Error', 'No se pudo eliminar el cupón.');
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={THEME_COLOR} />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cupones del Comercio</Text>
        <TouchableOpacity onPress={handleOpenAdd} style={styles.addButton}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={THEME_COLOR} style={styles.loader} />
      ) : coupons.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="gift-outline" size={80} color="#ccc" />
          <Text style={styles.emptyText}>No has creado cupones todavía.</Text>
          <TouchableOpacity style={styles.createFirstButton} onPress={handleOpenAdd}>
            <Text style={styles.createFirstButtonText}>Crear tu primer cupón</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={coupons}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          renderItem={({ item }) => (
            <View style={[styles.couponCard, !item.is_active && styles.inactiveCard]}>
              <View style={styles.couponLeft}>
                <Ionicons name="ticket" size={32} color={THEME_COLOR} />
                <Text style={styles.discountValueText}>
                  {item.discount_type === 'percentage' ? `${parseInt(item.discount_value)}%` : `$${parseInt(item.discount_value)}`}
                </Text>
              </View>

              <View style={styles.couponRight}>
                <View style={styles.cardHeader}>
                  <Text style={styles.couponTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={[styles.statusBadge, item.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                    <Text style={styles.statusText}>{item.is_active ? 'Activo' : 'Inactivo'}</Text>
                  </View>
                </View>

                <Text style={styles.couponCode}>{item.code}</Text>

                <Text style={styles.couponStats}>
                  Usos: {item.current_uses_count} {item.max_uses_total ? `/ ${item.max_uses_total}` : '(Sin límite)'}
                </Text>

                <View style={styles.cardActions}>
                  <Text style={styles.expiryText}>Vence: {item.end_date.split('T')[0]}</Text>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity onPress={() => handleOpenEdit(item)} style={styles.iconActionBtn}>
                      <Ionicons name="pencil" size={18} color="#666" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconActionBtn}>
                      <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* CREATE/EDIT MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCoupon ? 'Editar Cupón' : 'Nuevo Cupón'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Código del Cupón (Único)*</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: DESCUENTO10"
                value={formData.code}
                onChangeText={(val) => setFormData(prev => ({ ...prev, code: val.toUpperCase() }))}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Título*</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: 10% de descuento en tu compra"
                value={formData.title}
                onChangeText={(val) => setFormData(prev => ({ ...prev, title: val }))}
              />

              <Text style={styles.inputLabel}>Descripción (Opcional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Escribe detalles del cupón..."
                value={formData.description}
                onChangeText={(val) => setFormData(prev => ({ ...prev, description: val }))}
                multiline={true}
                numberOfLines={3}
              />

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Tipo de Descuento*</Text>
                  <View style={styles.pickerContainer}>
                    <TouchableOpacity
                      style={[styles.typeButton, formData.discount_type === 'percentage' && styles.typeButtonActive]}
                      onPress={() => setFormData(prev => ({ ...prev, discount_type: 'percentage' }))}
                    >
                      <Text style={[styles.typeButtonText, formData.discount_type === 'percentage' && styles.typeButtonTextActive]}>
                        Porcentaje (%)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.typeButton, formData.discount_type === 'fixed' && styles.typeButtonActive]}
                      onPress={() => setFormData(prev => ({ ...prev, discount_type: 'fixed' }))}
                    >
                      <Text style={[styles.typeButtonText, formData.discount_type === 'fixed' && styles.typeButtonTextActive]}>
                        Fijo ($)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ width: 120 }}>
                  <Text style={styles.inputLabel}>Valor*</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: 10"
                    keyboardType="numeric"
                    value={formData.discount_value}
                    onChangeText={(val) => setFormData(prev => ({ ...prev, discount_value: val }))}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Tope de Descuento ($)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: 100 (Opcional)"
                    keyboardType="numeric"
                    value={formData.max_discount_amount}
                    onChangeText={(val) => setFormData(prev => ({ ...prev, max_discount_amount: val }))}
                    disabled={formData.discount_type !== 'percentage'}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Compra Mínima ($)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: 200"
                    keyboardType="numeric"
                    value={formData.min_order_amount}
                    onChangeText={(val) => setFormData(prev => ({ ...prev, min_order_amount: val }))}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Fecha de Inicio (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2026-07-01"
                    value={formData.start_date}
                    onChangeText={(val) => setFormData(prev => ({ ...prev, start_date: val }))}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Fecha de Fin (YYYY-MM-DD)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2026-07-31"
                    value={formData.end_date}
                    onChangeText={(val) => setFormData(prev => ({ ...prev, end_date: val }))}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.inputLabel}>Límite de Usos Totales</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Opcional"
                    keyboardType="numeric"
                    value={formData.max_uses_total}
                    onChangeText={(val) => setFormData(prev => ({ ...prev, max_uses_total: val }))}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Usos por Usuario</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: 1"
                    keyboardType="numeric"
                    value={formData.max_uses_per_user}
                    onChangeText={(val) => setFormData(prev => ({ ...prev, max_uses_per_user: val }))}
                  />
                </View>
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>¿Cupón Activo?</Text>
                <Switch
                  value={formData.is_active}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, is_active: val }))}
                  trackColor={{ false: '#ccc', true: '#a3e4d7' }}
                  thumbColor={formData.is_active ? THEME_COLOR : '#f4f3f4'}
                />
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isSubmitLoading}>
                {isSubmitLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>{editingCoupon ? 'Guardar Cambios' : 'Crear Cupón'}</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF9F9',
  },
  header: {
    backgroundColor: THEME_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 25 : 15,
    paddingBottom: 20,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    padding: 5,
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    marginTop: 15,
    marginBottom: 20,
  },
  createFirstButton: {
    backgroundColor: THEME_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  createFirstButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  listContainer: {
    padding: 20,
  },
  couponCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  inactiveCard: {
    opacity: 0.6,
  },
  couponLeft: {
    width: 90,
    backgroundColor: '#E8F8F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#A3E4D7',
    paddingVertical: 20,
  },
  discountValueText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME_COLOR,
    marginTop: 5,
  },
  couponRight: {
    flex: 1,
    padding: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  couponTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeBadge: {
    backgroundColor: '#E8F8F5',
  },
  inactiveBadge: {
    backgroundColor: '#FADBD8',
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#666',
  },
  couponCode: {
    fontSize: 14,
    fontWeight: 'bold',
    color: THEME_COLOR,
    marginTop: 5,
    textTransform: 'uppercase',
  },
  couponStats: {
    fontSize: 11,
    color: '#888',
    marginTop: 3,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  expiryText: {
    fontSize: 11,
    color: '#aaa',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  iconActionBtn: {
    padding: 5,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  formScroll: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    height: 45,
    paddingHorizontal: 15,
    fontSize: 15,
    color: '#333',
    marginBottom: 10,
  },
  textArea: {
    height: 70,
    textAlignVertical: 'top',
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 5,
  },
  pickerContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 3,
    height: 45,
    alignItems: 'center',
  },
  typeButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  typeButtonActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
  },
  typeButtonText: {
    fontSize: 12,
    color: '#888',
    fontWeight: 'bold',
  },
  typeButtonTextActive: {
    color: THEME_COLOR,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 15,
    backgroundColor: '#FAF9F9',
    padding: 15,
    borderRadius: 10,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#444',
  },
  submitButton: {
    backgroundColor: THEME_COLOR,
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CommerceCouponsScreen;
