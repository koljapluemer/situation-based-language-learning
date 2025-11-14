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
 * Recursively collect all glosses from a GlossDTO tree
 * Includes: the gloss itself, all contains (recursive), all translations (depth 1)
 */
function collectAllGlossesRecursive(
  gloss: any,
  collected: Map<string, any>
): void {
  // Avoid cycles
  if (collected.has(gloss.id)) return;

  // Add this gloss
  collected.set(gloss.id, gloss);

  // Recursively collect contains glosses
  if (gloss.contains && Array.isArray(gloss.contains)) {
    gloss.contains.forEach((containedGloss: any) => {
      collectAllGlossesRecursive(containedGloss, collected);
    });
  }

  // Collect translations (depth 1, not recursive)
  if (gloss.translations && Array.isArray(gloss.translations)) {
    gloss.translations.forEach((translation: any) => {
      if (!collected.has(translation.id)) {
        collected.set(translation.id, translation);
      }
    });
  }

  // Also collect other relations at depth 1 if present
  const otherRelations = [
    'nearSynonyms',
    'nearHomophones',
    'clarifiesUsage',
    'toBeDifferentiatedFrom'
  ];

  otherRelations.forEach(relation => {
    if (gloss[relation] && Array.isArray(gloss[relation])) {
      gloss[relation].forEach((relatedGloss: any) => {
        if (!collected.has(relatedGloss.id)) {
          collected.set(relatedGloss.id, relatedGloss);
        }
      });
    }
  });
}

/**
 * Download full situation details including glosses
 * Performs smart merge:
 * - Situations merged by identifier
 * - Glosses deduplicated by [language+content]
 * - Recursively collects contains and translations
 */
export async function downloadSituation(
  identifier: string,
  nativeLanguages: LanguageCode[]
): Promise<void> {
  const situation = await fetchSituation(identifier, nativeLanguages);

  // Extract all unique glosses recursively from challenge arrays
  const allGlosses = new Map<string, typeof situation.challengesOfExpression[0]>();

  // Collect glosses from expression challenges (already GlossDTO[])
  // These are native language glosses with target language translations
  situation.challengesOfExpression.forEach(gloss => {
    collectAllGlossesRecursive(gloss, allGlosses);
  });

  // Collect glosses from understanding challenges (already GlossDTO[])
  // These are target language glosses with native language translations
  situation.challengesOfUnderstandingText.forEach(gloss => {
    collectAllGlossesRecursive(gloss, allGlosses);
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
