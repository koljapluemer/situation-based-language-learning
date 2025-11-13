import type { LanguageCode } from '@sbl/shared';
import { fetchSituationSummaries, fetchSituation } from './api';
import { upsertSituationSummary, upsertSituation } from '../../entities/situation';
import { upsertGlosses } from '../../entities/gloss';

/**
 * Download situation summaries for a target language
 * Stores lightweight metadata without full challenge/gloss data
 */
export async function downloadSituationSummaries(
  targetLanguage: LanguageCode,
  nativeLanguages: LanguageCode[]
): Promise<{ count: number }> {
  const summaries = await fetchSituationSummaries(targetLanguage, nativeLanguages);

  // Upsert each summary (smart merge by identifier)
  for (const summary of summaries) {
    await upsertSituationSummary(summary);
  }

  return { count: summaries.length };
}

/**
 * Download full situation details including glosses
 * Performs smart merge:
 * - Situations merged by identifier
 * - Glosses deduplicated by [language+content]
 */
export async function downloadSituation(
  identifier: string,
  nativeLanguages: LanguageCode[]
): Promise<void> {
  const situation = await fetchSituation(identifier, nativeLanguages);

  // Extract all unique glosses from challenge arrays
  // Challenges ARE glosses in the new architecture (no wrapper objects)
  const allGlosses = new Map<string, typeof situation.challengesOfExpression[0]>();

  // Collect glosses from expression challenges (already GlossDTO[])
  situation.challengesOfExpression.forEach(gloss => {
    allGlosses.set(gloss.id, gloss);
  });

  // Collect glosses from understanding challenges (already GlossDTO[])
  situation.challengesOfUnderstandingText.forEach(gloss => {
    allGlosses.set(gloss.id, gloss);
  });

  // Upsert all glosses (smart merge by [language+content])
  await upsertGlosses(Array.from(allGlosses.values()));

  // Upsert situation (smart merge by identifier)
  await upsertSituation(situation);
}

/**
 * Download all situations for a target language (summaries + full details)
 * Two-phase approach:
 * 1. Download summaries first (for quick list view)
 * 2. Download full details for each situation
 */
export async function downloadAllSituations(
  targetLanguage: LanguageCode,
  nativeLanguages: LanguageCode[],
  onProgress?: (current: number, total: number) => void
): Promise<{ count: number }> {
  // Phase 1: Download summaries
  const { count } = await downloadSituationSummaries(targetLanguage, nativeLanguages);

  if (count === 0) {
    return { count: 0 };
  }

  // Phase 2: Download full details for each situation
  const summaries = await fetchSituationSummaries(targetLanguage, nativeLanguages);

  for (let i = 0; i < summaries.length; i++) {
    await downloadSituation(summaries[i].identifier, nativeLanguages);
    onProgress?.(i + 1, summaries.length);
  }

  return { count: summaries.length };
}
