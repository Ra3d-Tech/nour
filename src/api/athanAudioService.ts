import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

// الملفات الصوتية المحلية المباشرة
export const LOCAL_ATHAN_FILES: { [key: string]: any } = {
  hossam: require('../../assets/audio/hossam.mp3'),
  ali_mulla: require('../../assets/audio/makkah.mp3'),
  abdelbasset: require('../../assets/audio/abdulbasit.mp3'),
  alafasy: require('../../assets/audio/mishary.mp3'),
  alaqsa: require('../../assets/audio/aqsa.mp3'),
  fajr: require('../../assets/audio/durar.mp3'),
};

export const MOAZZIN_LIST = [
  {
    id: 'hossam',
    name: 'أذان الشيخ حسام الدين عبادي',
    sheikh: 'حسام الدين عبادي',
    location: 'الجزائر 🇩🇿',
  },
  {
    id: 'ali_mulla',
    name: 'أذان الحرم المكي الشريف',
    sheikh: 'الشيخ علي ملا',
    location: 'مكة المكرمة 🕋',
  },
  {
    id: 'abdelbasset',
    name: 'أذان جمهورية مصر العربية',
    sheikh: 'الشيخ عبد الباسط عبد الصمد',
    location: 'القاهرة 🇪🇬',
  },
  {
    id: 'alafasy',
    name: 'أذان الشيخ مشاري العفاسي',
    sheikh: 'مشاري بن راشد العفاسي',
    location: 'الكويت 🇰🇼',
  },
  {
    id: 'alaqsa',
    name: 'أذان المسجد الأقصى المبارك',
    sheikh: 'مؤذنو القدس الشريف',
    location: 'فلسطين 🇵🇸',
  },
];

export const SELECTED_MOAZZIN_KEY = '@nour_selected_moazzin';

let currentAudioPlayer: AudioPlayer | null = null;
let isAudioPlaying = false;

// تشغيل الأذان: لو تم تمرير شيخ معين يشغله، لو ما مررش يقرا الشيخ اللي المستخدم حفظه في الإعدادات
// بترجع true لو التشغيل بدأ فعلًا، و false لو فشل
export const playAthanSound = async (
  moazzinId?: string,
  onStatusUpdate?: (isPlaying: boolean) => void
): Promise<boolean> => {
  try {
    let targetId = moazzinId;

    if (!targetId) {
      const saved = await AsyncStorage.getItem(SELECTED_MOAZZIN_KEY);
      targetId = saved || 'hossam';
    }

    const soundAsset = LOCAL_ATHAN_FILES[targetId] || LOCAL_ATHAN_FILES['hossam'];

    await stopAthanSound();

    // يخلي الصوت يشتغل حتى لو الهاتف على صامت (iOS) أو التطبيق في الخلفية
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    });

    const player = createAudioPlayer(soundAsset);
    currentAudioPlayer = player;

    // لما الأذان يخلص، حدّث الحالة وحرر الـ player
    player.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        isAudioPlaying = false;
        onStatusUpdate?.(false);
        try {
          player.remove();
        } catch {}
        if (currentAudioPlayer === player) currentAudioPlayer = null;
      }
    });

    player.play();
    isAudioPlaying = true;
    onStatusUpdate?.(true);
    return true;
  } catch (e) {
    console.log('Athan playback failed:', e);
    isAudioPlaying = false;
    onStatusUpdate?.(false);
    return false;
  }
};

// إيقاف الأذان
export const stopAthanSound = async () => {
  try {
    if (currentAudioPlayer) {
      currentAudioPlayer.pause();
      currentAudioPlayer.remove();
    }
  } catch {}
  currentAudioPlayer = null;
  isAudioPlaying = false;
};

export const isAthanPlaying = () => isAudioPlaying;