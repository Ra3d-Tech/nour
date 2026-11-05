import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Share,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MOAZZIN_LIST,
  SELECTED_MOAZZIN_KEY,
  playAthanSound,
  stopAthanSound,
} from '../api/athanAudioService';
import {
  scheduleAthan,
  setupAthanChannel,
  channelIdFor,
  SOUND_FILES,
} from '../api/notificationService';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';

// طريقة ظهور الإشعار أثناء فتح التطبيق (SDK 53+)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface AppSettings {
  athanEnabled: boolean;
  dhikrEnabled: boolean;
  calculationMethod: number;
}

const SETTINGS_STORAGE_KEY = 'app_settings';

const DEFAULT_SETTINGS: AppSettings = {
  athanEnabled: true,
  dhikrEnabled: true,
  calculationMethod: 5,
};

const loadSettings = async (): Promise<AppSettings> => {
  const stored = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
  return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
};

const saveSettings = async (settings: AppSettings): Promise<void> => {
  await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

export const SettingsScreen = ({ navigation }: any) => {
  const { isDarkMode, theme, toggleTheme } = useTheme();
  const { language, fontSize, setFontSize, t, fontScale } = useApp();

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [selectedMoazzin, setSelectedMoazzin] = useState(MOAZZIN_LIST[0]);
  const [showMoazzinModal, setShowMoazzinModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showFontSizeModal, setShowFontSizeModal] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const isRTL = language === 'ar';

  useEffect(() => {
    (async () => {
      const saved = await loadSettings();
      setSettings(saved);

      const id = await AsyncStorage.getItem(SELECTED_MOAZZIN_KEY);
      const found = MOAZZIN_LIST.find((m) => m.id === id);
      if (found) {
        setSelectedMoazzin(found);
        // تجديد جدولة الأيام الجاية كل ما الشاشة تفتح
        if (saved.athanEnabled) {
          scheduleAthan(found).catch(() => {});
        }
      }
    })();

    return () => {
      stopAthanSound();
    };
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleAthanToggle = async (value: boolean) => {
    if (value) {
      setShowMoazzinModal(true);
    } else {
      updateSetting('athanEnabled', false);
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  };

  const handlePreviewAudio = async (moazzin: (typeof MOAZZIN_LIST)[0]) => {
    if (previewingId === moazzin.id) {
      setPreviewingId(null);
      await stopAthanSound();
    } else {
      setPreviewingId(moazzin.id);
      await playAthanSound(moazzin.id, (isPlaying) => {
        if (!isPlaying) setPreviewingId(null);
      });
    }
  };

  const handleSelectMoazzin = async (moazzin: (typeof MOAZZIN_LIST)[0]) => {
    stopAthanSound();
    setPreviewingId(null);
    setSelectedMoazzin(moazzin);

    await AsyncStorage.setItem(SELECTED_MOAZZIN_KEY, moazzin.id);

    // إنشاء القناة بصوت المؤذن + جدولة مواقيت الصلاة الفعلية
    const ok = await scheduleAthan(moazzin);
    if (!ok) {
      Alert.alert('تنبيه', 'يرجى تفعيل إذن الإشعارات من إعدادات الهاتف حتى يعمل الأذان.');
      setShowMoazzinModal(false);
      return;
    }

    updateSetting('athanEnabled', true);
    setShowMoazzinModal(false);

    setTimeout(() => {
      setShowSuccessModal(true);
    }, 300);
  };

  // تجربة الأذان بعد 5 ثواني
  const testAzanAfter5Seconds = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('تنبيه', 'يرجى تفعيل إذن الإشعارات من إعدادات الهاتف أولاً!');
        return;
      }

      await setupAthanChannel(selectedMoazzin);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'حي على الصلاة 🕌 (تنبيه تجريبي)',
          body: `حان الآن موعد الأذان بصوت: ${selectedMoazzin.name}`,
          sound: SOUND_FILES[selectedMoazzin.id],
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 5,
          channelId: channelIdFor(selectedMoazzin.id),
        },
      });

      Alert.alert(
        'تم ضبط التنبيه ⏱️',
        'اقفل شاشة التليفون حالاً بزرار الباور واستنى 5 ثواني.'
      );
    } catch (error: any) {
      Alert.alert('خطأ', error.message);
    }
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Noor App - Your Faith Companion: Holy Quran, Prayer Times, Azkar & Hadith 🕌✨',
      });
    } catch (error) {}
  };

  const rowDir = { flexDirection: isRTL ? ('row-reverse' as const) : ('row' as const) };
  const align = { textAlign: isRTL ? ('right' as const) : ('left' as const) };

  const fontOptions: { key: 'small' | 'medium' | 'large'; title: string; desc: string }[] = [
    { key: 'small', title: 'صغير (Small)', desc: 'شاشات صغيرة وتوفير مساحة' },
    { key: 'medium', title: 'متوسط (Medium)', desc: 'حجم متوازن ومريح للعين' },
    { key: 'large', title: 'كبير (Large)', desc: 'قراءة واضحة جداً ومريحة' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* الهيدر */}
      <View style={[styles.header, { backgroundColor: theme.primaryHeader }, rowDir]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: 20 * fontScale }]}>{t.settings}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* المظهر */}
        <Text style={[styles.sectionTitle, { color: theme.gold, fontSize: 14 * fontScale }, align]}>
          {t.appearance}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={[styles.row, rowDir]}>
            <View style={[styles.rowRight, rowDir]}>
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceSoft }]}>
                <Ionicons
                  name={isDarkMode ? 'moon' : 'sunny'}
                  size={20}
                  color={isDarkMode ? theme.gold : theme.primaryHeader}
                />
              </View>
              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <Text style={[styles.rowTitle, { color: theme.textDark, fontSize: 13.5 * fontScale }, align]}>
                  {t.darkMode}
                </Text>
                <Text style={[styles.rowSub, { color: theme.textMuted, fontSize: 11.5 * fontScale }, align]}>
                  {isDarkMode ? t.darkModeSub : t.lightModeSub}
                </Text>
              </View>
            </View>
            <Switch
              value={isDarkMode}
              onValueChange={toggleTheme}
              trackColor={{ false: '#ded9cb', true: theme.primaryHeader }}
              thumbColor={isDarkMode ? theme.gold : '#f4f3f4'}
            />
          </View>
        </View>

        {/* الأذان والتنبيهات */}
        <Text style={[styles.sectionTitle, { color: theme.gold, fontSize: 14 * fontScale }, align]}>
          {t.athanAndNotifications}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={[styles.row, rowDir]}>
            <View style={[styles.rowRight, rowDir]}>
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceSoft }]}>
                <Ionicons name="volume-high-outline" size={20} color={theme.gold} />
              </View>
              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <Text style={[styles.rowTitle, { color: theme.textDark, fontSize: 13.5 * fontScale }, align]}>
                  {t.athanAlerts}
                </Text>
                <Text style={[styles.rowSub, { color: theme.textMuted, fontSize: 11.5 * fontScale }, align]}>
                  {t.athanAlertsSub}
                </Text>
              </View>
            </View>
            <Switch
              value={settings.athanEnabled}
              onValueChange={handleAthanToggle}
              trackColor={{ false: '#ded9cb', true: theme.primaryHeader }}
              thumbColor={settings.athanEnabled ? theme.gold : '#f4f3f4'}
            />
          </View>

          {settings.athanEnabled && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <TouchableOpacity style={[styles.row, rowDir]} onPress={() => setShowMoazzinModal(true)}>
                <View style={[styles.rowRight, rowDir]}>
                  <View style={[styles.iconBox, { backgroundColor: theme.surfaceSoft }]}>
                    <MaterialCommunityIcons name="account-voice" size={20} color={theme.gold} />
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={[styles.rowTitle, { color: theme.textDark, fontSize: 13.5 * fontScale }, align]}>
                      {t.activeMoazzin}
                    </Text>
                    <Text
                      style={[
                        styles.rowSub,
                        { color: theme.gold, fontWeight: 'bold', fontSize: 12 * fontScale },
                        align,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedMoazzin.name}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={isRTL ? 'chevron-back' : 'chevron-forward'}
                  size={20}
                  color={theme.textMuted}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.testAzanBtn, { backgroundColor: theme.primaryHeader }]}
                onPress={testAzanAfter5Seconds}
                activeOpacity={0.8}
              >
                <Ionicons name="timer-outline" size={19} color="#ffffff" />
                <Text style={styles.testAzanBtnText}>
                  تجربة التنبيه بعد 5 ثواني (واختبار قفل الشاشة)
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* التخصيص (حجم الخط) */}
        <Text style={[styles.sectionTitle, { color: theme.gold, fontSize: 14 * fontScale }, align]}>
          {isRTL ? 'التخصيص' : 'Customization'}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <TouchableOpacity style={[styles.row, rowDir]} onPress={() => setShowFontSizeModal(true)}>
            <View style={[styles.rowRight, rowDir]}>
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceSoft }]}>
                <MaterialCommunityIcons name="format-font" size={20} color={theme.gold} />
              </View>
              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <Text style={[styles.rowTitle, { color: theme.textDark, fontSize: 13.5 * fontScale }, align]}>
                  {t.fontSize}
                </Text>
                <Text
                  style={[
                    styles.rowSub,
                    { color: theme.gold, fontWeight: 'bold', fontSize: 12 * fontScale },
                    align,
                  ]}
                >
                  {fontOptions.find((o) => o.key === fontSize)?.title}
                </Text>
              </View>
            </View>
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={20}
              color={theme.textMuted}
            />
          </TouchableOpacity>
        </View>

        {/* عن التطبيق */}
        <Text style={[styles.sectionTitle, { color: theme.gold, fontSize: 14 * fontScale }, align]}>
          {t.aboutApp}
        </Text>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <TouchableOpacity style={[styles.row, rowDir]} onPress={handleShareApp}>
            <View style={[styles.rowRight, rowDir]}>
              <View style={[styles.iconBox, { backgroundColor: theme.surfaceSoft }]}>
                <Ionicons name="share-social-outline" size={20} color={theme.gold} />
              </View>
              <Text
                style={[
                  styles.rowTitle,
                  { color: theme.textDark, fontSize: 13.5 * fontScale, marginHorizontal: 10 },
                  align,
                ]}
              >
                {t.shareApp}
              </Text>
            </View>
            <Ionicons
              name={isRTL ? 'chevron-back' : 'chevron-forward'}
              size={20}
              color={theme.textMuted}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.gold, fontSize: 13 * fontScale }]}>
            {t.footerText}
          </Text>
          <Text style={[styles.footerSub, { color: theme.textMuted, fontSize: 11 * fontScale }]}>
            {t.footerSub}
          </Text>
        </View>
      </ScrollView>

      {/* مودال حجم الخط */}
      <Modal visible={showFontSizeModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.gold }]}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="format-size" size={36} color={theme.gold} />
              <Text style={[styles.modalTitle, { color: theme.textDark }]}>{t.chooseFontSize}</Text>
              <Text style={[styles.modalSub, { color: theme.textMuted }]}>{t.chooseFontSizeSub}</Text>
            </View>

            <View
              style={[styles.livePreviewBox, { backgroundColor: theme.surfaceSoft, borderColor: theme.border }]}
            >
              <Text style={{ fontSize: 11, color: theme.gold, marginBottom: 4, fontWeight: 'bold' }}>
                معاينة مباشرة (Live Preview):
              </Text>
              <Text style={[styles.previewQuranText, { color: theme.textDark, fontSize: 18 * fontScale }]}>
                ﴿ إِنَّ مَعَ الْعُسْرِ يُسْرًا ﴾
              </Text>
            </View>

            <View style={{ gap: 10, marginBottom: 18 }}>
              {fontOptions.map((opt) => {
                const active = fontSize === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.optionCard,
                      { backgroundColor: theme.surfaceSoft, borderColor: theme.border },
                      active && {
                        borderColor: theme.gold,
                        borderWidth: 1.8,
                        backgroundColor: theme.gold + '20',
                      },
                    ]}
                    onPress={() => setFontSize(opt.key)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={active ? theme.gold : theme.textMuted}
                    />
                    <View
                      style={{
                        flex: 1,
                        alignItems: isRTL ? 'flex-end' : 'flex-start',
                        marginHorizontal: 10,
                      }}
                    >
                      <Text style={[styles.optionTitle, { color: theme.textDark }]}>{opt.title}</Text>
                      <Text style={{ fontSize: 11, color: theme.textMuted }}>{opt.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: theme.gold, backgroundColor: theme.primaryHeader }]}
              onPress={() => setShowFontSizeModal(false)}
            >
              <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14 }}>
                تم الحفظ والاعتماد
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال المؤذنين */}
      <Modal visible={showMoazzinModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.gold }]}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name="mosque" size={32} color={theme.gold} />
              <Text style={[styles.modalTitle, { color: theme.textDark }]}>اختر صوت المؤذن 🕌</Text>
              <Text style={[styles.modalSub, { color: theme.textMuted }]}>
                انقر على زر السماعة لمعاينة الصوت فوراً، واضغط لاختيار المؤذن المعتمد
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {MOAZZIN_LIST.map((item) => {
                  const isSelected = selectedMoazzin.id === item.id;
                  const isPreviewing = previewingId === item.id;

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.optionCard,
                        { backgroundColor: theme.surfaceSoft, borderColor: theme.border },
                        isSelected && {
                          borderColor: theme.gold,
                          backgroundColor: theme.gold + '20',
                          borderWidth: 1.5,
                        },
                      ]}
                      onPress={() => handleSelectMoazzin(item)}
                      activeOpacity={0.8}
                    >
                      <TouchableOpacity
                        style={[
                          styles.previewBtn,
                          { backgroundColor: isPreviewing ? '#c0392b' : theme.primaryHeader },
                        ]}
                        onPress={() => handlePreviewAudio(item)}
                      >
                        <Ionicons name={isPreviewing ? 'stop' : 'volume-high'} size={18} color="#ffffff" />
                      </TouchableOpacity>

                      <View
                        style={{
                          flex: 1,
                          alignItems: isRTL ? 'flex-end' : 'flex-start',
                          marginHorizontal: 8,
                        }}
                      >
                        <Text style={[styles.optionTitle, { color: theme.textDark }]}>{item.name}</Text>
                        <Text style={{ fontSize: 11, color: theme.gold, marginTop: 2 }}>
                          {item.sheikh} • {item.location}
                        </Text>
                      </View>

                      <Ionicons
                        name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={24}
                        color={isSelected ? theme.gold : theme.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: theme.border, marginTop: 14 }]}
              onPress={() => {
                stopAthanSound();
                setPreviewingId(null);
                setShowMoazzinModal(false);
              }}
            >
              <Text style={[styles.cancelBtnText, { color: theme.textMuted }]}>{t.close}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال النجاح */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.successCard, { backgroundColor: theme.cardBg, borderColor: theme.gold }]}>
            <View style={[styles.successIconCircle, { backgroundColor: theme.primaryHeader }]}>
              <MaterialCommunityIcons name="check-decagram" size={42} color={theme.goldLight} />
            </View>

            <Text style={[styles.successTitle, { color: theme.textDark }]}>
              تم تفعيل الأذان بنجاح! 🕌
            </Text>
            <Text style={[styles.successDesc, { color: theme.textMuted }]}>
              تم ضبط مواقيت الصلاة بصوت:{'\n'}
              <Text style={{ color: theme.gold, fontWeight: 'bold' }}>{selectedMoazzin.name}</Text>
              {'\n'}سيعمل في موعد الصلاة حتى والشاشة مقفولة.
            </Text>

            <TouchableOpacity
              style={[styles.successBtn, { backgroundColor: theme.primaryHeader }]}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.successBtnText}>تم، بارك الله فيك</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  sectionTitle: { fontWeight: 'bold', marginTop: 16, marginBottom: 8, marginHorizontal: 6 },
  card: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  row: { justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  rowRight: { alignItems: 'center', flex: 1, marginRight: 6 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTitle: { fontWeight: '700' },
  rowSub: { marginTop: 2 },
  divider: { height: 1 },
  testAzanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    marginTop: 10,
    marginBottom: 6,
    gap: 8,
  },
  testAzanBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12.5 },
  footer: { alignItems: 'center', marginTop: 30 },
  footerText: { fontWeight: 'bold' },
  footerSub: { marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    borderRadius: 26,
    padding: 18,
    borderWidth: 1.5,
    elevation: 10,
  },
  modalHeader: { alignItems: 'center', marginBottom: 14 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 6 },
  modalSub: { fontSize: 11.5, textAlign: 'center', marginTop: 4, lineHeight: 17 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  optionTitle: { fontSize: 13.5, fontWeight: 'bold' },
  livePreviewBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 14,
  },
  previewQuranText: { fontWeight: 'bold', textAlign: 'center', marginTop: 4 },
  previewBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: { alignItems: 'center', paddingVertical: 11, borderRadius: 14, borderWidth: 1 },
  cancelBtnText: { fontSize: 13, fontWeight: '600' },
  successCard: {
    width: '90%',
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    elevation: 10,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  successTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  successDesc: { fontSize: 13, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  successBtn: { width: '100%', paddingVertical: 12, borderRadius: 16, alignItems: 'center' },
  successBtnText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
});

export default SettingsScreen;