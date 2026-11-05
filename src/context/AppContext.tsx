import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRANSLATIONS } from '../i18n/translations';

const LANG_KEY = '@nour_language';
const FONT_SIZE_KEY = '@nour_font_size';

export type LanguageType = 'ar' | 'en';
export type FontSizeType = 'small' | 'medium' | 'large';

interface AppContextType {
  language: LanguageType;
  setLanguage: (lang: LanguageType) => void;
  fontSize: FontSizeType;
  setFontSize: (size: FontSizeType) => void;
  t: typeof TRANSLATIONS.ar;
  fontScale: number;
}

const AppContext = createContext<AppContextType>({
  language: 'ar',
  setLanguage: () => {},
  fontSize: 'medium',
  setFontSize: () => {},
  t: TRANSLATIONS.ar,
  fontScale: 1.0,
});

export const AppContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageType>('ar');
  const [fontSize, setFontSizeState] = useState<FontSizeType>('medium');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((saved) => {
      if (saved === 'ar' || saved === 'en') setLanguageState(saved);
    });
    AsyncStorage.getItem(FONT_SIZE_KEY).then((saved) => {
      if (saved === 'small' || saved === 'medium' || saved === 'large') {
        setFontSizeState(saved);
      }
    });
  }, []);

  const setLanguage = (lang: LanguageType) => {
    setLanguageState(lang);
    AsyncStorage.setItem(LANG_KEY, lang);
  };

  const setFontSize = (size: FontSizeType) => {
    setFontSizeState(size);
    AsyncStorage.setItem(FONT_SIZE_KEY, size);
  };

  // معامل تكبير وتصغير الخط
  const fontScale = fontSize === 'small' ? 0.88 : fontSize === 'large' ? 1.18 : 1.0;
  const t = TRANSLATIONS[language];

  return (
    <AppContext.Provider value={{ language, setLanguage, fontSize, setFontSize, t, fontScale }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);