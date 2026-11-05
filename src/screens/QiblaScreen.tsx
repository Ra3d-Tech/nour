import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Vibration,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const COMPASS_SIZE = Math.min(SCREEN_WIDTH * 0.82, 340);

const SAVED_LOCATION_KEY = '@saved_user_location';

// إحداثيات الكعبة المشرفة الدقيقة (مكة المكرمة)
const KAABA_LAT = 21.422487;
const KAABA_LNG = 39.826206;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

// حساب اتجاه القبلة بالمعادلة الفلكية الكروية
const calculateQiblaDirection = (lat: number, lng: number): number => {
  const phiK = toRad(KAABA_LAT);
  const lambdaK = toRad(KAABA_LNG);
  const phiU = toRad(lat);
  const lambdaU = toRad(lng);

  const deltaLambda = lambdaK - lambdaU;

  const y = Math.sin(deltaLambda);
  const x = Math.cos(phiU) * Math.tan(phiK) - Math.sin(phiU) * Math.cos(deltaLambda);

  let qibla = toDeg(Math.atan2(y, x));
  return (qibla + 360) % 360;
};

export const QiblaScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const { t, fontScale, language } = useApp();
  const isRTL = language === 'ar';

  const [loading, setLoading] = useState(true);
  const [cityName, setCityName] = useState(isRTL ? 'موقعك الحالي' : 'Current Location');
  const [heading, setHeading] = useState<number>(0);
  const [qiblaAngle, setQiblaAngle] = useState<number>(0);
  const [isAligned, setIsAligned] = useState<boolean>(false);

  // Animated values لدوران البوصلة بسلاسة
  const compassRotation = useRef(new Animated.Value(0)).current;
  const currentHeadingRef = useRef<number>(0);

  const headingSubscription = useRef<Location.LocationSubscription | null>(null);
  const hasVibratedRef = useRef<boolean>(false);
  const isScreenActiveRef = useRef<boolean>(true);

  // التحكم بدورة حياة الحساس فور الدخول والخروج من الصفحة
  useFocusEffect(
    useCallback(() => {
      isScreenActiveRef.current = true;
      startQiblaService();

      return () => {
        // إيقاف الحساس والاهتزاز فوراً عند مغادرة الشاشة
        isScreenActiveRef.current = false;
        stopQiblaService();
        try {
          Vibration.cancel();
        } catch (e) {}
      };
    }, [])
  );

  const stopQiblaService = () => {
    if (headingSubscription.current) {
      try {
        headingSubscription.current.remove();
      } catch (e) {}
      headingSubscription.current = null;
    }
    hasVibratedRef.current = false;
  };

  const startQiblaService = async () => {
    // 1. تحميل الإحداثيات فوراً في 0 ثانية من الذاكرة
    await loadInstantLocation();

    // 2. تشغيل حساس البوصلة
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoading(false);
        return;
      }

      // إيقاف أي اشتراك قديم
      stopQiblaService();

      // تشغيل مراقبة الاتجاه بأعلى دقة
      headingSubscription.current = await Location.watchHeadingAsync((headingData) => {
        if (!isScreenActiveRef.current) return;

        // استخدام الاتجاه الحقيقي (True Heading) إذا توفر وإلا المغناطيسي
        const rawHeading =
          headingData.trueHeading >= 0 ? headingData.trueHeading : headingData.magHeading;
        const currentDeg = Math.round(rawHeading);

        currentHeadingRef.current = currentDeg;
        setHeading(currentDeg);

        Animated.timing(compassRotation, {
          toValue: currentDeg,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    } catch (e) {
      console.log('Compass sensor error', e);
    }
  };

  // تحميل الموقع المحفوظ فوراً لتفادي بطء الـ GPS
  const loadInstantLocation = async () => {
    try {
      const saved = await AsyncStorage.getItem(SAVED_LOCATION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.latitude && parsed.longitude) {
          if (parsed.cityName) setCityName(parsed.cityName);
          const angle = calculateQiblaDirection(parsed.latitude, parsed.longitude);
          setQiblaAngle(Math.round(angle));
          setLoading(false);
          return;
        }
      }

      // إذا لم يتوفر، نجلب آخر موقع سريع بدون انتظار
      let loc = await Location.getLastKnownPositionAsync({});
      if (!loc) {
        loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }
      if (loc) {
        const angle = calculateQiblaDirection(loc.coords.latitude, loc.coords.longitude);
        setQiblaAngle(Math.round(angle));
      }
    } catch (e) {
      // إحداثيات افتراضية للقاهرة/الإسكندرية
      setQiblaAngle(136);
    }
    setLoading(false);
  };

  // التحقق من تطابق الاتجاه مع القبلة (بدقة ±3 درجات)
  useEffect(() => {
    if (loading || qiblaAngle === 0) return;

    // الفرق بين وجهة الهاتف وزاوية القبلة
    const diff = Math.abs(((heading - qiblaAngle + 180) % 360) - 180);
    const alignedNow = diff <= 3;

    setIsAligned(alignedNow);

    if (alignedNow) {
      // اهتزاز لمرة واحدة فقط عند الوصول للقبلة
      if (!hasVibratedRef.current && isScreenActiveRef.current) {
        hasVibratedRef.current = true;
        try {
          Vibration.vibrate(Platform.OS === 'android' ? 80 : 50);
        } catch (e) {}
      }
    } else {
      hasVibratedRef.current = false;
    }
  }, [heading, qiblaAngle, loading]);

  // زاوية سهم القبلة بالنسبة للبوصلة
  const qiblaRelativeAngle = (qiblaAngle - heading + 360) % 360;

  // دوران قرص البوصلة بالعكس مع حركة الجهاز
  const rotateDial = compassRotation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '-360deg'],
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* الشريط العلوي */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { backgroundColor: theme.cardBg }]}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isRTL ? 'chevron-forward' : 'chevron-back'}
            size={22}
            color={theme.textDark}
          />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: theme.textDark, fontSize: 18 * fontScale }]}>
          {t.qibla || 'اتجاه القبلة'}
        </Text>

        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.gold} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>
            {isRTL ? 'جاري معايرة البوصلة وتحديد القبلة...' : 'Calibrating compass...'}
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          {/* كرت حالة الاتجاه الذكي */}
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor: isAligned
                  ? '#166534'
                  : isDarkMode
                  ? '#1E293B'
                  : '#FEF3C7',
                borderColor: isAligned ? '#22C55E' : theme.gold,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={isAligned ? 'check-decagram' : 'compass-outline'}
              size={24}
              color={isAligned ? '#4ADE80' : theme.gold}
            />
            <Text
              style={[
                styles.statusBannerText,
                {
                  color: isAligned
                    ? '#F0FDF4'
                    : isDarkMode
                    ? '#F8FAFC'
                    : '#92400E',
                  fontSize: 14 * fontScale,
                },
              ]}
            >
              {isAligned
                ? 'أنت باتجاه القبلة الشريفة الآن 🕋✨'
                : `وجّه هاتفك نحو الكعبة (متبقي ${Math.round(
                    Math.abs(((heading - qiblaAngle + 180) % 360) - 180)
                  )}°)`}
            </Text>
          </View>

          {/* البوصلة التفاعلية الجذابة */}
          <View style={styles.compassWrapper}>
            {/* قرص البوصلة الدائري */}
            <Animated.View
              style={[
                styles.compassDial,
                {
                  width: COMPASS_SIZE,
                  height: COMPASS_SIZE,
                  borderRadius: COMPASS_SIZE / 2,
                  backgroundColor: isDarkMode ? '#131D18' : '#F9FBF9',
                  borderColor: isAligned ? '#22C55E' : theme.gold,
                  shadowColor: isAligned ? '#22C55E' : theme.gold,
                  transform: [{ rotate: rotateDial }],
                },
              ]}
            >
              {/* الاتجاهات الأربعة */}
              <Text style={[styles.cardinalNorth, { color: '#E11D48' }]}>ش</Text>
              <Text style={[styles.cardinalEast, { color: theme.textMuted }]}>ق</Text>
              <Text style={[styles.cardinalSouth, { color: theme.textMuted }]}>ج</Text>
              <Text style={[styles.cardinalWest, { color: theme.textMuted }]}>غ</Text>

              {/* تدريجات البوصلة */}
              {Array.from({ length: 12 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.tick,
                    {
                      backgroundColor: i % 3 === 0 ? theme.gold : theme.border,
                      height: i % 3 === 0 ? 12 : 7,
                      transform: [
                        { rotate: `${i * 30}deg` },
                        { translateY: -(COMPASS_SIZE / 2 - 10) },
                      ],
                    },
                  ]}
                />
              ))}

              {/* مؤشر أيقونة الكعبة المشرفة في موقع القبلة على المحيط */}
              <View
                style={[
                  styles.kaabaMarkerBox,
                  {
                    transform: [
                      { rotate: `${qiblaAngle}deg` },
                      { translateY: -(COMPASS_SIZE / 2 - 24) },
                    ],
                  },
                ]}
              >
                <MaterialCommunityIcons name="mosque" size={26} color="#EAB308" />
              </View>
            </Animated.View>

            {/* سهم البوصلة الثابت في المركز المتجه نحو القبلة */}
            <View
              style={[
                styles.needleContainer,
                {
                  transform: [{ rotate: `${qiblaRelativeAngle}deg` }],
                },
              ]}
            >
              <View
                style={[
                  styles.needleTop,
                  {
                    borderBottomColor: isAligned ? '#22C55E' : theme.gold,
                  },
                ]}
              />
              <View style={[styles.needleBottom, { borderTopColor: isDarkMode ? '#334155' : '#CBD5E1' }]} />
              <View
                style={[
                  styles.needleCenterPin,
                  {
                    backgroundColor: isAligned ? '#22C55E' : theme.gold,
                  },
                ]}
              />
            </View>
          </View>

          {/* بطاقة معلومات الزاوية والموقع */}
          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.cardBg,
                borderColor: isAligned ? '#22C55E' : theme.border,
              },
            ]}
          >
            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>
                {isRTL ? 'زاوية القبلة' : 'Qibla Angle'}
              </Text>
              <Text style={[styles.infoValue, { color: theme.gold, fontSize: 18 * fontScale }]}>
                {qiblaAngle}°
              </Text>
            </View>

            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />

            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>
                {isRTL ? 'اتجاه هاتفك' : 'Current Heading'}
              </Text>
              <Text
                style={[
                  styles.infoValue,
                  {
                    color: isAligned ? '#22C55E' : theme.textDark,
                    fontSize: 18 * fontScale,
                  },
                ]}
              >
                {heading}°
              </Text>
            </View>

            <View style={[styles.infoDivider, { backgroundColor: theme.border }]} />

            <View style={styles.infoCol}>
              <Text style={[styles.infoLabel, { color: theme.textMuted }]}>
                {isRTL ? 'المدينة' : 'City'}
              </Text>
              <Text
                style={[styles.infoValue, { color: theme.textDark, fontSize: 14 * fontScale }]}
                numberOfLines={1}
              >
                {cityName}
              </Text>
            </View>
          </View>

          {/* تنبيه المعايرة */}
          <Text style={[styles.calibrationHint, { color: theme.textMuted, fontSize: 11.5 * fontScale }]}>
            💡 {isRTL ? 'لأفضل دقة: حرّك هاتفك على شكل رقم (8) بعيداً عن المعادن والأجهزة الإلكترونية' : 'For best accuracy, move your phone in a figure-8 motion away from metals.'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: 'bold',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 24,
    paddingTop: 10,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  statusBannerText: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  compassWrapper: {
    width: COMPASS_SIZE,
    height: COMPASS_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  compassDial: {
    position: 'absolute',
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  cardinalNorth: {
    position: 'absolute',
    top: 10,
    fontWeight: '900',
    fontSize: 16,
  },
  cardinalEast: {
    position: 'absolute',
    right: 12,
    fontWeight: 'bold',
    fontSize: 15,
  },
  cardinalSouth: {
    position: 'absolute',
    bottom: 10,
    fontWeight: 'bold',
    fontSize: 15,
  },
  cardinalWest: {
    position: 'absolute',
    left: 12,
    fontWeight: 'bold',
    fontSize: 15,
  },
  tick: {
    position: 'absolute',
    width: 2,
    borderRadius: 1,
  },
  kaabaMarkerBox: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  needleContainer: {
    width: 32,
    height: COMPASS_SIZE * 0.72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  needleTop: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: COMPASS_SIZE * 0.34,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  needleBottom: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: COMPASS_SIZE * 0.34,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  needleCenterPin: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 4,
  },
  infoCard: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.2,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  infoCol: {
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 11.5,
    marginBottom: 4,
    fontWeight: '500',
  },
  infoValue: {
    fontWeight: 'bold',
  },
  infoDivider: {
    width: 1,
    height: 28,
  },
  calibrationHint: {
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
  },
});