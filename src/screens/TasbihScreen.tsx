import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { DHIKR_TRANSLITERATION } from '../i18n/translations';

export const TasbihScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const { t, fontScale, language } = useApp();
  const isRTL = language === 'ar';

  const [selectedDhikrIndex, setSelectedDhikrIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [target, setTarget] = useState<number>(33);
  const [showPicker, setShowPicker] = useState(false);

  const currentDhikr = DHIKR_TRANSLITERATION[selectedDhikrIndex];

  const handlePress = () => {
    const nextCount = count + 1;
    setTotalCount((prev) => prev + 1);

    if (target > 0 && nextCount >= target) {
      setCount(0);
    } else {
      setCount(nextCount);
    }
  };

  const handleReset = () => {
    setCount(0);
  };

  const cycleTarget = () => {
    if (target === 33) setTarget(99);
    else if (target === 99) setTarget(100);
    else if (target === 100) setTarget(0);
    else setTarget(33);
    setCount(0);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* الهيدر */}
      <View style={[styles.header, { backgroundColor: theme.primaryHeader, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { fontSize: 20 * fontScale }]}>{t.electronicTasbih}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={handleReset}>
          <Ionicons name="refresh" size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* شريط الإحصائيات */}
        <View style={[styles.statsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[styles.statBox, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[styles.statLabel, { color: theme.textMuted, fontSize: 11 * fontScale }]}>
              {t.totalCount}
            </Text>
            <Text style={[styles.statValue, { color: theme.gold, fontSize: 18 * fontScale }]}>
              {totalCount}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.statBox, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
            onPress={cycleTarget}
            activeOpacity={0.7}
          >
            <Text style={[styles.statLabel, { color: theme.textMuted, fontSize: 11 * fontScale }]}>
              {t.target}
            </Text>
            <Text style={[styles.statValue, { color: theme.gold, fontSize: 18 * fontScale }]}>
              {target === 0 ? '∞' : target}
            </Text>
          </TouchableOpacity>
        </View>

        {/* كرت الذكر المختار والنطق الصوتي اللاتيني */}
        <TouchableOpacity
          style={[styles.dhikrCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.8}
        >
          <View style={[styles.dhikrCardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={[styles.dhikrBadge, { backgroundColor: theme.surfaceSoft, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MaterialCommunityIcons name="hands-pray" size={15} color={theme.gold} />
              <Text style={[styles.dhikrBadgeText, { color: theme.gold, fontSize: 12 * fontScale }]}>
                {t.chooseDhikr}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={theme.textMuted} />
          </View>

          {/* النص العربي الشريف الأصلي */}
          <Text style={[styles.arabicDhikr, { color: theme.textDark, fontSize: 22 * fontScale }]}>
            {currentDhikr.ar}
          </Text>

          {/* النطق الصوتي بالحروف اللاتينية الدقيقة (Transliteration) */}
          <View style={styles.translitContainer}>
            <Text style={[styles.translitDhikr, { color: theme.gold, fontSize: 14 * fontScale }]}>
              "{currentDhikr.en}"
            </Text>
            {currentDhikr.meaning && (
              <Text style={[styles.meaningDhikr, { color: theme.textMuted, fontSize: 12 * fontScale }]}>
                {currentDhikr.meaning}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* زر التسبيح الدائري الضخم والتفاعلي */}
        <View style={styles.counterWrapper}>
          <TouchableOpacity
            style={[
              styles.tasbihBigCircle,
              {
                backgroundColor: theme.primaryHeader,
                borderColor: theme.gold,
                shadowColor: theme.gold,
              },
            ]}
            onPress={handlePress}
            activeOpacity={0.85}
          >
            <View style={[styles.innerGlowCircle, { borderColor: theme.gold + '40' }]}>
              <Text style={[styles.counterNumber, { fontSize: 50 * fontScale }]}>{count}</Text>
              <Text style={[styles.counterHint, { color: theme.goldLight, fontSize: 13 * fontScale }]}>
                {target > 0 ? `${count} / ${target}` : t.tapToTasbih}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* أزرار التحكم */}
        <View style={[styles.actionsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity
            style={[styles.resetBtn, { backgroundColor: theme.surfaceSoft, borderColor: theme.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            onPress={handleReset}
          >
            <Ionicons name="reload" size={18} color={theme.gold} />
            <Text style={[styles.resetBtnText, { color: theme.textDark, fontSize: 13 * fontScale }]}>
              {t.resetCounter}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.changeDhikrBtn, { backgroundColor: theme.primaryHeader, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            onPress={() => setShowPicker(true)}
          >
            <Ionicons name="list" size={18} color="#ffffff" />
            <Text style={[styles.changeDhikrBtnText, { fontSize: 13 * fontScale }]}>
              {t.chooseDhikr}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* نافذة اختيار الذكر */}
      <Modal visible={showPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={[styles.modalHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.modalTitle, { color: theme.textDark, fontSize: 17 * fontScale }]}>
                {t.chooseDhikr}
              </Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={24} color={theme.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {DHIKR_TRANSLITERATION.map((item, index) => {
                const isSelected = index === selectedDhikrIndex;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dhikrOption,
                      { borderBottomColor: theme.border },
                      isSelected && { backgroundColor: theme.gold + '15', borderColor: theme.gold, borderWidth: 1, borderRadius: 12 },
                    ]}
                    onPress={() => {
                      setSelectedDhikrIndex(index);
                      setCount(0);
                      setShowPicker(false);
                    }}
                  >
                    <Text style={[styles.optionAr, { color: theme.textDark, fontSize: 16 * fontScale }]}>
                      {item.ar}
                    </Text>
                    <Text style={[styles.optionEn, { color: theme.gold, fontSize: 12.5 * fontScale }]}>
                      {item.en}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { padding: 20, paddingBottom: 40, alignItems: 'center' },
  statsRow: {
    width: '100%',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 18,
  },
  statBox: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1,
  },
  statLabel: { fontWeight: '600', marginBottom: 4 },
  statValue: { fontWeight: 'bold' },
  dhikrCard: {
    width: '100%',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.2,
    alignItems: 'center',
    marginBottom: 30,
  },
  dhikrCardHeader: {
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dhikrBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    alignItems: 'center',
    gap: 6,
  },
  dhikrBadgeText: { fontWeight: 'bold' },
  arabicDhikr: {
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 8,
    lineHeight: 34,
  },
  translitContainer: {
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 10,
  },
  translitDhikr: {
    fontStyle: 'italic',
    textAlign: 'center',
    fontWeight: '600',
  },
  meaningDhikr: {
    textAlign: 'center',
    marginTop: 4,
    fontSize: 11,
  },
  counterWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 15,
  },
  tasbihBigCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  innerGlowCircle: {
    width: 184,
    height: 184,
    borderRadius: 92,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterNumber: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  counterHint: {
    marginTop: 6,
    fontWeight: '600',
  },
  actionsRow: {
    width: '100%',
    justifyContent: 'space-between',
    gap: 14,
    marginTop: 25,
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  resetBtnText: { fontWeight: 'bold' },
  changeDhikrBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  changeDhikrBtnText: { color: '#ffffff', fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    borderWidth: 1,
    maxHeight: '80%',
  },
  modalHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(150,150,150,0.2)',
    marginBottom: 10,
  },
  modalTitle: { fontWeight: 'bold' },
  dhikrOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  optionAr: { fontWeight: 'bold', marginBottom: 4 },
  optionEn: { fontStyle: 'italic' },
});