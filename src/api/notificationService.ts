import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coordinates, CalculationMethod, PrayerTimes } from 'adhan';
import { Platform } from 'react-native';
// عدّل المسار حسب مكان الملف التاني عندك
import { MOAZZIN_LIST, SELECTED_MOAZZIN_KEY } from './athanAudioService';

// المفاتيح = نفس id في MOAZZIN_LIST، والقيم = أسماء ملفات الصوت (إنجليزي صغير) المسجلة في app.json
// ملحوظة iOS: صوت الإشعار لازم يكون أقل من 30 ثانية، وإلا iOS بيستبدله بالصوت الافتراضي.
// لو ملفاتك أطول، اعمل نسخ قصيرة منها وسجلها هنا وفي app.json.
export const SOUND_FILES: Record<string, string> = {
  hossam: 'hossam.mp3',
  ali_mulla: 'makkah.mp3',
  abdelbasset: 'abdulbasit.mp3',
  alafasy: 'mishary.mp3',
  alaqsa: 'aqsa.mp3',
};

export const channelIdFor = (id: string) => `azan-${id}`;

// كل إشعارات الأذان identifier بتبدأ بالبادئة دي، فنقدر نمسحها من غير ما نلمس باقي إشعارات التطبيق
const ATHAN_PREFIX = 'athan-';
const DAYS_AHEAD = 6; // 6 أيام × 5 صلوات = 30 إشعار (iOS حده 64)

// يخلي الإشعار يظهر ويشغل صوت حتى لو التطبيق مفتوح
// استدعيها مرة واحدة عند بداية التطبيق (أو سيبها كده، بتتنفذ عند أول import)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const setupAthanChannel = async (moazzin: { id: string; name: string }) => {
  if (Platform.OS !== 'android') return;

  const currentId = channelIdFor(moazzin.id);

  // امسح القناة القديمة + قنوات باقي المؤذنين بالاسم
  // (من غير getNotificationChannelsAsync لأنها بتنهار على بعض الأجهزة)
  const idsToDelete = ['azan-channel', ...Object.keys(SOUND_FILES).map(channelIdFor)].filter(
    (id) => id !== currentId
  );

  for (const id of idsToDelete) {
    try {
      await Notifications.deleteNotificationChannelAsync(id);
    } catch {}
  }

  const name = `أذان - ${moazzin.name}`;
  const importance = Notifications.AndroidImportance.MAX;
  const sound = SOUND_FILES[moazzin.id] ?? SOUND_FILES.hossam;

  // نجرب من الأكمل للأبسط، عشان لو خاصية واحدة بتعمل crash على الجهاز ما يوقفش كل حاجة
  const attempts: Notifications.NotificationChannelInput[] = [
    {
      name,
      importance,
      sound,
      vibrationPattern: [0, 500, 250, 500],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    },
    { name, importance, sound, vibrationPattern: [0, 500, 250, 500] },
    { name, importance, sound },
    { name, importance },
  ];

  for (const cfg of attempts) {
    try {
      await Notifications.setNotificationChannelAsync(currentId, cfg);
      return true;
    } catch (e) {
      console.log('Channel attempt failed, trying simpler config:', e);
    }
  }
  return false;
};

const PRAYERS = [
  ['fajr', 'الفجر'],
  ['dhuhr', 'الظهر'],
  ['asr', 'العصر'],
  ['maghrib', 'المغرب'],
  ['isha', 'العشاء'],
] as const;

// يمسح إشعارات الأذان بس
const cancelAthanNotifications = async () => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(ATHAN_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
};

export const scheduleAthan = async (moazzin: { id: string; name: string }) => {
  let perm = await Notifications.getPermissionsAsync();
  if (perm.status !== 'granted') {
    perm = await Notifications.requestPermissionsAsync();
  }
  if (perm.status !== 'granted') return false;

  await setupAthanChannel(moazzin);
  await cancelAthanNotifications();

  // الموقع (مع قيمة احتياطية: الإسكندرية)
  let lat = 31.2001;
  let lng = 29.9187;
  try {
    const loc = await Location.requestForegroundPermissionsAsync();
    if (loc.status === 'granted') {
      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({}));
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    }
  } catch {}

  const coords = new Coordinates(lat, lng);
  const params = CalculationMethod.Egyptian();
  const now = new Date();
  const sound = SOUND_FILES[moazzin.id] ?? SOUND_FILES.hossam;

  for (let d = 0; d < DAYS_AHEAD; d++) {
    const day = new Date();
    day.setDate(now.getDate() + d);
    const times = new PrayerTimes(coords, day, params);

    for (const [key, label] of PRAYERS) {
      const when = times[key] as Date;
      if (when <= now) continue;

      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `${ATHAN_PREFIX}${d}-${key}`,
          content: {
            title: `حان الآن موعد صلاة ${label} 🕌`,
            body: moazzin.name,
            sound, // iOS
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: when,
            channelId: channelIdFor(moazzin.id),
          },
        });
      } catch (e) {
        console.log(`Failed to schedule ${key} on day ${d}:`, e);
      }
    }
  }
  return true;
};

// استدعيها كل ما التطبيق يفتح أو يرجع للـ foreground
// عشان الجدولة تتجدد دايمًا ومتخلصش بعد 6 أيام
export const refreshAthanSchedule = async () => {
  try {
    const savedId = (await AsyncStorage.getItem(SELECTED_MOAZZIN_KEY)) || 'hossam';
    const moazzin = MOAZZIN_LIST.find((m) => m.id === savedId) ?? MOAZZIN_LIST[0];
    return await scheduleAthan(moazzin);
  } catch (e) {
    console.log('refreshAthanSchedule failed:', e);
    return false;
  }
};