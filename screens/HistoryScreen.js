import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api';

const HistoryScreen = ({ navigation }) => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await apiClient.get('/mis-entregas-historial/');
      const data = response.data;

      // Agrupar por Mes usando Intl.DateTimeFormat (Nativo de JS)
      const grouped = data.reduce((acc, order) => {
        const date = new Date(order.created_at);

        // Formatear: "Febrero 2026"
        const month = date.toLocaleString('es-ES', { month: 'long' });
        const year = date.getFullYear();
        const key = month.charAt(0).toUpperCase() + month.slice(1) + " " + year;

        if (!acc[key]) acc[key] = [];
        acc[key].push(order);
        return acc;
      }, {});

      // Convertir a formato SectionList
      const result = Object.keys(grouped).map(key => ({
        title: key,
        data: grouped[key]
      }));

      setSections(result);
    } catch (error) {
      console.error("Error al cargar historial:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => {
    const isCancelled = item.status === 'cancelled';
    const date = new Date(item.created_at);

    return (
      <View style={[styles.itemCard, isCancelled ? styles.borderRed : styles.borderGreen]}>
         <View style={{flex: 1}}>
            <Text style={styles.commerceName}>{item.commerce_name || "Comercio desconocido"}</Text>
            <Text style={styles.dateText}>
                {date.toLocaleDateString('es-ES')} • {date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
            </Text>
         </View>
         <View style={{alignItems: 'flex-end'}}>
             <Text style={{fontWeight:'bold', color: isCancelled ? '#E74C3C' : '#2ECC71', fontSize: 11}}>
                 {isCancelled ? 'CANCELADO' : 'ENTREGADO'}
             </Text>
             {!isCancelled && <Text style={styles.priceText}>+${item.delivery_fee}</Text>}
         </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
             <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historial de Entregas</Text>
        <View style={{width: 44}} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#5D5FEF" style={{marginTop: 50}} />
      ) : sections.length === 0 ? (
        <View style={styles.emptyContainer}>
            <Ionicons name="documents-outline" size={60} color="#ccc" />
            <Text style={{color:'#888', marginTop: 10}}>No hay pedidos registrados aún</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeaderContainer}>
                <Text style={styles.sectionHeader}>{title}</Text>
            </View>
          )}
          contentContainerStyle={{padding: 20, paddingBottom: 40}}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 45, // Ajuste para barra de estado
    paddingBottom: 15,
    paddingHorizontal: 10,
    backgroundColor: 'white',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5
  },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },

  sectionHeaderContainer: { backgroundColor: '#F8F9FA', paddingTop: 15, paddingBottom: 5 },
  sectionHeader: { fontSize: 17, fontWeight: 'bold', color: '#5D5FEF' },

  itemCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  borderGreen: { borderLeftColor: '#2ECC71' },
  borderRed: { borderLeftColor: '#E74C3C' },

  commerceName: { fontWeight: 'bold', fontSize: 15, color: '#333' },
  dateText: { color: '#888', fontSize: 12, marginTop: 4 },
  priceText: { color: '#2ECC71', fontWeight: 'bold', fontSize: 16, marginTop: 4 },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', flex: 1 },
});

export default HistoryScreen;