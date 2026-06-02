export type TaskCategory = string;

export type Priority = 'urgent' | 'important' | 'normal';

export interface Task {
  id: string;
  rawText: string;
  action: string;
  target: string;
  time?: string;
  notes?: string;
  images?: string[];
  priority: Priority;
  category: TaskCategory;
  completed: boolean;
  createdAt: string;
}

export interface ExtractedData {
  action: string;
  target: string;
  time?: string;
  priority: Priority;
  category: TaskCategory;
  summary: string;
}
