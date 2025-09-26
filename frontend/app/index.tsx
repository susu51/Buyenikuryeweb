import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import DocumentUpload from '../components/DocumentUpload';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: 'kurye' | 'isletme' | 'musteri';
  address?: string;
  vehicle_type?: string;
  business_name?: string;
  is_active: boolean;
  created_at: string;
  rating: number;
  total_orders: number;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Register form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'kurye' | 'isletme' | 'musteri'>('kurye');
  const [address, setAddress] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [businessName, setBusinessName] = useState('');
  
  // Document uploads for couriers
  const [driverLicensePhoto, setDriverLicensePhoto] = useState('');
  const [vehiclePhoto, setVehiclePhoto] = useState('');

  useEffect(() => {
    checkExistingAuth();
  }, []);

  const checkExistingAuth = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');
      
      if (token && userData) {
        const user = JSON.parse(userData);
        // Navigate based on user role
        navigateToRoleDashboard(user.role);
        return;
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setCheckingAuth(false);
    }
  };

  const navigateToRoleDashboard = (userRole: string) => {
    console.log('Navigating to dashboard for role:', userRole);
    
    switch (userRole) {
      case 'kurye':
        console.log('Redirecting to /courier');
        router.push('/courier');
        break;
      case 'isletme':
        console.log('Redirecting to /business');
        router.push('/business'); 
        break;
      case 'musteri':
        console.log('Redirecting to /customer');
        router.push('/customer');
        break;
      default:
        console.log('Redirecting to default /courier');
        router.push('/courier');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }

    setLoading(true);
    try {
      console.log('Login attempt:', { email: email.toLowerCase(), backend_url: BACKEND_URL });
      
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          password,
        }),
      });

      console.log('Login response status:', response.status);
      
      if (response.ok) {
        const data: AuthResponse = await response.json();
        console.log('Login success:', { user_role: data.user.role, user_name: data.user.full_name });

        // Navigate immediately without storage
        console.log('Navigating directly to dashboard...');
        
        // Use window.location for web compatibility
        if (Platform.OS === 'web') {
          if (data.user.role === 'kurye') {
            window.location.href = '/courier-start';
          } else if (data.user.role === 'isletme') {
            window.location.href = '/business';
          } else if (data.user.role === 'musteri') {
            window.location.href = '/customer';
          } else {
            window.location.href = '/courier-start';
          }
        } else {
          // For mobile, use router
          navigateToRoleDashboard(data.user.role);
        }

        // Store auth data in background (non-blocking)
        setTimeout(() => {
          try {
            AsyncStorage.setItem('authToken', data.access_token);
            AsyncStorage.setItem('userData', JSON.stringify(data.user));
            console.log('Auth data stored in background');
          } catch (error) {
            console.log('Background storage failed:', error);
          }
        }, 100);
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Bilinmeyen hata' }));
        console.log('Login error:', errorData);
        Alert.alert('Hata', errorData.detail || 'Giriş başarısız');
      }
    } catch (error) {
      console.error('Login network error:', error);
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !fullName || !phone) {
      Alert.alert('Hata', 'Lütfen gerekli alanları doldurun');
      return;
    }

    if (role === 'kurye' && !vehicleType) {
      Alert.alert('Hata', 'Lütfen araç tipinizi seçin');
      return;
    }

    if (role === 'isletme' && !businessName) {
      Alert.alert('Hata', 'Lütfen işletme adını girin');
      return;
    }

    setLoading(true);
    try {
      const registerData = {
        email: email.toLowerCase(),
        password,
        full_name: fullName,
        phone,
        role,
        address: address || null,
        vehicle_type: role === 'kurye' ? vehicleType : null,
        business_name: role === 'isletme' ? businessName : null,
      };

      console.log('Register attempt:', { email: registerData.email, role, backend_url: BACKEND_URL });

      const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerData),
      });

      console.log('Register response status:', response.status);

      if (response.ok) {
        const data: AuthResponse = await response.json();
        console.log('Register success:', { user_role: data.user.role, user_name: data.user.full_name });

        // Navigate immediately without storage
        console.log('Navigating directly to dashboard...');
        
        // Use window.location for web compatibility
        if (Platform.OS === 'web') {
          if (data.user.role === 'kurye') {
            window.location.href = '/courier-start';
          } else if (data.user.role === 'isletme') {
            window.location.href = '/business';
          } else if (data.user.role === 'musteri') {
            window.location.href = '/customer';
          } else {
            window.location.href = '/courier-start';
          }
        } else {
          // For mobile, use router
          navigateToRoleDashboard(data.user.role);
        }

        // Store auth data in background (non-blocking)
        setTimeout(() => {
          try {
            AsyncStorage.setItem('authToken', data.access_token);
            AsyncStorage.setItem('userData', JSON.stringify(data.user));
            console.log('Auth data stored in background');
          } catch (error) {
            console.log('Background storage failed:', error);
          }
        }, 100);
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Bilinmeyen hata' }));
        console.log('Register error:', errorData);
        Alert.alert('Hata', errorData.detail || 'Kayıt başarısız');
      }
    } catch (error) {
      console.error('Register network error:', error);
      Alert.alert('Hata', 'Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  const getRoleDisplayName = (roleValue: string) => {
    switch (roleValue) {
      case 'kurye': return 'Kurye';
      case 'isletme': return 'İşletme';
      case 'musteri': return 'Müşteri';
      default: return roleValue;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="car" size={48} color="#FF6B35" />
            <Text style={styles.title}>Mobil Kargo</Text>
            <Text style={styles.subtitle}>
              Kendi aracınla kurye ol, düşük komisyonla daha fazla kazan!
            </Text>
          </View>

          {/* Toggle Buttons */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, isLogin && styles.activeToggle]}
              onPress={() => setIsLogin(true)}
            >
              <Text style={[styles.toggleText, isLogin && styles.activeToggleText]}>
                Giriş Yap
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, !isLogin && styles.activeToggle]}
              onPress={() => setIsLogin(false)}
            >
              <Text style={[styles.toggleText, !isLogin && styles.activeToggleText]}>
                Kayıt Ol
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {!isLogin && (
              <>
                <View style={styles.inputContainer}>
                  <Ionicons name="person" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Ad Soyad"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>
                
                <View style={styles.inputContainer}>
                  <Ionicons name="call" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Telefon"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Role Selection */}
                <Text style={styles.labelText}>Rol Seçin:</Text>
                <View style={styles.roleContainer}>
                  {(['kurye', 'isletme', 'musteri'] as const).map((roleOption) => (
                    <TouchableOpacity
                      key={roleOption}
                      style={[
                        styles.roleButton,
                        role === roleOption && styles.activeRoleButton
                      ]}
                      onPress={() => setRole(roleOption)}
                    >
                      <Text style={[
                        styles.roleButtonText,
                        role === roleOption && styles.activeRoleButtonText
                      ]}>
                        {getRoleDisplayName(roleOption)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Conditional Fields */}
                {role === 'kurye' && (
                  <View style={styles.inputContainer}>
                    <Ionicons name="car-sport" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Araç Tipi (araba, motosiklet, bisiklet)"
                      value={vehicleType}
                      onChangeText={setVehicleType}
                    />
                  </View>
                )}

                {role === 'isletme' && (
                  <View style={styles.inputContainer}>
                    <Ionicons name="business" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="İşletme Adı"
                      value={businessName}
                      onChangeText={setBusinessName}
                    />
                  </View>
                )}

                <View style={styles.inputContainer}>
                  <Ionicons name="location" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Adres (İsteğe bağlı)"
                    value={address}
                    onChangeText={setAddress}
                    multiline
                  />
                </View>
              </>
            )}

            <View style={styles.inputContainer}>
              <Ionicons name="mail" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="E-posta"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Şifre"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.disabledButton]}
              onPress={isLogin ? handleLogin : handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Features */}
          <View style={styles.features}>
            <Text style={styles.featuresTitle}>✨ Özellikler</Text>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.featureText}>Düşük komisyon oranları</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.featureText}>Gerçek zamanlı takip</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.featureText}>Puanlama sistemi</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.featureText}>Hızlı ödemeler</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#E9ECEF',
    borderRadius: 25,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 21,
  },
  activeToggle: {
    backgroundColor: '#FF6B35',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeToggleText: {
    color: '#FFF',
  },
  form: {
    marginBottom: 24,
  },
  labelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    alignItems: 'center',
  },
  activeRoleButton: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeRoleButtonText: {
    color: '#FFF',
  },
  submitButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  features: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
});