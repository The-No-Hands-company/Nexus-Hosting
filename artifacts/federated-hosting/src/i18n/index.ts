import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./en.json";
import id from "./id.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "id", label: "Bahasa Indonesia", flag: "🇮🇩" },
] as const;

export type SupportedLang = (typeof SUPPORTED_LANGUAGES)[number]["code"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      id: { translation: id },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "id"],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      // Check localStorage first, then browser language
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "fh_language",
    },
  });

export default i18n;
