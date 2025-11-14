import type { GlossEntity } from '../../entities/gloss/types';
import type { Task } from '../types';

export function generateGlossReveal(gloss: GlossEntity): Task {
  const id = `gloss-reveal-${gloss.id}-${Date.now()}`;

  return {
    id,
    language: gloss.language,
    taskType: 'gloss-reveal',
    prompt: 'What does this mean?',
    data: {
      gloss
    }
  };
}