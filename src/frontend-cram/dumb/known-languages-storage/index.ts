import type { LanguageCode } from '@sbl/shared';

const STORAGE_KEY = 'knownLanguages';

/**
 * Get the user's known languages from localStorage
 */
export function getKnownLanguages(): LanguageCode[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse known languages from localStorage:', error);
    return [];
  }
}

/**
 * Save the user's known languages to localStorage
 */
export function setKnownLanguages(languages: LanguageCode[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(languages));
  } catch (error) {
    console.error('Failed to save known languages to localStorage:', error);
    throw error;
  }
}

/**
 * Check if the user has set their known languages
 */
export function hasKnownLanguages(): boolean {
  return getKnownLanguages().length > 0;
}
