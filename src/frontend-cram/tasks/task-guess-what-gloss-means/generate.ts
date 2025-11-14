import type { GlossEntity } from '../../entities/gloss/types';
import type { Task } from '../types';

export function generateGuessWhatGlossMeans(gloss: GlossEntity): Task {
  const id = `guess-what-gloss-means-${gloss.id}-${Date.now()}`;

  return {
    id,
    language: gloss.language,
    taskType: 'guess-what-gloss-means',
    prompt: 'Guess what this means',
    data: {
      gloss
    }
  };
}