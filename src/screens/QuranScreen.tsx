import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
  StatusBar,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { fetchCompleteQuranUthmani } from '../api/quranApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_PAGES = 604;
const REVERSED_PAGES_ARRAY = Array.from({ length: TOTAL_PAGES }, (_, i) => TOTAL_PAGES - i);

const LEGACY_RAW_STORAGE_KEY = '@quran_full_uthmani_v2';
const PROCESSED_STORAGE_KEY = '@quran_processed_uthmani_v5';
const BOOKMARK_STORAGE_KEY = '@quran_saved_bookmark';
const SHARED_AUDIO_SYNC_KEY = '@quran_shared_audio_sync_v3';
const FONT_SIZE_STORAGE_KEY = '@quran_reading_font_size_v3';
const QURAN_API_URL = 'https://api.alquran.cloud/v1/quran/quran-uthmani';

export type SurahMeta = {
  number: number;
  name: string;
  numberOfAyahs: number;
  startPage: number;
  revelationType: 'مدنية' | 'مكية';
};

// الفهرس الموثق لجميع سور القرآن الـ 114
export const ALL_SURAHS_STATIC: SurahMeta[] = [
  { number: 1, name: 'الفاتحة', numberOfAyahs: 7, startPage: 1, revelationType: 'مكية' },
  { number: 2, name: 'البقرة', numberOfAyahs: 286, startPage: 2, revelationType: 'مدنية' },
  { number: 3, name: 'آل عمران', numberOfAyahs: 200, startPage: 50, revelationType: 'مدنية' },
  { number: 4, name: 'النساء', numberOfAyahs: 176, startPage: 77, revelationType: 'مدنية' },
  { number: 5, name: 'المائدة', numberOfAyahs: 120, startPage: 106, revelationType: 'مدنية' },
  { number: 6, name: 'الأنعام', numberOfAyahs: 165, startPage: 128, revelationType: 'مكية' },
  { number: 7, name: 'الأعراف', numberOfAyahs: 206, startPage: 151, revelationType: 'مكية' },
  { number: 8, name: 'الأنفال', numberOfAyahs: 75, startPage: 177, revelationType: 'مدنية' },
  { number: 9, name: 'التوبة', numberOfAyahs: 129, startPage: 187, revelationType: 'مدنية' },
  { number: 10, name: 'يونس', numberOfAyahs: 109, startPage: 208, revelationType: 'مكية' },
  { number: 11, name: 'هود', numberOfAyahs: 123, startPage: 221, revelationType: 'مكية' },
  { number: 12, name: 'يوسف', numberOfAyahs: 111, startPage: 235, revelationType: 'مكية' },
  { number: 13, name: 'الرعد', numberOfAyahs: 43, startPage: 249, revelationType: 'مدنية' },
  { number: 14, name: 'إبراهيم', numberOfAyahs: 52, startPage: 255, revelationType: 'مكية' },
  { number: 15, name: 'الحجر', numberOfAyahs: 99, startPage: 262, revelationType: 'مكية' },
  { number: 16, name: 'النحل', numberOfAyahs: 128, startPage: 267, revelationType: 'مكية' },
  { number: 17, name: 'الإسراء', numberOfAyahs: 111, startPage: 282, revelationType: 'مكية' },
  { number: 18, name: 'الكهف', numberOfAyahs: 110, startPage: 293, revelationType: 'مكية' },
  { number: 19, name: 'مريم', numberOfAyahs: 98, startPage: 305, revelationType: 'مكية' },
  { number: 20, name: 'طه', numberOfAyahs: 135, startPage: 312, revelationType: 'مكية' },
  { number: 21, name: 'الأنبياء', numberOfAyahs: 112, startPage: 322, revelationType: 'مكية' },
  { number: 22, name: 'الحج', numberOfAyahs: 78, startPage: 332, revelationType: 'مدنية' },
  { number: 23, name: 'المؤمنون', numberOfAyahs: 118, startPage: 342, revelationType: 'مكية' },
  { number: 24, name: 'النور', numberOfAyahs: 64, startPage: 350, revelationType: 'مدنية' },
  { number: 25, name: 'الفرقان', numberOfAyahs: 77, startPage: 359, revelationType: 'مكية' },
  { number: 26, name: 'الشعراء', numberOfAyahs: 227, startPage: 367, revelationType: 'مكية' },
  { number: 27, name: 'النمل', numberOfAyahs: 93, startPage: 377, revelationType: 'مكية' },
  { number: 28, name: 'القصص', numberOfAyahs: 88, startPage: 385, revelationType: 'مكية' },
  { number: 29, name: 'العنكبوت', numberOfAyahs: 69, startPage: 396, revelationType: 'مكية' },
  { number: 30, name: 'الروم', numberOfAyahs: 60, startPage: 404, revelationType: 'مكية' },
  { number: 31, name: 'لقمان', numberOfAyahs: 34, startPage: 411, revelationType: 'مكية' },
  { number: 32, name: 'السجدة', numberOfAyahs: 30, startPage: 415, revelationType: 'مكية' },
  { number: 33, name: 'الأحزاب', numberOfAyahs: 73, startPage: 418, revelationType: 'مدنية' },
  { number: 34, name: 'سبأ', numberOfAyahs: 54, startPage: 428, revelationType: 'مكية' },
  { number: 35, name: 'فاطر', numberOfAyahs: 45, startPage: 434, revelationType: 'مكية' },
  { number: 36, name: 'يس', numberOfAyahs: 83, startPage: 440, revelationType: 'مكية' },
  { number: 37, name: 'الصافات', numberOfAyahs: 182, startPage: 446, revelationType: 'مكية' },
  { number: 38, name: 'ص', numberOfAyahs: 88, startPage: 453, revelationType: 'مكية' },
  { number: 39, name: 'الزمر', numberOfAyahs: 75, startPage: 458, revelationType: 'مكية' },
  { number: 40, name: 'غافر', numberOfAyahs: 85, startPage: 467, revelationType: 'مكية' },
  { number: 41, name: 'فصلت', numberOfAyahs: 54, startPage: 477, revelationType: 'مكية' },
  { number: 42, name: 'الشورى', numberOfAyahs: 53, startPage: 483, revelationType: 'مكية' },
  { number: 43, name: 'الزخرف', numberOfAyahs: 89, startPage: 489, revelationType: 'مكية' },
  { number: 44, name: 'الدخان', numberOfAyahs: 59, startPage: 496, revelationType: 'مكية' },
  { number: 45, name: 'الجاثية', numberOfAyahs: 37, startPage: 499, revelationType: 'مكية' },
  { number: 46, name: 'الأحقاف', numberOfAyahs: 35, startPage: 502, revelationType: 'مكية' },
  { number: 47, name: 'محمد', numberOfAyahs: 38, startPage: 507, revelationType: 'مدنية' },
  { number: 48, name: 'الفتح', numberOfAyahs: 29, startPage: 511, revelationType: 'مدنية' },
  { number: 49, name: 'الحجرات', numberOfAyahs: 18, startPage: 515, revelationType: 'مدنية' },
  { number: 50, name: 'ق', numberOfAyahs: 45, startPage: 518, revelationType: 'مكية' },
  { number: 51, name: 'الذاريات', numberOfAyahs: 60, startPage: 520, revelationType: 'مكية' },
  { number: 52, name: 'الطور', numberOfAyahs: 49, startPage: 523, revelationType: 'مكية' },
  { number: 53, name: 'النجم', numberOfAyahs: 62, startPage: 526, revelationType: 'مكية' },
  { number: 54, name: 'القمر', numberOfAyahs: 55, startPage: 528, revelationType: 'مكية' },
  { number: 55, name: 'الرحمن', numberOfAyahs: 78, startPage: 531, revelationType: 'مدنية' },
  { number: 56, name: 'الواقعة', numberOfAyahs: 96, startPage: 534, revelationType: 'مكية' },
  { number: 57, name: 'الحديد', numberOfAyahs: 29, startPage: 537, revelationType: 'مدنية' },
  { number: 58, name: 'المجادلة', numberOfAyahs: 22, startPage: 542, revelationType: 'مدنية' },
  { number: 59, name: 'الحشر', numberOfAyahs: 24, startPage: 545, revelationType: 'مدنية' },
  { number: 60, name: 'الممتحنة', numberOfAyahs: 13, startPage: 549, revelationType: 'مدنية' },
  { number: 61, name: 'الصف', numberOfAyahs: 14, startPage: 551, revelationType: 'مدنية' },
  { number: 62, name: 'الجمعة', numberOfAyahs: 11, startPage: 553, revelationType: 'مدنية' },
  { number: 63, name: 'المنافقون', numberOfAyahs: 11, startPage: 554, revelationType: 'مدنية' },
  { number: 64, name: 'التغابن', numberOfAyahs: 18, startPage: 556, revelationType: 'مدنية' },
  { number: 65, name: 'الطلاق', numberOfAyahs: 12, startPage: 558, revelationType: 'مدنية' },
  { number: 66, name: 'التحريم', numberOfAyahs: 12, startPage: 560, revelationType: 'مدنية' },
  { number: 67, name: 'الملك', numberOfAyahs: 30, startPage: 562, revelationType: 'مكية' },
  { number: 68, name: 'القلم', numberOfAyahs: 52, startPage: 564, revelationType: 'مكية' },
  { number: 69, name: 'الحاقة', numberOfAyahs: 52, startPage: 566, revelationType: 'مكية' },
  { number: 70, name: 'المعارج', numberOfAyahs: 44, startPage: 568, revelationType: 'مكية' },
  { number: 71, name: 'نوح', numberOfAyahs: 28, startPage: 570, revelationType: 'مكية' },
  { number: 72, name: 'الجن', numberOfAyahs: 28, startPage: 572, revelationType: 'مكية' },
  { number: 73, name: 'المزمل', numberOfAyahs: 20, startPage: 574, revelationType: 'مكية' },
  { number: 74, name: 'المدثر', numberOfAyahs: 56, startPage: 575, revelationType: 'مكية' },
  { number: 75, name: 'القيامة', numberOfAyahs: 40, startPage: 577, revelationType: 'مكية' },
  { number: 76, name: 'الإنسان', numberOfAyahs: 31, startPage: 578, revelationType: 'مدنية' },
  { number: 77, name: 'المرسلات', numberOfAyahs: 50, startPage: 580, revelationType: 'مكية' },
  { number: 78, name: 'النبأ', numberOfAyahs: 40, startPage: 582, revelationType: 'مكية' },
  { number: 79, name: 'النازعات', numberOfAyahs: 46, startPage: 583, revelationType: 'مكية' },
  { number: 80, name: 'عبس', numberOfAyahs: 42, startPage: 585, revelationType: 'مكية' },
  { number: 81, name: 'التكوير', numberOfAyahs: 29, startPage: 586, revelationType: 'مكية' },
  { number: 82, name: 'الانفطار', numberOfAyahs: 19, startPage: 587, revelationType: 'مكية' },
  { number: 83, name: 'المطففين', numberOfAyahs: 36, startPage: 587, revelationType: 'مكية' },
  { number: 84, name: 'الانشقاق', numberOfAyahs: 25, startPage: 589, revelationType: 'مكية' },
  { number: 85, name: 'البروج', numberOfAyahs: 22, startPage: 590, revelationType: 'مكية' },
  { number: 86, name: 'الطارق', numberOfAyahs: 17, startPage: 591, revelationType: 'مكية' },
  { number: 87, name: 'الأعلى', numberOfAyahs: 19, startPage: 591, revelationType: 'مكية' },
  { number: 88, name: 'الغاشية', numberOfAyahs: 26, startPage: 592, revelationType: 'مكية' },
  { number: 89, name: 'الفجر', numberOfAyahs: 30, startPage: 593, revelationType: 'مكية' },
  { number: 90, name: 'البلد', numberOfAyahs: 20, startPage: 594, revelationType: 'مكية' },
  { number: 91, name: 'الشمس', numberOfAyahs: 15, startPage: 595, revelationType: 'مكية' },
  { number: 92, name: 'الليل', numberOfAyahs: 21, startPage: 595, revelationType: 'مكية' },
  { number: 93, name: 'الضحى', numberOfAyahs: 11, startPage: 596, revelationType: 'مكية' },
  { number: 94, name: 'الشرح', numberOfAyahs: 8, startPage: 596, revelationType: 'مكية' },
  { number: 95, name: 'التين', numberOfAyahs: 8, startPage: 597, revelationType: 'مكية' },
  { number: 96, name: 'العلق', numberOfAyahs: 19, startPage: 597, revelationType: 'مكية' },
  { number: 97, name: 'القدر', numberOfAyahs: 5, startPage: 598, revelationType: 'مكية' },
  { number: 98, name: 'البينة', numberOfAyahs: 8, startPage: 598, revelationType: 'مدنية' },
  { number: 99, name: 'الزلزلة', numberOfAyahs: 8, startPage: 599, revelationType: 'مدنية' },
  { number: 100, name: 'العاديات', numberOfAyahs: 11, startPage: 599, revelationType: 'مكية' },
  { number: 101, name: 'القارعة', numberOfAyahs: 11, startPage: 600, revelationType: 'مكية' },
  { number: 102, name: 'التكاثر', numberOfAyahs: 8, startPage: 600, revelationType: 'مكية' },
  { number: 103, name: 'العصر', numberOfAyahs: 3, startPage: 601, revelationType: 'مكية' },
  { number: 104, name: 'الهمزة', numberOfAyahs: 9, startPage: 601, revelationType: 'مكية' },
  { number: 105, name: 'الفيل', numberOfAyahs: 5, startPage: 601, revelationType: 'مكية' },
  { number: 106, name: 'قريش', numberOfAyahs: 4, startPage: 602, revelationType: 'مكية' },
  { number: 107, name: 'الماعون', numberOfAyahs: 7, startPage: 602, revelationType: 'مكية' },
  { number: 108, name: 'الكوثر', numberOfAyahs: 3, startPage: 602, revelationType: 'مكية' },
  { number: 109, name: 'الكافرون', numberOfAyahs: 6, startPage: 603, revelationType: 'مكية' },
  { number: 110, name: 'النصر', numberOfAyahs: 3, startPage: 603, revelationType: 'مدنية' },
  { number: 111, name: 'المسد', numberOfAyahs: 5, startPage: 603, revelationType: 'مكية' },
  { number: 112, name: 'الإخلاص', numberOfAyahs: 4, startPage: 604, revelationType: 'مكية' },
  { number: 113, name: 'الفلق', numberOfAyahs: 5, startPage: 604, revelationType: 'مكية' },
  { number: 114, name: 'الناس', numberOfAyahs: 6, startPage: 604, revelationType: 'مكية' },
];

const SURAH_MAP_BY_NUM: { [num: number]: SurahMeta } = {};
ALL_SURAHS_STATIC.forEach((s) => {
  SURAH_MAP_BY_NUM[s.number] = s;
});

const getSurahName = (num: any, fallback?: string): string => {
  const n = Number(num);
  const found = SURAH_MAP_BY_NUM[n];
  if (found) return found.name;
  if (fallback) {
    const cleaned = fallback
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
      .replace(/^\s*سورة\s*/, '')
      .trim();
    if (cleaned) return cleaned;
  }
  return '';
};

const getSurahTitle = (num: any, fallback?: string): string => {
  const name = getSurahName(num, fallback);
  if (!name) return '';
  return name.startsWith('سورة') ? name : `سورة ${name}`;
};

const RECITERS = [
  { id: 'basit', name: 'الشيخ عبد الباسط عبد الصمد', server: 'https://server7.mp3quran.net/basit/', subfolder: 'Abdul_Basit_Murattal_192kbps' },
  { id: 'minshawi', name: 'الشيخ محمد صديق المنشاوي', server: 'https://server10.mp3quran.net/minsh/', subfolder: 'Minshawy_Murattal_128kbps' },
  { id: 'husary', name: 'الشيخ محمود خليل الحصري', server: 'https://server13.mp3quran.net/husr/', subfolder: 'Husary_128kbps' },
  { id: 'mishary', name: 'الشيخ مشاري راشد العفاسي', server: 'https://server8.mp3quran.net/afs/', subfolder: 'Alafasy_128kbps' },
];

const toArabicDigits = (num: number): string => {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return num
    .toString()
    .split('')
    .map((d) => digits[parseInt(d, 10)])
    .join('');
};

const normalizeArabic = (str: string): string =>
  str
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200B-\u200F]/g, '')
    .replace(/[\u0671\u0622\u0623\u0625]/g, '\u0627')
    .trim();

const fixUthmaniLigatures = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/ـَٔا/g, 'آ')
    .replace(/\u0640\u0654\u0670/g, 'آ')
    .replace(/بِٱلۡـَٔاخِرَةِ/g, 'بِٱلۡآخِرَةِ')
    .replace(/ٱلۡـَٔاخِرَة/g, 'ٱلۡآخِرَة')
    .replace(/ٱلۡـَٔاخِر/g, 'ٱلۡآخِر')
    .replace(/ءَا/g, 'آ')
    .replace(/ءَاتَىٰ/g, 'آتَىٰ')
    .replace(/ءَامَن/g, 'آمَن')
    .replace(/ءَايَـٰ/g, 'آيَـٰ')
    .replace(/\u0640\u0654/g, 'ئ')
    .replace(/ـٔ/g, 'ئ');
};

const cleanAyahText = (rawText: string, surahNum: number, ayahNum: number): string => {
  let text = rawText.replace(/\uFEFF/g, '');
  if (ayahNum === 1 && surahNum !== 1 && surahNum !== 9) {
    const tokens = text.trim().split(/\s+/);
    if (tokens.length > 4 && normalizeArabic(tokens[0]) === 'بسم') {
      text = tokens.slice(4).join(' ').trim();
    }
  }
  return fixUthmaniLigatures(text);
};

const SURAH_ALIASES: { [key: number]: string[] } = {
  1: ['فاتحة الكتاب', 'الحمد', 'ام الكتاب', 'السبع المثاني', 'فاتحه'],
  2: ['اية الكرسي', 'آية الكرسي', 'سنام القرآن', 'بقره'],
  3: ['ال عمران', 'عمران'],
  4: ['نساء'],
  5: ['العقود'],
  7: ['اعراف'],
  8: ['بدر'],
  9: ['براءة', 'التوبه', 'براءه'],
  10: ['يونس'],
  12: ['سورة يوسف', 'احسن القصص'],
  13: ['رعد'],
  17: ['بني اسرائيل', 'سبحان'],
  18: ['كهف', 'سورة الكهف'],
  19: ['مريم'],
  20: ['طه', 'طاها'],
  32: ['الم تنزيل', 'سجده', 'السجده'],
  36: ['ياسين', 'يس', 'قلب القرآن'],
  39: ['الغرف'],
  40: ['المؤمن'],
  41: ['حم السجده'],
  47: ['القتال'],
  48: ['فتح'],
  55: ['عروس القرآن', 'رحمن'],
  56: ['واقعه'],
  67: ['تبارك', 'ملك', 'المانعه', 'المنجيه'],
  73: ['مزمل'],
  74: ['مدثر'],
  76: ['الدهر', 'انسان'],
  78: ['عم', 'عم يتساءلون', 'نبا'],
  87: ['سبح', 'سبح اسم ربك'],
  93: ['ضحى', 'والضحى'],
  94: ['انشراح', 'الم نشرح', 'نشرح'],
  95: ['والتين', 'تين'],
  96: ['اقرأ', 'اقرا', 'علق'],
  97: ['قدر'],
  99: ['زلزله', 'اذا زلزلت'],
  101: ['قارعه'],
  102: ['تكاثر', 'الهاكم'],
  103: ['عصر', 'والعصر'],
  104: ['همزه', 'ويل لكل همزه'],
  105: ['فيل', 'الم تر'],
  106: ['قريش', 'لايلاف'],
  107: ['ماعون', 'ارايت'],
  108: ['كوثر', 'انا اعطيناك'],
  109: ['كافرون', 'قل يا ايها الكافرون'],
  110: ['نصر', 'اذا جاء نصر الله', 'التوديع'],
  111: ['مسد', 'تبت', 'لهب', 'اللهب'],
  112: ['اخلاص', 'قل هو الله احد', 'توحيد', 'التوحيد'],
  113: ['فلق', 'قل اعوذ برب الفلق', 'المعوذتين', 'المعوذتان'],
  114: ['ناس', 'قل اعوذ برب الناس', 'المعوذتين', 'المعوذتان'],
};

const normalizeSearch = (input: string): string =>
  String(input || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200B-\u200F\uFEFF]/g, '')
    .replace(/[\u0671\u0622\u0623\u0625]/g, '\u0627')
    .replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0626/g, '\u064A')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const stripAl = (s: string): string =>
  s
    .split(' ')
    .map((w) => (w.startsWith('ال') && w.length > 3 ? w.slice(2) : w))
    .join(' ');

type SearchEntry = {
  surah: SurahMeta;
  name: string;
  nameNoAl: string;
  aliases: string[];
  aliasesNoAl: string[];
};

const buildSearchIndex = (surahs: SurahMeta[]): SearchEntry[] =>
  surahs.map((s) => {
    const name = normalizeSearch(s.name);
    const aliases = (SURAH_ALIASES[s.number] || []).map(normalizeSearch);
    return {
      surah: s,
      name,
      nameNoAl: stripAl(name),
      aliases,
      aliasesNoAl: aliases.map(stripAl),
    };
  });

const scoreText = (cand: string, q: string, qNoAl: string): number => {
  if (!cand) return 0;
  if (cand === q || cand === qNoAl) return 100;
  if (cand.startsWith(q) || cand.startsWith(qNoAl)) return 85;
  const words = cand.split(' ');
  if (words.some((w) => w.startsWith(q) || w.startsWith(qNoAl))) return 75;
  if (cand.includes(q) || cand.includes(qNoAl)) return 65;
  return 0;
};

const scoreEntry = (entry: SearchEntry, rawQuery: string): number => {
  let q = normalizeSearch(rawQuery);

  if (/^\d+$/.test(q)) {
    const num = parseInt(q, 10);
    if (entry.surah.number === num) return 100;
    if (String(entry.surah.number).startsWith(q)) return 30;
    return 0;
  }

  q = q.replace(/^سورة\s+|^سوره\s+/, '').trim();
  if (!q) return 1;

  if (q === 'مدنيه' || q === 'مدنية') {
    return entry.surah.revelationType === 'مدنية' ? 100 : 0;
  }
  if (q === 'مكيه' || q === 'مكية') {
    return entry.surah.revelationType === 'مكية' ? 100 : 0;
  }

  const qNoAl = stripAl(q);
  let best = Math.max(scoreText(entry.name, q, qNoAl), scoreText(entry.nameNoAl, q, qNoAl));

  entry.aliases.forEach((al, i) => {
    const sc = Math.max(scoreText(al, q, qNoAl), scoreText(entry.aliasesNoAl[i], q, qNoAl));
    best = Math.max(best, sc - 5);
  });

  return best;
};

const searchSurahs = (index: SearchEntry[], rawQuery: string): SurahMeta[] => {
  if (!normalizeSearch(rawQuery)) return index.map((e) => e.surah);

  return index
    .map((entry) => ({ surah: entry.surah, score: scoreEntry(entry, rawQuery) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.surah.number - b.surah.number)
    .map((r) => r.surah);
};

export type AyahData = {
  globalNumber: number;
  numberInSurah: number;
  surahNumber: number;
  surahName: string;
  textArabic: string;
  page: number;
  juz: number;
};

type SavedBookmark = {
  page: number;
  surahNumber: number;
  surahName: string;
  ayahNumberInSurah: number;
  globalNumber: number;
};

type ProcessedQuran = {
  pages: { [page: number]: AyahData[] };
  surahs: SurahMeta[];
  startPages: { [surahNum: number]: number };
};

const processQuranData = (data: any): ProcessedQuran => {
  const pages: { [page: number]: AyahData[] } = {};
  const startPages: { [surahNum: number]: number } = {};

  data.surahs.forEach((s: any, idx: number) => {
    const sNum = Number(s.number) || idx + 1;
    const sName = getSurahName(sNum, s.name);
    const firstAyahPage = s.ayahs && s.ayahs[0] ? s.ayahs[0].page : (SURAH_MAP_BY_NUM[sNum]?.startPage || 1);

    startPages[sNum] = firstAyahPage;

    s.ayahs.forEach((a: any) => {
      const pageNum = a.page;
      if (!pages[pageNum]) {
        pages[pageNum] = [];
      }

      pages[pageNum].push({
        globalNumber: a.number,
        numberInSurah: a.numberInSurah,
        surahNumber: sNum,
        surahName: sName,
        textArabic: cleanAyahText(a.text, sNum, a.numberInSurah),
        page: pageNum,
        juz: a.juz,
      });
    });
  });

  return { pages, surahs: ALL_SURAHS_STATIC, startPages };
};

const TOTAL_SURAHS = 114;

const validateProcessedQuran = (data: ProcessedQuran | null): boolean => {
  try {
    if (!data || !data.pages) return false;
    return !!(data.pages[1]?.length && data.pages[TOTAL_PAGES]?.length);
  } catch (e) {
    return false;
  }
};

let MEMORY_CACHE: ProcessedQuran | null = null;
let LOAD_PROMISE: Promise<ProcessedQuran> | null = null;

const fetchWithTimeout = async (url: string, ms: number) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const loadQuranData = (): Promise<ProcessedQuran> => {
  if (MEMORY_CACHE && validateProcessedQuran(MEMORY_CACHE)) return Promise.resolve(MEMORY_CACHE);
  if (LOAD_PROMISE) return LOAD_PROMISE;

  LOAD_PROMISE = (async () => {
    try {
      const processedStr = await AsyncStorage.getItem(PROCESSED_STORAGE_KEY);
      if (processedStr) {
        const processed: ProcessedQuran = JSON.parse(processedStr);
        if (validateProcessedQuran(processed)) {
          processed.surahs = ALL_SURAHS_STATIC;
          MEMORY_CACHE = processed;
          return processed;
        }
      }
    } catch (e) {}

    let raw: any = null;
    try {
      const legacy = await AsyncStorage.getItem(LEGACY_RAW_STORAGE_KEY);
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (parsed?.surahs && parsed.surahs.length === TOTAL_SURAHS) {
          raw = parsed;
        }
      }
    } catch (e) {}

    if (!raw) {
      try {
        raw = await fetchCompleteQuranUthmani();
      } catch (err) {
        const response = await fetchWithTimeout(QURAN_API_URL, 35000);
        const json = await response.json();
        if (json?.data?.surahs) {
          raw = json.data;
        }
      }
    }

    if (!raw || !raw.surahs) {
      throw new Error('تعذر تحميل بيانات المصحف الشريف');
    }

    const processed = processQuranData(raw);
    MEMORY_CACHE = processed;

    AsyncStorage.setItem(PROCESSED_STORAGE_KEY, JSON.stringify(processed)).catch(() => {});
    return processed;
  })();

  LOAD_PROMISE.catch(() => {
    LOAD_PROMISE = null;
  });

  return LOAD_PROMISE;
};

loadQuranData().catch(() => {});

// =====================================================================
// صفحة المصحف (Memo) مع دعم حجم الخط الديناميكي وزخرفة الآيات
// =====================================================================
type MushafPageProps = {
  pageNumber: number;
  ayahs: AyahData[] | undefined;
  colors: any;
  fontSize: number;
  isPlayingAudio: boolean;
  playingAyah: AyahData | null;
  savedBookmark: SavedBookmark | null;
  highlightedAyah: { surah: number; ayah: number } | null;
  onAyahPress: (ayah: AyahData) => void;
  onSurahLayout: (key: string, y: number) => void;
  registerScrollRef: (page: number, ref: ScrollView | null) => void;
};

const MushafPage = React.memo(
  ({
    pageNumber,
    ayahs,
    colors,
    fontSize,
    isPlayingAudio,
    playingAyah,
    savedBookmark,
    highlightedAyah,
    onAyahPress,
    onSurahLayout,
    registerScrollRef,
  }: MushafPageProps) => {
    if (!ayahs || ayahs.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSec }]}>
            جاري فتح الصفحة {pageNumber}...
          </Text>
        </View>
      );
    }

    const groupsMap = new Map<number, AyahData[]>();
    ayahs.forEach((ayah) => {
      if (!groupsMap.has(ayah.surahNumber)) {
        groupsMap.set(ayah.surahNumber, []);
      }
      groupsMap.get(ayah.surahNumber)!.push(ayah);
    });

    const groups = Array.from(groupsMap.entries()).map(([surahNum, list]) => ({
      surahNumber: surahNum,
      surahName: getSurahName(surahNum, list[0].surahName),
      ayahs: list,
      startsHere: list[0].numberInSurah === 1,
    }));

    const dynamicLineHeight = Math.round(fontSize * 2.3);

    return (
      <ScrollView
        ref={(ref) => registerScrollRef(pageNumber, ref)}
        contentContainerStyle={styles.mushafPageContent}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((group) => (
          <View
            key={`surah_group_${group.surahNumber}_p${pageNumber}`}
            style={styles.surahSection}
            onLayout={(e) => {
              onSurahLayout(`${pageNumber}_${group.surahNumber}`, e.nativeEvent.layout.y);
            }}
          >
            {(group.startsHere || groups.length > 1) && (
              <View style={[styles.surahBanner, { backgroundColor: colors.bannerBg }]}>
                <Text style={[styles.surahBannerText, { color: colors.bannerText }]}>
                  {getSurahTitle(group.surahNumber, group.surahName)}
                </Text>
              </View>
            )}

            {group.startsHere && group.surahNumber !== 9 && group.surahNumber !== 1 && (
              <Text style={[styles.basmalahText, { color: colors.primary }]}>
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </Text>
            )}

            <Text style={[styles.quranTextContainer, { lineHeight: dynamicLineHeight }]}>
              {group.ayahs.map((ayah) => {
                const isPlayingThis =
                  isPlayingAudio &&
                  playingAyah?.surahNumber === ayah.surahNumber &&
                  playingAyah?.numberInSurah === ayah.numberInSurah;

                const isBookmarked =
                  savedBookmark &&
                  savedBookmark.surahNumber === ayah.surahNumber &&
                  savedBookmark.ayahNumberInSurah === ayah.numberInSurah;

                const isHighlighted =
                  highlightedAyah &&
                  highlightedAyah.surah === ayah.surahNumber &&
                  highlightedAyah.ayah === ayah.numberInSurah;

                return (
                  <Text
                    key={`ayah_${ayah.globalNumber}_${ayah.numberInSurah}`}
                    onPress={() => onAyahPress(ayah)}
                    style={[
                      styles.ayahArabicText,
                      {
                        fontSize: fontSize,
                        color: isHighlighted
                          ? '#000000'
                          : isPlayingThis
                          ? (colors.isDarkMode ? '#34D399' : '#065F46')
                          : isBookmarked
                          ? colors.bookmarkGold
                          : colors.verseText,
                        backgroundColor: isHighlighted
                          ? colors.highlightBg
                          : isPlayingThis
                          ? (colors.isDarkMode ? '#064E3B' : '#C7F9CC')
                          : isBookmarked
                          ? colors.bookmarkBg
                          : 'transparent',
                      },
                    ]}
                  >
                    {isBookmarked && <Text style={{ fontSize: fontSize * 0.8 }}>🔖 </Text>}
                    {isHighlighted && <Text style={{ fontSize: fontSize * 0.8 }}>✨ </Text>}
                    {ayah.textArabic}

                    {/* رمز رأس الآية المزخرف ﴿ رقم ﴾ */}
                    <Text
                      style={[
                        styles.ayahDecorativeCircle,
                        {
                          fontSize: Math.round(fontSize * 0.9),
                          color: isHighlighted
                            ? '#B45309'
                            : isPlayingThis
                            ? (colors.isDarkMode ? '#34D399' : '#059669')
                            : isBookmarked
                            ? colors.bookmarkGold
                            : (colors.isDarkMode ? '#E5C07B' : '#B8860B'),
                        },
                      ]}
                    >
                      {` ﴿${toArabicDigits(ayah.numberInSurah)}﴾ `}
                    </Text>
                  </Text>
                );
              })}
            </Text>
          </View>
        ))}
      </ScrollView>
    );
  }
);

export const QuranScreen = ({ navigation, route }: any) => {
  const { isDarkMode } = useTheme();

  const colors = useMemo(
    () => ({
      isDarkMode,
      bg: isDarkMode ? '#121212' : '#F8FAFC',
      card: isDarkMode ? '#1E1E1E' : '#FFFFFF',
      mushaf: isDarkMode ? '#18181B' : '#FFFDF7',
      border: isDarkMode ? '#2E2E33' : '#E8E1D1',
      primary: isDarkMode ? '#34D399' : '#059669',
      primaryDark: isDarkMode ? '#064E3B' : '#D1FAE5',
      bookmarkGold: '#EAB308',
      bookmarkBg: isDarkMode ? '#422006' : '#FEF9C3',
      highlightBg: isDarkMode ? '#634A00' : '#FEF08A',
      text: isDarkMode ? '#FFFFFF' : '#0F172A',
      textSec: isDarkMode ? '#A1A1AA' : '#64748B',
      bannerBg: isDarkMode ? '#064E3B' : '#059669',
      bannerText: '#FFFFFF',
      badgeText: isDarkMode ? '#34D399' : '#059669',
      verseText: isDarkMode ? '#F4F4F5' : '#1E293B',
    }),
    [isDarkMode]
  );

  const [loadingQuran, setLoadingQuran] = useState<boolean>(!MEMORY_CACHE);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [allPagesData, setAllPagesData] = useState<{ [page: number]: AyahData[] }>(
    MEMORY_CACHE ? MEMORY_CACHE.pages : {}
  );
  const [surahsList] = useState<SurahMeta[]>(ALL_SURAHS_STATIC);

  // حجم الخط قابل للتكبير والتصغير
  const [quranFontSize, setQuranFontSize] = useState<number>(22);

  const [activeSurahNumber, setActiveSurahNumber] = useState<number>(1);
  const [savedBookmark, setSavedBookmark] = useState<SavedBookmark | null>(null);
  const [highlightedAyah, setHighlightedAyah] = useState<{ surah: number; ayah: number } | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(-100)).current;

  // Index Modal
  const [showIndexModal, setShowIndexModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // مشغل الصوت وخيارات القراء
  const [selectedReciter, setSelectedReciter] = useState(RECITERS[0]);
  const [showReciterModal, setShowReciterModal] = useState<boolean>(false);

  // خيارات التلاوة
  const [isPlayingInteractive, setIsPlayingInteractive] = useState<boolean>(false);
  const [isPlayingFullSurah, setIsPlayingFullSurah] = useState<boolean>(false);
  const [playingAyah, setPlayingAyah] = useState<AyahData | null>(null);

  // نافذة تفاصيل وتفسير الآية
  const [selectedAyah, setSelectedAyah] = useState<AyahData | null>(null);
  const [ayahTafseer, setAyahTafseer] = useState<string>('');
  const [loadingTafseer, setLoadingTafseer] = useState<boolean>(false);

  // Refs
  const playerRef = useRef<any>(null);
  const subscriptionRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const pageScrollRefs = useRef<{ [page: number]: ScrollView | null }>({});
  const surahPositions = useRef<{ [key: string]: number }>({});
  const currentPageRef = useRef<number>(1);
  currentPageRef.current = currentPage;
  const allPagesDataRef = useRef(allPagesData);
  allPagesDataRef.current = allPagesData;

  const isPlayingRef = useRef<boolean>(false);
  const playlistRef = useRef<AyahData[]>([]);
  const playlistIndexRef = useRef<number>(0);
  const pendingTargetRef = useRef<{ page: number; surah?: number; ayah?: number } | null>(null);

  // تتبع ثواني ومدة السورة الكاملة
  const fullSurahCurrentTimeRef = useRef<number>(0);
  const fullSurahDurationRef = useRef<number>(0);

  // نظام المزامنة المشتركة بين نمطي التلاوة لكل سورة
  const sharedSyncRef = useRef<{
    [surahNum: number]: {
      ayahNumberInSurah: number;
      timestampSec: number;
      durationSec: number;
    };
  }>({});

  // استرجاع المزامنة وحجم الخط عند الفتح
  useEffect(() => {
    (async () => {
      try {
        const savedSync = await AsyncStorage.getItem(SHARED_AUDIO_SYNC_KEY);
        if (savedSync) {
          sharedSyncRef.current = JSON.parse(savedSync);
        }
        const savedSize = await AsyncStorage.getItem(FONT_SIZE_STORAGE_KEY);
        if (savedSize) {
          setQuranFontSize(parseInt(savedSize, 10));
        }
      } catch (e) {}
    })();
  }, []);

  // دالة حفظ المزامنة المشتركة
  const saveSharedPlayback = useCallback(async (surahNum: number, ayahNum: number, timeSec: number, durSec: number = 0) => {
    sharedSyncRef.current[surahNum] = {
      ayahNumberInSurah: ayahNum,
      timestampSec: Math.max(0, Math.floor(timeSec)),
      durationSec: Math.floor(durSec),
    };
    try {
      await AsyncStorage.setItem(SHARED_AUDIO_SYNC_KEY, JSON.stringify(sharedSyncRef.current));
    } catch (e) {}
  }, []);

  // دوال تكبير وتصغير حجم الخط
  const increaseFontSize = useCallback(() => {
    setQuranFontSize((prev) => {
      const next = Math.min(36, prev + 2);
      AsyncStorage.setItem(FONT_SIZE_STORAGE_KEY, next.toString()).catch(() => {});
      return next;
    });
  }, []);

  const decreaseFontSize = useCallback(() => {
    setQuranFontSize((prev) => {
      const next = Math.max(16, prev - 2);
      AsyncStorage.setItem(FONT_SIZE_STORAGE_KEY, next.toString()).catch(() => {});
      return next;
    });
  }, []);

  const applyData = (data: ProcessedQuran) => {
    setAllPagesData(data.pages);
    const firstAyah = data.pages[currentPageRef.current]?.[0] || data.pages[1]?.[0];
    if (firstAyah) {
      setActiveSurahNumber(firstAyah.surahNumber);
    }
  };

  const loadQuran = async () => {
    setLoadError(false);
    if (!MEMORY_CACHE) setLoadingQuran(true);
    try {
      const data = await loadQuranData();
      applyData(data);
    } catch (e) {
      if (!MEMORY_CACHE) setLoadError(true);
    }
    setLoadingQuran(false);
  };

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});

    loadQuran();
    loadSavedBookmark();

    return () => {
      stopAudio();
    };
  }, []);

  const scrollToSurahSection = useCallback((page: number, surahNum: number, attempts = 0) => {
    const posKey = `${page}_${surahNum}`;
    const y = surahPositions.current[posKey];
    if (y !== undefined && pageScrollRefs.current[page]) {
      pageScrollRefs.current[page]?.scrollTo({
        y: Math.max(0, y - 10),
        animated: true,
      });
    } else if (attempts < 6) {
      setTimeout(() => scrollToSurahSection(page, surahNum, attempts + 1), 120);
    }
  }, []);

  const goToPage = useCallback((targetPage: number, overrideSurah?: number) => {
    if (targetPage < 1 || targetPage > TOTAL_PAGES) return;
    currentPageRef.current = targetPage;
    setCurrentPage(targetPage);

    if (overrideSurah) {
      setActiveSurahNumber(overrideSurah);
    } else {
      const ayahs = allPagesDataRef.current[targetPage];
      if (ayahs && ayahs.length > 0) {
        setActiveSurahNumber(ayahs[0].surahNumber);
      }
    }

    const indexInReversed = TOTAL_PAGES - targetPage;
    const offset = indexInReversed * SCREEN_WIDTH;

    setTimeout(() => {
      try {
        flatListRef.current?.scrollToOffset({
          offset,
          animated: true,
        });
      } catch (e) {
        flatListRef.current?.scrollToIndex({
          index: indexInReversed,
          animated: true,
        });
      }
    }, 50);
  }, []);

  const executeNavigate = useCallback(
    (targetPage: number, tSurah?: any, tAyah?: any) => {
      const surahNum = Number(tSurah);
      const validSurah = surahNum >= 1 && surahNum <= 114 ? surahNum : undefined;

      if (validSurah && tAyah) {
        setHighlightedAyah({ surah: validSurah, ayah: Number(tAyah) });
        setTimeout(() => setHighlightedAyah(null), 8000);
      }

      if (loadingQuran || !allPagesDataRef.current[targetPage]) {
        pendingTargetRef.current = { page: targetPage, surah: validSurah, ayah: tAyah };
        return;
      }

      stopAudio();

      if (validSurah) {
        setActiveSurahNumber(validSurah);
      }

      goToPage(targetPage, validSurah);

      if (validSurah) {
        scrollToSurahSection(targetPage, validSurah);
      }
    },
    [loadingQuran, goToPage, scrollToSurahSection]
  );

  useEffect(() => {
    if (!loadingQuran && pendingTargetRef.current) {
      const { page, surah, ayah } = pendingTargetRef.current;
      pendingTargetRef.current = null;
      setTimeout(() => {
        executeNavigate(page, surah, ayah);
      }, 150);
    }
  }, [loadingQuran, executeNavigate]);

  useEffect(() => {
    const target = route?.params?.targetPage || route?.params?.page;
    if (target && !isNaN(Number(target))) {
      executeNavigate(Number(target), route?.params?.targetSurah, route?.params?.targetAyah);
    }
  }, [route?.params?.targetPage, route?.params?.page, route?.params?.timestamp, executeNavigate]);

  useFocusEffect(
    useCallback(() => {
      const handleNavigationTarget = async () => {
        let target = route?.params?.targetPage || route?.params?.page;
        let tSurah = route?.params?.targetSurah;
        let tAyah = route?.params?.targetAyah;

        if (!target) {
          try {
            const stored = await AsyncStorage.getItem('@quran_target_page');
            if (stored) {
              target = parseInt(stored, 10);
              await AsyncStorage.removeItem('@quran_target_page');
            }
            const storedSurah = await AsyncStorage.getItem('@quran_highlight_surah');
            const storedAyah = await AsyncStorage.getItem('@quran_highlight_ayah');
            if (storedSurah && storedAyah) {
              tSurah = storedSurah;
              tAyah = storedAyah;
              await AsyncStorage.removeItem('@quran_highlight_surah');
              await AsyncStorage.removeItem('@quran_highlight_ayah');
            }
          } catch (e) {}
        }

        if (target && !isNaN(Number(target))) {
          executeNavigate(Number(target), tSurah, tAyah);
        }
      };

      handleNavigationTarget();
    }, [route?.params, executeNavigate])
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    Animated.spring(toastAnim, {
      toValue: Platform.OS === 'android' ? 50 : 60,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setToastMessage(null));
    }, 2800);
  };

  const loadSavedBookmark = async () => {
    try {
      const data = await AsyncStorage.getItem(BOOKMARK_STORAGE_KEY);
      if (data) {
        setSavedBookmark(JSON.parse(data));
      }
    } catch (e) {}
  };

  const handleSaveBookmark = async (ayah: AyahData) => {
    const bookmarkData: SavedBookmark = {
      page: ayah.page,
      surahNumber: ayah.surahNumber,
      surahName: getSurahName(ayah.surahNumber, ayah.surahName),
      ayahNumberInSurah: ayah.numberInSurah,
      globalNumber: ayah.globalNumber,
    };

    try {
      await AsyncStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarkData));
      setSavedBookmark(bookmarkData);
      setSelectedAyah(null);
      showToast(`تم حفظ فاصل القراءة 🔖 عند سورة ${bookmarkData.surahName} (آية ${bookmarkData.ayahNumberInSurah})`);
    } catch (e) {}
  };

  const handleGoToBookmark = () => {
    if (!savedBookmark) {
      showToast('لم تقم بحفظ أي علامة بعد 🔖');
      return;
    }

    stopAudio();
    goToPage(savedBookmark.page, savedBookmark.surahNumber);
  };

  // إيقاف الصوت مع حفظ نقطة التوقف الحالية في المزامنة
  const stopAudio = () => {
    isPlayingRef.current = false;

    // حفظ موضع السورة كاملة لو كانت شغالة
    if (isPlayingFullSurah && fullSurahCurrentTimeRef.current > 0) {
      const sNum = activeSurahNumber;
      const totalAyahs = ALL_SURAHS_STATIC[sNum - 1]?.numberOfAyahs || 1;
      const curTime = fullSurahCurrentTimeRef.current;
      const dur = fullSurahDurationRef.current || 600;
      const estAyah = Math.max(1, Math.min(totalAyahs, Math.floor((curTime / dur) * totalAyahs) + 1));
      saveSharedPlayback(sNum, estAyah, curTime, dur);
    }

    playlistRef.current = [];
    playlistIndexRef.current = 0;

    if (subscriptionRef.current) {
      try {
        subscriptionRef.current.remove();
      } catch (e) {}
      subscriptionRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.remove();
      } catch (e) {}
      playerRef.current = null;
    }
    setIsPlayingInteractive(false);
    setIsPlayingFullSurah(false);
    setPlayingAyah(null);
  };

  // ==========================================
  // النمط 1: تظليل وتقليب الصفحات (آية بآية)
  // ==========================================
  const playNextAyahInPlaylist = async () => {
    if (!isPlayingRef.current) return;
    if (playlistIndexRef.current >= playlistRef.current.length) {
      stopAudio();
      return;
    }

    if (subscriptionRef.current) {
      try {
        subscriptionRef.current.remove();
      } catch (e) {}
      subscriptionRef.current = null;
    }
    if (playerRef.current) {
      try {
        playerRef.current.pause();
        playerRef.current.remove();
      } catch (e) {}
      playerRef.current = null;
    }

    const currentAyah = playlistRef.current[playlistIndexRef.current];
    setPlayingAyah(currentAyah);

    // حفظ التزامن المشترك لحظياً للآية الحالية
    const sNum = currentAyah.surahNumber;
    const totalAyahs = ALL_SURAHS_STATIC[sNum - 1]?.numberOfAyahs || 1;
    const durSec = sharedSyncRef.current[sNum]?.durationSec || 600;
    const estimatedSec = Math.floor(((currentAyah.numberInSurah - 1) / totalAyahs) * durSec);
    saveSharedPlayback(sNum, currentAyah.numberInSurah, estimatedSec, durSec);

    if (currentAyah.page !== currentPageRef.current) {
      goToPage(currentAyah.page, currentAyah.surahNumber);
    }

    try {
      const surahStr = String(currentAyah.surahNumber).padStart(3, '0');
      const ayahStr = String(currentAyah.numberInSurah).padStart(3, '0');
      const url = `https://everyayah.com/data/${selectedReciter.subfolder}/${surahStr}${ayahStr}.mp3`;

      const player = createAudioPlayer(url);
      playerRef.current = player;

      let hasHandledFinish = false;

      subscriptionRef.current = player.addListener('playbackStatusUpdate', (status: any) => {
        if (hasHandledFinish) return;

        if (status?.didJustFinish) {
          hasHandledFinish = true;
          if (isPlayingRef.current) {
            playlistIndexRef.current += 1;
            playNextAyahInPlaylist();
          }
        }
      });

      player.play();
    } catch (e) {
      if (isPlayingRef.current) {
        playlistIndexRef.current += 1;
        playNextAyahInPlaylist();
      }
    }
  };

  const handleToggleInteractivePlay = () => {
    if (isPlayingInteractive) {
      // عند التوقف نحفظ مكان الآية بدقة
      if (playingAyah) {
        const sNum = playingAyah.surahNumber;
        const totalAyahs = ALL_SURAHS_STATIC[sNum - 1]?.numberOfAyahs || 1;
        const durSec = sharedSyncRef.current[sNum]?.durationSec || 600;
        const estimatedSec = Math.floor(((playingAyah.numberInSurah - 1) / totalAyahs) * durSec);
        saveSharedPlayback(sNum, playingAyah.numberInSurah, estimatedSec, durSec);
      }
      stopAudio();
      return;
    }

    stopAudio();

    const currentSurah = activeSurahNumber;
    const surahAyahs: AyahData[] = [];

    for (let p = 1; p <= TOTAL_PAGES; p++) {
      const list = allPagesDataRef.current[p] || [];
      list.forEach((ay) => {
        if (ay.surahNumber === currentSurah) {
          surahAyahs.push(ay);
        }
      });
    }

    surahAyahs.sort((a, b) => a.numberInSurah - b.numberInSurah);
    if (surahAyahs.length === 0) return;

    // استئناف من نفس الآية المخزنة المشتركة لو موجودة، وإلا من بداية الصفحة الحالية
    const savedAyahNum = sharedSyncRef.current[currentSurah]?.ayahNumberInSurah;
    let startIndex = 0;
    if (savedAyahNum && savedAyahNum > 1) {
      const foundIdx = surahAyahs.findIndex((ay) => ay.numberInSurah === savedAyahNum);
      if (foundIdx !== -1) startIndex = foundIdx;
    } else {
      const pageIdx = surahAyahs.findIndex((ay) => ay.page === currentPageRef.current);
      if (pageIdx !== -1) startIndex = pageIdx;
    }

    playlistRef.current = surahAyahs;
    playlistIndexRef.current = startIndex;
    isPlayingRef.current = true;
    setIsPlayingInteractive(true);

    playNextAyahInPlaylist();
  };

  // ==========================================
  // النمط 2: سورة كاملة مع المزامنة
  // ==========================================
  const handleToggleFullSurahPlay = async () => {
    if (isPlayingFullSurah) {
      stopAudio();
      return;
    }

    stopAudio();
    setIsPlayingFullSurah(true);

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      }).catch(() => {});

      const currentSurah = activeSurahNumber;
      const surahPadded = String(currentSurah).padStart(3, '0');
      const surahAudioUrl = `${selectedReciter.server}${surahPadded}.mp3`;

      const player = createAudioPlayer(surahAudioUrl);
      playerRef.current = player;

      subscriptionRef.current = player.addListener('playbackStatusUpdate', (status: any) => {
        if (status?.isLoaded) {
          const curTime = status.currentTime || 0;
          const dur = status.duration || 0;
          fullSurahCurrentTimeRef.current = curTime;
          fullSurahDurationRef.current = dur;

          // تحديث دوري للمزامنة المشتركة كل 3 ثواني
          if (dur > 0 && Math.floor(curTime) % 3 === 0) {
            const totalAyahs = ALL_SURAHS_STATIC[currentSurah - 1]?.numberOfAyahs || 1;
            const estAyah = Math.max(1, Math.min(totalAyahs, Math.floor((curTime / dur) * totalAyahs) + 1));
            saveSharedPlayback(currentSurah, estAyah, curTime, dur);
          }
        }

        if (status?.didJustFinish || status?.playbackState === 'ended') {
          saveSharedPlayback(currentSurah, 1, 0, 0);
          stopAudio();
        }
      });

      player.play();

      // لو فيه وقت محفوظ سابقاً من النمط التفاعلي أو السورة، نقفز إليه فوراً
      const syncInfo = sharedSyncRef.current[currentSurah];
      if (syncInfo && syncInfo.timestampSec > 0) {
        setTimeout(() => {
          try {
            player.seekTo(syncInfo.timestampSec);
          } catch (e) {}
        }, 350);
      }
    } catch (e) {
      stopAudio();
    }
  };

  const playSingleAyahOnly = async (ayahItem: AyahData) => {
    stopAudio();
    setPlayingAyah(ayahItem);
    setIsPlayingInteractive(true);
    isPlayingRef.current = true;

    try {
      const surahStr = String(ayahItem.surahNumber).padStart(3, '0');
      const ayahStr = String(ayahItem.numberInSurah).padStart(3, '0');
      const url = `https://everyayah.com/data/${selectedReciter.subfolder}/${surahStr}${ayahStr}.mp3`;

      const player = createAudioPlayer(url);
      playerRef.current = player;

      let hasHandledFinish = false;

      subscriptionRef.current = player.addListener('playbackStatusUpdate', (status: any) => {
        if (hasHandledFinish) return;

        if (status?.didJustFinish) {
          hasHandledFinish = true;
          stopAudio();
        }
      });

      player.play();
    } catch (e) {
      stopAudio();
    }
  };

  const handleOpenAyahDetails = useCallback(async (ayah: AyahData) => {
    setSelectedAyah(ayah);
    setLoadingTafseer(true);
    setAyahTafseer('');

    const cacheKey = `@tafseer_ayah_${ayah.globalNumber}`;
    try {
      const cachedTafseer = await AsyncStorage.getItem(cacheKey);
      if (cachedTafseer) {
        setAyahTafseer(cachedTafseer);
        setLoadingTafseer(false);
        return;
      }

      const res = await fetch(`https://api.alquran.cloud/v1/ayah/${ayah.globalNumber}/ar.muyassar`);
      const data = await res.json();
      if (data?.data?.text) {
        setAyahTafseer(data.data.text);
        AsyncStorage.setItem(cacheKey, data.data.text).catch(() => {});
      } else {
        setAyahTafseer('لا يوجد تفسير متاح لهذه الآية حالياً.');
      }
    } catch (e) {
      setAyahTafseer('يتعذر تحميل التفسير حالياً (تأكد من الاتصال بالإنترنت للمرة الأولى).');
    } finally {
      setLoadingTafseer(false);
    }
  }, []);

  const handleSurahLayout = useCallback((key: string, y: number) => {
    surahPositions.current[key] = y;
  }, []);

  const registerScrollRef = useCallback((page: number, ref: ScrollView | null) => {
    pageScrollRefs.current[page] = ref;
  }, []);

  const handleSelectSurahFromIndex = (surah: SurahMeta) => {
    setShowIndexModal(false);
    setSearchQuery('');
    stopAudio();
    executeNavigate(surah.startPage, surah.number);
  };

  const renderPageItem = useCallback(
    ({ item: pageNum }: { item: number }) => (
      <View style={[styles.pageWrapper, { width: SCREEN_WIDTH }]}>
        <View
          style={[
            styles.mushafFrame,
            {
              backgroundColor: colors.mushaf,
              borderColor: colors.border,
            },
          ]}
        >
          <MushafPage
            pageNumber={pageNum}
            ayahs={allPagesData[pageNum]}
            colors={colors}
            fontSize={quranFontSize}
            isPlayingAudio={isPlayingInteractive || isPlayingFullSurah}
            playingAyah={playingAyah}
            savedBookmark={savedBookmark}
            highlightedAyah={highlightedAyah}
            onAyahPress={handleOpenAyahDetails}
            onSurahLayout={handleSurahLayout}
            registerScrollRef={registerScrollRef}
          />

          <View style={styles.pageNumberFooter}>
            <Text style={[styles.pageNumberText, { color: colors.textSec }]}>
              — {pageNum} —
            </Text>
          </View>
        </View>
      </View>
    ),
    [
      allPagesData,
      colors,
      quranFontSize,
      isPlayingInteractive,
      isPlayingFullSurah,
      playingAyah,
      savedBookmark,
      highlightedAyah,
      handleOpenAyahDetails,
      handleSurahLayout,
      registerScrollRef,
    ]
  );

  const searchIndex = useMemo(() => buildSearchIndex(surahsList), [surahsList]);
  const filteredSurahs = useMemo(
    () => searchSurahs(searchIndex, searchQuery),
    [searchIndex, searchQuery]
  );
  const currentAyahs = allPagesData[currentPage] || [];
  const currentJuz = currentAyahs[0]?.juz || 1;

  if (loadError && allPagesData[1]?.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.bg, padding: 24 }]}>
        <Ionicons name="cloud-offline-outline" size={44} color={colors.textSec} />
        <Text style={[styles.loadingText, { color: colors.text, marginTop: 14, textAlign: 'center' }]}>
          تعذر تحميل المصحف، تأكد من الاتصال بالإنترنت في أول مرة فقط ثم أعد المحاولة
        </Text>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary, paddingHorizontal: 30, marginTop: 18 }]}
          onPress={loadQuran}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionBtnText, { marginLeft: 0 }]}>إعادة المحاولة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loadingQuran && (!allPagesData[1] || allPagesData[1].length === 0)) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text, marginTop: 14 }]}>
          جاري تجهيز المصحف الشريف بالرسم العثماني...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* إشعار Toast */}
      {toastMessage && (
        <Animated.View
          style={[
            styles.toastContainer,
            {
              backgroundColor: isDarkMode ? '#1E293B' : '#0F172A',
              transform: [{ translateY: toastAnim }],
            },
          ]}
        >
          <Ionicons name="bookmark" size={20} color={colors.bookmarkGold} style={{ marginRight: 8 }} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}

      {/* الشريط العلوي مع أزرار التكبير والتصغير الكبيرة والمريحة */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setShowReciterModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="mic-outline" size={22} color={colors.primary} />
          <Text style={[styles.headerBtnText, { color: colors.text }]}>القارئ</Text>
        </TouchableOpacity>

        {/* زر العلامة */}
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleGoToBookmark}
          activeOpacity={0.7}
        >
          <Ionicons
            name={savedBookmark ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={savedBookmark ? colors.bookmarkGold : colors.textSec}
          />
          <Text
            style={[
              styles.headerBtnText,
              { color: savedBookmark ? colors.bookmarkGold : colors.textSec },
            ]}
          >
            {savedBookmark ? `ص ${savedBookmark.page}` : 'العلامة'}
          </Text>
        </TouchableOpacity>

        {/* أزرار التكبير والتصغير (كبيرة ومريحة) */}
        <View style={styles.fontSizeControls}>
          <TouchableOpacity
            style={[styles.fontSizeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={increaseFontSize}
            activeOpacity={0.7}
          >
            <Text style={[styles.fontSizeBtnText, { color: colors.primary }]}>A+</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.fontSizeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={decreaseFontSize}
            activeOpacity={0.7}
          >
            <Text style={[styles.fontSizeBtnText, { color: colors.primary }]}>A-</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerTitleBox}>
          <Text style={[styles.headerSurahText, { color: colors.primary }]}>
            {getSurahTitle(activeSurahNumber || currentAyahs[0]?.surahNumber)}
          </Text>
          <Text style={[styles.headerSubText, { color: colors.textSec }]}>
            الجزء {currentJuz} • صفحة {currentPage}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setShowIndexModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="list" size={22} color={colors.primary} />
          <Text style={[styles.headerBtnText, { color: colors.text }]}>الفهرس</Text>
        </TouchableOpacity>
      </View>

      {/* شريط خيارات التلاوة (متزامن كلياً ويحفظ موضع التوقف) */}
      <View style={[styles.audioBar, { backgroundColor: colors.card }]}>
        <TouchableOpacity
          style={[
            styles.modeBtn,
            isPlayingInteractive ? { backgroundColor: '#DC2626' } : { backgroundColor: colors.primary },
          ]}
          onPress={handleToggleInteractivePlay}
          activeOpacity={0.8}
        >
          <Ionicons name={isPlayingInteractive ? 'stop' : 'book-outline'} size={18} color="#FFFFFF" />
          <Text style={styles.modeBtnText}>
            {isPlayingInteractive ? 'إيقاف التظليل' : 'تظليل وتقليب الصفحات '}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.modeBtn,
            isPlayingFullSurah ? { backgroundColor: '#DC2626' } : { backgroundColor: colors.bannerBg },
          ]}
          onPress={handleToggleFullSurahPlay}
          activeOpacity={0.8}
        >
          <Ionicons name={isPlayingFullSurah ? 'stop' : 'headset-outline'} size={18} color="#FFFFFF" />
          <Text style={styles.modeBtnText}>
            {isPlayingFullSurah ? 'إيقاف السورة' : 'سورة كاملة (مع قفل الهاتف) '}
          </Text>
        </TouchableOpacity>
      </View>

      {/* عارض المصحف الشريف */}
      <FlatList
        ref={flatListRef}
        data={REVERSED_PAGES_ARRAY}
        keyExtractor={(item) => `page_${item}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={TOTAL_PAGES - 1}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        updateCellsBatchingPeriod={30}
        removeClippedSubviews={false}
        extraData={{ allPagesData, playingAyah, isPlayingInteractive, isPlayingFullSurah, highlightedAyah, savedBookmark, quranFontSize }}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({
              offset: info.index * SCREEN_WIDTH,
              animated: false,
            });
          }, 100);
        }}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          const activePage = TOTAL_PAGES - index;
          if (activePage >= 1 && activePage <= TOTAL_PAGES && activePage !== currentPageRef.current) {
            setCurrentPage(activePage);
            const pAyahs = allPagesDataRef.current[activePage];
            if (pAyahs && pAyahs.length > 0) {
              setActiveSurahNumber(pAyahs[0].surahNumber);
            }
          }
        }}
        renderItem={renderPageItem}
      />

      {/* مودال تفاصيل وتفسير الآية */}
      <Modal
        visible={!!selectedAyah}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedAyah(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalHeaderTitle, { color: colors.primary }]}>
                {selectedAyah
                  ? `${getSurahTitle(selectedAyah.surahNumber, selectedAyah.surahName)} - الآية (${selectedAyah.numberInSurah})`
                  : ''}
              </Text>
              <TouchableOpacity onPress={() => setSelectedAyah(null)}>
                <Ionicons name="close-circle" size={26} color={colors.textSec} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBodyScroll}>
              <View style={[styles.ayahQuoteBox, { backgroundColor: colors.bg }]}>
                <Text style={[styles.modalAyahText, { color: colors.text }]}>
                  {selectedAyah?.textArabic}
                </Text>
              </View>

              <View style={styles.actionButtonsList}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => selectedAyah && playSingleAyahOnly(selectedAyah)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={
                      (isPlayingInteractive || isPlayingFullSurah) &&
                      playingAyah?.surahNumber === selectedAyah?.surahNumber &&
                      playingAyah?.numberInSurah === selectedAyah?.numberInSurah
                        ? 'stop'
                        : 'volume-high-outline'
                    }
                    size={22}
                    color="#FFFFFF"
                  />
                  <Text style={styles.actionBtnText}>
                    {(isPlayingInteractive || isPlayingFullSurah) &&
                    playingAyah?.surahNumber === selectedAyah?.surahNumber &&
                    playingAyah?.numberInSurah === selectedAyah?.numberInSurah
                      ? 'إيقاف الاستماع'
                      : `استماع للآية (${selectedReciter.name.split(' ')[1]})`}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.bookmarkGold }]}
                  onPress={() => selectedAyah && handleSaveBookmark(selectedAyah)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="bookmark" size={20} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>حفظ كعلامة توقف 🔖</Text>
                </TouchableOpacity>
              </View>

              {loadingTafseer ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
              ) : (
                <View style={styles.detailSection}>
                  <Text style={[styles.sectionTitle, { color: colors.primary }]}>
                    📖 التفسير الميسر:
                  </Text>
                  <Text style={[styles.sectionContent, { color: colors.text }]}>
                    {ayahTafseer}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* مودال اختيار القارئ */}
      <Modal
        visible={showReciterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReciterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.reciterModalBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.reciterModalTitle, { color: colors.primary }]}>
              اختر القارئ المفضل لتلاوة السور
            </Text>
            {RECITERS.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.reciterItem,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor:
                      selectedReciter.id === r.id ? colors.primaryDark : 'transparent',
                  },
                ]}
                onPress={() => {
                  stopAudio();
                  setSelectedReciter(r);
                  setShowReciterModal(false);
                }}
              >
                <Text style={[styles.reciterItemText, { color: colors.text }]}>{r.name}</Text>
                {selectedReciter.id === r.id && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.closeModalBtn, { backgroundColor: colors.border }]}
              onPress={() => setShowReciterModal(false)}
            >
              <Text style={{ color: colors.text, fontWeight: 'bold' }}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* مودال الفهرس */}
      <Modal
        visible={showIndexModal}
        animationType="slide"
        onRequestClose={() => setShowIndexModal(false)}
      >
        <SafeAreaView style={[styles.indexContainer, { backgroundColor: colors.bg }]}>
          <View style={styles.indexHeader}>
            <Text style={[styles.indexTitle, { color: colors.primary }]}>فهرس السور</Text>
            <TouchableOpacity onPress={() => setShowIndexModal(false)}>
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.searchBox,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Ionicons name="search" size={20} color={colors.textSec} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="ابحث برقم السورة أو اسمها (الذاريات، البقرة، الكهف)..."
              placeholderTextColor={colors.textSec}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={colors.textSec} />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredSurahs}
            keyExtractor={(item) => `surah_${item.number}`}
            initialNumToRender={25}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={{ paddingVertical: 30, alignItems: 'center' }}>
                <Text style={[styles.surahRowMeta, { color: colors.textSec, fontSize: 14 }]}>
                  لا توجد سورة بهذا الاسم
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.surahRow, { borderBottomColor: colors.border }]}
                onPress={() => handleSelectSurahFromIndex(item)}
                activeOpacity={0.7}
              >
                <View style={styles.surahRowRight}>
                  <View style={[styles.surahNumBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.surahNumBadgeText}>{item.number}</Text>
                  </View>

                  <View style={styles.surahInfoContainer}>
                    <Text style={[styles.surahRowName, { color: colors.text }]}>
                      {`سورة ${item.name}`}
                    </Text>
                    <Text style={[styles.surahRowMeta, { color: colors.textSec }]}>
                      {item.revelationType} • {item.numberOfAyahs} آية • صفحة {item.startPage}
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-back" size={20} color={colors.textSec} />
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toastContainer: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
    maxWidth: '90%',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 44 : 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  headerBtnText: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  fontSizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fontSizeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  fontSizeBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  headerSurahText: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
    writingDirection: 'rtl',
    minWidth: 110,
  },
  headerSubText: {
    fontSize: 11.5,
    marginTop: 2,
  },
  audioBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  modeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pageWrapper: {
    flex: 1,
    paddingHorizontal: 10,
    paddingBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mushafFrame: {
    flex: 1,
    width: '100%',
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 6,
    justifyContent: 'space-between',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
  },
  mushafPageContent: {
    paddingTop: 10,
    paddingBottom: 70,
  },
  surahSection: {
    marginBottom: 20,
  },
  surahBanner: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'stretch',
    marginBottom: 10,
  },
  surahBannerText: {
    fontSize: 17,
    fontWeight: 'bold',
    alignSelf: 'stretch',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  basmalahText: {
    textAlign: 'center',
    fontSize: 19,
    fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'serif',
    marginBottom: 12,
    fontWeight: 'bold',
  },
  quranTextContainer: {
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  ayahArabicText: {
    fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'serif',
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ayahDecorativeCircle: {
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'serif',
  },
  pageNumberFooter: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  pageNumberText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    height: '65%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalBodyScroll: {
    paddingVertical: 14,
  },
  ayahQuoteBox: {
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  modalAyahText: {
    fontSize: 19,
    textAlign: 'center',
    lineHeight: 34,
  },
  actionButtonsList: {
    gap: 10,
    marginBottom: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  detailSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 15,
    lineHeight: 24,
  },
  reciterModalBox: {
    margin: 20,
    borderRadius: 16,
    padding: 20,
  },
  reciterModalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  reciterItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderRadius: 8,
  },
  reciterItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeModalBtn: {
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  indexContainer: {
    flex: 1,
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
  },
  indexHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  indexTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    textAlign: 'right',
  },
  surahRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  surahRowRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
  },
  surahNumBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 14,
  },
  surahNumBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  surahInfoContainer: {
    flex: 1,
    alignItems: 'stretch',
  },
  surahRowName: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 4,
  },
  surahRowMeta: {
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

export default QuranScreen;