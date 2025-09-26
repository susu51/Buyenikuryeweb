import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

interface DocumentUploadProps {
  label: string;
  onImageSelected: (base64: string, fileName: string) => void;
  required?: boolean;
  imageSource?: string;
  placeholder?: string;
}

export default function DocumentUpload({
  label,
  onImageSelected,
  required = false,
  imageSource,
  placeholder = 'Fotoğraf seçin'
}: DocumentUploadProps) {
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    setLoading(true);
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeriye erişim iznine ihtiyacımız var.');
        setLoading(false);
        return;
      }

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Check file size (max 10MB)
        if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
          Alert.alert('Dosya Çok Büyük', 'Lütfen 10MB altında bir fotoğraf seçin');
          return;
        }

        // Check file format
        const validFormats = ['image/jpeg', 'image/jpg', 'image/png'];
        if (asset.type && !validFormats.includes(asset.type)) {
          Alert.alert('Geçersiz Format', 'Sadece JPG ve PNG formatları desteklenir');
          return;
        }

        // Convert to base64
        const base64 = `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`;
        const fileName = asset.fileName || `document_${Date.now()}.jpg`;
        
        onImageSelected(base64, fileName);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Hata', 'Fotoğraf seçilirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    setLoading(true);
    try {
      // Request camera permission
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert('İzin Gerekli', 'Fotoğraf çekmek için kamera iznine ihtiyacımız var.');
        setLoading(false);
        return;
      }

      // Take photo
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
        base64: true,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Convert to base64
        const base64 = `data:image/jpeg;base64,${asset.base64}`;
        const fileName = `photo_${Date.now()}.jpg`;
        
        onImageSelected(base64, fileName);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Hata', 'Fotoğraf çekilirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const showOptions = () => {
    if (Platform.OS === 'web') {
      // Web'de sadece dosya seçimi
      pickImage();
    } else {
      // Mobile'da seçenek sunalım
      Alert.alert(
        'Fotoğraf Seç',
        'Fotoğrafı nasıl eklemek istersiniz?',
        [
          {
            text: '📱 Kamera',
            onPress: takePhoto
          },
          {
            text: '🖼️ Galeri',
            onPress: pickImage
          },
          {
            text: '❌ İptal',
            style: 'cancel'
          }
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      
      <TouchableOpacity
        style={[styles.uploadArea, imageSource && styles.uploadAreaWithImage]}
        onPress={showOptions}
        disabled={loading}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#FF6B35" />
            <Text style={styles.loadingText}>Yükleniyor...</Text>
          </View>
        ) : imageSource ? (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageSource }} style={styles.previewImage} />
            <View style={styles.imageOverlay}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={styles.successText}>Yüklendi</Text>
            </View>
            <TouchableOpacity style={styles.changeButton} onPress={showOptions}>
              <Ionicons name="camera" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="camera" size={32} color="#CCC" />
            <Text style={styles.placeholderText}>{placeholder}</Text>
            <Text style={styles.formatText}>JPG, PNG • Max 10MB</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#F44336',
  },
  uploadArea: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E9ECEF',
    borderStyle: 'dashed',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  uploadAreaWithImage: {
    borderStyle: 'solid',
    borderColor: '#4CAF50',
    padding: 8,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  imageContainer: {
    width: '100%',
    alignItems: 'center',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  successText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '600',
  },
  changeButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#FF6B35',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContainer: {
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
  formatText: {
    fontSize: 12,
    color: '#CCC',
    marginTop: 4,
  },
});