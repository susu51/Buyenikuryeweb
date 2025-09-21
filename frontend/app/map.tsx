import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

// Import MapView only on native platforms
let DeliveryMap: any = null;
if (Platform.OS !== 'web') {
  DeliveryMap = require('../components/MapView').default;
}

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface Order {
  id: string;
  pickup_address: string;
  delivery_address: string;
  package_description: string;
  status: string;
  pickup_coordinates?: { latitude: number; longitude: number };
  delivery_coordinates?: { latitude: number; longitude: number };
}

interface User {
  id: string;
  full_name: string;
  role: string;
}

export default function MapScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [courierLocation, setCourierLocation] = useState<any>(null);

  useEffect(() => {
    loadUserData();
    fetchActiveOrder();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
      } else {
        router.replace('/');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      router.replace('/');
    }
  };

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchActiveOrder = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/orders`, { headers });

      if (response.ok) {
        const orders = await response.json();
        // Find active order for courier
        const active = orders.find((order: Order) => 
          order.status === 'assigned' || order.status === 'picked_up' || order.status === 'in_transit'
        );
        
        if (active) {
          // Geocode addresses to get coordinates
          const orderWithCoords = await geocodeOrderAddresses(active);
          setActiveOrder(orderWithCoords);
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const geocodeOrderAddresses = async (order: Order) => {
    try {
      const headers = await getAuthHeaders();
      
      // Geocode pickup address
      const pickupResponse = await fetch(
        `${BACKEND_URL}/api/maps/geocode?address=${encodeURIComponent(order.pickup_address)}`,
        { method: 'POST', headers }
      );
      
      // Geocode delivery address
      const deliveryResponse = await fetch(
        `${BACKEND_URL}/api/maps/geocode?address=${encodeURIComponent(order.delivery_address)}`,
        { method: 'POST', headers }
      );

      let updatedOrder = { ...order };

      if (pickupResponse.ok) {
        const pickupData = await pickupResponse.json();
        if (pickupData.success) {
          updatedOrder.pickup_coordinates = pickupData.coordinates;
        }
      }

      if (deliveryResponse.ok) {
        const deliveryData = await deliveryResponse.json();
        if (deliveryData.success) {
          updatedOrder.delivery_coordinates = deliveryData.coordinates;
        }
      }

      return updatedOrder;
    } catch (error) {
      console.error('Geocoding error:', error);
      return order;
    }
  };

  const handleLocationUpdate = (location: any) => {
    setCourierLocation(location);
  };

  const updateOrderStatus = async (status: string) => {
    if (!activeOrder) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${BACKEND_URL}/api/orders/${activeOrder.id}/status?status=${status}`,
        { method: 'PUT', headers }
      );

      if (response.ok) {
        Alert.alert('Başarılı', 'Sipariş durumu güncellendi');
        await fetchActiveOrder();
      } else {
        const data = await response.json();
        Alert.alert('Hata', data.detail || 'Durum güncellenemedi');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Hata', 'Bağlantı hatası');
    }
  };

  const goBack = () => {
    if (user?.role === 'kurye') {
      router.replace('/courier');
    } else if (user?.role === 'musteri') {
      router.replace('/customer');
    } else {
      router.replace('/');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Harita yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Harita</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Map View */}
      <View style={styles.mapContainer}>
        {Platform.OS === 'web' || !DeliveryMap ? (
          <View style={styles.webMapPlaceholder}>
            <Ionicons name="map" size={64} color="#CCC" />
            <Text style={styles.webMapText}>Harita Görünümü</Text>
            <Text style={styles.webMapSubtext}>
              Mobil uygulamada Google Maps ile gerçek zamanlı konum takibi
            </Text>
            
            {/* Show location info for web */}
            {activeOrder && (
              <View style={styles.locationInfoWeb}>
                <View style={styles.locationItem}>
                  <View style={[styles.locationDot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={styles.locationText}>
                    Alım: {activeOrder.pickup_address}
                  </Text>
                </View>
                <View style={styles.locationItem}>
                  <View style={[styles.locationDot, { backgroundColor: '#FF6B35' }]} />
                  <Text style={styles.locationText}>
                    Teslimat: {activeOrder.delivery_address}
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <DeliveryMap
            pickupLocation={activeOrder?.pickup_coordinates ? {
              ...activeOrder.pickup_coordinates,
              title: 'Alım Noktası',
              description: activeOrder.pickup_address
            } : undefined}
            deliveryLocation={activeOrder?.delivery_coordinates ? {
              ...activeOrder.delivery_coordinates,
              title: 'Teslimat Noktası',
              description: activeOrder.delivery_address
            } : undefined}
            courierLocation={courierLocation}
            showRoute={!!activeOrder}
            trackingMode={user?.role === 'kurye'}
            onLocationUpdate={handleLocationUpdate}
          />
        )}
      </View>

      {/* Order Info Panel */}
      {activeOrder && (
        <View style={styles.orderPanel}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.orderHeader}>
              <Text style={styles.orderTitle}>{activeOrder.package_description}</Text>
              <View style={[styles.statusBadge, getStatusStyle(activeOrder.status)]}>
                <Text style={styles.statusText}>{getStatusText(activeOrder.status)}</Text>
              </View>
            </View>

            <View style={styles.addressContainer}>
              <View style={styles.addressItem}>
                <View style={[styles.addressIcon, { backgroundColor: '#4CAF50' }]}>
                  <Ionicons name="location" size={16} color="#FFF" />
                </View>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressLabel}>Alım Adresi</Text>
                  <Text style={styles.addressText}>{activeOrder.pickup_address}</Text>
                </View>
              </View>

              <View style={styles.addressSeparator} />

              <View style={styles.addressItem}>
                <View style={[styles.addressIcon, { backgroundColor: '#FF6B35' }]}>
                  <Ionicons name="flag" size={16} color="#FFF" />
                </View>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressLabel}>Teslimat Adresi</Text>
                  <Text style={styles.addressText}>{activeOrder.delivery_address}</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons - Only for couriers */}
            {user?.role === 'kurye' && (
              <View style={styles.actionButtons}>
                {activeOrder.status === 'assigned' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.pickupButton]}
                    onPress={() => updateOrderStatus('picked_up')}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                    <Text style={styles.actionButtonText}>Toplandı İşaretle</Text>
                  </TouchableOpacity>
                )}

                {activeOrder.status === 'picked_up' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.transitButton]}
                    onPress={() => updateOrderStatus('in_transit')}
                  >
                    <Ionicons name="car" size={20} color="#FFF" />
                    <Text style={styles.actionButtonText}>Yola Çık</Text>
                  </TouchableOpacity>
                )}

                {activeOrder.status === 'in_transit' && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deliveredButton]}
                    onPress={() => updateOrderStatus('delivered')}
                  >
                    <Ionicons name="checkmark-done-circle" size={20} color="#FFF" />
                    <Text style={styles.actionButtonText}>Teslim Edildi</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* No Active Order */}
      {!activeOrder && !loading && (
        <View style={styles.noOrderContainer}>
          <Ionicons name="map-outline" size={48} color="#CCC" />
          <Text style={styles.noOrderText}>Aktif sipariş bulunmuyor</Text>
          <Text style={styles.noOrderSubtext}>
            {user?.role === 'kurye' 
              ? 'Sipariş aldığınızda harita burada görünecek'
              : 'Siparişiniz kurye tarafından alındığında takip edebileceksiniz'
            }
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'assigned': return 'Atandı';
    case 'picked_up': return 'Toplandı';
    case 'in_transit': return 'Yolda';
    case 'delivered': return 'Teslim Edildi';
    default: return status;
  }
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'assigned': return { backgroundColor: '#2196F3' };
    case 'picked_up': return { backgroundColor: '#4CAF50' };
    case 'in_transit': return { backgroundColor: '#FF5722' };
    case 'delivered': return { backgroundColor: '#8BC34A' };
    default: return { backgroundColor: '#666' };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  mapContainer: {
    flex: 1,
  },
  orderPanel: {
    backgroundColor: '#FFF',
    maxHeight: 300,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  addressContainer: {
    marginBottom: 20,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  addressIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  addressSeparator: {
    height: 1,
    backgroundColor: '#E9ECEF',
    marginLeft: 44,
    marginVertical: 8,
  },
  actionButtons: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  pickupButton: {
    backgroundColor: '#4CAF50',
  },
  transitButton: {
    backgroundColor: '#2196F3',
  },
  deliveredButton: {
    backgroundColor: '#8BC34A',
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  noOrderContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  noOrderText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  noOrderSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});