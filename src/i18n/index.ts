import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../store/languageTypes';
import type { SupportedLanguage } from '../store/languageTypes';

// G7 Languages
import en from './locales/en.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';
import ja from './locales/ja.json';

// EU Languages
import bg from './locales/bg.json';
import cs from './locales/cs.json';
import da from './locales/da.json';
import el from './locales/el.json';
import es from './locales/es.json';
import et from './locales/et.json';
import fi from './locales/fi.json';
import ga from './locales/ga.json';
import hr from './locales/hr.json';
import hu from './locales/hu.json';
import lt from './locales/lt.json';
import lv from './locales/lv.json';
import mt from './locales/mt.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import ro from './locales/ro.json';
import sk from './locales/sk.json';
import sl from './locales/sl.json';
import sv from './locales/sv.json';

// Other Ultravox Languages
import ar from './locales/ar.json';
import be from './locales/be.json';
import bn from './locales/bn.json';
import cy from './locales/cy.json';
import fa from './locales/fa.json';
import gl from './locales/gl.json';
import hi from './locales/hi.json';
import ka from './locales/ka.json';
import mk from './locales/mk.json';
import mr from './locales/mr.json';
import ru from './locales/ru.json';
import sr from './locales/sr.json';
import sw from './locales/sw.json';
import ta from './locales/ta.json';
import th from './locales/th.json';
import tr from './locales/tr.json';
import uk from './locales/uk.json';
import ur from './locales/ur.json';
import vi from './locales/vi.json';
import zh from './locales/zh.json';

// Map of all locale modules
const localeModules: Record<SupportedLanguage, Record<string, unknown>> = {
  en, fr, de, it, ja,
  bg, cs, da, el, es, et, fi, ga, hr, hu, lt, lv, mt, nl, pl, pt, ro, sk, sl, sv,
  ar, be, bn, cy, fa, gl, hi, ka, mk, mr, ru, sr, sw, ta, th, tr, uk, ur, vi, zh,
};

// Build resources object dynamically
const resources: Record<string, { translation: Record<string, unknown> }> = {};
for (const lang of SUPPORTED_LANGUAGES) {
  resources[lang] = { translation: localeModules[lang] };
}

// Load saved language preference
const savedLanguage = localStorage.getItem('preferred-language');
const defaultLanguage = savedLanguage && SUPPORTED_LANGUAGES.includes(savedLanguage as SupportedLanguage)
  ? savedLanguage
  : 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: defaultLanguage,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
