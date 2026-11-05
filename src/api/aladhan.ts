// خدمة جلب مواقيت الصلاة مع فلتر فلسطين الأبية

export interface PrayerTimesData {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  rawTimings: any;
}

// دالة تنظيف اسم الدولة: فلسطين دائماً وأبداً 🇵🇸
export const sanitizeCountryName = (country: string | null | undefined): string => {
  if (!country) return 'مصر';
  const lower = country.toLowerCase();
  if (lower.includes('israel') || lower.includes('إسرائيل') || lower.includes('occupied')) {
    return 'فلسطين 🇵🇸';
  }
  return country;
};

// دالة تنظيف اسم المدينة
export const sanitizeCityName = (city: string | null | undefined, country: string | null | undefined): string => {
  const cleanCountry = sanitizeCountryName(country);
  if (cleanCountry.includes('فلسطين')) {
    if (!city || city.toLowerCase().includes('tel aviv') || city.toLowerCase().includes('israel')) {
      return 'القدس الشريف، فلسطين 🇵🇸';
    }
    return `${city}، فلسطين 🇵🇸`;
  }
  return `${city || 'موقعك'}، ${cleanCountry}`;
};

// تحويل الوقت إلى 12 ساعة (ص / م)
export const formatTo12Hour = (time24: string, isEnglish: boolean = false): string => {
  if (!time24) return '';
  const clean = time24.split(' ')[0];
  const parts = clean.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];

  const period = isEnglish ? (hours >= 12 ? 'PM' : 'AM') : (hours >= 12 ? 'م' : 'ص');
  hours = hours % 12;
  hours = hours ? hours : 12;

  const formattedHours = hours.toString().padStart(2, '0');
  return `${formattedHours}:${minutes} ${period}`;
};

// جلب المواقيت الدقيقة بالإحداثيات
export const fetchPrayerTimesByCoords = async (
  latitude: number,
  longitude: number
): Promise<PrayerTimesData | null> => {
  try {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const url = `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${latitude}&longitude=${longitude}&method=5`;
    const response = await fetch(url);
    const json = await response.json();

    if (json.code === 200 && json.data) {
      const timings = json.data.timings;
      return {
        Fajr: formatTo12Hour(timings.Fajr),
        Sunrise: formatTo12Hour(timings.Sunrise),
        Dhuhr: formatTo12Hour(timings.Dhuhr),
        Asr: formatTo12Hour(timings.Asr),
        Maghrib: formatTo12Hour(timings.Maghrib),
        Isha: formatTo12Hour(timings.Isha),
        rawTimings: timings,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching timings by coords:', error);
    return null;
  }
};

// جلب المواقيت بالمدينة
export const fetchPrayerTimesByCity = async (
  city: string = 'Alexandria',
  country: string = 'Egypt'
): Promise<PrayerTimesData | null> => {
  try {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    const url = `https://api.aladhan.com/v1/timingsByCity/${day}-${month}-${year}?city=${city}&country=${country}&method=5`;
    const response = await fetch(url);
    const json = await response.json();

    if (json.code === 200 && json.data) {
      const timings = json.data.timings;
      return {
        Fajr: formatTo12Hour(timings.Fajr),
        Sunrise: formatTo12Hour(timings.Sunrise),
        Dhuhr: formatTo12Hour(timings.Dhuhr),
        Asr: formatTo12Hour(timings.Asr),
        Maghrib: formatTo12Hour(timings.Maghrib),
        Isha: formatTo12Hour(timings.Isha),
        rawTimings: timings,
      };
    }
    return null;
  } catch (error) {
    return null;
  }
};

// دالة العد التنازلي للصلاة القادمة
// دالة العد التنازلي الدقيق بالساعة والدقيقة والثانية
export const getNextPrayerInfo = (rawTimings: any) => {
  if (!rawTimings) return { name: 'العصر', timeLeft: '--:--:--' };

  const prayerSchedule = [
    { key: 'Fajr', name: 'الفجر' },
    { key: 'Dhuhr', name: 'الظهر' },
    { key: 'Asr', name: 'العصر' },
    { key: 'Maghrib', name: 'المغرب' },
    { key: 'Isha', name: 'العشاء' },
  ];

  const now = new Date();
  const currentTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  for (let prayer of prayerSchedule) {
    const timeStr = rawTimings[prayer.key];
    if (!timeStr) continue;
    const clean = timeStr.split(' ')[0];
    const [h, m] = clean.split(':').map(Number);
    const prayerTotalSeconds = h * 3600 + m * 60;

    if (prayerTotalSeconds > currentTotalSeconds) {
      const diff = prayerTotalSeconds - currentTotalSeconds;
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      return {
        name: prayer.name,
        timeLeft: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
      };
    }
  }

  // إذا انتهت صلوات اليوم، يحسب الوقت المتبقي لفجر الغد بالثانية
  const fajrClean = rawTimings.Fajr ? rawTimings.Fajr.split(' ')[0] : '05:00';
  const [fH, fM] = fajrClean.split(':').map(Number);
  const tomorrowFajrSeconds = 24 * 3600 + fH * 3600 + fM * 60;
  const diff = tomorrowFajrSeconds - currentTotalSeconds;
  const hours = Math.floor(diff / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  const seconds = diff % 60;

  return {
    name: 'الفجر',
    timeLeft: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
  };
};

