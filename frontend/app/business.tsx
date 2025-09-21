import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
  ActivityIndicator
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

interface BusinessStats {
  total_orders: number;
  pending_orders: number;
  delivered_orders: number;
  success_rate: number;
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  business_name?: string;
}

export default function BusinessDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<BusinessStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create order form
  const [customerEmail, setCustomerEmail] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [pickupPhone, setPickupPhone] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [packageDescription, setPackageDescription] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [estimatedWeight, setEstimatedWeight] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');

  useEffect(() => {
    loadUserData();
    fetchData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const parsedUser = JSON.parse(userData);
        if (parsedUser.role !== 'isletme') {
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

  const resetForm = () => {
    setCustomerEmail('');
    setPickupAddress('');
    setDeliveryAddress('');
    setPickupPhone('');
    setDeliveryPhone('');
    setPackageDescription('');
    setSpecialInstructions('');
    setEstimatedWeight('');
    setEstimatedValue('');
  };

  const createOrder = async () => {
    if (!customerEmail || !pickupAddress || !deliveryAddress || !pickupPhone || !deliveryPhone || !packageDescription) {
      Alert.alert('Hata', 'Lütfen gerekli alanları doldurun');
      return;
    }

    setCreating(true);
    try {
      const headers = await getAuthHeaders();
      const orderData = {
        customer_email: customerEmail.toLowerCase(),
        pickup_address: pickupAddress,
        delivery_address: deliveryAddress,
        pickup_phone: pickupPhone,
        delivery_phone: deliveryPhone,
        package_description: packageDescription,
        special_instructions: specialInstructions || null,
        estimated_weight: estimatedWeight ? parseFloat(estimatedWeight) : null,
        estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
      };

      console.log('Creating order with data:', orderData);

      const response = await fetch(`${BACKEND_URL}/api/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify(orderData),
      });

      console.log('Order creation response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Order created successfully:', data);
        
        // Success message with platform-specific handling
        if (Platform.OS === 'web') {
          alert('Sipariş başarıyla oluşturuldu!');
        } else {
          Alert.alert('Başarılı', 'Sipariş oluşturuldu!');
        }
        
        setShowCreateModal(false);
        resetForm();
        await fetchData();
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Bilinmeyen hata' }));
        console.log('Order creation error:', errorData);
        
        if (Platform.OS === 'web') {
          alert('Hata: ' + (errorData.detail || 'Sipariş oluşturulamadı'));
        } else {
          Alert.alert('Hata', errorData.detail || 'Sipariş oluşturulamadı');
        }
      }
    } catch (error) {
      console.error('Order creation network error:', error);
      
      if (Platform.OS === 'web') {
        alert('Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.');
      } else {
        Alert.alert('Hata', 'Bağlantı hatası');
      }
    } finally {
      setCreating(false);
    }
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['authToken', 'userData']);
    router.replace('/');
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
            <Text style={styles.welcomeText}>İşletme Paneli</Text>
            <Text style={styles.userName}>{user?.business_name || user?.full_name}</Text>
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
              <Text style={styles.statLabel}>Bekleyen</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={styles.statNumber}>{stats.delivered_orders}</Text>
              <Text style={styles.statLabel}>Teslim Edilen</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="trending-up" size={24} color="#8BC34A" />
              <Text style={styles.statNumber}>%{stats.success_rate}</Text>
              <Text style={styles.statLabel}>Başarı Oranı</Text>
            </View>
          </View>
        )}

        {/* Create Order Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={styles.createOrderButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add" size={24} color="#FFF" />
            <Text style={styles.createOrderText}>Yeni Sipariş Oluştur</Text>
          </TouchableOpacity>
        </View>

        {/* Orders List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Siparişlerim</Text>
          {orders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Henüz sipariş oluşturmadınız</Text>
            </View>
          ) : (
            orders.map((order) => (
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
                    <View style={styles.orderMeta}>
                      <Text style={styles.dateText}>
                        {new Date(order.created_at).toLocaleDateString('tr-TR')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={styles.feeText}>₺{order.delivery_fee}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Create Order Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Yeni Sipariş</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Müşteri E-posta *</Text>
              <TextInput
                style={styles.input}
                value={customerEmail}
                onChangeText={setCustomerEmail}
                placeholder="musteri@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Paket Açıklaması *</Text>
              <TextInput
                style={styles.input}
                value={packageDescription}
                onChangeText={setPackageDescription}
                placeholder="Paket içeriği..."
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Alım Adresi *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={pickupAddress}
                onChangeText={setPickupAddress}
                placeholder="Paket alınacak adres..."
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Teslimat Adresi *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder="Paket teslim edilecek adres..."
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Alım Telefonu *</Text>
              <TextInput
                style={styles.input}
                value={pickupPhone}
                onChangeText={setPickupPhone}
                placeholder="0555 123 4567"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Teslimat Telefonu *</Text>
              <TextInput
                style={styles.input}
                value={deliveryPhone}
                onChangeText={setDeliveryPhone}
                placeholder="0555 123 4567"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Özel Talimatlar</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={specialInstructions}
                onChangeText={setSpecialInstructions}
                placeholder="Ek açıklamalar..."
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputContainer, styles.halfInput]}>
                <Text style={styles.inputLabel}>Ağırlık (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={estimatedWeight}
                  onChangeText={setEstimatedWeight}
                  placeholder="1.5"
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputContainer, styles.halfInput]}>
                <Text style={styles.inputLabel}>Değer (₺)</Text>
                <TextInput
                  style={styles.input}
                  value={estimatedValue}
                  onChangeText={setEstimatedValue}
                  placeholder="100"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.createButton, creating && styles.disabledButton]}
              onPress={createOrder}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.createButtonText}>Sipariş Oluştur</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
    textAlign: 'center',
  },
  actionSection: {
    padding: 20,
  },
  createOrderButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createOrderText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
  orderRight: {
    alignItems: 'flex-end',
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  createButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  disabledButton: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});