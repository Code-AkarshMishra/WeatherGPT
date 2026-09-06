import { createContext, useContext, useState } from 'react';

// i18n strings for UI labels — add more languages by extending this map
const STRINGS = {
  en: {
    appName: 'WeatherGPT',
    home: 'Home',
    dashboard: 'Dashboard',
    about: 'About',
    login: 'Login',
    logout: 'Logout',
    register: 'Register',
    profile: 'Profile',
    selectRole: 'Select Role',
    quickAccess: 'Quick Access',
    typeMessage: 'Ask about weather, alerts, crops...',
    send: 'Send',
    useLocation: 'Use My Location',
    searchLocation: 'Search city...',
    loading: 'Loading...',
    errorFetch: 'Failed to load weather data.',
    temperature: 'Temperature',
    feelsLike: 'Feels Like',
    humidity: 'Humidity',
    wind: 'Wind',
    rainChance: 'Rain Chance',
    youAreChattingAs: 'Chatting as:',
    switchRole: 'Switch role?',
    switchRoleHint: 'Detected query matches',
    switchBtn: 'Switch',
    dismiss: 'Dismiss',
    newConversation: 'New Chat',
    conversations: 'Conversations',
  },
  hi: {
    appName: 'वेदरजीपीटी',
    home: 'होम',
    dashboard: 'डैशबोर्ड',
    about: 'परिचय',
    login: 'लॉगिन',
    logout: 'लॉगआउट',
    register: 'रजिस्टर',
    profile: 'प्रोफाइल',
    selectRole: 'भूमिका चुनें',
    quickAccess: 'त्वरित पहुँच',
    typeMessage: 'मौसम, अलर्ट, फसल के बारे में पूछें...',
    send: 'भेजें',
    useLocation: 'मेरी लोकेशन',
    searchLocation: 'शहर खोजें...',
    loading: 'लोड हो रहा है...',
    errorFetch: 'मौसम डेटा लोड नहीं हो सका।',
    temperature: 'तापमान',
    feelsLike: 'महसूस होता है',
    humidity: 'आर्द्रता',
    wind: 'हवा',
    rainChance: 'बारिश संभावना',
    youAreChattingAs: 'आप बात कर रहे हैं:',
    switchRole: 'भूमिका बदलें?',
    switchRoleHint: 'पता चला प्रश्न मेल खाता है',
    switchBtn: 'बदलें',
    dismiss: 'बंद करें',
    newConversation: 'नई बातचीत',
    conversations: 'बातचीत',
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('lang') || 'en';
  });

  const t = (key) => STRINGS[lang]?.[key] || STRINGS.en[key] || key;

  const setLanguage = (newLang) => {
    if (STRINGS[newLang]) {
      setLang(newLang);
      localStorage.setItem('lang', newLang);
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, setLanguage, t, availableLanguages: Object.keys(STRINGS) }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
};
