import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  StatusBar,
  Animated,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

// Context
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { AppContextProvider } from './src/context/AppContext';

// Screens
import { HomeScreen } from './src/screens/HomeScreen';
import { QuranScreen } from './src/screens/QuranScreen';
import { QiblaScreen } from './src/screens/QiblaScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { PrayerTimesScreen } from './src/screens/PrayerTimesScreen';
import { DuaaAzkarScreen } from './src/screens/DuaaAzkarScreen';
import { ProphetsScreen } from './src/screens/ProphetsScreen';
import { TafseerScreen } from './src/screens/TafseerScreen';
import { HadithScreen } from './src/screens/HadithScreen';
import { LearnScreen } from './src/screens/LearnScreen';
import { TasbihScreen } from './src/screens/TasbihScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// =====================================================================
// شاشة البداية (Splash Screen): خلفية خضراء غامقة + لوجو دائري + 3.5 ثوانٍ
// =====================================================================
const CustomSplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 30,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]).start();
    });

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(onFinish);
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={splashStyles.container}>
      <StatusBar barStyle="light-content" />
      <Animated.View
        style={[
          splashStyles.logoCard,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('./assets/icon.jpeg')}
          style={splashStyles.icon}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
};

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#064E3B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCard: {
    width: 140,
    height: 140,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#064E3B',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  icon: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
});

// =====================================================================
// الزر الأوسط الدائري البارز (ديناميكي مع اللايت مود والدارك مود)
// =====================================================================
const CustomQuranTabBarButton = ({ children, onPress, isDarkMode, theme }: any) => (
  <TouchableOpacity
    style={styles.customQuranBtnContainer}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View
      style={[
        styles.customQuranBtn,
        {
          backgroundColor: isDarkMode ? '#121212' : '#FFFFFF',
          borderColor: theme?.gold || '#D4AF37',
          shadowColor: isDarkMode ? '#000' : '#888',
        },
      ]}
    >
      {children}
    </View>
  </TouchableOpacity>
);

// =====================================================================
// البار السفلي العائم (أبيض في اللايت مود - أسود في الدارك مود)
// أسماء الشاشات هنا لازم تطابق اللي بتنادي عليه HomeScreen:
// Home, Qibla, Quran, Prophets, DuaaAzkar
// =====================================================================
function MainTabs() {
  const { theme, isDarkMode } = useTheme();

  const GOLD_COLOR = theme?.gold || '#D4AF37';
  const BAR_BG = isDarkMode ? '#121212' : '#FFFFFF';
  const BORDER_COLOR = isDarkMode ? '#27272A' : '#E2E8F0';
  const INACTIVE_COLOR = isDarkMode ? '#71717A' : '#94A3B8';

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: GOLD_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: [
          styles.floatingTabBar,
          {
            backgroundColor: BAR_BG,
            borderTopColor: BORDER_COLOR,
            borderColor: BORDER_COLOR,
            shadowColor: isDarkMode ? '#000' : '#64748b',
          },
        ],
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      {/* 1. الرئيسية */}
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: 'الرئيسية',
          tabBarIcon: ({ focused }) => (
            <View style={styles.activeHomePill}>
              <Ionicons
                name={focused ? 'home' : 'home-outline'}
                size={22}
                color={focused ? GOLD_COLOR : INACTIVE_COLOR}
              />
            </View>
          ),
        }}
      />

      {/* 2. القبلة */}
      <Tab.Screen
        name="Qibla"
        component={QiblaScreen}
        options={{
          tabBarLabel: 'القبلة',
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'compass' : 'compass-outline'}
              size={24}
              color={focused ? GOLD_COLOR : INACTIVE_COLOR}
            />
          ),
        }}
      />

      {/* 3. القرآن (الزر البارز في النص) */}
      <Tab.Screen
        name="Quran"
        component={QuranScreen}
        options={{
          tabBarLabel: 'القرآن',
          tabBarLabelStyle: [styles.tabBarLabel, { color: GOLD_COLOR, marginTop: 4 }],
          tabBarButton: (props) => (
            <CustomQuranTabBarButton
              {...props}
              isDarkMode={isDarkMode}
              theme={theme}
            />
          ),
          tabBarIcon: () => (
            <MaterialCommunityIcons
              name="book-open-page-variant"
              size={25}
              color={GOLD_COLOR}
            />
          ),
        }}
      />

      {/* 4. القصص (الاسم Prophets عشان يطابق HomeScreen) */}
      <Tab.Screen
        name="Prophets"
        component={ProphetsScreen}
        options={{
          tabBarLabel: 'القصص',
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? 'book' : 'book-outline'}
              size={22}
              color={focused ? GOLD_COLOR : INACTIVE_COLOR}
            />
          ),
        }}
      />

      {/* 5. الأذكار (الاسم DuaaAzkar عشان يطابق HomeScreen) */}
      <Tab.Screen
        name="DuaaAzkar"
        component={DuaaAzkarScreen}
        options={{
          tabBarLabel: 'الأذكار',
          tabBarIcon: ({ focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'hand-heart' : 'hand-heart-outline'}
              size={24}
              color={focused ? GOLD_COLOR : INACTIVE_COLOR}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// =====================================================================
// التطبيق الرئيسي مع تسجيل شاشات الـ Stack
// =====================================================================
export default function App() {
  const [isSplashFinished, setIsSplashFinished] = useState(false);

  if (!isSplashFinished) {
    return <CustomSplashScreen onFinish={() => setIsSplashFinished(true)} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContextProvider>
          <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              {/* التاب بار الأساسي */}
              <Stack.Screen name="MainTabs" component={MainTabs} />

              {/* الشاشات الخارجية */}
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="PrayerTimes" component={PrayerTimesScreen} />
              <Stack.Screen name="PrayerTimesScreen" component={PrayerTimesScreen} />
              <Stack.Screen name="Tafseer" component={TafseerScreen} />
              <Stack.Screen name="Hadith" component={HadithScreen} />
              <Stack.Screen name="Learn" component={LearnScreen} />
              <Stack.Screen name="Tasbih" component={TasbihScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </AppContextProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// =====================================================================
// الستايل
// =====================================================================
const styles = StyleSheet.create({
  floatingTabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 12 : 24,
    left: 14,
    right: 14,
    height: 68,
    borderRadius: 36,
    borderWidth: 1,
    paddingBottom: 8,
    paddingTop: 8,
    elevation: 10,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  activeHomePill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customQuranBtnContainer: {
    top: -24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customQuranBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
});