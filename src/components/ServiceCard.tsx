import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface ServiceCardProps {
  title: string;
  iconName: keyof typeof MaterialCommunityIcons.glyphMap;
  bgColor?: string;
  iconColor?: string;
  onPress: () => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  title,
  iconName,
  bgColor = '#ffffff',
  iconColor,
  onPress,
}) => {
  const { theme, isDarkMode } = useTheme();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View
        style={[
          styles.iconWrapper,
          {
            backgroundColor: isDarkMode ? '#22332b' : bgColor,
            borderColor: theme.border,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={iconName}
          size={28}
          color={iconColor || theme.gold}
        />
      </View>
      <Text
        style={[
          styles.title,
          {
            color: theme.textDark, // أبيض مريح في الدارك مود، وأخضر غامق في اللايت مود
          },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '25%',
    alignItems: 'center',
    marginVertical: 10,
  },
  iconWrapper: {
    width: 62,
    height: 62,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    marginBottom: 6,
  },
  title: {
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center',
  },
});