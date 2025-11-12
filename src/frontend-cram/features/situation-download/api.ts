import type { SituationDTO, SituationSummaryDTO, LanguageCode } from '@sbl/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333';

/**
 * Fetch situation summaries for a specific target language
 * Includes native languages for language-aware filtering
 */
export async function fetchSituationSummaries(
  targetLanguage: LanguageCode,
  nativeLanguages: LanguageCode[]
): Promise<SituationSummaryDTO[]> {
  const params = new URLSearchParams();
  params.set('targetLanguage', targetLanguage);
  if (nativeLanguages.length > 0) {
    params.set('nativeLanguages', nativeLanguages.join(','));
  }

  const response = await fetch(`${API_BASE_URL}/situations/summary?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch situation summaries: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Fetch full situation details by identifier
 * Includes native languages for language-aware filtering (one prompt per challenge, filtered glosses)
 */
export async function fetchSituation(
  identifier: string,
  nativeLanguages: LanguageCode[]
): Promise<SituationDTO> {
  const params = new URLSearchParams();
  if (nativeLanguages.length > 0) {
    params.set('nativeLanguages', nativeLanguages.join(','));
  }

  const url = params.toString()
    ? `${API_BASE_URL}/situations/${identifier}?${params.toString()}`
    : `${API_BASE_URL}/situations/${identifier}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch situation: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}
