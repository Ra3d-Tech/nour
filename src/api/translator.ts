import AsyncStorage from '@react-native-async-storage/async-storage';

const TRANSLATION_CACHE_KEY_PREFIX = '@noor_translation_cache_';
const inMemoryCache: { [key: string]: string } = {};

/**
 * دالة ترجمة النصوص الحرة والمقالات والديناميكية
 * باستخدام رابط جوجل مع نظام كاش متطور محلي
 */
export const translateDynamicText = async (
  text: string,
  targetLang: 'ar' | 'en' = 'en',
  sourceLang: string = 'auto'
): Promise<string> => {
  if (!text || !text.trim()) return '';

  const cacheKey = `${sourceLang}_${targetLang}_${text.trim()}`;

  // 1. الفحص من الكاش السريع في الذاكرة
  if (inMemoryCache[cacheKey]) {
    return inMemoryCache[cacheKey];
  }

  // 2. الفحص من التخزين المحلي للأوفلاين
  try {
    const saved = await AsyncStorage.getItem(TRANSLATION_CACHE_KEY_PREFIX + cacheKey);
    if (saved) {
      inMemoryCache[cacheKey] = saved;
      return saved;
    }
  } catch (e) {}

  // 3. طلب الترجمة من سيرفر جوجل
  try {
    const googleLang = targetLang === 'ar' ? 'ar' : 'en';
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${googleLang}&dt=t&q=${encodeURIComponent(
      text
    )}`;

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data[0]) {
        const translated = data[0].map((part: any) => part[0]).join('');
        if (translated && translated.trim()) {
          inMemoryCache[cacheKey] = translated;
          // حفظها في التخزين المحلي لتعمل أوفلاين مستقبلاً
          AsyncStorage.setItem(TRANSLATION_CACHE_KEY_PREFIX + cacheKey, translated).catch(() => {});
          return translated;
        }
      }
    }
  } catch (err) {
    console.log('Dynamic translation fallback error:', err);
  }

  // في حالة انقطاع الإنترنت يرجع النص الأصلي
  return text;
};