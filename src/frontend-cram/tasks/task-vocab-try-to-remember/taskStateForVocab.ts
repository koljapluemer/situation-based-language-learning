import type { TargetItem } from '@frontend-shared/entities/target-items/TargetItem';
import type { TranslationData } from '@frontend-shared/entities/translations/TranslationData';
import type { TaskStateResult } from '@frontend-shared/tasks/utils/TaskState';

export function getVocabTryToRememberTaskState(
  vocab: TargetItem,
  translations: TranslationData[] = []
): TaskStateResult {
  const level = vocab.progress.level;
  const isSentenceVocab = vocab.consideredSentence === true;
  const hasTranslations = translations.length > 0;

  if (isSentenceVocab) {
    return { state: 'inactive', reason: 'Not for sentence vocab' };
  }

  if (!hasTranslations) {
    return { state: 'impossible', reason: 'No translations available' };
  }

  if (level !== -1) {
    return { state: 'inactive', reason: 'Only for unseen vocab (level -1)' };
  }

  return { state: 'active' };
}
