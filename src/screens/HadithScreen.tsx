import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Share,
  FlatList,
  Modal,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';

const { width } = Dimensions.get('window');
const FAVORITES_STORAGE_KEY = '@saved_hadiths_favs';
const FONT_SIZE_STORAGE_KEY = '@hadith_custom_font_size';
const TOTAL_IBN_MAJAH_HADITHS = 4342; // إجمالي أحاديث سنن ابن ماجه كاملة

const normalizeArabicText = (text: string = ''): string => {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .toLowerCase()
    .trim();
};

export const IBN_MAJAH_SECTIONS = [
  { id: 1, name: 'المقدمة (اتباع سنة رسول الله)', icon: 'book-open-page-variant', range: '1 - 266' },
  { id: 2, name: 'كتاب الطهارة وسننها', icon: 'water', range: '267 - 666' },
  { id: 3, name: 'كتاب الصلاة', icon: 'hands-pray', range: '667 - 705' },
  { id: 4, name: 'كتاب الأذان والسنة فيها', icon: 'bullhorn', range: '706 - 734' },
  { id: 5, name: 'كتاب المساجد والجماعات', icon: 'mosque', range: '735 - 802' },
  { id: 6, name: 'كتاب إقامة الصلاة والسنة فيها', icon: 'compass', range: '803 - 1432' },
  { id: 7, name: 'كتاب الجنائز', icon: 'account-clock', range: '1433 - 1637' },
  { id: 8, name: 'كتاب الصيام', icon: 'weather-night', range: '1638 - 1782' },
  { id: 9, name: 'كتاب الزكاة', icon: 'hand-coin', range: '1783 - 1844' },
  { id: 10, name: 'كتاب النكاح', icon: 'heart-multiple', range: '1845 - 2015' },
  { id: 11, name: 'كتاب الطلاق', icon: 'file-document-outline', range: '2016 - 2089' },
  { id: 12, name: 'كتاب الكفارات', icon: 'scale-balance', range: '2090 - 2136' },
  { id: 13, name: 'كتاب التجارات', icon: 'cart-outline', range: '2137 - 2307' },
  { id: 14, name: 'كتاب الأحكام والقضاء', icon: 'gavel', range: '2308 - 2374' },
  { id: 15, name: 'كتاب الهبات', icon: 'gift-outline', range: '2375 - 2389' },
  { id: 16, name: 'كتاب الصدقات', icon: 'hand-heart', range: '2390 - 2400' },
  { id: 17, name: 'كتاب الرهون', icon: 'shield-home', range: '2401 - 2435' },
  { id: 18, name: 'كتاب الشفعة', icon: 'home-group', range: '2436 - 2442' },
  { id: 19, name: 'كتاب اللقطة', icon: 'magnify-scan', range: '2443 - 2458' },
  { id: 20, name: 'كتاب العتق', icon: 'account-arrow-right', range: '2459 - 2490' },
  { id: 21, name: 'كتاب الحدود', icon: 'shield-alert', range: '2491 - 2577' },
  { id: 22, name: 'كتاب الديات', icon: 'cash-multiple', range: '2578 - 2632' },
  { id: 23, name: 'كتاب الوصايا', icon: 'script-text-outline', range: '2633 - 2718' },
  { id: 24, name: 'كتاب الفرائض', icon: 'sitemap', range: '2719 - 2752' },
  { id: 25, name: 'كتاب الجهاد', icon: 'shield-sword', range: '2753 - 2881' },
  { id: 26, name: 'كتاب المناسك والحج', icon: 'navigation-variant', range: '2882 - 3119' },
  { id: 27, name: 'كتاب الأضاحي', icon: 'food-drumstick', range: '3120 - 3161' },
  { id: 28, name: 'كتاب الذبائح', icon: 'silverware-clean', range: '3162 - 3199' },
  { id: 29, name: 'كتاب الصيد', icon: 'target', range: '3200 - 3250' },
  { id: 30, name: 'كتاب الأطعمة', icon: 'food-apple', range: '3251 - 3370' },
  { id: 31, name: 'كتاب الأشربة', icon: 'cup-water', range: '3371 - 3435' },
  { id: 32, name: 'كتاب الطب والاستشفاء', icon: 'medical-bag', range: '3436 - 3549' },
  { id: 33, name: 'كتاب اللباس والزينة', icon: 'tshirt-crew', range: '3550 - 3656' },
  { id: 34, name: 'كتاب الأدب والأخلاق', icon: 'account-heart', range: '3657 - 3824' },
  { id: 35, name: 'كتاب الدعاء والاستغفار', icon: 'hands-pray', range: '3825 - 3892' },
  { id: 36, name: 'كتاب تعبير الرؤيا', icon: 'moon-waning-crescent', range: '3893 - 3926' },
  { id: 37, name: 'كتاب الفتن وأشراط الساعة', icon: 'alert-circle-outline', range: '3927 - 4100' },
  { id: 38, name: 'كتاب الزهد والرقائق', icon: 'leaf', range: '4101 - 4342' },
];

const INITIAL_CURATED_HADITHS = [
  {
    hadithnumber: 1,
    arabicnumber: 1,
    text: 'عَنْ أَبِي هُرَيْرَةَ رَضِيَ اللَّهُ عَنْهُ، قَالَ: قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: «مَا أَمَرْتُكُمْ بِهِ فَخُذُوهُ، وَمَا نَهَيْتُكُمْ عَنْهُ فَانْتَهُوا».',
    grades: [{ name: 'تحقيق الألباني', grade: 'صحيح' }],
    bookName: 'المقدمة',
  },
  {
    hadithnumber: 224,
    arabicnumber: 224,
    text: 'عَنْ أَنَسِ بْنِ مَالِكٍ، قَالَ: قَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: «طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ، وَوَاضِعُ الْعِلْمِ عِنْدَ غَيْرِ أَهْلِهِ كَمُقَلِّدِ الْخَنَازِيرِ الْجَوْهَرَ وَاللُّؤْلُؤَ وَالذَّهَبَ».',
    grades: [{ name: 'تحقيق الألباني', grade: 'صحيح' }],
    bookName: 'المقدمة',
  },
  {
    hadithnumber: 3838,
    arabicnumber: 3838,
    text: 'عَنْ عَائِشَةَ رَضِيَ اللَّهُ عَنْهَا، أَنَّهَا قَالَتْ: يَا رَسُولَ اللَّهِ، أَرَأَيْتَ إِنْ وَافَقْتُ لَيْلَةَ الْقَدْرِ مَا أَدْعُو؟ قَالَ: «تَقُولِينَ: اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي».',
    grades: [{ name: 'تحقيق الألباني', grade: 'صحيح' }],
    bookName: 'كتاب الدعاء',
  },
  {
    hadithnumber: 4102,
    arabicnumber: 4102,
    text: 'عَنْ سَهْلِ بْنِ سَعْدٍ السَّاعِدِيِّ، قَالَ: أَتَى النَّبِيَّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ رَجُلٌ، فَقَالَ: يَا رَسُولَ اللَّهِ، دُلَّنِي عَلَى عَمَلٍ إِذَا أَنَا عَمِلْتُهُ أَحَبَّنِي اللَّهُ وَأَحَبَّنِي النَّاسُ، فَقَالَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ: «ازْهَدْ فِي الدُّنْيَا يُحِبَّكَ اللَّهُ، وَازْهَدْ فِيمَا فِي أَيْدِي النَّاسِ يُحِبَّكَ النَّاسُ».',
    grades: [{ name: 'تحقيق الألباني', grade: 'صحيح' }],
    bookName: 'كتاب الزهد',
  },
];

export const HadithScreen = ({ navigation }: any) => {
  const { theme, isDarkMode } = useTheme();
  const { fontScale, language } = useApp();
  const isRTL = language === 'ar';

  const [activeSectionId, setActiveSectionId] = useState<number>(1);
  const [hadiths, setHadiths] = useState<any[]>(INITIAL_CURATED_HADITHS);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [favorites, setFavorites] = useState<{ [key: string]: boolean }>({});
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [savedHadithsList, setSavedHadithsList] = useState<any[]>([]);
  const [showSectionsModal, setShowSectionsModal] = useState<boolean>(false);
  const [textSizeFactor, setTextSizeFactor] = useState<number>(1.1);

  const cardBackgroundColor = isDarkMode ? '#131F19' : '#FFFFFF';
  const cardBorderColor = isDarkMode ? '#2D4436' : '#E2EBE5';
  const primaryTextColor = isDarkMode ? '#FFFFFF' : '#111827';
  const secondaryTextColor = isDarkMode ? '#9EB3A6' : '#4B5563';
  const goldAccent = '#E5C06E';

  const currentRequestIdRef = useRef<number>(1);

  useEffect(() => {
    loadSavedSettings();
    fetchSectionHadiths(1);
  }, []);

  const loadSavedSettings = async () => {
    try {
      const favsData = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
      if (favsData) {
        const parsed = JSON.parse(favsData);
        setFavorites(parsed.map || {});
        setSavedHadithsList(parsed.list || []);
      }
      const fontData = await AsyncStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (fontData) {
        setTextSizeFactor(parseFloat(fontData));
      }
    } catch {}
  };

  const fetchSectionHadiths = async (sectionId: number) => {
    currentRequestIdRef.current = sectionId;
    setActiveSectionId(sectionId);
    setLoading(true);

    const cacheKey = `@hadith_section_cache_${sectionId}`;

    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached && currentRequestIdRef.current === sectionId) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) {
          setHadiths(parsed);
          setLoading(false);
        }
      }
    } catch {}

    try {
      const url = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-ibnmajah/sections/${sectionId}.min.json`;
      const response = await fetch(url);

      if (response.ok && currentRequestIdRef.current === sectionId) {
        const data = await response.json();
        if (data && data.hadiths && Array.isArray(data.hadiths)) {
          const currentBook = IBN_MAJAH_SECTIONS.find((s) => s.id === sectionId);
          const formatted = data.hadiths.map((h: any) => ({
            ...h,
            bookName: currentBook?.name || 'سنن ابن ماجه',
          }));
          setHadiths(formatted);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(formatted));
        }
      }
    } catch (e) {
    } finally {
      if (currentRequestIdRef.current === sectionId) {
        setLoading(false);
      }
    }
  };

  const handleToggleFavorite = async (hadith: any) => {
    const key = `hadith_${hadith.hadithnumber}`;
    const isFav = !favorites[key];
    const newFavMap = { ...favorites, [key]: isFav };

    let newList = [...savedHadithsList];
    if (isFav) {
      if (!newList.some((item) => item.hadithnumber === hadith.hadithnumber)) {
        newList.push(hadith);
      }
    } else {
      newList = newList.filter((item) => item.hadithnumber !== hadith.hadithnumber);
    }

    setFavorites(newFavMap);
    setSavedHadithsList(newList);

    try {
      await AsyncStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify({ map: newFavMap, list: newList })
      );
    } catch {}
  };

  const handleShareHadith = async (hadith: any) => {
    try {
      const shareText = `قال رسول الله ﷺ:\n\n"${hadith.text}"\n\n[سنن ابن ماجه - ${hadith.bookName} • حديث رقم ${hadith.hadithnumber}]\nتمت المشاركة من تطبيق نور`;
      await Share.share({ message: shareText });
    } catch {}
  };

  const handleAdjustFontSize = async (delta: number) => {
    const newFactor = Math.min(1.5, Math.max(0.9, textSizeFactor + delta));
    setTextSizeFactor(newFactor);
    await AsyncStorage.setItem(FONT_SIZE_STORAGE_KEY, String(newFactor));
  };

  const activeSection = useMemo(() => {
    return IBN_MAJAH_SECTIONS.find((s) => s.id === activeSectionId) || IBN_MAJAH_SECTIONS[0];
  }, [activeSectionId]);

  const displayedHadiths = useMemo(() => {
    const source = showFavoritesOnly ? savedHadithsList : hadiths;
    if (!searchQuery.trim()) return source;

    const normalizedQuery = normalizeArabicText(searchQuery);
    const numericMatch = normalizedQuery.match(/\d+/);
    const targetNumber = numericMatch ? numericMatch[0] : null;

    return source.filter((h) => {
      const hadithNumStr = String(h.hadithnumber || '');
      const arabicNumStr = String(h.arabicnumber || '');
      if (targetNumber && (hadithNumStr === targetNumber || arabicNumStr === targetNumber)) {
        return true;
      }
      if (hadithNumStr.includes(normalizedQuery) || arabicNumStr.includes(normalizedQuery)) {
        return true;
      }

      const normalizedText = normalizeArabicText(h.text || '');
      const normalizedBook = normalizeArabicText(h.bookName || '');

      return normalizedText.includes(normalizedQuery) || normalizedBook.includes(normalizedQuery);
    });
  }, [hadiths, savedHadithsList, showFavoritesOnly, searchQuery]);

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0B120E' : '#F4F7F5' }]}>
      {/* الهيدر الفخم مع عداد أحاديث الباب */}
      <View style={[styles.topHeader, { backgroundColor: isDarkMode ? '#13221B' : theme.primaryHeader }]}>
        <View style={[styles.headerRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? '#1E352A' : 'rgba(255, 255, 255, 0.15)' }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitles}>
            <Text style={[styles.mainTitle, { fontSize: 18 * fontScale }]}>سنن ابن ماجه الشريف</Text>
            <View style={[styles.badgeCountRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.subTitle, { color: goldAccent, fontSize: 12 * fontScale }]}>
                {showFavoritesOnly ? 'الأحاديث المحفوظة' : activeSection.name}
              </Text>
              <View style={styles.hadithCountPill}>
                <Text style={styles.hadithCountText}>
                  {displayedHadiths.length} حديثاً
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.headerActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity
              style={[
                styles.headerIconBtn,
                { backgroundColor: showFavoritesOnly ? goldAccent : isDarkMode ? '#1E352A' : 'rgba(255, 255, 255, 0.15)' },
              ]}
              onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name={showFavoritesOnly ? 'bookmark-check' : 'bookmark-outline'}
                size={22}
                color={showFavoritesOnly ? '#0B120E' : '#FFFFFF'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: isDarkMode ? '#1E352A' : 'rgba(255, 255, 255, 0.15)' }]}
              onPress={() => setShowSectionsModal(true)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="format-list-bulleted-type" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* شريط البحث الذكي */}
        <View style={[styles.searchControlRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[styles.searchBox, { backgroundColor: isDarkMode ? '#0E1712' : '#FFFFFF', borderColor: isDarkMode ? '#243A2D' : '#DDE5E0', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Ionicons name="search" size={18} color={secondaryTextColor} />
            <TextInput
              placeholder="ابحث بالنص أو برقم الحديث (مثلاً: 1 أو 4102)..."
              placeholderTextColor={secondaryTextColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={[styles.searchInput, { color: primaryTextColor, textAlign: isRTL ? 'right' : 'left', fontSize: 13 * fontScale }]}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={secondaryTextColor} />
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.fontSizer, { backgroundColor: isDarkMode ? '#1E352A' : 'rgba(255, 255, 255, 0.18)', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <TouchableOpacity onPress={() => handleAdjustFontSize(-0.08)} style={styles.fontBtn}>
              <Text style={styles.fontBtnText}>A-</Text>
            </TouchableOpacity>
            <View style={styles.fontDivider} />
            <TouchableOpacity onPress={() => handleAdjustFontSize(0.08)} style={styles.fontBtn}>
              <Text style={styles.fontBtnText}>A+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* شريط الأقسام السريع */}
      {!showFavoritesOnly && (
        <View style={[styles.sectionTabsWrapper, { backgroundColor: isDarkMode ? '#101B15' : '#EBF1ED', borderBottomColor: isDarkMode ? '#1C2E24' : '#D8E2DC' }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.sectionTabsContent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
          >
            {IBN_MAJAH_SECTIONS.map((sec) => {
              const isActive = sec.id === activeSectionId;
              return (
                <TouchableOpacity
                  key={sec.id}
                  style={[
                    styles.sectionChip,
                    isActive
                      ? [styles.sectionChipActive, { backgroundColor: isDarkMode ? '#1B3125' : theme.primaryHeader, borderColor: goldAccent }]
                      : { backgroundColor: isDarkMode ? '#14221A' : '#FFFFFF', borderColor: isDarkMode ? '#253B2E' : '#D0DDD5' },
                    { flexDirection: isRTL ? 'row-reverse' : 'row' },
                  ]}
                  onPress={() => fetchSectionHadiths(sec.id)}
                  activeOpacity={0.75}
                >
                  <MaterialCommunityIcons
                    name={sec.icon as any}
                    size={17}
                    color={isActive ? goldAccent : secondaryTextColor}
                  />
                  <Text
                    style={[
                      styles.sectionChipText,
                      {
                        color: isActive ? '#FFFFFF' : primaryTextColor,
                        fontWeight: isActive ? '800' : '600',
                        fontSize: 12.5 * fontScale,
                      },
                    ]}
                  >
                    {sec.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* قائمة الأحاديث مع مساحات واسعة مريحة وغير مزنوقة */}
      {loading && displayedHadiths.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={goldAccent} />
          <Text style={[styles.loadingText, { color: secondaryTextColor, fontSize: 14 * fontScale }]}>
            جاري استحضار الأحاديث الشريفة...
          </Text>
        </View>
      ) : displayedHadiths.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="book-open-blank-variant" size={58} color={goldAccent} />
          <Text style={[styles.emptyTitle, { color: primaryTextColor, fontSize: 16 * fontScale }]}>
            {showFavoritesOnly ? 'لا توجد أحاديث محفوظة في المفضلة' : 'لم يتم العثور على أحاديث تطابق بحثك'}
          </Text>
          <Text style={[styles.emptySub, { color: secondaryTextColor, fontSize: 13 * fontScale }]}>
            {showFavoritesOnly
              ? 'اضغط على علامة الحفظ في أي حديث ليظهر هنا'
              : 'جرب البحث برقم آخر أو تجريد الكلمات أو تصفح باقي الأبواب'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedHadiths}
          keyExtractor={(item, index) => `${item.hadithnumber || index}`}
          contentContainerStyle={styles.listContentSpacious}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={12}
          windowSize={7}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => fetchSectionHadiths(activeSectionId)}
              tintColor={goldAccent}
            />
          }
          renderItem={({ item }) => {
            const isFav = !!favorites[`hadith_${item.hadithnumber}`];
            const grade = item.grades && item.grades.length > 0 ? item.grades[0].grade : 'صحيح';

            return (
              <View
                style={[
                  styles.hadithCardSpacious,
                  {
                    backgroundColor: cardBackgroundColor,
                    borderColor: cardBorderColor,
                    borderWidth: isDarkMode ? 1.5 : 1.2,
                  },
                ]}
              >
                {/* رأس الكرت */}
                <View style={[styles.cardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <View style={[styles.badgePill, { backgroundColor: isDarkMode ? '#1B2E23' : '#EDF6F0', borderColor: isDarkMode ? '#2B4A37' : '#D1E6DA', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <MaterialCommunityIcons name="feather" size={15} color={goldAccent} />
                    <Text style={[styles.badgePillText, { color: isDarkMode ? '#F0D48D' : '#926D15', fontSize: 12 * fontScale }]}>
                      حديث #{item.hadithnumber}
                    </Text>
                  </View>

                  <View style={[styles.gradeBadge, { backgroundColor: isDarkMode ? '#173322' : '#E8F7ED', borderColor: isDarkMode ? '#235235' : '#BCE8CB' }]}>
                    <Text style={[styles.gradeBadgeText, { color: isDarkMode ? '#52E088' : '#1E824C', fontSize: 11.5 * fontScale }]}>
                      {grade}
                    </Text>
                  </View>
                </View>

                {/* متن الحديث بخط غامق فخم ومسافات أسطر مريحة جداً */}
                <Text
                  style={[
                    styles.hadithBodyText,
                    {
                      color: primaryTextColor,
                      fontSize: 18 * fontScale * textSizeFactor,
                      lineHeight: 38 * fontScale * textSizeFactor,
                      textAlign: isRTL ? 'right' : 'left',
                    },
                  ]}
                >
                  {item.text}
                </Text>

                {/* فوتر الحديث وأزرار التفاعل */}
                <View style={[styles.cardFooter, { borderTopColor: isDarkMode ? '#1F3427' : '#EDF2EE', flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Text style={[styles.footerBookTag, { color: secondaryTextColor, fontSize: 12 * fontScale }]} numberOfLines={1}>
                    {item.bookName || activeSection.name}
                  </Text>

                  <View style={[styles.footerActionButtons, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: isDarkMode ? '#192C21' : '#F0F5F2' }]}
                      onPress={() => handleShareHadith(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="share-social-outline" size={18} color={goldAccent} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        {
                          backgroundColor: isFav
                            ? (isDarkMode ? '#3D2D18' : '#FEF3C7')
                            : (isDarkMode ? '#192C21' : '#F0F5F2'),
                        },
                      ]}
                      onPress={() => handleToggleFavorite(item)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name={isFav ? 'bookmark' : 'bookmark-outline'}
                        size={20}
                        color={isFav ? '#F59E0B' : secondaryTextColor}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* نافذة الفهرس: تم استبدال الـ 38 باباً بإجمالي أحاديث سنن ابن ماجه كلها */}
      <Modal visible={showSectionsModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: isDarkMode ? '#132019' : '#FFFFFF', borderColor: cardBorderColor }]}>
            <View style={[styles.modalHeaderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <Text style={[styles.modalHeading, { color: primaryTextColor, fontSize: 17 * fontScale }]}>
                  فهرس كتب وأبواب سنن ابن ماجه
                </Text>
                <Text style={[styles.modalTotalText, { color: goldAccent, fontSize: 12 * fontScale }]}>
                  إجمالي أحاديث الكتاب: {TOTAL_IBN_MAJAH_HADITHS} حديثاً شريفاً
                </Text>
              </View>

              <TouchableOpacity onPress={() => setShowSectionsModal(false)}>
                <Ionicons name="close" size={26} color={secondaryTextColor} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: Dimensions.get('window').height * 0.65 }}>
              {IBN_MAJAH_SECTIONS.map((sec) => {
                const isSelected = sec.id === activeSectionId;
                return (
                  <TouchableOpacity
                    key={sec.id}
                    style={[
                      styles.modalListItem,
                      {
                        backgroundColor: isSelected ? (isDarkMode ? '#1A3324' : '#E8F5EE') : 'transparent',
                        borderColor: isSelected ? goldAccent : isDarkMode ? '#1E3527' : '#E5ECE8',
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                      },
                    ]}
                    onPress={() => {
                      setShowSectionsModal(false);
                      setShowFavoritesOnly(false);
                      fetchSectionHadiths(sec.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.modalItemNumberCircle, { backgroundColor: isSelected ? (isDarkMode ? '#264B34' : theme.primaryHeader) : isDarkMode ? '#1A2C21' : '#EDF4F0' }]}>
                      <Text style={[styles.modalItemNumberText, { color: isSelected ? '#FFFFFF' : primaryTextColor }]}>
                        {sec.id}
                      </Text>
                    </View>

                    <View style={styles.modalItemInfo}>
                      <Text
                        style={[
                          styles.modalItemTitle,
                          {
                            color: isSelected ? (isDarkMode ? '#F5D78E' : '#145A32') : primaryTextColor,
                            fontWeight: isSelected ? '800' : '700',
                            fontSize: 14 * fontScale,
                            textAlign: isRTL ? 'right' : 'left',
                          },
                        ]}
                      >
                        {sec.name}
                      </Text>
                      <Text style={[styles.modalItemRange, { color: secondaryTextColor, fontSize: 11.5 * fontScale, textAlign: isRTL ? 'right' : 'left' }]}>
                        الأحاديث: {sec.range}
                      </Text>
                    </View>

                    {isSelected && <Ionicons name="checkmark-circle" size={22} color={goldAccent} />}
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
  topHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 32,
    paddingBottom: 16,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  headerRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitles: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  mainTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  badgeCountRow: {
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  subTitle: {
    fontWeight: '700',
  },
  hadithCountPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 0.8,
    borderColor: 'rgba(229, 192, 110, 0.5)',
  },
  hadithCountText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  headerActions: {
    gap: 10,
  },
  searchControlRow: {
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 8,
    paddingVertical: 0,
    fontWeight: '600',
  },
  fontSizer: {
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  fontBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  fontBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  fontDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  sectionTabsWrapper: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionTabsContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  sectionChip: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1.5,
    gap: 8,
  },
  sectionChipActive: {
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  sectionChipText: {},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 14,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontWeight: '900',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  // مساحات واسعة رحبة للأحاديث لراحة العين
  listContentSpacious: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 60,
    gap: 20,
  },
  hadithCardSpacious: {
    borderRadius: 26,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  cardHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: 6,
  },
  badgePillText: {
    fontWeight: '800',
  },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  gradeBadgeText: {
    fontWeight: '800',
  },
  hadithBodyText: {
    fontWeight: '800',
    marginBottom: 18,
    letterSpacing: 0.25,
  },
  cardFooter: {
    paddingTop: 14,
    borderTopWidth: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerBookTag: {
    flex: 1,
    fontWeight: '700',
    marginRight: 10,
  },
  footerActionButtons: {
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 22,
    borderWidth: 1.5,
    borderBottomWidth: 0,
  },
  modalHeaderRow: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeading: {
    fontWeight: '900',
  },
  modalTotalText: {
    fontWeight: '800',
    marginTop: 4,
  },
  modalListItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    gap: 14,
  },
  modalItemNumberCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalItemNumberText: {
    fontWeight: '900',
    fontSize: 13,
  },
  modalItemInfo: {
    flex: 1,
  },
  modalItemTitle: {},
  modalItemRange: {
    marginTop: 3,
    fontWeight: '600',
  },
});