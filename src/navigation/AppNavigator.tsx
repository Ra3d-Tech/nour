import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';

// الشاشات
import { HomeScreen } from '../screens/HomeScreen';
import { QuranScreen } from './../screens/QuranScreen';
import { QiblaScreen } from '../screens/QiblaScreen';
import { ProphetsScreen } from '../screens/ProphetsScreen';
import { DuaaAzkarScreen } from '../screens/DuaaAzkarScreen';
import { PrayerTimesScreen } from '../screens/PrayerTimesScreen';
import { TafseerScreen } from '../screens/TafseerScreen';
import { HadithScreen } from '../screens/HadithScreen';
import { LearnScreen } from '../screens/LearnScreen';
import { TasbihScreen } from '../screens/TasbihScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const CenterQuranButton = ({ onPress, theme, label, fontScale }: any) => (
  <TouchableOpacity
    style={styles.centerButtonWrapper}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View style={[styles.centerButtonCircle, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      <View style={[styles.centerButtonInner, { backgroundColor: theme.primaryHeader }]}>
        <MaterialCommunityIcons
          name="book-open-page-variant"
          size={27}
          color={theme.goldLight}
        />
      </View>
    </View>
    <Text style={[styles.centerButtonLabel, { color: theme.gold, fontSize: 11 * fontScale }]}>{label}</Text>
  </TouchableOpacity>
);

const MainTabs = () => {
  const { theme } = useTheme();
  const { t, fontScale } = useApp();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.gold,
        tabBarInactiveTintColor: theme.tabInactiveIcon,
        tabBarLabelStyle: {
          fontSize: 10.5 * fontScale,
          fontWeight: '700',
          marginTop: -3,
          marginBottom: 3,
        },
        tabBarStyle: [
          styles.floatingTabBar,
          {
            backgroundColor: theme.tabBarBg,
            borderColor: theme.border,
          },
        ],
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: t.home,
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabItemPill, focused && { backgroundColor: theme.tabActivePill }]}>
              <MaterialCommunityIcons
                name={focused ? 'home-variant' : 'home-variant-outline'}
                size={24}
                color={focused ? theme.gold : theme.tabInactiveIcon}
              />
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Qibla"
        component={QiblaScreen}
        options={{
          tabBarLabel: t.qibla,
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabItemPill, focused && { backgroundColor: theme.tabActivePill }]}>
              <MaterialCommunityIcons
                name={focused ? 'compass' : 'compass-outline'}
                size={24}
                color={focused ? theme.gold : theme.tabInactiveIcon}
              />
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="Quran"
        component={QuranScreen}
        options={{
          tabBarButton: (props) => <CenterQuranButton {...props} theme={theme} label={t.quran} fontScale={fontScale} />,
        }}
      />

<Tab.Screen 
  name="Prophets" 
  component={ProphetsScreen} 
  options={{ tabBarStyle: { display: 'none' } }} 
/>


      <Tab.Screen
        name="DuaaAzkar"
        component={DuaaAzkarScreen}
        options={{
          tabBarLabel: t.azkar,
          tabBarIcon: ({ focused }) => (
            <View style={[styles.tabItemPill, focused && { backgroundColor: theme.tabActivePill }]}>
              <MaterialCommunityIcons
                name={focused ? 'hands-pray' : 'hand-heart-outline'}
                size={24}
                color={focused ? theme.gold : theme.tabInactiveIcon}
              />
            </View>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} />
        {/* تسجيل جميع الشاشات في الستاك العام */}
        <Stack.Screen name="Tafseer" component={TafseerScreen} />
        <Stack.Screen name="Hadith" component={HadithScreen} />
        <Stack.Screen name="Learn" component={LearnScreen} />
        <Stack.Screen name="Tasbih" component={TasbihScreen} />
        <Stack.Screen name="PrayerTimes" component={PrayerTimesScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="QuranScreen" component={QuranScreen} />
        <Stack.Screen name="QiblaScreen" component={QiblaScreen} />
        <Stack.Screen name="ProphetsScreen" component={ProphetsScreen} />
        <Stack.Screen name="DuaaAzkarScreen" component={DuaaAzkarScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  floatingTabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 14 : 8,
    left: 12,
    right: 12,
    height: 64,
    borderRadius: 26,
    borderWidth: 1.2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 6,
  },
  tabItemPill: {
    width: 42,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  centerButtonWrapper: {
    top: -24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerButtonCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1.5,
  },
  centerButtonInner: {
    flex: 1,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerButtonLabel: {
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
});