export interface Language {
  name: string;
  emoji?: string;
}

export const LANGUAGES: Record<string, Language> = {
  deu: { name: "German", emoji: "🇩🇪" },
  arz: { name: "Egyptian Arabic", emoji: "🇪🇬" },
  arb: { name: "Standard Arabic" },
  apc: { name: "Levantine Arabic", emoji: "🇱🇧" },
  cmn: { name: "Mandarin Chinese", emoji: "🇨🇳" },
  fra: { name: "French", emoji: "🇫🇷" },
  spa: { name: "Spanish", emoji: "🇪🇸" },
  uzb: { name: "Uzbek", emoji: "🇺🇿" },
  eng: { name: "English"}
};

export type LanguageCode = keyof typeof LANGUAGES;