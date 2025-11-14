import type { SituationDTO, SituationSummaryDTO, LanguageCode, GlossDTO } from '@sbl/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3333';

/**
 * Fetch situation summaries for a specific target language
 * Includes native languages for language-aware filtering
 */
export async function fetchSituationSummaries(
  targetLanguage: LanguageCode
): Promise<SituationSummaryDTO[]> {
  const params = new URLSearchParams();
  params.set('targetLanguage', targetLanguage);

  const response = await fetch(`${API_BASE_URL}/situations/summary?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch situation summaries: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Fetch full situation details by id
 * Includes native languages for language-aware filtering (one prompt per challenge, filtered glosses)
 */
export async function fetchSituation(
  id: string
): Promise<SituationDTO> {
  const url = `${API_BASE_URL}/situations/${id}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch situation: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

/**
 * Fetch a single gloss by ID
 */
export async function fetchGloss(glossId: string): Promise<GlossDTO> {
  const response = await fetch(`${API_BASE_URL}/glosses/${glossId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch gloss ${glossId}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}
