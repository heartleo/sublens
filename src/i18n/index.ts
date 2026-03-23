import { createContext, useContext } from "react";
import en, { type LocaleMessages } from "./locales/en";
import zh from "./locales/zh";

export type Locale = "en" | "zh";

const messages: Record<Locale, LocaleMessages> = { en, zh };

export function getMessages(locale: Locale): LocaleMessages {
  return messages[locale] ?? en;
}

export const I18nContext = createContext<LocaleMessages>(en);
export const LocaleContext = createContext<Locale>("en");

export function useI18n(): LocaleMessages {
  return useContext(I18nContext);
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Localize price suffixes like "/mo" → "/每月". */
export function localizePrice(price: string, t: LocaleMessages): string {
  return price.replace("/mo", t.priceMo).replace("/yr", t.priceYr);
}

const localeCode: Record<Locale, string> = { en: "en-US", zh: "zh-CN" };

/** Format an ISO date string (e.g. "2026-04-23") according to the current locale. */
export function formatDate(isoDate: string, locale: Locale): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(localeCode[locale], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
