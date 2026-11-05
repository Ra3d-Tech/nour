import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { Header } from '../components/Header';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchPrayerTimesByCoords,
  fetchPrayerTimesByCity,
  getNextPrayerInfo,
  sanitizeCityName,
  formatTo12Hour,
} from '../api/aladhan';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { DHIKR_TRANSLITERATION } from '../i18n/translations';
import { fetchAyahTafseer } from '../api/quranApi';

const LOCATION_STORAGE_KEY = '@saved_user_location';

const CURATED_DAILY_VERSES = [
  { surah: 94, ayah: 6, surahName: 'الشرح', page: 596, text: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا' },
  { surah: 13, ayah: 28, surahName: 'الرعد', page: 252, text: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ' },
  { surah: 2, ayah: 152, surahName: 'البقرة', page: 23, text: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ' },
  { surah: 65, ayah: 3, surahName: 'الطلاق', page: 558, text: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ' },
  { surah: 7, ayah: 156, surahName: 'الأعراف', page: 170, text: 'وَرَحْمَتِي وَسِعَتْ كُلَّ شَيْءٍ' },
  { surah: 20, ayah: 114, surahName: 'طه', page: 320, text: 'وَقُل رَّبِّ زِدْنِي عِلْمًا' },
  { surah: 2, ayah: 153, surahName: 'البقرة', page: 23, text: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ' },
  { surah: 14, ayah: 7, surahName: 'إبراهيم', page: 256, text: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ' },
  { surah: 57, ayah: 4, surahName: 'الحديد', page: 537, text: 'وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ' },
  { surah: 20, ayah: 46, surahName: 'طه', page: 314, text: 'قَالَ لَا تَخَافَا إِنَّنِي مَعَكُمَا أَسْمَعُ وَأَرَىٰ' },
];

// شاشات التابات (مسجلة داخل MainTabs في App.tsx)
const TAB_SCREENS = ['Home', 'Qibla', 'Quran', 'Prophets', 'DuaaAzkar'];

/* ========================================================================
 * مكونات الأنيميشن والزجاج (بدون أي مكتبات إضافية، Animated الجاهز في RN)
 * ====================================================================== */

// يضيف شفافية للون hex (#RRGGBB). لو اللون بصيغة تانية بيرجعه زي ما هو.
const withAlpha = (color: string, alpha: number) => {
  if (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) {
    return color + Math.round(alpha * 255).toString(16).padStart(2, '0');
  }
  return color;
};

// ظهور تدريجي مع صعود خفيف، وبيتأخر حسب delay (تتابع الظهور)
const FadeInUp = ({
  delay = 0,
  children,
  style,
}: {
  delay?: number;
  children: React.ReactNode;
  style?: any;
}) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 650,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

// ضغطة بتصغّر العنصر بنعومة (spring) وترجعه
const PressableScale = ({
  children,
  onPress,
  onLongPress,
  style,
  scaleTo = 0.97,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: any;
  scaleTo?: number;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 30, bounciness: 6 }).start();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
};

// نبض مستمر (تكبير وتصغير) للعناصر المهمة زي "القادمة" والمؤقّت
const Pulse = ({
  children,
  style,
  from = 1,
  to = 1.12,
  duration = 900,
}: {
  children: React.ReactNode;
  style?: any;
  from?: number;
  to?: number;
  duration?: number;
}) => {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[style, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) }] }]}
    >
      {children}
    </Animated.View>
  );
};

// دايرة ناعمة طايرة في الخلفية (طبقات متداخلة عشان تبان متدرجة)، بتخلي الزجاج باين فعلاً
const FloatingBlob = ({
  size,
  color,
  style,
  delay = 0,
  range = 26,
  duration = 6500,
}: {
  size: number;
  color: string;
  style?: any;
  delay?: number;
  range?: number;
  duration?: number;
}) => {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const layers = [1, 0.78, 0.56, 0.34];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [-range, range] }) },
            { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [range / 2, -range / 2] }) },
          ],
        },
        style,
      ]}
    >
      {layers.map((l, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            width: size * l,
            height: size * l,
            borderRadius: (size * l) / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </Animated.View>
  );
};

export const HomeScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const { t, fontScale, language } = useApp();

  const isRTL = language === 'ar';

  const [tasbihTotal, setTasbihTotal] = useState(0);
  const [dhikrIndex, setDhikrIndex] = useState(0);

  const [cityName, setCityName] = useState(isRTL ? 'جاري تحديد موقعك...' : 'Locating your city...');
  const [loadingPrayers, setLoadingPrayers] = useState(true);
  const [rawTimings, setRawTimings] = useState<any>(null);
  const [nextPrayerData, setNextPrayerData] = useState({ name: 'Asr', timeLeft: '--:--:--' });

  const [showVerseModal, setShowVerseModal] = useState(false);
  const [ayahTafseer, setAyahTafseer] = useState('');
  const [loadingTafseer, setLoadingTafseer] = useState(false);

  const prayersScrollRef = useRef<ScrollView | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const itemLayouts = useRef<{ [key: number]: { x: number; width: number } }>({});
  const hasAutoCenteredRef = useRef<boolean>(false);

  // أنيميشن "نطة" عداد التسبيح
  const counterBump = useRef(new Animated.Value(1)).current;

  const today = new Date();
  const dayIndex =
    (today.getDate() + today.getMonth() * 31 + today.getFullYear()) % CURATED_DAILY_VERSES.length;
  const todayVerse = CURATED_DAILY_VERSES[dayIndex];

  // ستايل الزجاج المشترك
  const glass = {
    backgroundColor: isDarkMode ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.62)',
    borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: isDarkMode ? 0.28 : 0.09,
    shadowRadius: 18,
  };

  useEffect(() => {
    loadCachedLocationOrRequest();
  }, [language]);

  useEffect(() => {
    if (!rawTimings) return;

    setNextPrayerData(getNextPrayerInfo(rawTimings));

    const interval = setInterval(() => {
      setNextPrayerData(getNextPrayerInfo(rawTimings));
    }, 1000);

    return () => clearInterval(interval);
  }, [rawTimings]);

  useEffect(() => {
    if (tasbihTotal === 0) return;
    Animated.sequence([
      Animated.timing(counterBump, { toValue: 1.28, duration: 90, useNativeDriver: true }),
      Animated.spring(counterBump, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  }, [tasbihTotal]);

  const loadCachedLocationOrRequest = async () => {
    setLoadingPrayers(true);

    try {
      const cached = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setCityName(parsed.cityName);
        const res = await fetchPrayerTimesByCoords(parsed.latitude, parsed.longitude);
        if (res) {
          setRawTimings(res.rawTimings);
          setNextPrayerData(getNextPrayerInfo(res.rawTimings));
          setLoadingPrayers(false);
          return;
        }
      }

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = location.coords;

        let geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        let displayName = isRTL ? 'موقعك الحالي' : 'Your Location';
        if (geocode && geocode.length > 0) {
          const place = geocode[0];
          displayName = sanitizeCityName(place.city || place.region, place.country);
        }
        setCityName(displayName);

        await AsyncStorage.setItem(
          LOCATION_STORAGE_KEY,
          JSON.stringify({ latitude, longitude, cityName: displayName })
        );

        const res = await fetchPrayerTimesByCoords(latitude, longitude);
        if (res) {
          setRawTimings(res.rawTimings);
          setNextPrayerData(getNextPrayerInfo(res.rawTimings));
          setLoadingPrayers(false);
          return;
        }
      }
    } catch (e) {}

    setCityName(isRTL ? 'الإسكندرية، مصر' : 'Alexandria, Egypt');
    const fallbackRes = await fetchPrayerTimesByCity('Alexandria', 'Egypt');
    if (fallbackRes) {
      setRawTimings(fallbackRes.rawTimings);
      setNextPrayerData(getNextPrayerInfo(fallbackRes.rawTimings));
    }
    setLoadingPrayers(false);
  };

  const prayersList = rawTimings
    ? [
        { rawKey: 'Fajr', name: t.fajr, time: formatTo12Hour(rawTimings.Fajr, !isRTL), isNext: nextPrayerData.name === 'الفجر' || nextPrayerData.name === 'Fajr' },
        { rawKey: 'Sunrise', name: t.sunrise, time: formatTo12Hour(rawTimings.Sunrise, !isRTL), isNext: false },
        { rawKey: 'Dhuhr', name: t.dhuhr, time: formatTo12Hour(rawTimings.Dhuhr, !isRTL), isNext: nextPrayerData.name === 'الظهر' || nextPrayerData.name === 'Dhuhr' },
        { rawKey: 'Asr', name: t.asr, time: formatTo12Hour(rawTimings.Asr, !isRTL), isNext: nextPrayerData.name === 'العصر' || nextPrayerData.name === 'Asr' },
        { rawKey: 'Maghrib', name: t.maghrib, time: formatTo12Hour(rawTimings.Maghrib, !isRTL), isNext: nextPrayerData.name === 'المغرب' || nextPrayerData.name === 'Maghrib' },
        { rawKey: 'Isha', name: t.isha, time: formatTo12Hour(rawTimings.Isha, !isRTL), isNext: nextPrayerData.name === 'العشاء' || nextPrayerData.name === 'Isha' },
      ]
    : [];

  const centerNextPrayerOnce = useCallback(() => {
    if (hasAutoCenteredRef.current || !rawTimings || prayersList.length === 0) return;
    const nextIdx = prayersList.findIndex((p) => p.isNext);
    if (nextIdx !== -1 && itemLayouts.current[nextIdx]) {
      const layout = itemLayouts.current[nextIdx];
      const visibleWidth = containerWidth > 0 ? containerWidth : Dimensions.get('window').width - 32;
      const targetX = Math.max(0, layout.x + layout.width / 2 - visibleWidth / 2);
      prayersScrollRef.current?.scrollTo({ x: targetX, animated: true });
      hasAutoCenteredRef.current = true;
    }
  }, [rawTimings, prayersList, containerWidth]);

  useEffect(() => {
    const timer = setTimeout(() => {
      centerNextPrayerOnce();
    }, 150);
    return () => clearTimeout(timer);
  }, [centerNextPrayerOnce]);

  const currentDhikr = DHIKR_TRANSLITERATION[dhikrIndex];

  const handleTasbihPress = () => {
    setTasbihTotal((prev) => prev + 1);
    setDhikrIndex((prev) => (prev + 1) % DHIKR_TRANSLITERATION.length);
  };

  // التنقل: شاشات التابات تعدّي على MainTabs، والباقي في الـ Stack مباشرة
  const navigateTo = (screenName: string, params?: any) => {
    if (TAB_SCREENS.includes(screenName)) {
      navigation.navigate('MainTabs', { screen: screenName, params });
      return;
    }

    navigation.navigate(screenName, params);
  };

  const handleGoToQuranPage = async () => {
    setShowVerseModal(false);

    try {
      await AsyncStorage.multiSet([
        ['@quran_target_page', String(todayVerse.page)],
        ['@quran_highlight_surah', String(todayVerse.surah)],
        ['@quran_highlight_ayah', String(todayVerse.ayah)],
      ]);
    } catch (e) {}

    navigateTo('Quran', {
      targetPage: todayVerse.page,
      page: todayVerse.page,
      targetSurah: todayVerse.surah,
      targetAyah: todayVerse.ayah,
      timestamp: Date.now(),
    });
  };

  const handleOpenVerseTafseer = async () => {
    setShowVerseModal(true);
    setLoadingTafseer(true);
    setAyahTafseer('');
    const tafseer = await fetchAyahTafseer(todayVerse.ayah);
    setAyahTafseer(tafseer);
    setLoadingTafseer(false);
  };

  // أقسام التطبيق (بعد حذف التفسير وتعلم ودعوة)
  const services = [
    { id: '1', title: t.secQuran || 'القرآن الكريم', icon: 'book-open-page-variant', screen: 'Quran', bg: isDarkMode ? '#1e2c26' : '#f1f8f5', iconColor: theme.gold },
    { id: '3', title: t.secHadith || 'الأحاديث', icon: 'format-quote-close', screen: 'Hadith', bg: isDarkMode ? '#192633' : '#f3f6f9', iconColor: '#3498db' },
    { id: '4', title: t.secProphets || 'قصص الأنبياء', icon: 'book-account', screen: 'Prophets', bg: isDarkMode ? '#331d1b' : '#fdf4f4', iconColor: '#e74c3c' },
    { id: '6', title: t.secAzkar || 'الأذكار والأدعية', icon: 'hands-pray', screen: 'DuaaAzkar', bg: isDarkMode ? '#2a1e33' : '#f8f4fb', iconColor: '#9b59b6' },
    { id: '7', title: t.secQibla || 'القبلة', icon: 'compass', screen: 'Qibla', bg: isDarkMode ? '#2e2a1b' : '#fbf8f0', iconColor: '#f1c40f' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* خلفية متحركة تظهر من ورا الزجاج */}
      <FloatingBlob
        size={300}
        color={withAlpha('#D4AF37', isDarkMode ? 0.07 : 0.09)}
        style={{ top: -60, right: -90 }}
        range={24}
        duration={7000}
      />
      <FloatingBlob
        size={340}
        color={withAlpha('#10B981', isDarkMode ? 0.07 : 0.08)}
        style={{ top: 330, left: -140 }}
        range={30}
        duration={8200}
        delay={600}
      />
      <FloatingBlob
        size={260}
        color={withAlpha('#8B5CF6', isDarkMode ? 0.06 : 0.07)}
        style={{ bottom: 40, right: -80 }}
        range={22}
        duration={7600}
        delay={1200}
      />

      <Header />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* دعاء خاص مبارك لجدتك وجدك وعائلتك الكريمة (بدون إيموجي) */}
        <FadeInUp delay={0}>
          <View
            style={[
              styles.blessingBanner,
              {
                backgroundColor: isDarkMode ? 'rgba(30,41,59,0.6)' : 'rgba(254,243,199,0.75)',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(253,230,138,0.95)',
              },
            ]}
          >
            <MaterialCommunityIcons name="heart-pulse" size={22} color={theme.gold} />
            <Text
              style={[
                styles.blessingText,
                { color: isDarkMode ? '#F8FAFC' : '#92400E', fontSize: 13.5 * fontScale },
              ]}
            >
              اللهم بارك في عمر جدتي و جدي و عائلتي وألبسهم ثوب الصحة والعافية، واجعل هذا التطبيق صدقة جارية لهم ونوراً
            </Text>
          </View>
        </FadeInUp>

        {/* كرت مواقيت الصلاة (ينتقل إلى PrayerTimes في الـ Stack) */}
        <FadeInUp delay={120}>
          <View
            style={[
              styles.prayerCard,
              {
                backgroundColor: withAlpha(theme.primaryHeader, 0.88),
                borderColor: 'rgba(255,255,255,0.2)',
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.prayerCardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              onPress={() => navigateTo('PrayerTimes')}
              activeOpacity={0.7}
            >
              <View style={[styles.locationBadge, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Ionicons name="location-sharp" size={14} color={theme.gold} />
                <Text style={[styles.locationText, { fontSize: 11.5 * fontScale }]} numberOfLines={1}>
                  {cityName}
                </Text>
              </View>

              <View style={[styles.countdownRectangle, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Pulse style={{ marginHorizontal: 3 }} from={1} to={1.18} duration={800}>
                  <Ionicons name="timer-outline" size={13} color={theme.gold} />
                </Pulse>
                <Text style={[styles.countdownText, { color: theme.goldLight, fontSize: 11 * fontScale }]} numberOfLines={1}>
                  {t.remaining} {nextPrayerData.timeLeft}
                </Text>
              </View>
            </TouchableOpacity>

            {loadingPrayers ? (
              <View style={{ paddingVertical: 14, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.gold} />
              </View>
            ) : (
              <ScrollView
                ref={prayersScrollRef}
                horizontal
                nestedScrollEnabled={true}
                showsHorizontalScrollIndicator={false}
                onLayout={(e) => {
                  setContainerWidth(e.nativeEvent.layout.width);
                }}
                style={styles.prayersScrollWrapper}
                contentContainerStyle={[
                  styles.prayersScrollContent,
                  { flexDirection: isRTL ? 'row-reverse' : 'row' },
                ]}
              >
                {prayersList.map((item, index) => {
                  const isNext = item.isNext;
                  return (
                    <TouchableOpacity
                      key={index}
                      activeOpacity={0.8}
                      onLayout={(e) => {
                        const { x, width } = e.nativeEvent.layout;
                        itemLayouts.current[index] = { x, width };
                        if (isNext && !hasAutoCenteredRef.current) {
                          setTimeout(() => {
                            const visibleW = containerWidth > 0 ? containerWidth : Dimensions.get('window').width - 32;
                            const targetX = Math.max(0, x + width / 2 - visibleW / 2);
                            prayersScrollRef.current?.scrollTo({ x: targetX, animated: false });
                            hasAutoCenteredRef.current = true;
                          }, 50);
                        }
                      }}
                      onPress={() => navigateTo('PrayerTimes')}
                      style={[
                        styles.prayerItemSlide,
                        isNext
                          ? [
                              styles.prayerItemSlideActive,
                              {
                                backgroundColor: theme.gold,
                                borderColor: '#FFFFFF',
                                shadowColor: theme.gold,
                              },
                            ]
                          : {
                              backgroundColor: 'rgba(255, 255, 255, 0.1)',
                              borderColor: 'rgba(255, 255, 255, 0.12)',
                            },
                      ]}
                    >
                      {isNext && (
                        <Pulse from={1} to={1.1} duration={700}>
                          <View style={styles.activePrayerBadge}>
                            <Text style={styles.activePrayerBadgeText}>القادمة</Text>
                          </View>
                        </Pulse>
                      )}
                      <Text
                        style={[
                          styles.prayerNameText,
                          { fontSize: 13 * fontScale },
                          isNext
                            ? { color: '#1B3022', fontWeight: 'bold' }
                            : { color: '#b2d2c7' },
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.prayerTimeText,
                          { fontSize: 13.5 * fontScale },
                          isNext
                            ? { color: '#0F1E15', fontWeight: '900' }
                            : { color: '#ffffff' },
                        ]}
                      >
                        {item.time}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </FadeInUp>

        {/* كرت آية اليوم */}
        <FadeInUp delay={240}>
          <PressableScale
            style={[styles.verseCard, glass]}
            onPress={handleGoToQuranPage}
            scaleTo={0.98}
          >
            <View style={[styles.verseHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.surahTag, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <MaterialCommunityIcons name="book-open-page-variant" size={16} color={theme.gold} />
                <Text style={[styles.surahName, { color: theme.gold, fontSize: 13 * fontScale }]}>
                  سورة {todayVerse.surahName}
                </Text>
              </View>
              <Text style={[styles.verseLabel, { backgroundColor: theme.surfaceSoft, color: theme.textMuted, fontSize: 11 * fontScale }]}>
                {t.dailyAyah}
              </Text>
            </View>

            <Text style={[styles.verseText, { color: theme.textDark, fontSize: 18 * fontScale }]}>
              {todayVerse.text}
            </Text>

            <View style={[styles.verseActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <TouchableOpacity
                style={[
                  styles.openQuranBtn,
                  { backgroundColor: theme.primaryHeader, flexDirection: isRTL ? 'row-reverse' : 'row' },
                ]}
                onPress={handleGoToQuranPage}
              >
                <Ionicons name="book-outline" size={15} color="#fff" />
                <Text style={[styles.openQuranBtnText, { fontSize: 12 * fontScale }]}>
                  فتح في المصحف (ص {todayVerse.page})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tafseerBtn,
                  { backgroundColor: theme.surfaceSoft, borderColor: theme.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
                ]}
                onPress={handleOpenVerseTafseer}
              >
                <MaterialCommunityIcons name="book-open-page-variant" size={15} color={theme.gold} />
                <Text style={[styles.tafseerBtnText, { color: theme.textDark, fontSize: 12 * fontScale }]}>
                  التفسير
                </Text>
              </TouchableOpacity>
            </View>
          </PressableScale>
        </FadeInUp>

        {/* كرت التسبيح السريع (ينتقل إلى Tasbih في الـ Stack) */}
        <FadeInUp delay={360}>
          <PressableScale
            style={[
              styles.quickDhikrCard,
              {
                backgroundColor: isDarkMode ? 'rgba(23,39,32,0.65)' : 'rgba(238,247,242,0.72)',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.95)',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: isDarkMode ? 0.28 : 0.08,
                shadowRadius: 16,
                flexDirection: isRTL ? 'row-reverse' : 'row',
              },
            ]}
            onPress={handleTasbihPress}
            onLongPress={() => navigateTo('Tasbih')}
            scaleTo={0.97}
          >
            <View style={[styles.dhikrRight, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
              <Text style={[styles.dhikrPhrase, { color: theme.gold, fontSize: 16 * fontScale }]}>
                {isRTL ? currentDhikr.ar : currentDhikr.en}
              </Text>
              <Text style={[styles.dhikrSub, { color: theme.textMuted, fontSize: 11 * fontScale }]}>
                {t.tapToTasbih} (اضغط مطولاً لفتح السبحة كاملة)
              </Text>
            </View>
            <Animated.View style={{ transform: [{ scale: counterBump }] }}>
              <TouchableOpacity
                style={[styles.counterCircle, { backgroundColor: theme.primaryHeader }]}
                onPress={() => navigateTo('Tasbih')}
              >
                <Text style={[styles.counterText, { color: theme.goldLight, fontSize: 18 * fontScale }]}>{tasbihTotal}</Text>
              </TouchableOpacity>
            </Animated.View>
          </PressableScale>
        </FadeInUp>

        {/* عنوان الأقسام */}
        <FadeInUp delay={460}>
          <View style={[styles.sectionTitleRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.titleAccent, { backgroundColor: theme.gold }]} />
            <Text style={[styles.sectionTitle, { color: theme.textDark, fontSize: 16 * fontScale }]}>{t.appSections}</Text>
          </View>
        </FadeInUp>

        {/* الأقسام تحت بعض (قائمة زجاجية) */}
        <View style={styles.servicesList}>
          {services.map((item, index) => (
            <FadeInUp key={item.id} delay={540 + index * 90}>
              <PressableScale
                style={[
                  styles.serviceRow,
                  glass,
                  { flexDirection: isRTL ? 'row-reverse' : 'row' },
                ]}
                onPress={() => navigateTo(item.screen, (item as any).params)}
                scaleTo={0.965}
              >
                <View style={[styles.serviceIconBox, { backgroundColor: item.bg }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={26} color={item.iconColor} />
                </View>

                <Text
                  style={[
                    styles.serviceTitle,
                    { color: theme.textDark, fontSize: 16 * fontScale, textAlign: isRTL ? 'right' : 'left' },
                  ]}
                  numberOfLines={1}
                >
                  {item.title}
                </Text>

                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={20}
                  color={theme.textMuted}
                />
              </PressableScale>
            </FadeInUp>
          ))}
        </View>
      </ScrollView>

      {/* نافذة تفسير الآية */}
      <Modal visible={showVerseModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: isDarkMode ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.92)',
                borderColor: isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.95)',
              },
            ]}
          >
            <View style={[styles.modalTopRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.modalTitleText, { color: theme.gold, fontSize: 15 * fontScale }]}>
                سورة {todayVerse.surahName} • الآية {todayVerse.ayah}
              </Text>
              <TouchableOpacity onPress={() => setShowVerseModal(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.verseModalArabic, { color: theme.textDark, fontSize: 18 * fontScale }]}>
              {todayVerse.text}
            </Text>

            <ScrollView style={{ maxHeight: 220, marginVertical: 10 }}>
              <View style={[styles.modalSectionBox, { backgroundColor: isDarkMode ? 'rgba(31,43,35,0.7)' : 'rgba(245,249,246,0.8)', borderColor: theme.border }]}>
                <Text style={[styles.modalSectionLabel, { color: theme.gold, fontSize: 13 * fontScale }]}>
                  التفسير الميسر:
                </Text>
                {loadingTafseer ? (
                  <ActivityIndicator size="small" color={theme.gold} style={{ marginVertical: 10 }} />
                ) : (
                  <Text style={[styles.modalMeaning, { color: theme.textDark, fontSize: 13.5 * fontScale }]}>
                    {ayahTafseer}
                  </Text>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.goToQuranBtn, { backgroundColor: theme.primaryHeader }]}
              onPress={handleGoToQuranPage}
              activeOpacity={0.8}
            >
              <Ionicons name="book-outline" size={18} color="#FFFFFF" style={{ marginHorizontal: 6 }} />
              <Text style={styles.goToQuranBtnText}>فتح في المصحف (صفحة {todayVerse.page})</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  blessingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  blessingText: {
    fontWeight: 'bold',
    flex: 1,
    lineHeight: 22,
    textAlign: 'center',
  },
  prayerCard: {
    borderRadius: 26,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 5,
  },
  prayerCardHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 0.8,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    paddingBottom: 10,
    gap: 10,
  },
  locationBadge: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  },
  locationText: {
    color: '#d6ede4',
    fontWeight: '600',
    flexShrink: 1,
    includeFontPadding: false,
  },
  countdownRectangle: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.5)',
    overflow: 'hidden',
  },
  countdownText: {
    fontWeight: 'bold',
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontVariant: ['tabular-nums'],
  },
  prayersScrollWrapper: {
    marginHorizontal: -16,
  },
  prayersScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'center',
    paddingVertical: 6,
  },
  prayerItemSlide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 92,
    borderWidth: 1.5,
  },
  prayerItemSlideActive: {
    borderWidth: 2,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    transform: [{ scale: 1.05 }],
  },
  activePrayerBadge: {
    backgroundColor: '#1B3022',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 4,
  },
  activePrayerBadgeText: {
    color: '#FFD700',
    fontSize: 9.5,
    fontWeight: 'bold',
  },
  prayerNameText: { marginBottom: 3, fontWeight: '600' },
  prayerTimeText: { fontWeight: 'bold' },
  verseCard: {
    borderRadius: 26,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.2,
  },
  verseHeader: { justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  surahTag: { alignItems: 'center', gap: 6 },
  surahName: { fontWeight: 'bold' },
  verseLabel: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  verseText: { textAlign: 'center', lineHeight: 30, fontWeight: 'bold', marginVertical: 12 },
  verseActions: { alignItems: 'center', gap: 8, marginTop: 4 },
  openQuranBtn: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, gap: 6 },
  openQuranBtnText: { color: '#ffffff', fontWeight: 'bold' },
  tafseerBtn: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, gap: 4, borderWidth: 1 },
  tafseerBtnText: { fontWeight: '600' },
  quickDhikrCard: {
    borderRadius: 24,
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1.2,
    marginBottom: 20,
  },
  dhikrRight: { flex: 1, marginHorizontal: 10 },
  dhikrPhrase: { fontWeight: 'bold', marginBottom: 4 },
  dhikrSub: {},
  counterCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  counterText: { fontWeight: 'bold' },
  sectionTitleRow: {
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
    gap: 8,
  },
  titleAccent: { width: 4, height: 18, borderRadius: 2 },
  sectionTitle: { fontWeight: 'bold' },
  servicesList: { gap: 12 },
  serviceRow: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1.2,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 14,
  },
  serviceIconBox: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceTitle: { flex: 1, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
  },
  modalTopRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitleText: { fontWeight: 'bold' },
  verseModalArabic: {
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 32,
    marginVertical: 12,
  },
  modalSectionBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  modalSectionLabel: { fontWeight: 'bold', marginBottom: 6 },
  modalMeaning: { lineHeight: 22 },
  goToQuranBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 10,
  },
  goToQuranBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});