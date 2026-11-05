// src/api/quranApi.ts

// السيرفرات المعتمدة من الـ OpenAPI مع التبديل التلقائي في حال انقطاع أحدهم
const BASE_SERVERS = [
  'https://api.alquran.cloud/v1',
  'https://alquran.api.islamic.network/v1',
];

/**
 * دالة مساعدة لطلب البيانات مع Timeout وسيرفر احتياطي تلقائي
 */
async function fetchWithFallback(endpoint: string, timeoutMs: number = 15000): Promise<any> {
  let lastError: any = null;

  for (const baseUrl of BASE_SERVERS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${baseUrl}${endpoint}`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const json = await response.json();
        if (json.code === 200 && json.data) {
          return json.data;
        }
      }
    } catch (err) {
      lastError = err;
      // يجرب السيرفر التاني تلقائياً لو الأول معلق
    }
  }

  throw lastError || new Error('فشل الاتصال بجميع سيرفرات المصحف الشريف');
}

/**
 * 1. جلب المصحف كاملاً بالرسم العثماني
 * Endpoint: /quran/quran-uthmani
 */
export async function fetchCompleteQuranUthmani() {
  return await fetchWithFallback('/quran/quran-uthmani', 30000); // 30 ثانية لأن حجم المصحف كامل حوالي 4MB
}

/**
 * 2. جلب صفحة معينة (من 1 إلى 604)
 * Endpoint: /page/{pageNumber}/quran-uthmani
 */
export async function fetchQuranPage(pageNumber: number) {
  return await fetchWithFallback(`/page/${pageNumber}/quran-uthmani`, 10000);
}

/**
 * 3. جلب سورة معينة (من 1 إلى 114)
 * Endpoint: /surah/{surahNumber}/quran-uthmani
 */
export async function fetchSurah(surahNumber: number) {
  return await fetchWithFallback(`/surah/${surahNumber}/quran-uthmani`, 15000);
}

/**
 * 4. جلب تفسير الآية (الميسر)
 * Endpoint: /ayah/{ayahNumber}/ar.muyassar
 */
export async function fetchAyahTafseer(ayahNumber: number): Promise<string> {
  try {
    const data = await fetchWithFallback(`/ayah/${ayahNumber}/ar.muyassar`, 8000);
    return data?.text || 'لا يوجد تفسير متاح لهذه الآية حالياً.';
  } catch (err) {
    return 'تعذر تحميل التفسير، تأكد من اتصال الإنترنت.';
  }
}