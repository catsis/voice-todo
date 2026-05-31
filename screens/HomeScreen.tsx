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

  const categoryFilters = Array.from(
    new Set(tasks.filter((t) => !t.completed).map((t) => t.category))
  ).map((cat) => ({
    key: cat,
    label: cat,
    count: tasks.filter((t) => t.category === cat && !t.completed).length,
  }));
  const doneCount = tasks.filter((t) => t.completed).length;

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

        {/* Filter bar: "全部" pinned left, rest scrollable */}
        <View style={styles.filterBar}>
          <TouchableOpacity
            onPress={() => setFilter('all')}
            style={[styles.chipAll, filter !== 'all' && styles.chipAllDim]}
            activeOpacity={0.8}
          >
            <Text style={styles.chipAllText}>全部</Text>
            {pendingCount > 0 && <Text style={styles.chipCount}>{pendingCount}</Text>}
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterScrollContent}
          >
            {categoryFilters.map((f) => (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, filter === f.key && styles.chipActive]}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
                  {f.label}
                </Text>
                {f.count > 0 && <Text style={styles.chipCount}>{f.count}</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setFilter('done')}
              style={[styles.chipDone, filter !== 'done' && styles.chipDoneDim]}
              activeOpacity={0.8}
            >
              <Text style={styles.chipDoneText}>完成</Text>
              {doneCount > 0 && <Text style={styles.chipDoneCount}>{doneCount}</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>

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
    borderRadius: 13,
    minWidth: 30,
    height: 26,
    paddingHorizontal: S.s03,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: S.s01,
  },
  badgeText: {
    fontSize: 15,
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
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: S.s06,
    paddingBottom: S.s05,
    gap: S.s03,
  },
  filterScroll: { flex: 1 },
  filterScrollContent: {
    paddingRight: S.s06,
    gap: S.s03,
    alignItems: 'center',
  },
  // "全部" pinned chip (always blue)
  chipAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s02,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: C.interactive,
    flexShrink: 0,
  },
  chipAllDim: { opacity: 0.46 },
  chipAllText: { fontSize: 15, fontFamily: F.semiBold, color: '#fff' },
  // Category chips
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s02,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: C.layer02,
    borderWidth: 1,
    borderColor: C.borderSubtle01,
  },
  chipActive: {
    backgroundColor: C.layerHi,
    borderColor: C.borderSubtle02,
  },
  chipText: { fontSize: 15, fontFamily: F.semiBold, color: C.textSecondary },
  chipTextActive: { color: C.textPrimary },
  // Count badge on chips
  chipCount: { fontSize: 13, fontFamily: F.bold, color: 'rgba(255,255,255,0.6)' },
  // "完成" chip (always green)
  chipDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s02,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: C.supportSuccess,
  },
  chipDoneDim: { opacity: 0.46 },
  chipDoneText: { fontSize: 15, fontFamily: F.semiBold, color: '#06160d' },
  chipDoneCount: { fontSize: 13, fontFamily: F.bold, color: 'rgba(6,22,13,0.7)' },
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
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: C.buttonPrimary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: C.buttonPrimary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 14,
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
