import type { LanguageCode } from '@sbl/shared';
import { fetchSituationSummaries, fetchSituation, fetchGloss } from './api';
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
 * Collect all gloss IDs from a GlossDTO (including all relation IDs)
 * The backend returns GlossReference (lightweight {id, language, content}) for relations,
 * so we need to collect IDs and fetch them separately
 */
function collectAllGlossIds(
  gloss: any,
  collected: Set<string>,
  processed: Set<string>
): void {
  console.log('[collectAllGlossIds] Processing gloss:', gloss.id, gloss.language, gloss.content);

  // Add this gloss ID to collection
  if (!collected.has(gloss.id)) {
    collected.add(gloss.id);
    console.log('[collectAllGlossIds] Added gloss ID:', gloss.id);
  }

  // Avoid processing relations twice (cycle prevention)
  if (processed.has(gloss.id)) {
    console.log('[collectAllGlossIds] Already processed relations, skipping');
    return;
  }
  processed.add(gloss.id);

  // Collect IDs from all relation arrays (these are GlossReference objects with .id)
  const relations = [
    'contains',
    'translations',
    'nearSynonyms',
    'nearHomophones',
    'clarifiesUsage',
    'toBeDifferentiatedFrom'
  ];

  relations.forEach(relation => {
    if (gloss[relation] && Array.isArray(gloss[relation])) {
      console.log(`[collectAllGlossIds]   ${relation}:`, gloss[relation].length, gloss[relation]);
      gloss[relation].forEach((ref: any) => {
        if (ref.id && !collected.has(ref.id)) {
          console.log(`[collectAllGlossIds]     Adding ${relation} ID:`, ref.id);
          collected.add(ref.id);
        }
      });
    } else {
      console.log(`[collectAllGlossIds]   ${relation}: not present or not array`);
    }
  });

  console.log('[collectAllGlossIds] Total collected after this gloss:', collected.size);
}

/**
 * Download full situation details including ALL related glosses
 * Performs smart merge:
 * - Situations merged by identifier
 * - Glosses deduplicated by [language+content]
 * - Recursively fetches all referenced glosses (contains, translations, etc.)
 */
export async function downloadSituation(
  identifier: string,
  nativeLanguages: LanguageCode[]
): Promise<void> {
  const situation = await fetchSituation(identifier, nativeLanguages);

  console.log('[downloadSituation] Downloaded situation:', identifier);
  console.log('[downloadSituation] Expression challenges:', situation.challengesOfExpression.length);
  console.log('[downloadSituation] Understanding challenges:', situation.challengesOfUnderstandingText.length);

  // Phase 1: Collect all gloss IDs from the situation
  const glossIdsToFetch = new Set<string>();
  const processedGlossIds = new Set<string>();

  situation.challengesOfExpression.forEach(gloss => {
    collectAllGlossIds(gloss, glossIdsToFetch, processedGlossIds);
  });

  situation.challengesOfUnderstandingText.forEach(gloss => {
    collectAllGlossIds(gloss, glossIdsToFetch, processedGlossIds);
  });

  console.log('[downloadSituation] Total gloss IDs to fetch:', glossIdsToFetch.size);

  // Phase 2: Fetch all glosses individually by ID
  // This is necessary because the backend only returns GlossReference objects
  // in the relations (not full nested GlossDTO objects)
  const allGlosses: any[] = [];
  const fetchedIds = new Set<string>();

  // Keep fetching until no new IDs are discovered
  let lastSize = 0;
  while (glossIdsToFetch.size > lastSize) {
    lastSize = glossIdsToFetch.size;

    // Fetch all glosses we haven't fetched yet
    const idsToFetch = Array.from(glossIdsToFetch).filter(id => !fetchedIds.has(id));

    console.log('[downloadSituation] Fetching batch of', idsToFetch.length, 'glosses');

    for (const glossId of idsToFetch) {
      try {
        const gloss = await fetchGloss(glossId);
        console.log('[downloadSituation] Fetched gloss:', gloss.id, gloss.language, gloss.content);
        console.log('[downloadSituation]   contains:', gloss.contains?.length || 0);
        console.log('[downloadSituation]   translations:', gloss.translations?.length || 0);
        allGlosses.push(gloss);
        fetchedIds.add(glossId);

        // This gloss might reference more glosses, so collect their IDs too
        collectAllGlossIds(gloss, glossIdsToFetch, processedGlossIds);
      } catch (error) {
        console.warn('[downloadSituation] Failed to fetch gloss', glossId, error);
      }
    }
  }

  console.log('[downloadSituation] Fetched', allGlosses.length, 'total glosses');

  // Phase 3: Upsert all glosses (smart merge by [language+content])
  if (allGlosses.length > 0) {
    await upsertGlosses(allGlosses);
  }

  // Phase 4: Upsert situation (smart merge by identifier)
  await upsertSituation(situation);

  console.log('[downloadSituation] Download complete for', identifier);
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
