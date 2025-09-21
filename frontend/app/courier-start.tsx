import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  rating: number;
  vehicle_type?: string;
  total_orders: number;
}

interface Order {
  id: string;
  package_description: string;
  pickup_address: string;
  delivery_address: string;
  status: string;
  created_at: string;
  delivery_fee?: number;
}

export default function CourierStartScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [startingWork, setStartingWork] = useState(false);

  useEffect(() => {
    loadUserData();
    fetchRecentOrders();
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
    } finally {
      setLoading(false);
    }
  };

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchRecentOrders = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/orders/history`, { headers });

      if (response.ok) {
        const orders = await response.json();
        setRecentOrders(orders.slice(0, 5)); // Son 5 sipariş
      }
    } catch (error) {
      console.error('Error fetching recent orders:', error);
    }
  };

  const startWork = async () => {
    setStartingWork(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/courier/start-work`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          location: 'current' // GPS konumu buraya eklenecek
        }),
      });

      if (response.ok) {
        // Dashboard'a yönlendir
        if (Platform.OS === 'web') {
          window.location.href = '/courier';
        } else {
          router.replace('/courier');
        }
      } else {
        if (Platform.OS === 'web') {
          alert('İşe başlama işlemi başarısız');
        } else {
          Alert.alert('Hata', 'İşe başlama işlemi başarısız');
        }
      }
    } catch (error) {
      console.error('Error starting work:', error);
      if (Platform.OS === 'web') {
        alert('Bağlantı hatası');
      } else {
        Alert.alert('Hata', 'Bağlantı hatası');
      }
    } finally {
      setStartingWork(false);
    }
  };

  const viewAllHistory = () => {
    router.push('/courier-history');
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['authToken', 'userData']);
    router.replace('/');
  };

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
      <ScrollView style={styles.scrollView}>
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
        </View>

        {/* Welcome Card */}
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeIcon}>
            <Ionicons name="car" size={48} color="#FF6B35" />
          </View>
          <Text style={styles.welcomeTitle}>İşe Başlamaya Hazır mısın?</Text>
          <Text style={styles.welcomeSubtitle}>
            Bugün {user?.total_orders || 0} sipariş teslim ettiniz.
            Yeni siparişler için hazır olun!
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.startWorkButton, startingWork && styles.disabledButton]}
            onPress={startWork}
            disabled={startingWork}
          >
            {startingWork ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="play-circle" size={24} color="#FFF" />
                <Text style={styles.startWorkText}>İşe Başla</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyButton}
            onPress={viewAllHistory}
          >
            <Ionicons name="time" size={20} color="#FF6B35" />
            <Text style={styles.historyButtonText}>Geçmiş Paketlerim</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Orders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Son Siparişlerim</Text>
          {recentOrders.length === 0 ? (
            <View style={styles.emptyStateSmall}>
              <Ionicons name="archive-outline" size={32} color="#CCC" />
              <Text style={styles.emptyTextSmall}>Henüz sipariş geçmişi yok</Text>
            </View>
          ) : (
            recentOrders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderTitle}>{order.package_description}</Text>
                  <View style={styles.addressContainer}>
                    <Ionicons name="location" size={12} color="#666" />
                    <Text style={styles.addressText} numberOfLines={1}>
                      {order.pickup_address}
                    </Text>
                  </View>
                  <Text style={styles.dateText}>
                    {new Date(order.created_at).toLocaleDateString('tr-TR')}
                  </Text>
                </View>
                <View style={styles.orderMeta}>
                  <Text style={styles.feeText}>₺{order.delivery_fee}</Text>
                  <View style={[styles.statusBadge, getStatusStyle(order.status)]}>
                    <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Tips */}
        <View style={styles.tipsSection}>
          <Text style={styles.tipsTitle}>💡 Günün İpuçları</Text>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.tipText}>Zamanında teslimat için puanınız artar</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.tipText}>Müşteri ile iletişimi koparmayın</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={styles.tipText}>Güvenli sürüş en önemli öncelik</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStatusText = (status: string) => {
  switch (status) {
    case 'delivered': return 'Teslim Edildi';
    case 'cancelled': return 'İptal Edildi';
    default: return 'Tamamlandı';
  }
};

const getStatusStyle = (status: string) => {
  switch (status) {
    case 'delivered': return { backgroundColor: '#4CAF50' };
    case 'cancelled': return { backgroundColor: '#F44336' };
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
  welcomeCard: {
    backgroundColor: '#FFF',
    margin: 20,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  actionSection: {
    paddingHorizontal: 20,
    gap: 12,
  },
  startWorkButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  disabledButton: {
    opacity: 0.6,
  },
  startWorkText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  historyButton: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  historyButtonText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
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
  emptyStateSmall: {
    alignItems: 'center',
    padding: 20,
  },
  emptyTextSmall: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  orderInfo: {
    flex: 1,
  },
  orderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  orderMeta: {
    alignItems: 'flex-end',
  },
  feeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  tipsSection: {
    backgroundColor: '#FFF',
    margin: 20,
    borderRadius: 12,
    padding: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
});