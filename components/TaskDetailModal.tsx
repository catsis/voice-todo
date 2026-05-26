import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Task } from '../types/task';
import { CategoryBadge, PriorityBadge } from './TagBadge';

interface Props {
  task: Task | null;
  visible: boolean;
  onClose: () => void;
  onSave: (updated: Task) => void;
}

// ── 日期選擇器（與 VoiceModal 相同邏輯）─────────────────────────
const ITEM_H = 48;
const todayDate = new Date();
const YEARS = [todayDate.getFullYear(), todayDate.getFullYear() + 1, todayDate.getFullYear() + 2];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function PickerColumn({ items, selectedValue, onSelect, label }: {
  items: number[]; selectedValue: number;
  onSelect: (v: number) => void; label: string;
}) {
  const ref = useRef<ScrollView>(null);
  const idx = items.indexOf(selectedValue);

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: Math.max(0, idx) * ITEM_H, animated: false });
    }, 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    ref.current?.scrollTo({ y: Math.max(0, idx) * ITEM_H, animated: true });
  }, [idx]);

  function onEnd(e: any) {
    const i = Math.max(0, Math.min(Math.round(e.nativeEvent.contentOffset.y / ITEM_H), items.length - 1));
    onSelect(items[i]);
  }

  return (
    <View style={col.wrap}>
      <View style={col.scrollWrap}>
        <ScrollView
          ref={ref}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          onMomentumScrollEnd={onEnd}
          onScrollEndDrag={onEnd}
          contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        >
          {items.map((v) => (
            <View key={v} style={col.item}>
              <Text style={[col.text, v === selectedValue && col.textSel]}>
                {String(v)}
              </Text>
            </View>
          ))}
        </ScrollView>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={{ height: ITEM_H * 2 }} />
          <View style={col.highlight} />
        </View>
      </View>
      <Text style={col.label}>{label}</Text>
    </View>
  );
}

const col = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center' },
  scrollWrap: { height: ITEM_H * 5, overflow: 'hidden', width: '100%' },
  item: { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 20, color: '#40405A', fontWeight: '400' },
  textSel: { fontSize: 22, color: '#EAEAF0', fontWeight: '700' },
  highlight: {
    height: ITEM_H, marginHorizontal: 6,
    backgroundColor: 'rgba(107,133,240,0.12)',
    borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(107,133,240,0.22)',
  },
  label: { fontSize: 12, color: '#7878A0', marginTop: 8, fontWeight: '500' },
});

// ── 工具 ──────────────────────────────────────────────────────────
function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${year}/${month}/${day}  週${weekdays[d.getDay()]}  ${hours}:${mins}`;
}

// ── 主元件 ──────────────────────────────────────────────────────
export default function TaskDetailModal({ task, visible, onClose, onSave }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [editAction, setEditAction] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(todayDate.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(todayDate.getMonth() + 1);
  const [pickerDay, setPickerDay] = useState(todayDate.getDate());

  const maxDay = getDaysInMonth(pickerYear, pickerMonth);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  useEffect(() => {
    if (pickerDay > getDaysInMonth(pickerYear, pickerMonth)) {
      setPickerDay(getDaysInMonth(pickerYear, pickerMonth));
    }
  }, [pickerYear, pickerMonth]);

  useEffect(() => {
    if (!visible) {
      setIsEditing(false);
      setShowDatePicker(false);
    }
  }, [visible]);

  if (!task) return null;

  function handleStartEdit() {
    setEditAction(task!.action);
    setEditTarget(task!.target);
    setEditTime(task!.time ?? '');
    setEditNotes(task!.notes ?? '');
    setIsUrgent(task!.priority === 'urgent');
    if (task!.time) {
      const parts = task!.time.split('/');
      if (parts.length === 3) {
        setPickerYear(parseInt(parts[0]) || todayDate.getFullYear());
        setPickerMonth(parseInt(parts[1]) || todayDate.getMonth() + 1);
        setPickerDay(parseInt(parts[2]) || todayDate.getDate());
      }
    } else {
      setPickerYear(todayDate.getFullYear());
      setPickerMonth(todayDate.getMonth() + 1);
      setPickerDay(todayDate.getDate());
    }
    setIsEditing(true);
  }

  function handleCancel() {
    if (showDatePicker) {
      setShowDatePicker(false);
    } else {
      setIsEditing(false);
    }
  }

  function handleSave() {
    const updated: Task = {
      ...task!,
      action: editAction.trim() || task!.action,
      target: editTarget.trim() || task!.target,
      time: editTime || undefined,
      notes: editNotes.trim() || undefined,
      priority: isUrgent ? 'urgent' : 'normal',
      category: editAction.trim() || task!.category,
    };
    onSave(updated);
    setIsEditing(false);
  }

  function confirmDate() {
    setEditTime(`${pickerYear}/${pickerMonth}/${pickerDay}`);
    setShowDatePicker(false);
  }

  function handleBackPress() {
    if (showDatePicker) {
      setShowDatePicker(false);
    } else if (isEditing) {
      setIsEditing(false);
    } else {
      onClose();
    }
  }

  const headerTitle = isEditing ? '編輯' : '詳情';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleBackPress}
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

          {/* Header */}
          <View style={styles.header}>
            {isEditing ? (
              <TouchableOpacity onPress={handleCancel} style={styles.headerBtn}>
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleStartEdit} style={styles.headerBtn}>
                <Text style={styles.editText}>✎ 編輯</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.title}>{headerTitle}</Text>
            {isEditing ? (
              <TouchableOpacity
                onPress={handleSave}
                style={styles.headerBtn}
                disabled={!editTarget.trim()}
              >
                <Text style={[styles.saveText, !editTarget.trim() && styles.saveTextOff]}>儲存</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* 日期選擇器覆蓋 */}
          {showDatePicker && (
            <View style={styles.dateOverlay}>
              <View style={styles.dateHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.dateBtn}>
                  <Text style={styles.dateCancel}>取消</Text>
                </TouchableOpacity>
                <Text style={styles.dateTitle}>選擇日期</Text>
                <TouchableOpacity onPress={confirmDate} style={styles.dateBtn}>
                  <Text style={styles.dateConfirm}>確認</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.dateCols}>
                <PickerColumn items={YEARS} selectedValue={pickerYear} onSelect={setPickerYear} label="年" />
                <PickerColumn items={MONTHS} selectedValue={pickerMonth} onSelect={setPickerMonth} label="月" />
                <PickerColumn items={days} selectedValue={pickerDay} onSelect={setPickerDay} label="日" />
              </View>
            </View>
          )}

          {/* 檢視模式 */}
          {!isEditing && !showDatePicker && (
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <View style={styles.heroCard}>
                <Text style={styles.heroAction}>{task.action}</Text>
                <Text style={styles.heroTarget}>{task.target}</Text>
                <View style={styles.heroBadges}>
                  <CategoryBadge category={task.category} />
                  <PriorityBadge priority={task.priority} />
                  {task.completed && (
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedBadgeText}>✓  已完成</Text>
                    </View>
                  )}
                </View>
              </View>

              {task.time && (
                <View style={styles.row}>
                  <Text style={styles.rowIcon}>◷</Text>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>時間</Text>
                    <Text style={styles.rowValue}>{task.time}</Text>
                  </View>
                </View>
              )}

              <View style={styles.row}>
                <Text style={styles.rowIcon}>⊕</Text>
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>新增於</Text>
                  <Text style={styles.rowValue}>{formatDateTime(task.createdAt)}</Text>
                </View>
              </View>

              {task.notes ? (
                <View style={styles.row}>
                  <Text style={styles.rowIcon}>◈</Text>
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>備註</Text>
                    <Text style={styles.rowValue}>{task.notes}</Text>
                  </View>
                </View>
              ) : null}

              {task.rawText ? (
                <View style={styles.rawCard}>
                  <Text style={styles.rawLabel}>語音原文</Text>
                  <Text style={styles.rawText}>「{task.rawText}」</Text>
                </View>
              ) : null}
            </ScrollView>
          )}

          {/* 編輯模式 */}
          {isEditing && !showDatePicker && (
            <>
              <ScrollView
                contentContainerStyle={styles.body}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* 動作/名稱 */}
                <View style={styles.fieldCard}>
                  <Text style={styles.fieldLabel}>動作／分類</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editAction}
                    onChangeText={setEditAction}
                    placeholder="例：買、寄、回電"
                    placeholderTextColor="#646490"
                  />
                </View>

                <View style={styles.fieldCard}>
                  <Text style={styles.fieldLabel}>名稱</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editTarget}
                    onChangeText={setEditTarget}
                    placeholder="對象或物品"
                    placeholderTextColor="#646490"
                  />
                </View>

                {/* 時間 */}
                <TouchableOpacity
                  style={styles.fieldCard}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.fieldLabel}>時間</Text>
                  <View style={styles.timeRow}>
                    <Text style={[styles.fieldInput, !editTime && styles.fieldPlaceholder, { flex: 1 }]}>
                      {editTime || '選擇日期'}
                    </Text>
                    {editTime ? (
                      <TouchableOpacity
                        onPress={() => setEditTime('')}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Text style={styles.timeClear}>✕</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>

                {/* 備註 */}
                <View style={styles.fieldCard}>
                  <Text style={styles.fieldLabel}>備註</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.notesInput]}
                    value={editNotes}
                    onChangeText={setEditNotes}
                    placeholder="補充說明（選填）"
                    placeholderTextColor="#646490"
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                {/* 優先級 */}
                <TouchableOpacity
                  style={[styles.urgentToggle, isUrgent && styles.urgentToggleOn]}
                  onPress={() => setIsUrgent(!isUrgent)}
                >
                  <Text style={[styles.urgentToggleText, isUrgent && styles.urgentToggleTextOn]}>
                    {isUrgent ? '● 緊急' : '○ 一般'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>

              {/* 儲存按鈕（底部固定） */}
              <View style={styles.saveBtnWrap}>
                <TouchableOpacity
                  style={[styles.saveBtn, !editTarget.trim() && styles.saveBtnOff]}
                  onPress={handleSave}
                  disabled={!editTarget.trim()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.saveBtnText}>儲存</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E0E11' },
  container: { flex: 1, backgroundColor: '#0E0E11' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#282840',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#EAEAF0' },
  headerBtn: { minWidth: 60, paddingVertical: 4, paddingHorizontal: 2 },
  editText: { fontSize: 14, color: '#6B85F0', fontWeight: '600' },
  cancelText: { fontSize: 14, color: '#7878A0' },
  saveText: { fontSize: 14, color: '#6B85F0', fontWeight: '700', textAlign: 'right' },
  saveTextOff: { color: '#40406A' },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  closeBtnText: { fontSize: 18, color: '#7878A0' },

  // View mode
  body: { padding: 20, gap: 10 },
  heroCard: {
    backgroundColor: '#17171C', borderRadius: 16, padding: 20, marginBottom: 4, gap: 8,
  },
  heroAction: {
    fontSize: 11, fontWeight: '700', color: '#6B85F0',
    letterSpacing: 1.5, textTransform: 'uppercase',
  },
  heroTarget: { fontSize: 24, fontWeight: '800', color: '#EAEAF0', lineHeight: 32 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  completedBadge: {
    backgroundColor: 'rgba(61, 204, 136, 0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  completedBadgeText: { fontSize: 12, color: '#3DCC88', fontWeight: '600' },
  row: {
    backgroundColor: '#17171C', borderRadius: 12, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  rowIcon: { fontSize: 16, color: '#7878A0', marginTop: 1 },
  rowContent: { flex: 1 },
  rowLabel: {
    fontSize: 11, color: '#646490', fontWeight: '600',
    marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  rowValue: { fontSize: 15, color: '#EAEAF0', fontWeight: '500' },
  rawCard: {
    backgroundColor: '#17171C', borderRadius: 12, padding: 16,
    borderLeftWidth: 2, borderLeftColor: '#6B85F0',
  },
  rawLabel: {
    fontSize: 11, color: '#6B85F0', fontWeight: '700',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  rawText: { fontSize: 14, color: '#7878A0', fontStyle: 'italic', lineHeight: 20 },

  // Edit mode
  fieldCard: { backgroundColor: '#17171C', borderRadius: 12, padding: 14 },
  fieldLabel: {
    fontSize: 11, color: '#646490', fontWeight: '600',
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  fieldInput: {
    fontSize: 16, color: '#EAEAF0',
    borderBottomWidth: 1, borderBottomColor: '#40406A', paddingVertical: 4,
  },
  fieldPlaceholder: { color: '#646490' },
  notesInput: { minHeight: 56, borderBottomWidth: 0 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeClear: { fontSize: 14, color: '#646490', padding: 2 },
  urgentToggle: {
    backgroundColor: '#17171C', borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#40406A',
  },
  urgentToggleOn: {
    backgroundColor: 'rgba(245,101,101,0.08)', borderColor: 'rgba(245,101,101,0.3)',
  },
  urgentToggleText: { fontSize: 14, color: '#646490', fontWeight: '500' },
  urgentToggleTextOn: { color: '#F56565', fontWeight: '700' },
  saveBtnWrap: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#282840',
  },
  saveBtn: {
    backgroundColor: '#6B85F0', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#6B85F0', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  saveBtnOff: { backgroundColor: '#1C1C28', shadowOpacity: 0, elevation: 0 },
  saveBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },

  // Date picker
  dateOverlay: { flex: 1, backgroundColor: '#0E0E11' },
  dateHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#282840',
  },
  dateBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  dateTitle: { fontSize: 16, fontWeight: '700', color: '#EAEAF0' },
  dateCancel: { fontSize: 15, color: '#7878A0' },
  dateConfirm: { fontSize: 15, color: '#6B85F0', fontWeight: '700' },
  dateCols: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 24 },
});
