// The room in English or Hindi: a toggle in the bottom dock (Overlay.tsx), remembered in this browser, and ?lang=hi
// for a link that opens in Hindi. Text is written in place as t('Projects', 'प्रोजेक्ट्स'); components call useT()
// so they redraw when the language changes. The project write-ups, resume and SameerOS stay in English.
import { create } from 'zustand'

export type Lang = 'en' | 'hi'

function initial(): Lang {
  try {
    const url = new URL(location.href)
    const asked = url.searchParams.get('lang')
    if (asked === 'en' || asked === 'hi') return asked
    const saved = localStorage.getItem('lang')
    if (saved === 'en' || saved === 'hi') return saved
  } catch {
    // storage blocked: English
  }
  return 'en'
}

export const useLang = create<{ lang: Lang }>(() => ({ lang: initial() }))

const apply = (lang: Lang) => {
  document.documentElement.lang = lang
  try {
    localStorage.setItem('lang', lang)
  } catch {
    // only this visit then
  }
}
apply(useLang.getState().lang)
useLang.subscribe(({ lang }) => apply(lang))

export const toggleLang = () => useLang.setState((s) => ({ lang: s.lang === 'en' ? 'hi' : 'en' }))

/** the text in the visitor's language */
export const t = (en: string, hi: string) => (useLang.getState().lang === 'hi' ? hi : en)

/** t(), for components: they redraw when the language changes */
export function useT() {
  useLang((s) => s.lang)
  return t
}
