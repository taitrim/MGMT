import { create } from 'zustand'

export type Language = 'en' | 'vi'

interface I18nState {
  language: Language
  toggleLanguage: () => void
  setLanguage: (language: Language) => void
}

const STORAGE_KEY = 'securevault_language'

const getInitialLanguage = (): Language => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'vi' || saved === 'en') return saved
  return 'en'
}

export const useI18nStore = create<I18nState>((set) => ({
  language: getInitialLanguage(),
  toggleLanguage: () =>
    set((state) => {
      const next = state.language === 'en' ? 'vi' : 'en'
      localStorage.setItem(STORAGE_KEY, next)
      return { language: next }
    }),
  setLanguage: (language) => {
    localStorage.setItem(STORAGE_KEY, language)
    set({ language })
  },
}))

export const t = (language: Language, en: string, vi: string) =>
  language === 'vi' ? vi : en
