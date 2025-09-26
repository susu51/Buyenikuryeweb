import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
  showNumbers?: boolean;
  style?: any;
}

export default function StarRating({
  rating,
  onRatingChange,
  size = 24,
  readonly = false,
  showNumbers = false,
  style
}: StarRatingProps) {
  const handleStarPress = (starRating: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(starRating);
    }
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const isActive = i <= rating;
      
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => handleStarPress(i)}
          disabled={readonly}
          style={styles.starButton}
        >
          <Ionicons
            name={isActive ? 'star' : 'star-outline'}
            size={size}
            color={isActive ? '#FFD700' : '#CCC'}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.starsContainer}>
        {renderStars()}
      </View>
      {showNumbers && (
        <Text style={styles.ratingText}>
          {rating.toFixed(1)}/5.0
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  starButton: {
    padding: 2,
  },
  ratingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },
});