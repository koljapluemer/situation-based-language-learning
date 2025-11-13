import type { TargetItem } from '@frontend-shared/entities/target-items/TargetItem';
import type { TranslationData } from '@frontend-shared/entities/translations/TranslationData';
import type { TaskStateResult } from '@frontend-shared/tasks/utils/TaskState';

export function getVocabRevealTargetToNativeTaskState(
  vocab: TargetItem,
  translations: TranslationData[] = []
): TaskStateResult {
  const level = vocab.progress.level;
  const isSentenceVocab = vocab.consideredSentence === true;
  const hasTranslations = translations.length > 0;

  if (!hasTranslations) {
    return { state: 'impossible', reason: 'No translations available' };
  }

  // For non-sentence vocab, level must be >= 3
  if (!isSentenceVocab) {
    if (level < 3) {
      return { state: 'inactive', reason: 'Only for level 3+ (non-sentence vocab)' };
    }
    return { state: 'active' };
  }

  // For sentence vocab, level must be > 6
  if (isSentenceVocab) {
    if (level <= 6) {
      return { state: 'inactive', reason: 'Only for level 7+ (sentence vocab)' };
    }
    return { state: 'active' };
  }

  return { state: 'active' };
}

export function getVocabRevealNativeToTargetTaskState(
  vocab: TargetItem,
  translations: TranslationData[] = []
): TaskStateResult {
  const level = vocab.progress.level;
  const isSentenceVocab = vocab.consideredSentence === true;
  const hasTranslations = translations.length > 0;

  if (!hasTranslations) {
    return { state: 'impossible', reason: 'No translations available' };
  }

  // For non-sentence vocab, level must be >= 4
  if (!isSentenceVocab) {
    if (level < 4) {
      return { state: 'inactive', reason: 'Only for level 4+ (non-sentence vocab)' };
    }
    return { state: 'active' };
  }

  // For sentence vocab, level must be > 6
  if (isSentenceVocab) {
    if (level <= 6) {
      return { state: 'inactive', reason: 'Only for level 7+ (sentence vocab)' };
    }
    return { state: 'active' };
  }

  return { state: 'active' };
}
