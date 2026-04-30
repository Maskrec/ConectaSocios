import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const TermsScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#333333" />
      
      {/* HEADER */}
      <View style={styles.headerContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Términos y Condiciones</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* CONTENIDO */}
      <View style={styles.whiteCard}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.lastUpdate}>Última actualización: {new Date().toLocaleDateString()}</Text>

          <Text style={styles.title}>1. Introducción</Text>
          <Text style={styles.paragraph}>
            Bienvenido a ConectaLocal. Estas condiciones rigen el uso de nuestra plataforma tecnológica, 
            la cual actúa exclusivamente como un servicio de intermediación que conecta a usuarios (clientes), 
            comercios locales, socios repartidores y conductores de transporte privado o taxis.
          </Text>

          <Text style={styles.title}>2. Naturaleza del Servicio</Text>
          <Text style={styles.paragraph}>
            ConectaLocal NO es una empresa de transporte, logística ni un restaurante. Nuestro servicio 
            consiste en proporcionar una plataforma digital. Los socios repartidores y conductores son 
            contratistas independientes de libre ejercicio y no son empleados de ConectaLocal.
          </Text>

          <Text style={styles.title}>3. Condiciones para Clientes</Text>
          <Text style={styles.paragraph}>
            • El cliente se compromete a proporcionar información veraz para la entrega o recogida.{'\n'}
            • El pago de los servicios se realiza principalmente en efectivo al momento de la entrega o finalización del viaje.{'\n'}
            • El cliente se compromete a tratar con respeto a los socios y comercios. El uso del "Botón de Pánico" debe ser exclusivamente para emergencias reales.
          </Text>

          <Text style={styles.title}>4. Condiciones para Socios (Conductores y Repartidores)</Text>
          <Text style={styles.paragraph}>
            • <Text style={{fontWeight: 'bold'}}>Comisiones y Deudas:</Text> Al recibir pagos en efectivo, el socio retiene su ganancia y adquiere una deuda con la plataforma correspondiente a la comisión por intermediación.{'\n'}
            • <Text style={{fontWeight: 'bold'}}>Límites de Deuda:</Text> El sistema bloqueará automáticamente la recepción de nuevos viajes/pedidos si la deuda acumulada supera los $400 MXN (Repartidores) o $700 MXN (conductores). La liquidación debe realizarse directamente en la oficina autorizada.{'\n'}
            • <Text style={{fontWeight: 'bold'}}>Seguridad:</Text> Es obligatorio respetar las leyes de tránsito, usar equipo de protección (casco) y no manipular el dispositivo móvil mientras el vehículo está en movimiento.
          </Text>

          <Text style={styles.title}>5. Condiciones para Comercios</Text>
          <Text style={styles.paragraph}>
            • El comercio es el único responsable de la calidad, inocuidad y preparación de los alimentos o productos.{'\n'}
            • El comercio acepta el pago de la tarifa de uso de plataforma acordada (Ej. 6%) que será descontada al momento de la recolección del pedido.
          </Text>

          <Text style={styles.title}>6. Limitación de Responsabilidad</Text>
          <Text style={styles.paragraph}>
            ConectaLocal no se hace responsable por pérdidas, daños, accidentes de tránsito, intoxicaciones alimentarias 
            o disputas directas entre las partes. La plataforma facilita herramientas de seguridad y rastreo GPS, 
            pero la ejecución física del servicio recae sobre los contratistas independientes y comercios.
          </Text>

          <Text style={styles.title}>7. Aceptación</Text>
          <Text style={styles.paragraph}>
            Al crear una cuenta, ya sea como Usuario, Comercio o Socio, declaras haber leído, entendido y 
            aceptado la totalidad de estos Términos y Condiciones.
          </Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#333333' },
  headerContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? 40 : 60, paddingBottom: 20
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  backButton: { padding: 5 },
  whiteCard: {
    flex: 1, backgroundColor: '#fff',
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    overflow: 'hidden'
  },
  scrollContent: { padding: 25 },
  lastUpdate: { color: '#999', fontSize: 12, marginBottom: 20, fontStyle: 'italic' },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 15, marginBottom: 8 },
  paragraph: { fontSize: 14, color: '#555', lineHeight: 22, textAlign: 'justify' }
});

export default TermsScreen;