import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface Order {
  id: string;
  customer_id: string;
  business_id: string;
  courier_id?: string;
  pickup_address: string;
  delivery_address: string;
  pickup_phone: string;
  delivery_phone: string;
  package_description: string;
  special_instructions?: string;
  estimated_weight?: number;
  estimated_value?: number;
  status: string;
  created_at: string;
  delivery_fee?: number;
}

interface CourierStats {
  total_deliveries: number;
  pending_orders: number;
  total_earnings: number;
  rating: number;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  rating: number;
  vehicle_type?: string;
}

export default function CourierDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<CourierStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningOrder, setAssigningOrder] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();
    fetchData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        if (parsedUser.role !== 'kurye') {
          router.replace('/');
          return;
        }
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

  const fetchData = async () => {
    try {
      const headers = await getAuthHeaders();
      
      // Fetch orders and stats in parallel
      const [ordersResponse, statsResponse] = await Promise.all([
        fetch(`${BACKEND_URL}/api/orders`, { headers }),
        fetch(`${BACKEND_URL}/api/dashboard/stats`, { headers })
      ]);

      if (ordersResponse.ok) {
        const ordersData = await ordersResponse.json();
        setOrders(ordersData);
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Hata', 'Veriler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const assignOrder = async (orderId: string) => {
    setAssigningOrder(orderId);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/orders/${orderId}/assign`, {
        method: 'POST',
        headers,
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Başarılı', 'Sipariş alındı!');
        await fetchData(); // Refresh data
      } else {
        Alert.alert('Hata', data.detail || 'Sipariş alınamadı');
      }
    } catch (error) {
      console.error('Error assigning order:', error);
      Alert.alert('Hata', 'Bağlantı hatası');
    } finally {
      setAssigningOrder(null);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/orders/${orderId}/status?status=${status}`, {
        method: 'PUT',
        headers,
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Başarılı', 'Sipariş durumu güncellendi');
        await fetchData(); // Refresh data
      } else {
        Alert.alert('Hata', data.detail || 'Durum güncellenemedi');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      Alert.alert('Hata', 'Bağlantı hatası');
    }
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['authToken', 'userData']);
    router.replace('/');
  };

  const openDirections = (order: Order) => {
    const destination = encodeURIComponent(order.delivery_address);
    
    if (Platform.OS === 'web') {
      // Web'de hem Google Maps hem Apple Maps linklerini göster
      const confirmMessage = `${order.delivery_address} adresine yol tarifi:\n\n1. Google Maps için "Tamam"\n2. Apple Maps için "İptal"`;
      
      if (window.confirm(confirmMessage)) {
        // Google Maps
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
      } else {
        // Apple Maps (web'de çalışmaz ama link verilebilir)
        window.open(`https://maps.apple.com/?daddr=${destination}`, '_blank');
      }
    } else {
      // Mobile'da seçenek sunalım
      Alert.alert(
        'Yol Tarifi',
        `${order.delivery_address} adresine hangi harita uygulamasıyla gitmek istersiniz?`,
        [
          {
            text: 'Google Maps',
            onPress: () => {
              const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
              Linking.openURL(url);
            }
          },
          {
            text: 'Apple Maps',
            onPress: () => {
              const url = `https://maps.apple.com/?daddr=${destination}`;
              Linking.openURL(url);
            }
          },
          {
            text: 'İptal',
            style: 'cancel'
          }
        ]
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#FF9800';
      case 'assigned': return '#2196F3';
      case 'picked_up': return '#4CAF50';
      case 'in_transit': return '#FF5722';
      case 'delivered': return '#8BC34A';
      case 'cancelled': return '#F44336';
      default: return '#666';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Bekliyor';
      case 'assigned': return 'Atandı';
      case 'picked_up': return 'Toplandı';
      case 'in_transit': return 'Yolda';
      case 'delivered': return 'Teslim Edildi';
      case 'cancelled': return 'İptal Edildi';
      default: return status;
    }
  };

  const availableOrders = orders.filter(order => order.status === 'pending' && !order.courier_id);
  const myOrders = orders.filter(order => order.courier_id === user?.id);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.welcomeText}>Hoş geldin</Text>
            <Text style={styles.userName}>{user?.full_name}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={16} color="#FFD700" />
              <Text style={styles.ratingText}>{user?.rating?.toFixed(1)}</Text>
              {user?.vehicle_type && (
                <Text style={styles.vehicleText}>• {user.vehicle_type}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Ionicons name="log-out" size={24} color="#FF6B35" />
          </TouchableOpacity>
          {Platform.OS !== 'web' && (
            <TouchableOpacity 
              style={styles.mapButton} 
              onPress={() => router.push('/map')}
            >
              <Ionicons name="map" size={24} color="#2196F3" />
            </TouchableOpacity>
          )}
        </View>

        {/* Stats Cards */}
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Ionicons name="car" size={24} color="#4CAF50" />
              <Text style={styles.statNumber}>{stats.total_deliveries}</Text>
              <Text style={styles.statLabel}>Tamamlanan</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time" size={24} color="#FF9800" />
              <Text style={styles.statNumber}>{stats.pending_orders}</Text>
              <Text style={styles.statLabel}>Aktif Sipariş</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="wallet" size={24} color="#2196F3" />
              <Text style={styles.statNumber}>₺{stats.total_earnings}</Text>
              <Text style={styles.statLabel}>Toplam Kazanç</Text>
            </View>
          </View>
        )}

        {/* Available Orders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Müsait Siparişler</Text>
          {availableOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="bicycle" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Şu anda müsait sipariş yok</Text>
            </View>
          ) : (
            availableOrders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderTitle}>{order.package_description}</Text>
                    <View style={styles.addressContainer}>
                      <Ionicons name="location" size={14} color="#666" />
                      <Text style={styles.addressText} numberOfLines={1}>
                        {order.pickup_address}
                      </Text>
                    </View>
                    <View style={styles.addressContainer}>
                      <Ionicons name="flag" size={14} color="#666" />
                      <Text style={styles.addressText} numberOfLines={1}>
                        {order.delivery_address}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.orderMeta}>
                    <Text style={styles.feeText}>₺{order.delivery_fee}</Text>
                    {order.estimated_weight && (
                      <Text style={styles.weightText}>{order.estimated_weight}kg</Text>
                    )}
                  </View>
                </View>
                
                <TouchableOpacity
                  style={[styles.assignButton, assigningOrder === order.id && styles.disabledButton]}
                  onPress={() => assignOrder(order.id)}
                  disabled={assigningOrder === order.id}
                >
                  {assigningOrder === order.id ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.assignButtonText}>Siparişi Al</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {/* My Orders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Siparişlerim</Text>
          {myOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="list" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Henüz sipariş almadınız</Text>
            </View>
          ) : (
            myOrders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderInfo}>
                    <View style={styles.statusContainer}>
                      <View style={[styles.statusDot, { backgroundColor: getStatusColor(order.status) }]} />
                      <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
                    </View>
                    <Text style={styles.orderTitle}>{order.package_description}</Text>
                    <View style={styles.addressContainer}>
                      <Ionicons name="location" size={14} color="#666" />
                      <Text style={styles.addressText} numberOfLines={1}>
                        {order.pickup_address}
                      </Text>
                    </View>
                    <View style={styles.addressContainer}>
                      <Ionicons name="flag" size={14} color="#666" />
                      <Text style={styles.addressText} numberOfLines={1}>
                        {order.delivery_address}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.orderMeta}>
                    <Text style={styles.feeText}>₺{order.delivery_fee}</Text>
                  </View>
                </View>

                {/* Action Buttons */}
                {order.status === 'assigned' && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => updateOrderStatus(order.id, 'picked_up')}
                  >
                    <Text style={styles.actionButtonText}>Toplandı İşaretle</Text>
                  </TouchableOpacity>
                )}
                {order.status === 'picked_up' && (
                  <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.routeButton]}
                      onPress={() => openDirections(order)}
                    >
                      <Ionicons name="navigate" size={16} color="#FFF" />
                      <Text style={styles.actionButtonText}>Yol Tarifi</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => updateOrderStatus(order.id, 'in_transit')}
                    >
                      <Text style={styles.actionButtonText}>Yola Çık</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {order.status === 'in_transit' && (
                  <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.routeButton]}
                      onPress={() => openDirections(order)}
                    >
                      <Ionicons name="navigate" size={16} color="#FFF" />
                      <Text style={styles.actionButtonText}>Yol Tarifi</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deliveredButton]}
                      onPress={() => updateOrderStatus(order.id, 'delivered')}
                    >
                      <Text style={styles.actionButtonText}>Teslim Edildi</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  headerLeft: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  vehicleText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  logoutButton: {
    padding: 8,
  },
  mapButton: {
    padding: 8,
    marginLeft: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderInfo: {
    flex: 1,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    flex: 1,
  },
  orderMeta: {
    alignItems: 'flex-end',
  },
  feeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  weightText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  assignButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.6,
  },
  assignButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  deliveredButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  routeButton: {
    backgroundColor: '#2196F3',
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});