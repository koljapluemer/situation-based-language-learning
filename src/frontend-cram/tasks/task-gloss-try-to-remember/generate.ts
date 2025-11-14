import type { GlossEntity } from '../../entities/gloss/types';
import type { Task } from '../types';

export function generateGlossTryToRemember(gloss: GlossEntity): Task {
  const id = `gloss-try-to-remember-${gloss.id}-${Date.now()}`;

  return {
    id,
    language: gloss.language,
    taskType: 'gloss-try-to-remember',
    prompt: 'Try to memorize',
    data: {
      gloss
    }
  };
}