import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Task } from '../types/task';
import { loadTasks, addTask, toggleTask, deleteTask, updateTask } from '../lib/storage';
import TaskCard from '../components/TaskCard';
import VoiceModal, { MicIcon } from '../components/VoiceModal';
import TaskDetailModal from '../components/TaskDetailModal';

type FilterType = string;

interface Props {
  apiKey: string;
  onOpenSettings: () => void;
}

function getTodayLabel(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${month}/${day}  週${weekdays[now.getDay()]}`;
}

export default function HomeScreen({ apiKey, onOpenSettings }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const today = getTodayLabel();

  useEffect(() => { loadAllTasks(); }, []);

  async function loadAllTasks() {
    const loaded = await loadTasks();
    setTasks(loaded);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllTasks();
    setRefreshing(false);
  }, []);

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'all') return !t.completed;
    if (filter === 'done') return t.completed;
    return t.category === filter && !t.completed;
  });

  const pendingCount = tasks.filter((t) => !t.completed).length;

  async function handleAdd(taskData: Omit<Task, 'id' | 'createdAt' | 'completed'>) {
    const newTask: Task = {
      ...taskData,
      id: Date.now().toString(),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    const updated = await addTask(newTask);
    setTasks(updated);
    setFilter('all');
  }

  async function handleToggle(id: string) {
    const updated = await toggleTask(id);
    setTasks(updated);
  }

  async function handleDelete(id: string) {
    const updated = await deleteTask(id);
    setTasks(updated);
  }

  async function handleUpdate(updatedTask: Task) {
    const updated = await updateTask(updatedTask.id, updatedTask);
    setTasks(updated);
    setSelectedTask(updatedTask);
  }

  const filters = [
    { key: 'all', label: '全部', count: tasks.filter((t) => !t.completed).length },
    ...Array.from(new Set(tasks.filter((t) => !t.completed).map((t) => t.category)))
      .map((cat) => ({
        key: cat,
        label: cat,
        count: tasks.filter((t) => t.category === cat && !t.completed).length,
      })),
    { key: 'done', label: '✓', count: tasks.filter((t) => t.completed).length },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerDate}>{today}</Text>
            <View style={styles.titleRow}>
              <Text style={styles.appTitle}>待辦</Text>
              {pendingCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingCount}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={onOpenSettings} style={styles.settingsBtn}>
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>

        {/* Filter bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterBarContent}
        >
          {filters.map((f) => {
            const isActive = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                  {f.label}{f.count > 0 ? `  ${f.count}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Task list */}
        <FlatList
          data={filteredTasks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onPress={setSelectedTask}
            />
          )}
          ListEmptyComponent={<EmptyState filter={filter} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6B85F0"
              colors={['#6B85F0']}
            />
          }
        />

        {/* FAB — 底部置中 */}
        <View style={styles.fabWrapper} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <MicIcon size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <VoiceModal
          visible={modalVisible}
          apiKey={apiKey}
          onClose={() => setModalVisible(false)}
          onAdd={handleAdd}
        />

        <TaskDetailModal
          task={selectedTask}
          visible={selectedTask !== null}
          onClose={() => setSelectedTask(null)}
          onSave={handleUpdate}
        />
      </View>
    </SafeAreaView>
  );
}

function EmptyState({ filter }: { filter: FilterType }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>
        {filter === 'all' ? '◎' : filter === 'done' ? '✓' : '○'}
      </Text>
      <Text style={styles.emptyTitle}>
        {filter === 'all'
          ? '沒有待辦'
          : filter === 'done'
          ? '尚無完成紀錄'
          : `無「${filter}」項目`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0E0E11',
  },
  container: {
    flex: 1,
    backgroundColor: '#0E0E11',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerDate: {
    fontSize: 12,
    color: '#7878A0',
    fontWeight: '500',
    letterSpacing: 1,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#EAEAF0',
    letterSpacing: -1,
  },
  badge: {
    backgroundColor: '#6B85F0',
    borderRadius: 12,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  settingsBtn: {
    padding: 6,
    marginBottom: 4,
  },
  settingsIcon: {
    fontSize: 20,
    color: '#7878A0',
  },
  filterBar: {
    flexGrow: 0,
  },
  filterBarContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#40406A',
  },
  filterChipActive: {
    backgroundColor: '#6B85F0',
    borderColor: '#6B85F0',
  },
  filterText: {
    fontSize: 13,
    color: '#7878A0',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 130,
  },
  fabWrapper: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fab: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#6B85F0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6B85F0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 12,
  },
  emptyContainer: {
    paddingTop: 100,
    alignItems: 'center',
    gap: 14,
  },
  emptyIcon: {
    fontSize: 44,
    color: '#404060',
  },
  emptyTitle: {
    fontSize: 15,
    color: '#606080',
    fontWeight: '500',
  },
});
