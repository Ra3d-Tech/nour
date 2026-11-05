import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';

interface HeaderProps {
  onSettingsPress?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onSettingsPress }) => {
  const navigation = useNavigation<any>();
  const { theme } = useTheme();
  const { t, fontScale, language } = useApp();

  const isRTL = language === 'ar';

  // معالجة فتح شاشة الإعدادات بشكل ذكي سواء نافيجيتور متداخل أو مباشر
  const handleOpenSettings = () => {
    if (onSettingsPress) {
      onSettingsPress();
      return;
    }

    try {
      // 1. تجربة التنقل عبر الـ Parent Stack Navigator (في حال وجود Bottom Tabs)
      const parentNav = navigation.getParent();
      if (parentNav && parentNav.navigate) {
        parentNav.navigate('Settings');
        return;
      }
      // 2. التنقل المباشر
      navigation.navigate('Settings');
    } catch (e) {
      // بديل إضافي للتأكد
      navigation.navigate('Settings');
    }
  };

  // حساب التاريخ الحقيقي الدقيق لحظياً بحسب لغة الجهاز
  const formattedRealDate = useMemo(() => {
    const now = new Date();

    if (language === 'ar') {
      try {
        const hijriFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
        const hijri = hijriFormatter.format(now);
        const weekday = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(now);
        return `${weekday}، ${hijri} هـ`;
      } catch (e) {
        return new Intl.DateTimeFormat('ar-EG', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(now);
      }
    } else {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(now);
    }
  }, [language]);

  return (
    <View style={[styles.header, { backgroundColor: theme.primaryHeader }]}>
      {/* الشريط العلوي المضغوط الأنيق */}
      <View style={[styles.topBar, { flexDirection: isRTL ? 'row' : 'row-reverse' }]}>
        {/* زر الإعدادات المضبوط */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleOpenSettings}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={20} color={theme.gold} />
        </TouchableOpacity>

        {/* الشعار واسم التطبيق المدمج في المنتصف */}
        <View style={[styles.logoContainer, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.appName, { fontSize: 17 * fontScale, color: theme.gold }]}>
            {t.appName}
          </Text>
          <MaterialCommunityIcons
            name="star-crescent"
            size={18}
            color={theme.gold}
            style={{ marginHorizontal: 4 }}
          />
        </View>

        {/* موازن بصري فارغ للحفاظ على توسيط اللوجو بدقة */}
        <View style={styles.placeholderBtn} />
      </View>

      {/* قسم التاريخ */}
      <View style={styles.dateSection}>
        <View style={[styles.dateCapsule, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Ionicons
            name="calendar-outline"
            size={13}
            color={theme.gold}
            style={{ marginHorizontal: 5, opacity: 0.9 }}
          />
          <Text style={[styles.dateText, { fontSize: 12 * fontScale, color: theme.gold }]}>
            {formattedRealDate}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingTop: 44,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  topBar: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderBtn: {
    width: 36,
    height: 36,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  dateSection: {
    alignItems: 'center',
    marginTop: 2,
  },
  dateCapsule: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderColor: 'rgba(212, 175, 55, 0.2)',
    borderWidth: 0.8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    alignItems: 'center',
  },
  dateText: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});