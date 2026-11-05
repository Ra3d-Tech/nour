import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions,
  Modal,
  I18nManager,
  useColorScheme,
  Animated,
  Easing,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// مدة التقديم والترجيع بالثواني
const SKIP_SECONDS = 10;

// المصدر: سلسلة قصص الأنبياء للشيخ نبيل العوضي على أرشيف الإنترنت
const BASE_URL = 'https://archive.org/download/9asas_almoshta9';

export interface Story {
  id: number;
  title: string;
  url: string;
  file: string;
}

// قائمة الحلقات الـ 31 كاملة
const RAW_STORIES: [string, string][] = [
  ['خلق آدم عليه السلام', '01.mp3'],
  ['آدم عليه السلام', '02.mp3'],
  ['إدريس ونوح عليهما السلام', '03.mp3'],
  ['نوح عليه السلام', '04.mp3'],
  ['هود عليه السلام', '05.mp3'],
  ['صالح عليه السلام', '06.mp3'],
  ['إبراهيم عليه السلام (1)', '07.mp3'],
  ['إبراهيم عليه السلام (2)', '08.mp3'],
  ['إبراهيم وإسماعيل عليهما السلام', '09.mp3'],
  ['لوط عليه السلام', '10.mp3'],
  ['شعيب عليه السلام', '11.mp3'],
  ['يوسف عليه السلام (1)', '12.mp3'],
  ['يوسف عليه السلام وامرأة العزيز', '13.mp3'],
  ['يوسف عليه السلام على خزائن مصر', '14.mp3'],
  ['أيوب عليه السلام', '15.mp3'],
  ['يونس عليه السلام', '16.mp3'],
  ['موسى عليه السلام مع فرعون (1)', '17.mp3'],
  ['موسى عليه السلام مع فرعون (2)', '18.mp3'],
  ['موسى عليه السلام مع فرعون (3)', '19.mp3'],
  ['موسى عليه السلام مع بني إسرائيل', '20.mp3'],
  ['موسى عليه السلام مع الخضر', '21.mp3'],
  ['يوشع بن نون عليه السلام', '22.mp3'],
  ['داود عليه السلام', '23.mp3'],
  ['سليمان عليه السلام مع الهدهد', '24.mp3'],
  ['سليمان عليه السلام وبناء بيت المقدس', '25.mp3'],
  ['العزير عليه السلام', '26.mp3'],
  ['زكريا ويحيى عليهما السلام', '27.mp3'],
  ['مريم عليها السلام', '28.mp3'],
  ['عيسى ابن مريم عليه السلام', '29.mp3'],
  ['خاتم الأنبياء محمد ﷺ', '30.mp3'],
  ['تتمة وعبر من قصص الأنبياء', '31.mp3'],
];

export const PROPHET_STORIES: Story[] = RAW_STORIES.map(([title, file], i) => ({
  id: i + 1,
  title,
  file,
  url: `${BASE_URL}/${file}`,
}));

const normalizeTime = (val: number | undefined | null): number => {
  if (typeof val !== 'number' || isNaN(val) || val < 0) return 0;
  return val > 10000 ? val / 1000 : val;
};

const formatTime = (secs: number) => {
  if (isNaN(secs) || secs < 0) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export function ProphetsScreen({ navigation: propNav }: any) {
  const hookNav = useNavigation<any>();
  const navigation = propNav || hookNav;
  const systemColorScheme = useColorScheme();

  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'downloads'>('all');
  const [selectedStory, setSelectedStory] = useState<Story>(PROPHET_STORIES[0]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFullPlayerVisible, setIsFullPlayerVisible] = useState<boolean>(false);

  // أنيميشن نافذة تأكيد الحذف
  const [deleteCandidate, setDeleteCandidate] = useState<Story | null>(null);
  const deleteModalScale = useRef(new Animated.Value(0.85)).current;
  const deleteModalOpacity = useRef(new Animated.Value(0)).current;

  // أنيميشن المشغل المنزلق بنمط Spotify فائق النعومة
  const slideAnim = useRef(new Animated.Value(height)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // خريطة الملفات المحمّلة ونسبة التقدم
  const [downloadedStories, setDownloadedStories] = useState<{ [id: number]: string }>({});
  const [downloadProgress, setDownloadProgress] = useState<{ [id: number]: number }>({});

  const loadedIdRef = useRef<number | null>(null);
  const loadedStoryRef = useRef<Story | null>(null);
  const loadRequestRef = useRef<number>(0);
  const wantPlayRef = useRef<boolean>(false);
  const seekGuardRef = useRef<number>(0);
  const lastPosRef = useRef<number>(0);
  const failCountRef = useRef<number>(0);
  const notLoadedCountRef = useRef<number>(0);
  const isLoadingRef = useRef<boolean>(false);
  const loadAndPlayRef = useRef<((s: Story, resumeAt?: number) => Promise<void>) | null>(null);

  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const statusRef = useRef(status);
  statusRef.current = status;
  const isPlaying = status?.playing ?? false;
  isLoadingRef.current = isLoading;
  const isRTL = I18nManager.isRTL;

  // فتح المشغل وتجهيز القيم
  const openFullPlayer = () => {
    slideAnim.setValue(height);
    backdropAnim.setValue(0);
    setIsFullPlayerVisible(true);
  };

  // تشغيل حركة الرفع الفائقة النعومة فور جاهزية النافذة (onShow)
  const animateModalOpen = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 420,
        easing: Easing.bezier(0.16, 1, 0.3, 1), // كيرف آبل وسبوتيفاي فائق النعومة
        useNativeDriver: true,
      }),
    ]).start();
  };

  // إغلاق المشغل بنعومة
  const closeFullPlayer = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsFullPlayerVisible(false);
    });
  };

  // فتح وإغلاق نافذة تأكيد الحذف
  const openDeleteModal = (story: Story) => {
    setDeleteCandidate(story);
    deleteModalScale.setValue(0.85);
    deleteModalOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(deleteModalScale, { toValue: 1, friction: 8, tension: 70, useNativeDriver: true }),
      Animated.timing(deleteModalOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const closeDeleteModal = () => {
    Animated.parallel([
      Animated.timing(deleteModalScale, { toValue: 0.85, duration: 150, useNativeDriver: true }),
      Animated.timing(deleteModalOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => setDeleteCandidate(null));
  };

  // إمكانية سحب الشاشة للأسفل للإغلاق بسلاسة
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 10,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          slideAnim.setValue(gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 0.5) {
          closeFullPlayer();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            damping: 24,
            stiffness: 240,
            mass: 0.8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // إخفاء بار النافيجاتور وقراءة الثيم حصرياً من @nour_theme_mode
  useFocusEffect(
    useCallback(() => {
      const parent = navigation.getParent?.();
      if (parent) {
        parent.setOptions({ tabBarStyle: { display: 'none' } });
      }
      navigation?.setOptions?.({ tabBarStyle: { display: 'none' } });

      const readTheme = async () => {
        try {
          const themeMode = await AsyncStorage.getItem('@nour_theme_mode');
          if (themeMode) {
            if (themeMode === 'dark' || themeMode === 'true') {
              setIsDarkMode(true);
              return;
            }
            if (themeMode === 'light' || themeMode === 'false') {
              setIsDarkMode(false);
              return;
            }
            if (themeMode === 'system') {
              setIsDarkMode(systemColorScheme === 'dark');
              return;
            }
            try {
              const parsed = JSON.parse(themeMode);
              if (typeof parsed === 'boolean') {
                setIsDarkMode(parsed);
                return;
              }
            } catch {}
          }

          const settingsJson = await AsyncStorage.getItem('@nour_settings');
          if (settingsJson) {
            const parsed = JSON.parse(settingsJson);
            if (parsed.themeMode) {
              setIsDarkMode(parsed.themeMode === 'dark');
              return;
            }
            if (parsed.isDarkMode !== undefined) {
              setIsDarkMode(Boolean(parsed.isDarkMode));
              return;
            }
            if (parsed.darkMode !== undefined) {
              setIsDarkMode(Boolean(parsed.darkMode));
              return;
            }
          }

          setIsDarkMode(systemColorScheme === 'dark');
        } catch {
          setIsDarkMode(systemColorScheme === 'dark');
        }
      };

      readTheme();

      return () => {
        if (parent) {
          parent.setOptions({ tabBarStyle: undefined });
        }
        navigation?.setOptions?.({ tabBarStyle: undefined });
      };
    }, [navigation, systemColorScheme])
  );

  // ألوان الثيم الديناميكية (فاتح / داكن)
  const theme = useMemo(() => {
    if (isDarkMode) {
      return {
        background: '#080D1A',
        headerBorder: '#131D31',
        cardBg: '#0F172A',
        cardBorder: '#1E293B',
        activeCardBg: '#14203B',
        activeCardBorder: '#E2B143',
        textPrimary: '#F8FAFC',
        textSecondary: '#94A3B8',
        gold: '#E2B143',
        badgeBg: 'rgba(226, 177, 67, 0.12)',
        badgeBorder: 'rgba(226, 177, 67, 0.3)',
        numberCircleBg: '#1E293B',
        numberCircleBorder: '#334155',
        dockBg: '#0F172A',
        dockBorder: 'rgba(226, 177, 67, 0.45)',
        dockProgressBg: 'rgba(255, 255, 255, 0.08)',
        btnBg: '#1E293B',
        btnBorder: '#334155',
        tabTrackBg: '#131D31',
        tabActiveBg: '#E2B143',
        tabActiveText: '#080D1A',
        modalCardBg: '#0F172A',
        danger: '#EF4444',
        dangerSoft: 'rgba(239, 68, 68, 0.15)',
        statusBarStyle: 'light-content' as const,
      };
    } else {
      return {
        background: '#F8F9FA',
        headerBorder: '#E2E8F0',
        cardBg: '#FFFFFF',
        cardBorder: '#E2E8F0',
        activeCardBg: '#FFFDF5',
        activeCardBorder: '#C59B27',
        textPrimary: '#0F172A',
        textSecondary: '#475569',
        gold: '#C59B27',
        badgeBg: 'rgba(197, 155, 39, 0.1)',
        badgeBorder: 'rgba(197, 155, 39, 0.25)',
        numberCircleBg: '#F1F5F9',
        numberCircleBorder: '#CBD5E1',
        dockBg: '#FFFFFF',
        dockBorder: 'rgba(197, 155, 39, 0.35)',
        dockProgressBg: '#E2E8F0',
        btnBg: '#F1F5F9',
        btnBorder: '#E2E8F0',
        tabTrackBg: '#E2E8F0',
        tabActiveBg: '#C59B27',
        tabActiveText: '#FFFFFF',
        modalCardBg: '#FFFFFF',
        danger: '#EF4444',
        dangerSoft: 'rgba(239, 68, 68, 0.1)',
        statusBarStyle: 'dark-content' as const,
      };
    }
  }, [isDarkMode]);

  const handleGoBack = () => {
    if (navigation?.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation?.navigate?.('Home');
    }
  };

  const offlineDir = `${FileSystem.documentDirectory}prophet_stories/`;

  useEffect(() => {
    const scanDownloadedFiles = async () => {
      try {
        const dirInfo = await FileSystem.getInfoAsync(offlineDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(offlineDir, { intermediates: true });
          return;
        }

        const files = await FileSystem.readDirectoryAsync(offlineDir);
        const map: { [id: number]: string } = {};

        for (const filename of files) {
          const story = PROPHET_STORIES.find((s) => s.file === filename);
          if (story) {
            const path = `${offlineDir}${filename}`;
            const info = await FileSystem.getInfoAsync(path);
            if (info.exists && info.size && info.size > 200000) {
              map[story.id] = path;
            }
          }
        }
        setDownloadedStories(map);
      } catch (err) {
        console.warn('Scan offline error:', err);
      }
    };

    scanDownloadedFiles();
  }, []);

  // ✅ تعديل 1: إعدادات الصوت للتشغيل في الخلفية (expo-audio)
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (status?.didJustFinish) {
      wantPlayRef.current = false;
      handleNextTrack();
    }
  }, [status?.didJustFinish]);

  const waitForLoaded = async () => {
    for (let i = 0; i < 150; i++) {
      if (player.isLoaded) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  };

  const loadAndPlay = async (story: Story, resumeAt: number = 0) => {
    const requestId = ++loadRequestRef.current;
    setIsLoading(true);
    try {
      const localUri = downloadedStories[story.id];
      const audioUri = localUri || story.url;

      player.replace({ uri: audioUri });
      loadedIdRef.current = story.id;
      loadedStoryRef.current = story;
      lastPosRef.current = resumeAt;
      wantPlayRef.current = true;
      failCountRef.current = 0;
      notLoadedCountRef.current = 0;

      if (resumeAt > 0) {
        await waitForLoaded();
        if (requestId !== loadRequestRef.current) return;
        player.seekTo(resumeAt);
      }
      player.play();

      // ✅ تعديل 2: تفعيل التحكم على شاشة القفل والخدمة الأمامية (تشغيل مع قفل الهاتف)
      try {
        player.setActiveForLockScreen(true, {
          title: story.title,
          artist: 'الشيخ نبيل العوضي',
        });
      } catch {}
    } catch (e) {
      console.warn('Load story error:', e);
    } finally {
      if (requestId === loadRequestRef.current) setIsLoading(false);
    }
  };
  loadAndPlayRef.current = loadAndPlay;

  useEffect(() => {
    const id = setInterval(() => {
      if (!wantPlayRef.current || isLoadingRef.current) return;
      if (Date.now() < seekGuardRef.current) return;
      const story = loadedStoryRef.current;
      if (!story) return;

      try {
        const pos = normalizeTime(player.currentTime);

        if (player.playing) {
          if (pos > 0) lastPosRef.current = pos;
          failCountRef.current = 0;
          notLoadedCountRef.current = 0;
          return;
        }

        if (statusRef.current?.isBuffering) return;

        const dur = normalizeTime(player.duration);
        if (dur > 60 && Math.max(pos, lastPosRef.current) >= dur - 3) {
          wantPlayRef.current = false;
          return;
        }

        if (failCountRef.current >= 8) {
          wantPlayRef.current = false;
          failCountRef.current = 0;
          notLoadedCountRef.current = 0;
          return;
        }
        failCountRef.current += 1;

        if (player.isLoaded) {
          if (pos > 0) lastPosRef.current = pos;
          notLoadedCountRef.current = 0;
          player.play();
        } else {
          notLoadedCountRef.current += 1;
          if (notLoadedCountRef.current >= 3) {
            notLoadedCountRef.current = 0;
            loadAndPlayRef.current?.(story, lastPosRef.current);
          }
        }
      } catch (e) {
        console.warn('Watchdog error:', e);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [player]);

  const playOrToggle = (story: Story) => {
    if (loadedIdRef.current === story.id) {
      if (player.playing) {
        wantPlayRef.current = false;
        player.pause();
      } else {
        wantPlayRef.current = true;
        failCountRef.current = 0;
        player.play();
      }
    } else {
      loadAndPlay(story);
    }
  };

  const handleCardPress = (story: Story) => {
    setSelectedStory(story);
    playOrToggle(story);
    openFullPlayer();
  };

  const handleNextTrack = () => {
    const currentIndex = PROPHET_STORIES.findIndex((s) => s.id === selectedStory.id);
    const nextIndex = (currentIndex + 1) % PROPHET_STORIES.length;
    const nextStory = PROPHET_STORIES[nextIndex];
    setSelectedStory(nextStory);
    loadAndPlay(nextStory);
  };

  const handlePrevTrack = () => {
    const currentIndex = PROPHET_STORIES.findIndex((s) => s.id === selectedStory.id);
    const prevIndex = (currentIndex - 1 + PROPHET_STORIES.length) % PROPHET_STORIES.length;
    const prevStory = PROPHET_STORIES[prevIndex];
    setSelectedStory(prevStory);
    loadAndPlay(prevStory);
  };

  const seekRelative = (offsetSeconds: number) => {
    try {
      if (loadedIdRef.current !== selectedStory.id || !player.isLoaded) return;
      const now = normalizeTime(player.currentTime);
      const dur = normalizeTime(player.duration);
      const maxPos = dur > 60 ? Math.max(dur - 1, 0) : Number.MAX_SAFE_INTEGER;
      const target = Math.max(0, Math.min(now + offsetSeconds, maxPos));
      seekGuardRef.current = Date.now() + 2500;
      lastPosRef.current = target;
      player.seekTo(target);
      wantPlayRef.current = true;
      if (!player.playing) {
        player.play();
      }
    } catch (e) {
      console.warn('Seek relative error:', e);
    }
  };

  const handleSeekOnBar = (locationX: number, totalWidth: number) => {
    try {
      if (loadedIdRef.current !== selectedStory.id || !player.isLoaded) return;
      const dur = normalizeTime(player.duration);
      if (dur <= 0) return;
      const ratio = Math.max(0, Math.min(locationX / totalWidth, 1));
      const target = Math.floor(ratio * dur);
      seekGuardRef.current = Date.now() + 2500;
      lastPosRef.current = target;
      player.seekTo(target);
      wantPlayRef.current = true;
      if (!player.playing) {
        player.play();
      }
    } catch (e) {
      console.warn('Bar seek error:', e);
    }
  };

  // تنزيل القصة مع متابعة تفاعلية فورية للنسبة المئوية
  const handleDownloadStory = async (story: Story) => {
    if (downloadedStories[story.id]) {
      openDeleteModal(story);
      return;
    }

    if (downloadProgress[story.id] !== undefined) return;

    // إيقاف الصوت فوراً لو شغال
    if (isPlaying) {
      wantPlayRef.current = false;
      player.pause();
    }

    setDownloadProgress((prev) => ({ ...prev, [story.id]: 1 }));

    try {
      const targetPath = `${offlineDir}${story.file}`;

      let finalDownloadUrl = story.url;
      try {
        const headCheck = await fetch(story.url, {
          method: 'HEAD',
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (headCheck.url && headCheck.url.startsWith('http')) {
          finalDownloadUrl = headCheck.url;
        }
      } catch {}

      const downloadResumable = FileSystem.createDownloadResumable(
        finalDownloadUrl,
        targetPath,
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
        (data) => {
          if (data.totalBytesExpectedToWrite > 0) {
            const percentage = Math.max(
              1,
              Math.min(99, Math.floor((data.totalBytesWritten / data.totalBytesExpectedToWrite) * 100))
            );
            setDownloadProgress((prev) => ({ ...prev, [story.id]: percentage }));
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result && result.uri) {
        setDownloadedStories((prev) => ({
          ...prev,
          [story.id]: result.uri,
        }));
      }
    } catch {
      try {
        const fallbackTarget = `${offlineDir}${story.file}`;
        const fallbackRes = await FileSystem.downloadAsync(story.url, fallbackTarget, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (fallbackRes.status === 200) {
          setDownloadedStories((prev) => ({
            ...prev,
            [story.id]: fallbackRes.uri,
          }));
        }
      } catch (fallbackErr) {
        console.warn('Fallback download error:', fallbackErr);
      }
    } finally {
      setDownloadProgress((prev) => {
        const updated = { ...prev };
        delete updated[story.id];
        return updated;
      });
    }
  };

  // تأكيد حذف القصة
  const confirmDeleteStory = async () => {
    if (!deleteCandidate) return;
    const story = deleteCandidate;
    closeDeleteModal();

    const localUri = downloadedStories[story.id];
    if (localUri) {
      try {
        await FileSystem.deleteAsync(localUri, { idempotent: true });
        setDownloadedStories((prev) => {
          const updated = { ...prev };
          delete updated[story.id];
          return updated;
        });

        if (loadedIdRef.current === story.id) {
          loadAndPlay(story, normalizeTime(player.currentTime));
        }
      } catch (e) {
        console.warn('Delete error:', e);
      }
    }
  };

  // القصص المعروضة حسب التبويب
  const displayedStories = useMemo(() => {
    if (activeTab === 'downloads') {
      return PROPHET_STORIES.filter((s) => Boolean(downloadedStories[s.id]));
    }
    return PROPHET_STORIES;
  }, [activeTab, downloadedStories]);

  const dockIsPlaying = isPlaying && loadedIdRef.current === selectedStory.id;
  const showSpinner =
    isLoading || (loadedIdRef.current === selectedStory.id && !!status?.isBuffering && !isPlaying);

  const curSeconds = normalizeTime(player.currentTime);
  const durSeconds = normalizeTime(player.duration);
  const progressPercent = durSeconds > 0 ? Math.min((curSeconds / durSeconds) * 100, 100) : 0;
  const isCurrentStoryDownloaded = !!downloadedStories[selectedStory.id];

  // متابعة تنزيل القصة المفتوحة في مشغل سبوتيفاي
  const currentModalDownloadPercent = downloadProgress[selectedStory.id];
  const isCurrentModalDownloading = currentModalDownloadPercent !== undefined;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.background} />

      {/* الرأس الفخم */}
      <View style={[styles.header, { borderBottomColor: theme.headerBorder }]}>
        <TouchableOpacity
          onPress={handleGoBack}
          style={[styles.backBtn, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
          activeOpacity={0.7}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={theme.gold} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={[styles.headerBadge, { backgroundColor: theme.badgeBg, borderColor: theme.badgeBorder }]}>
            <Ionicons name="book-outline" size={13} color={theme.gold} />
            <Text style={[styles.headerBadgeText, { color: theme.gold }]}>سلسلة مباركة</Text>
          </View>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>قصص الأنبياء</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>بصوت الشيخ نبيل العوضي</Text>
        </View>

        <View style={{ width: 42 }} />
      </View>

      {/* تبويبات التصفح الفخمة */}
      <View style={styles.tabBarWrapper}>
        <View style={[styles.tabBarTrack, { backgroundColor: theme.tabTrackBg }]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'all' && [styles.tabBtnActive, { backgroundColor: theme.tabActiveBg }]]}
            onPress={() => setActiveTab('all')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === 'all' ? theme.tabActiveText : theme.textSecondary },
              ]}
            >
              جميع القصص ({PROPHET_STORIES.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'downloads' && [styles.tabBtnActive, { backgroundColor: theme.tabActiveBg }]]}
            onPress={() => setActiveTab('downloads')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="download-outline"
              size={15}
              color={activeTab === 'downloads' ? theme.tabActiveText : theme.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabBtnText,
                { color: activeTab === 'downloads' ? theme.tabActiveText : theme.textSecondary },
              ]}
            >
              التنزيلات ({Object.keys(downloadedStories).length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* قائمة القصص */}
      <FlatList
        data={displayedStories}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        extraData={[selectedStory.id, isPlaying, isLoading, downloadedStories, downloadProgress, isDarkMode, activeTab]}
        ListEmptyComponent={
          activeTab === 'downloads' ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.badgeBg }]}>
                <Ionicons name="cloud-download-outline" size={42} color={theme.gold} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>لا توجد تنزيلات حتى الآن</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                اضغط على زر التنزيل عند أي قصة لحفظها والاستماع إليها في أي وقت
              </Text>
              <TouchableOpacity
                style={[styles.emptyActionBtn, { backgroundColor: theme.gold }]}
                onPress={() => setActiveTab('all')}
              >
                <Text style={[styles.emptyActionText, { color: isDarkMode ? '#080D1A' : '#FFFFFF' }]}>
                  تصفح جميع القصص
                </Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isSelected = item.id === selectedStory.id;
          const showPause = isSelected && isPlaying && loadedIdRef.current === item.id;
          const isDownloaded = !!downloadedStories[item.id];
          const progress = downloadProgress[item.id];
          const isDownloading = progress !== undefined;

          return (
            <TouchableOpacity
              style={[
                styles.storyCard,
                { backgroundColor: theme.cardBg, borderColor: theme.cardBorder },
                isSelected && { backgroundColor: theme.activeCardBg, borderColor: theme.activeCardBorder },
              ]}
              onPress={() => handleCardPress(item)}
              activeOpacity={0.75}
            >
              <View style={styles.cardRightSection}>
                <View
                  style={[
                    styles.numberCircle,
                    { backgroundColor: theme.numberCircleBg, borderColor: theme.numberCircleBorder },
                    isSelected && { backgroundColor: theme.gold, borderColor: theme.gold },
                  ]}
                >
                  <Text
                    style={[
                      styles.numberCircleText,
                      { color: theme.textSecondary },
                      isSelected && { color: isDarkMode ? '#080D1A' : '#FFFFFF' },
                    ]}
                  >
                    {item.id}
                  </Text>
                </View>
                <View style={styles.titleInfo}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[
                        styles.storyTitle,
                        { color: theme.textPrimary },
                        isSelected && { color: theme.gold, fontWeight: 'bold' },
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>

                    {/* علامة صح خضراء ناعمة وبسيطة بدون أي نص */}
                    {isDownloaded && (
                      <View style={styles.savedCheckBadge}>
                        <Ionicons name="checkmark-circle" size={15} color="#10B981" />
                      </View>
                    )}
                  </View>

                  <View style={styles.durationRow}>
                    <Ionicons name="mic-outline" size={13} color={isSelected ? theme.gold : theme.textSecondary} />
                    <Text style={[styles.durationText, { color: theme.textSecondary }]}>
                      الشيخ نبيل العوضي
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardActionsRow}>
                {/* زر التنزيل / الحذف */}
                <TouchableOpacity
                  onPress={() => handleDownloadStory(item)}
                  style={[
                    styles.downloadBtn,
                    { backgroundColor: theme.btnBg, borderColor: theme.btnBorder },
                    isDownloaded && styles.downloadBtnActive,
                  ]}
                  activeOpacity={0.8}
                >
                  {isDownloading ? (
                    <View style={styles.downloadProgressWrap}>
                      <ActivityIndicator size="small" color={theme.gold} />
                      <Text style={[styles.downloadPercentText, { color: theme.gold }]}>{progress}%</Text>
                    </View>
                  ) : isDownloaded ? (
                    <Ionicons name="trash-outline" size={20} color={theme.danger} />
                  ) : (
                    <Ionicons name="cloud-download-outline" size={20} color={theme.gold} />
                  )}
                </TouchableOpacity>

                {/* زر التشغيل */}
                <View
                  style={[
                    styles.actionPlayIcon,
                    { backgroundColor: theme.badgeBg, borderColor: theme.badgeBorder },
                    isSelected && { backgroundColor: theme.gold, borderColor: theme.gold },
                  ]}
                >
                  <Ionicons
                    name={showPause ? 'pause' : 'play'}
                    size={18}
                    color={isSelected ? (isDarkMode ? '#080D1A' : '#FFFFFF') : theme.gold}
                  />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* بار المشغل السفلي الصغير */}
      <TouchableOpacity
        style={[styles.dock, { backgroundColor: theme.dockBg, borderColor: theme.dockBorder }]}
        activeOpacity={0.92}
        onPress={openFullPlayer}
      >
        <View style={[styles.dockProgressLineBg, { backgroundColor: theme.dockProgressBg }]}>
          <View style={[styles.dockProgressLineFill, { width: `${progressPercent}%`, backgroundColor: theme.gold }]} />
        </View>

        <View style={styles.dockContentRow}>
          <View style={styles.dockInfo}>
            <View style={[styles.dot, { backgroundColor: theme.gold }]} />
            <View style={styles.dockTextWrap}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                <Text style={[styles.dockTitle, { color: theme.textPrimary }]} numberOfLines={1}>
                  {selectedStory.title}
                </Text>
                {isCurrentStoryDownloaded && (
                  <View style={styles.miniCheckIconWrap}>
                    <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                  </View>
                )}
              </View>
              <Text style={[styles.dockSubTitle, { color: theme.textSecondary }]}>
                {formatTime(curSeconds)} / {formatTime(durSeconds)}
              </Text>
            </View>
          </View>

          {/* أزرار المشغل الصغير */}
          <View style={styles.dockControls}>
            {isRTL ? (
              <>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    seekRelative(SKIP_SECONDS);
                  }}
                  style={[styles.circleSecondaryBtn, { backgroundColor: theme.badgeBg, borderColor: theme.badgeBorder }]}
                >
                  <Ionicons name="refresh-outline" size={18} color={theme.gold} style={{ transform: [{ scaleX: -1 }] }} />
                  <Text style={[styles.btnSubText, { color: theme.gold }]}>{SKIP_SECONDS}+</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    playOrToggle(selectedStory);
                  }}
                  style={[styles.goldPlayBtn, { backgroundColor: theme.gold }]}
                >
                  {showSpinner ? (
                    <ActivityIndicator color={isDarkMode ? '#080D1A' : '#FFFFFF'} />
                  ) : (
                    <Ionicons name={dockIsPlaying ? 'pause' : 'play'} size={24} color={isDarkMode ? '#080D1A' : '#FFFFFF'} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    seekRelative(-SKIP_SECONDS);
                  }}
                  style={[styles.circleSecondaryBtn, { backgroundColor: theme.badgeBg, borderColor: theme.badgeBorder }]}
                >
                  <Ionicons name="refresh-outline" size={18} color={theme.gold} />
                  <Text style={[styles.btnSubText, { color: theme.gold }]}>{SKIP_SECONDS}-</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    seekRelative(-SKIP_SECONDS);
                  }}
                  style={[styles.circleSecondaryBtn, { backgroundColor: theme.badgeBg, borderColor: theme.badgeBorder }]}
                >
                  <Ionicons name="refresh-outline" size={18} color={theme.gold} />
                  <Text style={[styles.btnSubText, { color: theme.gold }]}>{SKIP_SECONDS}-</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    playOrToggle(selectedStory);
                  }}
                  style={[styles.goldPlayBtn, { backgroundColor: theme.gold }]}
                >
                  {showSpinner ? (
                    <ActivityIndicator color={isDarkMode ? '#080D1A' : '#FFFFFF'} />
                  ) : (
                    <Ionicons name={dockIsPlaying ? 'pause' : 'play'} size={24} color={isDarkMode ? '#080D1A' : '#FFFFFF'} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    seekRelative(SKIP_SECONDS);
                  }}
                  style={[styles.circleSecondaryBtn, { backgroundColor: theme.badgeBg, borderColor: theme.badgeBorder }]}
                >
                  <Ionicons name="refresh-outline" size={18} color={theme.gold} style={{ transform: [{ scaleX: -1 }] }} />
                  <Text style={[styles.btnSubText, { color: theme.gold }]}>{SKIP_SECONDS}+</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* مشغل ملء الشاشة Spotify بأنيميشن انسيابي فائق النعومة */}
      <Modal
        visible={isFullPlayerVisible}
        transparent
        animationType="none"
        onShow={animateModalOpen}
        onRequestClose={closeFullPlayer}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalBackdrop,
              {
                opacity: backdropAnim,
                backgroundColor: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
              },
            ]}
          />

          <Animated.View
            renderToHardwareTextureAndroid={true}
            shouldRasterizeIOS={true}
            style={[
              styles.animatedSheetContainer,
              {
                backgroundColor: isDarkMode ? '#0A0F1D' : '#F8FAFC',
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <SafeAreaView style={styles.fullModalInner}>
              <StatusBar barStyle={theme.statusBarStyle} backgroundColor={isDarkMode ? '#0A0F1D' : '#F8FAFC'} />

              {/* مقبض السحب */}
              <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
                <View style={[styles.dragPill, { backgroundColor: isDarkMode ? '#334155' : '#CBD5E1' }]} />
              </View>

              {/* هيدر المودال التفاعلي مع زر التنزيل المباشر */}
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeFullPlayer} style={styles.modalCloseBtn}>
                  <Ionicons name="chevron-down" size={30} color={theme.textPrimary} />
                </TouchableOpacity>

                <View style={styles.modalHeaderCenter}>
                  <Text style={styles.modalNowPlayingText}>جاري الاستماع الآن</Text>
                  <Text style={[styles.modalSeriesText, { color: theme.textPrimary }]}>قصص الأنبياء</Text>
                </View>

                {/* زر التنزيل التفاعلي في الهيدر مع العداد */}
                <TouchableOpacity
                  onPress={() => handleDownloadStory(selectedStory)}
                  style={[
                    styles.modalDownloadInteractiveBtn,
                    isCurrentModalDownloading && { backgroundColor: theme.badgeBg, borderColor: theme.badgeBorder },
                  ]}
                  activeOpacity={0.8}
                >
                  {isCurrentModalDownloading ? (
                    <View style={styles.modalHeaderDownloadBadge}>
                      <ActivityIndicator size="small" color={theme.gold} />
                      <Text style={[styles.modalHeaderPercent, { color: theme.gold }]}>
                        {currentModalDownloadPercent}%
                      </Text>
                    </View>
                  ) : isCurrentStoryDownloaded ? (
                    <Ionicons name="checkmark-circle" size={26} color="#10B981" />
                  ) : (
                    <Ionicons name="cloud-download-outline" size={26} color={theme.gold} />
                  )}
                </TouchableOpacity>
              </View>

              {/* كارت البوستر */}
              <View style={styles.albumArtContainer}>
                <View
                  style={[
                    styles.albumArtCard,
                    { backgroundColor: isDarkMode ? '#111827' : '#FFFFFF', borderColor: theme.badgeBorder },
                  ]}
                >
                  <Ionicons name="moon" size={72} color={theme.gold} />
                  <Text style={[styles.albumArtLogo, { color: theme.gold }]}>نُور</Text>
                  <Text style={[styles.albumArtSub, { color: theme.textSecondary }]}>قصص الأنبياء عليهم السلام</Text>
                  {isCurrentStoryDownloaded && !isCurrentModalDownloading && (
                    <View style={styles.albumCheckTag}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                    </View>
                  )}
                </View>
              </View>

              {/* شريط التحميل التفاعلي الأنيق عند التنزيل داخل سبوتيفاي */}
              {isCurrentModalDownloading && (
                <View style={styles.modalDownloadCardWrap}>
                  <View style={[styles.modalDownloadCard, { backgroundColor: theme.cardBg, borderColor: theme.badgeBorder }]}>
                    <View style={styles.modalDownloadCardTop}>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                        <ActivityIndicator size="small" color={theme.gold} />
                        <Text style={[styles.modalDownloadCardTitle, { color: theme.gold }]}>
                          جاري حفظ القصة...
                        </Text>
                      </View>
                      <Text style={[styles.modalDownloadCardPercent, { color: theme.gold }]}>
                        {currentModalDownloadPercent}%
                      </Text>
                    </View>
                    <View style={[styles.modalDownloadProgressBarBg, { backgroundColor: theme.tabTrackBg }]}>
                      <View
                        style={[
                          styles.modalDownloadProgressBarFill,
                          { width: `${currentModalDownloadPercent}%`, backgroundColor: theme.gold },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* معلومات القصة والشيخ */}
              <View style={styles.modalTitleBlock}>
                <Text style={[styles.modalStoryTitle, { color: theme.textPrimary }]}>{selectedStory.title}</Text>
                <Text style={[styles.modalSpeakerName, { color: theme.gold }]}>فضيلة الشيخ نبيل العوضي</Text>
              </View>

              {/* التايم لاين الكبير */}
              <View style={styles.modalTimelineWrapper}>
                <TouchableOpacity
                  style={[styles.modalProgressTrack, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}
                  activeOpacity={0.9}
                  onPress={(e) => handleSeekOnBar(e.nativeEvent.locationX, width - 48)}
                >
                  <View style={[styles.modalProgressFilled, { width: `${progressPercent}%`, backgroundColor: theme.gold }]}>
                    <View style={[styles.modalScrubberThumb, { borderColor: theme.gold }]} />
                  </View>
                </TouchableOpacity>

                <View style={styles.modalTimeRow}>
                  <Text style={[styles.modalTimeText, { color: theme.textSecondary }]}>{formatTime(curSeconds)}</Text>
                  <Text style={[styles.modalTimeText, { color: theme.textSecondary }]}>{formatTime(durSeconds)}</Text>
                </View>
              </View>

              {/* أزرار التحكم */}
              <View style={styles.modalControlsRow}>
                {isRTL ? (
                  <>
                    <TouchableOpacity
                      onPress={() => seekRelative(SKIP_SECONDS)}
                      style={[styles.modalSecBtn, { backgroundColor: theme.badgeBg }]}
                    >
                      <Ionicons name="refresh-outline" size={24} color={theme.gold} style={{ transform: [{ scaleX: -1 }] }} />
                      <Text style={[styles.modalSecBtnText, { color: theme.gold }]}>{SKIP_SECONDS}+</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleNextTrack} style={styles.modalNavBtn}>
                      <Ionicons name="play-skip-forward" size={30} color={theme.textPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => playOrToggle(selectedStory)}
                      style={[styles.modalMainPlayBtn, { backgroundColor: theme.gold }]}
                    >
                      {showSpinner ? (
                        <ActivityIndicator size="large" color={isDarkMode ? '#080D1A' : '#FFFFFF'} />
                      ) : (
                        <Ionicons name={dockIsPlaying ? 'pause' : 'play'} size={36} color={isDarkMode ? '#080D1A' : '#FFFFFF'} />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handlePrevTrack} style={styles.modalNavBtn}>
                      <Ionicons name="play-skip-back" size={30} color={theme.textPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => seekRelative(-SKIP_SECONDS)}
                      style={[styles.modalSecBtn, { backgroundColor: theme.badgeBg }]}
                    >
                      <Ionicons name="refresh-outline" size={24} color={theme.gold} />
                      <Text style={[styles.modalSecBtnText, { color: theme.gold }]}>{SKIP_SECONDS}-</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => seekRelative(-SKIP_SECONDS)}
                      style={[styles.modalSecBtn, { backgroundColor: theme.badgeBg }]}
                    >
                      <Ionicons name="refresh-outline" size={24} color={theme.gold} />
                      <Text style={[styles.modalSecBtnText, { color: theme.gold }]}>{SKIP_SECONDS}-</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handlePrevTrack} style={styles.modalNavBtn}>
                      <Ionicons name="play-skip-back" size={30} color={theme.textPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => playOrToggle(selectedStory)}
                      style={[styles.modalMainPlayBtn, { backgroundColor: theme.gold }]}
                    >
                      {showSpinner ? (
                        <ActivityIndicator size="large" color={isDarkMode ? '#080D1A' : '#FFFFFF'} />
                      ) : (
                        <Ionicons name={dockIsPlaying ? 'pause' : 'play'} size={36} color={isDarkMode ? '#080D1A' : '#FFFFFF'} />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleNextTrack} style={styles.modalNavBtn}>
                      <Ionicons name="play-skip-forward" size={30} color={theme.textPrimary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => seekRelative(SKIP_SECONDS)}
                      style={[styles.modalSecBtn, { backgroundColor: theme.badgeBg }]}
                    >
                      <Ionicons name="refresh-outline" size={24} color={theme.gold} style={{ transform: [{ scaleX: -1 }] }} />
                      <Text style={[styles.modalSecBtnText, { color: theme.gold }]}>{SKIP_SECONDS}+</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>

      {/* نافذة تأكيد الحذف الخاصة الفخمة بأنيميشن */}
      <Modal
        visible={Boolean(deleteCandidate)}
        transparent
        animationType="none"
        onRequestClose={closeDeleteModal}
      >
        <View style={styles.deleteOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={closeDeleteModal}
          />
          <Animated.View
            style={[
              styles.deleteDialogCard,
              {
                backgroundColor: theme.modalCardBg,
                borderColor: theme.cardBorder,
                opacity: deleteModalOpacity,
                transform: [{ scale: deleteModalScale }],
              },
            ]}
          >
            <View style={[styles.deleteIconCircle, { backgroundColor: theme.dangerSoft }]}>
              <Ionicons name="trash" size={28} color={theme.danger} />
            </View>

            <Text style={[styles.deleteDialogTitle, { color: theme.textPrimary }]}>إزالة من التنزيلات؟</Text>
            <Text style={[styles.deleteDialogSub, { color: theme.textSecondary }]}>
              هل تود حذف قصة "{deleteCandidate?.title}" من التنزيلات؟ ستظل متاحة للاستماع عبر الإنترنت في أي وقت.
            </Text>

            <View style={styles.deleteDialogButtonsRow}>
              <TouchableOpacity
                onPress={closeDeleteModal}
                style={[styles.deleteDialogCancelBtn, { backgroundColor: theme.btnBg, borderColor: theme.btnBorder }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.deleteDialogCancelText, { color: theme.textPrimary }]}>إلغاء</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmDeleteStory}
                style={[styles.deleteDialogConfirmBtn, { backgroundColor: theme.danger }]}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteDialogConfirmText}>نعم، احذف</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// التصديرات لـ React Navigation
export const Prophets = ProphetsScreen;
export default ProphetsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 16,
    marginBottom: 4,
    borderWidth: 1,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  tabBarWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tabBarTrack: {
    flexDirection: 'row-reverse',
    borderRadius: 14,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 130,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyActionBtn: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 22,
  },
  emptyActionText: {
    fontWeight: 'bold',
    fontSize: 13,
  },
  storyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardRightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  numberCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    borderWidth: 1,
  },
  numberCircleText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  titleInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  storyTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  savedCheckBadge: {
    marginLeft: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    justifyContent: 'flex-end',
  },
  durationText: {
    fontSize: 12,
    marginRight: 5,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  downloadBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  downloadBtnActive: {
    borderColor: 'rgba(239, 68, 68, 0.4)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  downloadProgressWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadPercentText: {
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 1,
  },
  actionPlayIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dock: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: Platform.OS === 'ios' ? 24 : 16,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  dockProgressLineBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  dockProgressLineFill: {
    height: '100%',
  },
  dockContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  dockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  dockTextWrap: {
    flex: 1,
  },
  dockTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  miniCheckIconWrap: {
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockSubTitle: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 2,
  },
  dockControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  circleSecondaryBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnSubText: {
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: -2,
  },
  goldPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  // =================== مشغل Spotify المخصص ===================
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  animatedSheetContainer: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  fullModalInner: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  dragHandleArea: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragPill: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 2,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderCenter: {
    alignItems: 'center',
  },
  modalNowPlayingText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  modalSeriesText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  modalDownloadInteractiveBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modalHeaderDownloadBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderPercent: {
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 2,
  },
  albumArtContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  albumArtCard: {
    width: width * 0.72,
    height: width * 0.72,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  albumArtLogo: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 10,
  },
  albumArtSub: {
    fontSize: 13,
    marginTop: 4,
  },
  albumCheckTag: {
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // كارت التقدم التفاعلي داخل مشغل سبوتيفاي
  modalDownloadCardWrap: {
    paddingHorizontal: 24,
    marginTop: 6,
    marginBottom: 2,
  },
  modalDownloadCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalDownloadCardTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalDownloadCardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalDownloadCardPercent: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalDownloadProgressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  modalDownloadProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  modalTitleBlock: {
    paddingHorizontal: 28,
    alignItems: 'center',
    marginTop: 6,
  },
  modalStoryTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSpeakerName: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalTimelineWrapper: {
    paddingHorizontal: 24,
    marginTop: 8,
  },
  modalProgressTrack: {
    height: 8,
    borderRadius: 4,
    justifyContent: 'center',
  },
  modalProgressFilled: {
    height: '100%',
    borderRadius: 4,
    position: 'relative',
  },
  modalScrubberThumb: {
    position: 'absolute',
    right: -6,
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  modalTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalTimeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  modalSecBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  modalSecBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: -2,
  },
  modalNavBtn: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMainPlayBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  // =================== نافذة تأكيد الحذف ===================
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  deleteDialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  deleteIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteDialogTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  deleteDialogSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 22,
  },
  deleteDialogButtonsRow: {
    flexDirection: 'row-reverse',
    width: '100%',
    gap: 10,
  },
  deleteDialogCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  deleteDialogCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  deleteDialogConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteDialogConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});