import type { TargetItem } from '@frontend-shared/entities/target-items/TargetItem';
import type { Task } from '@frontend-shared/tasks/Task';

export function generateGuessWhatSentenceMeans(vocab: TargetItem): Task {
  const id = `guess-what-sentence-means-${vocab.id}-${Date.now()}`;
  
  return {
    id,
    language: vocab.language,
    taskType: 'guess-what-sentence-means',
    prompt: 'Guess what this sentence means',
    associatedVocab: [vocab.id]
  };
}