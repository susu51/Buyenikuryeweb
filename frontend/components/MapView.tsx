import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Platform
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Conditional import for native platforms only
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
}

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const { width, height } = Dimensions.get('window');

interface MapLocation {
  latitude: number;
  longitude: number;
  title?: string;
  description?: string;
  id?: string;
}

interface DeliveryMapProps {
  pickupLocation?: MapLocation;
  deliveryLocation?: MapLocation;
  courierLocation?: MapLocation;
  showRoute?: boolean;
  onLocationUpdate?: (location: MapLocation) => void;
  trackingMode?: boolean;
  style?: any;
}

export default function DeliveryMap({
  pickupLocation,
  deliveryLocation,
  courierLocation,
  showRoute = false,
  onLocationUpdate,
  trackingMode = false,
  style
}: DeliveryMapProps) {
  const [region, setRegion] = useState({
    latitude: 41.0082, // İstanbul default
    longitude: 28.9784,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  
  const [userLocation, setUserLocation] = useState<MapLocation | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<MapLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState(false);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useEffect(() => {
    if (showRoute && pickupLocation && deliveryLocation) {
      getRoute();
    }
  }, [showRoute, pickupLocation, deliveryLocation]);

  useEffect(() => {
    if (trackingMode && locationPermission) {
      startLocationTracking();
    }
  }, [trackingMode, locationPermission]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission(true);
        getCurrentLocation();
      } else {
        Alert.alert(
          'Konum İzni Gerekli',
          'Harita özelliklerini kullanmak için konum iznine ihtiyacımız var.',
          [
            { text: 'İptal', style: 'cancel' },
            { text: 'Ayarlara Git', onPress: () => Location.requestForegroundPermissionsAsync() }
          ]
        );
      }
    } catch (error) {
      console.error('Location permission error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setUserLocation(currentLocation);
      setRegion({
        ...currentLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      if (onLocationUpdate) {
        onLocationUpdate(currentLocation);
      }
    } catch (error) {
      console.error('Get location error:', error);
      Alert.alert('Hata', 'Mevcut konum alınamadı');
    }
  };

  const startLocationTracking = async () => {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Background location permission not granted');
      }

      // Start location updates
      const locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // 5 seconds
          distanceInterval: 10, // 10 meters
        },
        (location) => {
          const newLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          setUserLocation(newLocation);
          
          if (onLocationUpdate) {
            onLocationUpdate(newLocation);
          }

          // Send location to backend
          sendLocationToBackend(newLocation);
        }
      );

      return () => {
        locationSubscription.remove();
      };
    } catch (error) {
      console.error('Location tracking error:', error);
    }
  };

  const sendLocationToBackend = async (location: MapLocation) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      await fetch(`${BACKEND_URL}/api/location/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courier_id: 'current_user', // This should be actual user ID
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: 10,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Error sending location:', error);
    }
  };

  const getRoute = async () => {
    if (!pickupLocation || !deliveryLocation) return;

    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      const origin = `${pickupLocation.latitude},${pickupLocation.longitude}`;
      const destination = `${deliveryLocation.latitude},${deliveryLocation.longitude}`;

      const response = await fetch(
        `${BACKEND_URL}/api/maps/directions?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // For demo purposes, create a simple route
          const routePoints = [
            pickupLocation,
            {
              latitude: (pickupLocation.latitude + deliveryLocation.latitude) / 2,
              longitude: (pickupLocation.longitude + deliveryLocation.longitude) / 2,
            },
            deliveryLocation,
          ];
          setRouteCoordinates(routePoints);
        }
      }
    } catch (error) {
      console.error('Route error:', error);
    }
  };

  const centerMapOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      });
    }
  };

  const centerMapOnRoute = () => {
    if ((pickupLocation || deliveryLocation) && mapRef.current) {
      const locations = [pickupLocation, deliveryLocation, userLocation].filter(Boolean);
      if (locations.length > 0) {
        mapRef.current.fitToCoordinates(locations, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Harita yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={region}
        showsUserLocation={locationPermission}
        showsMyLocationButton={false}
        onRegionChangeComplete={setRegion}
        mapType="standard"
      >
        {/* Pickup Marker */}
        {pickupLocation && (
          <Marker
            coordinate={pickupLocation}
            title={pickupLocation.title || "Alım Noktası"}
            description={pickupLocation.description}
            pinColor="#4CAF50"
            identifier="pickup"
          />
        )}

        {/* Delivery Marker */}
        {deliveryLocation && (
          <Marker
            coordinate={deliveryLocation}
            title={deliveryLocation.title || "Teslimat Noktası"}
            description={deliveryLocation.description}
            pinColor="#FF6B35"
            identifier="delivery"
          />
        )}

        {/* Courier Marker */}
        {courierLocation && (
          <Marker
            coordinate={courierLocation}
            title="Kurye"
            description="Mevcut konum"
            identifier="courier"
          >
            <View style={styles.courierMarker}>
              <Ionicons name="car" size={24} color="#FFF" />
            </View>
          </Marker>
        )}

        {/* Route Polyline */}
        {showRoute && routeCoordinates.length > 1 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={4}
            strokeColor="#2196F3"
            lineDashPattern={[1]}
          />
        )}
      </MapView>

      {/* Map Controls */}
      <View style={styles.controls}>
        {locationPermission && (
          <TouchableOpacity style={styles.controlButton} onPress={centerMapOnUser}>
            <Ionicons name="locate" size={24} color="#333" />
          </TouchableOpacity>
        )}
        
        {(pickupLocation || deliveryLocation) && (
          <TouchableOpacity style={styles.controlButton} onPress={centerMapOnRoute}>
            <Ionicons name="resize" size={24} color="#333" />
          </TouchableOpacity>
        )}
      </View>

      {/* Map Info */}
      {(pickupLocation || deliveryLocation) && (
        <View style={styles.infoContainer}>
          {pickupLocation && (
            <View style={styles.infoItem}>
              <View style={[styles.infoIcon, { backgroundColor: '#4CAF50' }]} />
              <Text style={styles.infoText} numberOfLines={1}>
                {pickupLocation.title || 'Alım Noktası'}
              </Text>
            </View>
          )}
          {deliveryLocation && (
            <View style={styles.infoItem}>
              <View style={[styles.infoIcon, { backgroundColor: '#FF6B35' }]} />
              <Text style={styles.infoText} numberOfLines={1}>
                {deliveryLocation.title || 'Teslimat Noktası'}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  controls: {
    position: 'absolute',
    right: 16,
    top: 60,
    gap: 8,
  },
  controlButton: {
    backgroundColor: '#FFF',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  courierMarker: {
    backgroundColor: '#2196F3',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  infoContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
});