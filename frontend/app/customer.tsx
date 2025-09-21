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
  Platform
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

interface CustomerStats {
  total_orders: number;
  pending_orders: number;
  delivered_orders: number;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export default function CustomerDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUserData();
    fetchData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        if (parsedUser.role !== 'musteri') {
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

  const logout = async () => {
    await AsyncStorage.multiRemove(['authToken', 'userData']);
    router.replace('/');
  };

  const approveOrder = async (orderId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/orders/${orderId}/approve`, {
        method: 'POST',
        headers,
      });

      if (response.ok) {
        if (Platform.OS === 'web') {
          alert('Sipariş onaylandı! Yakında bir kurye atanacak.');
        } else {
          Alert.alert('Başarılı', 'Sipariş onaylandı! Yakında bir kurye atanacak.');
        }
        await fetchData(); // Refresh data
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Onay başarısız' }));
        if (Platform.OS === 'web') {
          alert('Hata: ' + errorData.detail);
        } else {
          Alert.alert('Hata', errorData.detail);
        }
      }
    } catch (error) {
      console.error('Order approval error:', error);
      if (Platform.OS === 'web') {
        alert('Bağlantı hatası');
      } else {
        Alert.alert('Hata', 'Bağlantı hatası');
      }
    }
  };

  const rejectOrder = async (orderId: string) => {
    const confirmReject = Platform.OS === 'web' 
      ? window.confirm('Siparişi reddetmek istediğinizden emin misiniz?')
      : await new Promise((resolve) => {
          Alert.alert(
            'Sipariş Reddi',
            'Siparişi reddetmek istediğinizden emin misiniz?',
            [
              { text: 'İptal', onPress: () => resolve(false) },
              { text: 'Reddet', onPress: () => resolve(true) }
            ]
          );
        });

    if (!confirmReject) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/orders/${orderId}/reject`, {
        method: 'POST',
        headers,
      });

      if (response.ok) {
        if (Platform.OS === 'web') {
          alert('Sipariş reddedildi.');
        } else {
          Alert.alert('Başarılı', 'Sipariş reddedildi.');
        }
        await fetchData(); // Refresh data
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Red işlemi başarısız' }));
        if (Platform.OS === 'web') {
          alert('Hata: ' + errorData.detail);
        } else {
          Alert.alert('Hata', errorData.detail);
        }
      }
    } catch (error) {
      console.error('Order rejection error:', error);
      if (Platform.OS === 'web') {
        alert('Bağlantı hatası');
      } else {
        Alert.alert('Hata', 'Bağlantı hatası');
      }
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
      case 'pending': return 'Kurye Bekleniyor';
      case 'assigned': return 'Kuryeye Atandı';
      case 'picked_up': return 'Toplandı';
      case 'in_transit': return 'Yolda';
      case 'delivered': return 'Teslim Edildi';
      case 'cancelled': return 'İptal Edildi';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return 'time';
      case 'assigned': return 'person';
      case 'picked_up': return 'checkmark-circle';
      case 'in_transit': return 'car';
      case 'delivered': return 'checkmark-done-circle';
      case 'cancelled': return 'close-circle';
      default: return 'help-circle';
    }
  };

  const trackOrder = (order: Order) => {
    if (order.courier_id) {
      Alert.alert('Takip', `Siparişiniz ${getStatusText(order.status)} durumunda`, [
        { text: 'Haritada Göster', onPress: () => {
          // TODO: Navigate to map screen
          Alert.alert('Bilgi', 'Harita özelliği yakında eklenecek');
        }},
        { text: 'Tamam' }
      ]);
    } else {
      Alert.alert('Bilgi', 'Sipariş henüz bir kuryeye atanmadı');
    }
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
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.welcomeText}>Hoş geldin</Text>
            <Text style={styles.userName}>{user?.full_name}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Ionicons name="log-out" size={24} color="#FF6B35" />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Ionicons name="cube" size={24} color="#2196F3" />
              <Text style={styles.statNumber}>{stats.total_orders}</Text>
              <Text style={styles.statLabel}>Toplam Sipariş</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time" size={24} color="#FF9800" />
              <Text style={styles.statNumber}>{stats.pending_orders}</Text>
              <Text style={styles.statLabel}>Aktif Sipariş</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={styles.statNumber}>{stats.delivered_orders}</Text>
              <Text style={styles.statLabel}>Teslim Edilen</Text>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionSection}>
          <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionCard}>
              <Ionicons name="checkmark-circle" size={32} color="#4CAF50" />
              <Text style={styles.actionText}>Siparişi Onayla</Text>
              <Text style={styles.actionSubtext}>Bekleyen siparişleri onayla</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard}>
              <Ionicons name="help-circle" size={32} color="#2196F3" />
              <Text style={styles.actionText}>Destek</Text>
              <Text style={styles.actionSubtext}>Yardım al</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Orders List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Siparişlerim</Text>
          {orders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Henüz sipariş bulunmuyor</Text>
              <Text style={styles.emptySubtext}>
                Siparişleriniz işletmeler tarafından oluşturulacak
              </Text>
            </View>
          ) : (
            orders.map((order) => (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderInfo}>
                    <View style={styles.statusContainer}>
                      <Ionicons 
                        name={getStatusIcon(order.status)} 
                        size={16} 
                        color={getStatusColor(order.status)} 
                      />
                      <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
                        {getStatusText(order.status)}
                      </Text>
                    </View>
                    <Text style={styles.orderTitle}>{order.package_description}</Text>
                    <View style={styles.addressContainer}>
                      <Ionicons name="location" size={14} color="#666" />
                      <Text style={styles.addressText} numberOfLines={1}>
                        Alım: {order.pickup_address}
                      </Text>
                    </View>
                    <View style={styles.addressContainer}>
                      <Ionicons name="flag" size={14} color="#666" />
                      <Text style={styles.addressText} numberOfLines={1}>
                        Teslimat: {order.delivery_address}
                      </Text>
                    </View>
                    <View style={styles.orderMeta}>
                      <Text style={styles.dateText}>
                        {new Date(order.created_at).toLocaleDateString('tr-TR')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={styles.feeText}>₺{order.delivery_fee}</Text>
                    {order.courier_id && ['assigned', 'picked_up', 'in_transit'].includes(order.status) && (
                      <TouchableOpacity
                        style={styles.trackButton}
                        onPress={() => trackOrder(order)}
                      >
                        <Ionicons name="location" size={16} color="#FFF" />
                        <Text style={styles.trackButtonText}>Takip Et</Text>
                      </TouchableOpacity>
                    )}
                    {order.courier_id && ['assigned', 'picked_up', 'in_transit'].includes(order.status) && (
                      <TouchableOpacity
                        style={[styles.trackButton, { backgroundColor: '#2196F3', marginTop: 4 }]}
                        onPress={() => router.push('/map')}
                      >
                        <Ionicons name="map" size={16} color="#FFF" />
                        <Text style={styles.trackButtonText}>Haritada Göster</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {order.special_instructions && (
                  <View style={styles.instructionsContainer}>
                    <Ionicons name="information-circle" size={16} color="#666" />
                    <Text style={styles.instructionsText}>{order.special_instructions}</Text>
                  </View>
                )}

                {/* Delivery Progress */}
                {order.status !== 'pending' && order.status !== 'cancelled' && (
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { width: getProgressWidth(order.status) }
                        ]} 
                      />
                    </View>
                    <View style={styles.progressSteps}>
                      <View style={styles.progressStep}>
                        <Text style={styles.progressStepText}>Atandı</Text>
                      </View>
                      <View style={styles.progressStep}>
                        <Text style={styles.progressStepText}>Toplandı</Text>
                      </View>
                      <View style={styles.progressStep}>
                        <Text style={styles.progressStepText}>Yolda</Text>
                      </View>
                      <View style={styles.progressStep}>
                        <Text style={styles.progressStepText}>Teslim</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Order Approval Button for Pending Orders */}
                {order.status === 'pending' && (
                  <View style={styles.approvalContainer}>
                    <Text style={styles.approvalText}>
                      Bu sipariş sizin için oluşturuldu. Onaylamak istiyor musunuz?
                    </Text>
                    <View style={styles.approvalButtons}>
                      <TouchableOpacity 
                        style={styles.approveButton}
                        onPress={() => approveOrder(order.id)}
                      >
                        <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                        <Text style={styles.approveButtonText}>Siparişi Onayla</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.rejectButton}
                        onPress={() => rejectOrder(order.id)}
                      >
                        <Ionicons name="close-circle" size={20} color="#FFF" />
                        <Text style={styles.rejectButtonText}>Reddet</Text>
                      </TouchableOpacity>
                    </View>
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

const getProgressWidth = (status: string) => {
  switch (status) {
    case 'assigned': return '25%';
    case 'picked_up': return '50%';
    case 'in_transit': return '75%';
    case 'delivered': return '100%';
    default: return '0%';
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
  logoutButton: {
    padding: 8,
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
  actionSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  actionSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  section: {
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#CCC',
    marginTop: 8,
    textAlign: 'center',
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
  orderRight: {
    alignItems: 'flex-end',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
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
    marginTop: 8,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  feeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  trackButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  trackButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  instructionsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 12,
    padding: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
  },
  instructionsText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E9ECEF',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
  },
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  progressStep: {
    flex: 1,
    alignItems: 'center',
  },
  progressStepText: {
    fontSize: 10,
    color: '#666',
  },
});