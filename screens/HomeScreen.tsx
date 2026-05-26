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
import { C, S, F, TS } from '../lib/theme';
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
              tintColor={C.interactive}
              colors={[C.interactive]}
            />
          }
        />

        {/* FAB */}
        <View style={styles.fabWrapper} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.fab}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <MicIcon size={26} color={C.textOnColor} />
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
  safe: { flex: 1, backgroundColor: C.background },
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: S.s06,
    paddingTop: S.s04,
    paddingBottom: S.s06,
  },
  headerDate: {
    fontSize: TS.label01,
    color: C.textSecondary,
    fontFamily: F.regular,
    letterSpacing: 1,
    marginBottom: S.s02,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s03,
  },
  appTitle: {
    fontSize: TS.heading05,
    fontFamily: F.bold,
    color: C.textPrimary,
    letterSpacing: -1,
  },
  badge: {
    backgroundColor: C.interactive,
    borderRadius: 12,
    minWidth: 26,
    height: 26,
    paddingHorizontal: S.s03,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: S.s01,
  },
  badgeText: {
    fontSize: 14,
    fontFamily: F.bold,
    color: C.textOnColor,
  },
  settingsBtn: {
    padding: S.s03,
    marginBottom: S.s02,
  },
  settingsIcon: {
    fontSize: 20,
    color: C.textSecondary,
  },
  filterBar: { flexGrow: 0 },
  filterBarContent: {
    paddingHorizontal: S.s06,
    paddingBottom: S.s05,
    gap: S.s03,
  },
  filterChip: {
    paddingHorizontal: S.s04,
    paddingVertical: S.s02,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderSubtle01,
  },
  filterChipActive: {
    backgroundColor: C.interactive,
    borderColor: C.interactive,
  },
  filterText: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: F.regular,
  },
  filterTextActive: {
    color: C.textOnColor,
    fontFamily: F.semiBold,
  },
  listContent: {
    paddingTop: S.s02,
    paddingBottom: 130,
  },
  fabWrapper: {
    position: 'absolute',
    bottom: S.s07,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fab: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.buttonPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.buttonPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 12,
  },
  emptyContainer: {
    paddingTop: 100,
    alignItems: 'center',
    gap: S.s04,
  },
  emptyIcon: {
    fontSize: 44,
    color: C.layer02,
  },
  emptyTitle: {
    fontSize: TS.body02,
    color: C.borderSubtle01,
    fontFamily: F.regular,
  },
});
