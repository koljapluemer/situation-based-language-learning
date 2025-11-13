import type { taskRegistry } from "@/tasks/ui/taskRegistry";

export interface Task {
  id: string;
  language: string; // code of LanguageData
  taskType: TaskName;
  prompt: string;

  associatedVocab?: string[] // ids of vocab data
  associatedResources?: string[] // ids of resource data
  associatedFactCards?: string[] // ids of fact card data
  associatedGoals?: string[] // ids of goal data
}

export type TaskName = keyof typeof taskRegistry; 
