import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchPrayerTimesByCoords,
  fetchPrayerTimesByCity,
  PrayerTimesData,
  getNextPrayerInfo,
  sanitizeCityName,
  formatTo12Hour,
} from '../api/aladhan';
// ⚠️ تأكد إن اسم الملف هنا مطابق لاسم ملف الصوت الفعلي عندك
import {
  playAthanSound,
  stopAthanSound,
  MOAZZIN_LIST,
  SELECTED_MOAZZIN_KEY,
} from '../api/athanAudioService';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';

const SAVED_LOCATION_KEY = '@saved_user_location';
const SAVED_PRAYER_TIMES_KEY = '@saved_prayer_screen_data';
const SETTINGS_STORAGE_KEY = 'app_settings'; // نفس المفتاح المستخدم في SettingsScreen

export const PrayerTimesScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const { t, fontScale, language } = useApp();
  const isRTL = language === 'ar';

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PrayerTimesData | null>(null);
  const [currentCity, setCurrentCity] = useState(isRTL ? 'موقعك الحالي' : 'Locating...');
  const [playingAthan, setPlayingAthan] = useState(false);
  const [activeMoazzin, setActiveMoazzin] = useState(MOAZZIN_LIST[0]);
  const [athanEnabled, setAthanEnabled] = useState(true);
  const [nextPrayer, setNextPrayer] = useState({ name: 'العصر', timeLeft: '--:--:--' });

  // تحديث الشيخ المختار + حالة الأذان (مفعّل/مقفول) كل ما نرجع للصفحة
  useFocusEffect(
    useCallback(() => {
      loadAthanState();
      return () => {
        stopAthanSound();
        setPlayingAthan(false);
      };
    }, [])
  );

  useEffect(() => {
    quickLoadTimes();
  }, [language]);

  // عداد تنازلي حي كل ثانية
  useEffect(() => {
    if (!data?.rawTimings) return;

    setNextPrayer(getNextPrayerInfo(data.rawTimings));

    const interval = setInterval(() => {
      setNextPrayer(getNextPrayerInfo(data.rawTimings));
    }, 1000);

    return () => clearInterval(interval);
  }, [data]);

  const loadAthanState = async () => {
    try {
      const [savedId, settingsStr] = await Promise.all([
        AsyncStorage.getItem(SELECTED_MOAZZIN_KEY),
        AsyncStorage.getItem(SETTINGS_STORAGE_KEY),
      ]);

      if (savedId) {
        const found = MOAZZIN_LIST.find((m) => m.id === savedId);
        if (found) setActiveMoazzin(found);
      }

      // الافتراضي مفعّل لو مفيش إعدادات محفوظة
      const enabled = settingsStr ? JSON.parse(settingsStr).athanEnabled !== false : true;
      setAthanEnabled(enabled);

      if (!enabled) {
        await stopAthanSound();
        setPlayingAthan(false);
      }
    } catch (e) {}
  };

  /**
   * 1. نعرض الكاش فوراً
   * 2. نحدّث في الخلفية بدون قفل الشاشة
   */
  const quickLoadTimes = async (forceRefresh = false) => {
    let hasCache = false;
    try {
      const [savedLocStr, savedTimesStr] = await Promise.all([
        AsyncStorage.getItem(SAVED_LOCATION_KEY),
        AsyncStorage.getItem(SAVED_PRAYER_TIMES_KEY),
      ]);

      if (savedTimesStr) {
        const parsedTimes = JSON.parse(savedTimesStr);
        setData(parsedTimes);
        if (parsedTimes?.rawTimings) {
          setNextPrayer(getNextPrayerInfo(parsedTimes.rawTimings));
        }
        hasCache = true;
      }

      if (savedLocStr) {
        const parsedLoc = JSON.parse(savedLocStr);
        if (parsedLoc.cityName) {
          setCurrentCity(parsedLoc.cityName);
        }
      }
    } catch (e) {
      console.log('Error reading cache', e);
    }

    if (!hasCache || forceRefresh) {
      setLoading(true);
    }

    await syncTimesInBackground(hasCache);
  };

  const syncTimesInBackground = async (hasCache: boolean) => {
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;

      // 1. الإحداثيات المحفوظة
      const savedLoc = await AsyncStorage.getItem(SAVED_LOCATION_KEY);
      if (savedLoc) {
        const parsed = JSON.parse(savedLoc);
        latitude = parsed.latitude;
        longitude = parsed.longitude;
        if (parsed.cityName) setCurrentCity(parsed.cityName);
      }

      // 2. آخر موقع معروف للجهاز
      if (latitude === null || longitude === null) {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          let loc = await Location.getLastKnownPositionAsync({});
          if (!loc) {
            loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          }
          if (loc) {
            latitude = loc.coords.latitude;
            longitude = loc.coords.longitude;
            const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (geocode && geocode.length > 0) {
              const p = geocode[0];
              const displayName = sanitizeCityName(p.city || p.region, p.country);
              setCurrentCity(displayName);
            }
          }
        }
      }

      // 3. جلب المواقيت وحفظها
      if (latitude !== null && longitude !== null) {
        const res = await fetchPrayerTimesByCoords(latitude, longitude);
        if (res) {
          setData(res);
          await AsyncStorage.setItem(SAVED_PRAYER_TIMES_KEY, JSON.stringify(res));
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.log('Location fetch fallback');
    }

    // احتياطي: الإسكندرية، فقط لو مفيش كاش (عشان منكتبش فوق بيانات المستخدم الحقيقية)
    if (!hasCache) {
      setCurrentCity(isRTL ? 'الإسكندرية، مصر' : 'Alexandria, Egypt');
      const res = await fetchPrayerTimesByCity('Alexandria', 'Egypt');
      if (res) {
        setData(res);
        await AsyncStorage.setItem(SAVED_PRAYER_TIMES_KEY, JSON.stringify(res));
      }
    }
    setLoading(false);
  };

  const handleToggleAthan = async () => {
    if (playingAthan) {
      await stopAthanSound();
      setPlayingAthan(false);
    } else {
      setPlayingAthan(true);
      await playAthanSound(undefined, (isPlaying) => setPlayingAthan(isPlaying));
    }
  };

  const getLocalizedPrayerName = (nameInArabic: string) => {
    if (isRTL) return nameInArabic;
    switch (nameInArabic) {
      case 'الفجر': return t.fajr;
      case 'الشروق': return t.sunrise;
      case 'الظهر': return t.dhuhr;
      case 'العصر': return t.asr;
      case 'المغرب': return t.maghrib;
      case 'العشاء': return t.isha;
      default: return nameInArabic;
    }
  };

  const prayersList =
    data && data.rawTimings
      ? [
          { key: 'Fajr', name: t.fajr, rawName: 'الفجر', time: formatTo12Hour(data.rawTimings.Fajr, !isRTL), icon: 'weather-sunset-up' },
          { key: 'Sunrise', name: t.sunrise, rawName: 'الشروق', time: formatTo12Hour(data.rawTimings.Sunrise, !isRTL), icon: 'weather-sunny' },
          { key: 'Dhuhr', name: t.dhuhr, rawName: 'الظهر', time: formatTo12Hour(data.rawTimings.Dhuhr, !isRTL), icon: 'white-balance-sunny' },
          { key: 'Asr', name: t.asr, rawName: 'العصر', time: formatTo12Hour(data.rawTimings.Asr, !isRTL), icon: 'weather-partly-cloudy' },
          { key: 'Maghrib', name: t.maghrib, rawName: 'المغرب', time: formatTo12Hour(data.rawTimings.Maghrib, !isRTL), icon: 'weather-sunset-down' },
          { key: 'Isha', name: t.isha, rawName: 'العشاء', time: formatTo12Hour(data.rawTimings.Isha, !isRTL), icon: 'weather-night' },
        ]
      : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* الهيدر */}
      <View style={[styles.header, { backgroundColor: theme.primaryHeader, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: 20 * fontScale }]}>{t.prayerTimes}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => quickLoadTimes(true)}>
          <Ionicons name="refresh" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {loading && !data ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={theme.gold} />
          <Text style={[styles.loadingText, { color: theme.textMuted, fontSize: 14 * fontScale }]}>
            {t.updatingPrayers}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* كرت الصلاة القادمة */}
          <View style={[styles.nextPrayerBanner, { backgroundColor: theme.primaryHeader, borderColor: theme.border }]}>
            <MaterialCommunityIcons name="mosque" size={44} color={theme.gold} />
            <Text style={[styles.nextLabel, { color: theme.goldLight, fontSize: 13 * fontScale }]}>
              {t.nextPrayer}
            </Text>
            <Text style={[styles.nextName, { fontSize: 26 * fontScale }]}>
              {getLocalizedPrayerName(nextPrayer.name)}
            </Text>

            <View style={[styles.countdownBadge, { borderColor: theme.gold, backgroundColor: theme.gold + '20', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Ionicons name="timer-outline" size={16} color={theme.goldLight} style={{ marginHorizontal: 4 }} />
              <Text style={[styles.countdownValue, { color: theme.goldLight, fontSize: 13.5 * fontScale }]}>
                {t.remaining} {nextPrayer.timeLeft}
              </Text>
            </View>

            {/* زرار الأذان وصوت المؤذن: بيظهر بس لو الأذان مفعّل من الإعدادات */}
            {athanEnabled && (
              <TouchableOpacity
                style={[
                  styles.athanAudioBtn,
                  playingAthan && { backgroundColor: '#a93226', borderColor: '#e74c3c' },
                  { flexDirection: isRTL ? 'row-reverse' : 'row' },
                ]}
                onPress={handleToggleAthan}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={playingAthan ? 'stop-circle' : 'volume-high'}
                  size={22}
                  color="#ffffff"
                />
                <View style={styles.btnTextWrapper}>
                  <Text style={[styles.athanAudioBtnTitle, { fontSize: 13.5 * fontScale }]}>
                    {playingAthan ? t.stopAthan : t.listenAthan}
                  </Text>
                  <Text style={[styles.athanAudioBtnSub, { fontSize: 11 * fontScale }]}>
                    {t.bySheikh} {activeMoazzin.sheikh}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <Text style={[styles.cityText, { fontSize: 11.5 * fontScale }]}>
              {currentCity} • {t.surveyAuthority}
            </Text>
          </View>

          {/* قائمة الصلوات */}
          <Text style={[styles.listTitle, { color: theme.gold, textAlign: isRTL ? 'right' : 'left', fontSize: 15 * fontScale }]}>
            {t.todaySchedule}
          </Text>

          <View style={[styles.timesCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            {prayersList.map((item, index) => {
              const isNext = item.rawName === nextPrayer.name;

              return (
                <View
                  key={index}
                  style={[
                    styles.prayerRow,
                    { borderBottomColor: theme.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
                    index === prayersList.length - 1 && { borderBottomWidth: 0 },
                    isNext && [
                      styles.prayerRowHighlighted,
                      {
                        backgroundColor: isDarkMode ? '#22382e' : '#eef8f3',
                        borderColor: theme.gold,
                      },
                    ],
                  ]}
                >
                  <View style={[styles.prayerRight, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <View
                      style={[
                        styles.iconBox,
                        { backgroundColor: isDarkMode ? '#1a2822' : '#f0f5f2' },
                        isNext && { backgroundColor: theme.primaryHeader },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.icon as any}
                        size={22}
                        color={isNext ? theme.gold : theme.textMuted}
                      />
                    </View>
                    <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                      <Text
                        style={[
                          styles.prayerName,
                          { color: theme.textDark, fontSize: 15 * fontScale },
                          isNext && { color: theme.gold, fontWeight: 'bold' },
                        ]}
                      >
                        {item.name}
                      </Text>
                      {isNext && (
                        <Text style={[styles.nextBadgeText, { color: isDarkMode ? theme.goldLight : '#155d47', fontSize: 10.5 * fontScale }]}>
                          {t.nextPrayer}
                        </Text>
                      )}
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.prayerTime,
                      { color: theme.textDark, fontSize: 15 * fontScale },
                      isNext && { color: theme.gold, fontSize: 16 * fontScale },
                    ]}
                  >
                    {item.time}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTitle: { fontWeight: 'bold', color: '#ffffff' },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { padding: 16, paddingBottom: 40 },
  centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12 },
  nextPrayerBanner: {
    borderRadius: 24,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 20,
  },
  nextLabel: { fontWeight: '600', marginTop: 8 },
  nextName: { color: '#ffffff', fontWeight: 'bold', marginTop: 2 },
  countdownBadge: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
  },
  countdownValue: { fontWeight: 'bold' },
  athanAudioBtn: {
    alignItems: 'center',
    backgroundColor: '#1b5e4c',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginTop: 16,
    gap: 10,
    borderWidth: 1.2,
    borderColor: '#d4af37',
    width: '90%',
    justifyContent: 'center',
  },
  btnTextWrapper: { alignItems: 'center' },
  athanAudioBtnTitle: { color: '#ffffff', fontWeight: 'bold' },
  athanAudioBtnSub: { color: '#faeec7', marginTop: 2, fontWeight: '600' },
  cityText: { color: '#c2dfd5', marginTop: 12 },
  listTitle: { fontWeight: 'bold', marginBottom: 10, marginHorizontal: 6 },
  timesCard: {
    borderRadius: 22,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1.2,
  },
  prayerRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderRadius: 14,
  },
  prayerRowHighlighted: { borderWidth: 1.2, marginVertical: 4 },
  prayerRight: { alignItems: 'center', gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prayerName: { fontWeight: '700' },
  nextBadgeText: { fontWeight: '700', marginTop: 2 },
  prayerTime: { fontWeight: 'bold' },
});

export default PrayerTimesScreen;