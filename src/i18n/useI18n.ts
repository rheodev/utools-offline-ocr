import { computed, onUnmounted, ref, watchEffect } from 'vue'
import { translate, type LocalizedMessage, type MessageKey } from './messages'
import { readPreference, resolveLocale, savePreference } from './preferences'

export function useI18n() {
  // Access localStorage inside the guarded adapter: its getter can also throw.
  const storage = {
    getItem: (key: string) => window.localStorage.getItem(key),
    setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
  }
  const preference = ref(readPreference(storage))
  const language = ref(navigator.language || 'en')
  const locale = computed(() => resolveLocale(preference.value, language.value))
  function t(key: MessageKey, params?: LocalizedMessage['params']) {
    return translate(locale.value, { key, params })
  }
  function format(message: LocalizedMessage) { return translate(locale.value, message) }
  function updateLanguage() { language.value = navigator.language || 'en' }
  window.addEventListener('languagechange', updateLanguage)
  onUnmounted(() => window.removeEventListener('languagechange', updateLanguage))
  watchEffect(() => {
    savePreference(storage, preference.value)
    document.documentElement.lang = locale.value
    document.title = t('app.title')
  })
  return { preference, locale, t, format }
}
