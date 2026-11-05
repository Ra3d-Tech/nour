import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT_COLORS, DARK_COLORS } from '../constants/theme';

const THEME_STORAGE_KEY = '@nour_theme_mode';

interface ThemeContextType {
  isDarkMode: boolean;
  theme: typeof LIGHT_COLORS;
  toggleTheme: (val?: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  theme: LIGHT_COLORS,
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // قراءة الوضع المحفوظ في الجهاز
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved !== null) {
        setIsDarkMode(saved === 'dark');
      }
    });
  }, []);

  const toggleTheme = (val?: boolean) => {
    setIsDarkMode((prev) => {
      const nextVal = typeof val === 'boolean' ? val : !prev;
      AsyncStorage.setItem(THEME_STORAGE_KEY, nextVal ? 'dark' : 'light');
      return nextVal;
    });
  };

  const theme = isDarkMode ? DARK_COLORS : LIGHT_COLORS;

  return (
    <ThemeContext.Provider value={{ isDarkMode, theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);