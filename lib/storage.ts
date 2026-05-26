import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Task } from '../types/task';

const TASKS_KEY = '@voice_todo_tasks';
const API_KEY_STORE = 'anthropic_api_key';

// ─── Task operations ───────────────────────────────────────────────

export async function loadTasks(): Promise<Task[]> {
  const json = await AsyncStorage.getItem(TASKS_KEY);
  return json ? (JSON.parse(json) as Task[]) : [];
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await AsyncStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

export async function addTask(task: Task): Promise<Task[]> {
  const tasks = await loadTasks();
  const updated = [task, ...tasks];
  await saveTasks(updated);
  return updated;
}

export async function toggleTask(id: string): Promise<Task[]> {
  const tasks = await loadTasks();
  const updated = tasks.map((t) =>
    t.id === id ? { ...t, completed: !t.completed } : t
  );
  await saveTasks(updated);
  return updated;
}

export async function deleteTask(id: string): Promise<Task[]> {
  const tasks = await loadTasks();
  const updated = tasks.filter((t) => t.id !== id);
  await saveTasks(updated);
  return updated;
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<Task[]> {
  const tasks = await loadTasks();
  const updated = tasks.map((t) => t.id === id ? { ...t, ...patch } : t);
  await saveTasks(updated);
  return updated;
}

// ─── API key operations ────────────────────────────────────────────

export async function saveApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(API_KEY_STORE, key);
}

export async function loadApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY_STORE);
}
