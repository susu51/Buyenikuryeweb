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
import StarRating from './StarRating';
import TipModal from './TipModal';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  courierName: string;
  onRatingSubmitted?: () => void;
}

export default function RatingModal({
  visible,
  onClose,
  orderId,
  courierName,
  onRatingSubmitted
}: RatingModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);

  const getAuthHeaders = async () => {
    const token = await AsyncStorage.getItem('authToken');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const submitRating = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      
      // Get courier ID from order
      const orderResponse = await fetch(`${BACKEND_URL}/api/orders`, { headers });
      if (!orderResponse.ok) {
        throw new Error('Sipariş bilgisi alınamadı');
      }
      
      const orders = await orderResponse.json();
      const currentOrder = orders.find((o: any) => o.id === orderId);
      
      if (!currentOrder || !currentOrder.courier_id) {
        throw new Error('Kurye bilgisi bulunamadı');
      }

      const response = await fetch(`${BACKEND_URL}/api/ratings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          order_id: orderId,
          rated_by: 'current_user', // Will be filled by backend
          rated_user: currentOrder.courier_id,
          rating: rating,
          comment: comment.trim() || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (Platform.OS === 'web') {
          alert('Değerlendirme gönderildi! Teşekkürler.');
        } else {
          Alert.alert('Başarılı', 'Değerlendirme gönderildi! Teşekkürler.');
        }
        
        onRatingSubmitted?.();
        onClose();
        
        // Show tip modal after rating
        setShowTipModal(true);
        resetForm();
      } else {
        const errorMessage = data.detail || 'Değerlendirme gönderilemedi';
        if (Platform.OS === 'web') {
          alert('Hata: ' + errorMessage);
        } else {
          Alert.alert('Hata', errorMessage);
        }
      }
    } catch (error) {
      console.error('Rating error:', error);
      const errorMessage = 'Değerlendirme gönderilirken hata oluştu';
      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert('Hata', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const skipRating = () => {
    onClose();
    setShowTipModal(true); // Still show tip modal
    resetForm();
  };

  const resetForm = () => {
    setRating(5);
    setComment('');
  };

  const getRatingMessage = (stars: number) => {
    switch (stars) {
      case 1: return 'Çok kötü 😞';
      case 2: return 'Kötü 😕';
      case 3: return 'Orta 😐';
      case 4: return 'İyi 😊';
      case 5: return 'Mükemmel 🌟';
      default: return '';
    }
  };

  return (
    <>
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
            <Text style={styles.headerTitle}>Kuryeyi Değerlendir</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.content}>
            {/* Courier Info */}
            <View style={styles.courierInfo}>
              <Ionicons name="person-circle" size={48} color="#FF6B35" />
              <View style={styles.courierDetails}>
                <Text style={styles.courierName}>{courierName}</Text>
                <Text style={styles.courierSubtext}>Hizmet nasıldı?</Text>
              </View>
            </View>

            {/* Star Rating */}
            <View style={styles.ratingSection}>
              <Text style={styles.ratingTitle}>Puan Ver:</Text>
              <StarRating
                rating={rating}
                onRatingChange={setRating}
                size={40}
                style={styles.starRating}
              />
              <Text style={styles.ratingMessage}>
                {getRatingMessage(rating)}
              </Text>
            </View>

            {/* Comment */}
            <View style={styles.commentSection}>
              <Text style={styles.commentTitle}>Yorum (İsteğe bağlı):</Text>
              <TextInput
                style={styles.commentInput}
                placeholder="Kurye hakkındaki düşüncelerinizi paylaşın..."
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={4}
                maxLength={300}
                textAlignVertical="top"
              />
              <Text style={styles.characterCount}>
                {comment.length}/300
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={skipRating}
                disabled={loading}
              >
                <Text style={styles.skipButtonText}>Değerlendirme Yapma</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.disabledButton]}
                onPress={submitRating}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="star" size={16} color="#FFF" />
                    <Text style={styles.submitButtonText}>
                      {rating} Yıldız Ver
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tip Modal - Shows after rating */}
      <TipModal
        visible={showTipModal}
        onClose={() => setShowTipModal(false)}
        orderId={orderId}
        courierName={courierName}
        onTipSent={() => {
          setShowTipModal(false);
          onRatingSubmitted?.();
        }}
      />
    </>
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
    marginBottom: 32,
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
  ratingSection: {
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 12,
    marginBottom: 24,
  },
  ratingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  starRating: {
    marginBottom: 12,
  },
  ratingMessage: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
  },
  commentSection: {
    marginBottom: 32,
  },
  commentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  commentInput: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
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
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },
});