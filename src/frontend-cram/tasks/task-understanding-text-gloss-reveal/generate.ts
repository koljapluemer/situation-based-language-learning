import type { LanguageCode } from '@sbl/shared';
import type { GlossEntity } from '../../entities/gloss/types';
import type { Task } from '../types';

/**
 * Generate a gloss reveal task
 *
 * Task flow: Show gloss content in target language → user clicks "Reveal"
 * → show translations/notes → user rates difficulty
 *
 * @param gloss The gloss entity to create a task from
 * @param challengeLanguage The language of the understanding text challenge
 * @returns Task object with embedded gloss data
 */
export function generateGlossRevealTask(
  gloss: GlossEntity,
  challengeLanguage: LanguageCode
): Task {
  return {
    id: `gloss-reveal-${gloss.id}-${Date.now()}`,
    language: challengeLanguage,
    taskType: 'understanding-text-gloss-reveal',
    prompt: 'What does this mean?',
    data: {
      gloss, // Embed the full gloss entity to avoid re-fetching
    },
  };
}

/**
 * Generate gloss reveal tasks for all glosses in a challenge
 *
 * @param glosses Array of gloss entities
 * @param challengeLanguage The language of the understanding text challenge
 * @returns Array of Task objects
 */
export function generateGlossRevealTasks(
  glosses: GlossEntity[],
  challengeLanguage: LanguageCode
): Task[] {
  return glosses.map(gloss => generateGlossRevealTask(gloss, challengeLanguage));
}
