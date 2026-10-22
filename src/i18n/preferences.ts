import type { Locale } from './messages.ts'

export type LanguagePreference = 'auto' | Locale
export const LANGUAGE_STORAGE_KEY = 'offline-ocr.language'
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

export function resolveLocale(preference: LanguagePreference, language: string): Locale {
  if (preference !== 'auto') return preference
  return /^zh(?:-|_|$)/i.test(language) ? 'zh-CN' : 'en'
}

export function readPreference(storage: PreferenceStorage): LanguagePreference {
  try {
    const value = storage.getItem(LANGUAGE_STORAGE_KEY)
    if (value === 'zh-CN' || value === 'en') return value
  } catch { /* Storage may be unavailable; use automatic detection. */ }
  return 'auto'
}

export function savePreference(storage: PreferenceStorage, value: LanguagePreference) {
  try { storage.setItem(LANGUAGE_STORAGE_KEY, value) }
  catch { /* Keep the selection for this session when storage is unavailable. */ }
}
