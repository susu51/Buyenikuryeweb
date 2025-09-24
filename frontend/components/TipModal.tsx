import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface TipModalProps {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  courierName: string;
  onTipSent?: () => void;
}

export default function TipModal({ 
  visible, 
  onClose, 
  orderId, 
  courierName, 
  onTipSent 
}: TipModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [tipType, setTipType] = useState<'online' | 'cash'>('online');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const predefinedAmounts = [10, 20, 50];

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const handleAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  const getTipAmount = (): number => {
    if (selectedAmount) return selectedAmount;
    if (customAmount) return parseFloat(customAmount) || 0;
    return 0;
  };

  const sendTip = async () => {
    const tipAmount = getTipAmount();
    
    if (tipAmount <= 0) {
      if (Platform.OS === 'web') {
        alert('Lütfen geçerli bir bahşiş miktarı seçin');
      } else {
        Alert.alert('Hata', 'Lütfen geçerli bir bahşiş miktarı seçin');
      }
      return;
    }

    if (tipAmount > 1000) {
      if (Platform.OS === 'web') {
        alert('Bahşiş miktarı 1000 TL\'yi geçemez');
      } else {
        Alert.alert('Hata', 'Bahşiş miktarı 1000 TL\'yi geçemez');
      }
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/tips`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          order_id: orderId,
          tip_amount: tipAmount,
          tip_type: tipType,
          note: note.trim() || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const successMessage = `₺${tipAmount} bahşiş başarıyla gönderildi!`;
        
        if (Platform.OS === 'web') {
          alert(successMessage);
        } else {
          Alert.alert('Başarılı', successMessage);
        }
        
        onTipSent?.();
        onClose();
        resetForm();
      } else {
        const errorMessage = data.detail || 'Bahşiş gönderilemedi';
        
        if (Platform.OS === 'web') {
          alert('Hata: ' + errorMessage);
        } else {
          Alert.alert('Hata', errorMessage);
        }
      }
    } catch (error) {
      console.error('Tip error:', error);
      const errorMessage = 'Bağlantı hatası. Lütfen tekrar deneyin.';
      
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('Hata', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const skipTip = () => {
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setSelectedAmount(null);
    setCustomAmount('');
    setTipType('online');
    setNote('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bahşiş Ver</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          {/* Courier Info */}
          <View style={styles.courierInfo}>
            <Ionicons name="person-circle" size={48} color="#FF6B35" />
            <View style={styles.courierDetails}>
              <Text style={styles.courierName}>{courierName}</Text>
              <Text style={styles.courierSubtext}>Kuryenize teşekkür edin</Text>
            </View>
          </View>

          {/* Amount Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Bahşiş Miktarı</Text>
            
            {/* Predefined Amounts */}
            <View style={styles.amountGrid}>
              {predefinedAmounts.map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={[
                    styles.amountButton,
                    selectedAmount === amount && styles.selectedAmount
                  ]}
                  onPress={() => handleAmountSelect(amount)}
                >
                  <Text style={[
                    styles.amountText,
                    selectedAmount === amount && styles.selectedAmountText
                  ]}>
                    ₺{amount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Amount */}
            <View style={styles.customAmountContainer}>
              <Text style={styles.customLabel}>Özel tutar:</Text>
              <TextInput
                style={[
                  styles.customInput,
                  customAmount && styles.customInputActive
                ]}
                placeholder="₺0"
                value={customAmount}
                onChangeText={handleCustomAmountChange}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
          </View>

          {/* Payment Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ödeme Türü</Text>
            <View style={styles.paymentTypes}>
              <TouchableOpacity
                style={[
                  styles.paymentButton,
                  tipType === 'online' && styles.selectedPayment
                ]}
                onPress={() => setTipType('online')}
              >
                <Ionicons name="card" size={20} color={tipType === 'online' ? '#FFF' : '#666'} />
                <Text style={[
                  styles.paymentText,
                  tipType === 'online' && styles.selectedPaymentText
                ]}>
                  Online
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.paymentButton,
                  tipType === 'cash' && styles.selectedPayment
                ]}
                onPress={() => setTipType('cash')}
              >
                <Ionicons name="cash" size={20} color={tipType === 'cash' ? '#FFF' : '#666'} />
                <Text style={[
                  styles.paymentText,
                  tipType === 'cash' && styles.selectedPaymentText
                ]}>
                  Nakit
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Note */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Not (İsteğe bağlı)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="Teşekkür mesajınız..."
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.skipButton}
              onPress={skipTip}
              disabled={loading}
            >
              <Text style={styles.skipButtonText}>Bahşişsiz Geç</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.sendButton, loading && styles.disabledButton]}
              onPress={sendTip}
              disabled={loading || getTipAmount() <= 0}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.sendButtonText}>
                  ₺{getTipAmount()} Gönder
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  courierInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
  },
  courierDetails: {
    marginLeft: 16,
    flex: 1,
  },
  courierName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  courierSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  amountGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  amountButton: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E9ECEF',
  },
  selectedAmount: {
    borderColor: '#FF6B35',
    backgroundColor: '#FF6B35',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedAmountText: {
    color: '#FFF',
  },
  customAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  customLabel: {
    fontSize: 16,
    color: '#333',
  },
  customInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#E9ECEF',
  },
  customInputActive: {
    borderColor: '#FF6B35',
  },
  paymentTypes: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#E9ECEF',
    gap: 8,
  },
  selectedPayment: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  paymentText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  selectedPaymentText: {
    color: '#FFF',
  },
  noteInput: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
    paddingTop: 20,
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E9ECEF',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  sendButton: {
    flex: 1,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
});