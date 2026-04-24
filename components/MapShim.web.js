import React from 'react';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';

// Toma la llave web de tu .env de forma automática y segura
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const MapViewWeb = ({
  style,
  initialRegion,
  onPress,
  children
}) => {
  // Convertimos el formato de región de Expo al formato de Google Web
  const center = {
    lat: initialRegion?.latitude || 0,
    lng: initialRegion?.longitude || 0
  };

  const handleMapClick = (e) => {
    if (onPress && e.detail.latLng) {
      // Simulamos el evento nativo para que tus pantallas no noten la diferencia
      onPress({
        nativeEvent: {
          coordinate: {
            latitude: e.detail.latLng.lat,
            longitude: e.detail.latLng.lng
          }
        }
      });
    }
  };

  return (
    <div style={{ ...style, width: '100%', overflow: 'hidden' }}>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={15}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          onClick={handleMapClick}
          style={{ width: '100%', height: '100%' }}
        >
          {children}
        </Map>
      </APIProvider>
    </div>
  );
};

export const MarkerWeb = ({ coordinate, title }) => (
  <Marker
    position={{ lat: coordinate.latitude, lng: coordinate.longitude }}
    title={title}
  />
);

export const Polyline = () => null; 
export const Callout = ({ children }) => <div style={{ display: 'none' }}>{children}</div>;
export const PROVIDER_GOOGLE = 'google';

export { MarkerWeb as Marker };
export default MapViewWeb;