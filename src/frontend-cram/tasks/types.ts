import type { LanguageCode } from '@sbl/shared';

/**
 * Minimal Task interface for practice tasks
 * Inspired by legacy task architecture
 */
export interface Task {
  id: string;
  language: LanguageCode;
  taskType: string;
  prompt: string;
  data: any; // Task-specific data (e.g., embedded gloss, vocab, etc.)
}

/**
 * Task completion result
 */
export interface TaskResult {
  taskId: string;
  rating?: number; // 1-4 for spaced repetition (Again, Hard, Good, Easy)
  correct?: boolean; // For tasks with right/wrong answers
}
