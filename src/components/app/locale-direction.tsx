"use client";
import { useLocale } from "next-intl";
import { useEffect } from "react";

// Keeps <html dir> and <html lang> in sync with the active locale on client-side navigation.
// The root layout sets these server-side on first load; this handles subsequent client transitions
// (e.g., switching EN -> AR must flip dir to rtl). PRD §4: Arabic must support RTL.
export function LocaleDirection() {
  const locale = useLocale();
  useEffect(() => {
    const dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale]);
  return null;
}
