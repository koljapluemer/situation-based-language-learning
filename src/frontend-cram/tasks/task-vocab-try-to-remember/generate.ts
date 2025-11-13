import type { TargetItem } from '@frontend-shared/entities/target-items/TargetItem';
import type { Task } from '@frontend-shared/tasks/Task';

export function generateVocabTryToRemember(vocab: TargetItem): Task {
  const id = `vocab-try-to-remember-${vocab.id}-${Date.now()}`;
  
  return {
    id,
    language: vocab.language,
    taskType: 'vocab-try-to-remember',
    prompt: 'Try to memorize',
    associatedVocab: [vocab.id]
  };
}