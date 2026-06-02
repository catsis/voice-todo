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
import { Task, Priority } from '../types/task';
import { CategoryBadge, PriorityBadge } from './TagBadge';
import ImagePickerSection from './ImagePickerSection';
import ImageViewer from './ImageViewer';
import { C, S, F, TS } from '../lib/theme';

interface Props {
  task: Task | null;
  visible: boolean;
  onClose: () => void;
  onSave: (updated: Task) => void;
}

// ── 日期選擇器 ──────────────────────────────────────────────────
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
  text: { fontSize: 20, color: C.textDisabled, fontFamily: F.regular },
  textSel: { fontSize: 22, color: C.textPrimary, fontFamily: F.semiBold },
  highlight: {
    height: ITEM_H, marginHorizontal: 6,
    backgroundColor: C.interactiveHighlight,
    borderRadius: 4, borderWidth: 1,
    borderColor: C.interactiveBorder,
  },
  label: { fontSize: TS.label01, color: C.textSecondary, marginTop: S.s03, fontFamily: F.regular },
});

// ── 工具 ────────────────────────────────────────────────────────
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
  const [editPriority, setEditPriority] = useState<Priority>('normal');
  const [editImages, setEditImages]     = useState<string[]>([]);
  const [viewerIndex, setViewerIndex]   = useState(-1);
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
      setViewerIndex(-1);
    }
  }, [visible]);

  if (!task) return null;

  function handleStartEdit() {
    setEditAction(task!.action);
    setEditTarget(task!.target);
    setEditTime(task!.time ?? '');
    setEditNotes(task!.notes ?? '');
    setEditPriority(task!.priority);
    setEditImages(task!.images ?? []);
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
      images: editImages.length > 0 ? editImages : undefined,
      priority: editPriority,
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
    if (viewerIndex >= 0) { setViewerIndex(-1); return; }
    if (showDatePicker) { setShowDatePicker(false); }
    else if (isEditing) { setIsEditing(false); }
    else { onClose(); }
  }

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
            <Text style={styles.title}>{isEditing ? '編輯' : '詳情'}</Text>
            {isEditing ? (
              <TouchableOpacity onPress={handleSave} style={styles.headerBtn} disabled={!editTarget.trim()}>
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

              {(task.images?.length ?? 0) > 0 && (
                <View style={styles.fieldCard}>
                  <Text style={styles.fieldLabel}>照片</Text>
                  <ImagePickerSection
                    images={task.images!}
                    onView={uri => setViewerIndex(task.images!.indexOf(uri))}
                    editable={false}
                  />
                </View>
              )}

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
                <View style={styles.fieldCard}>
                  <Text style={styles.fieldLabel}>動作／分類</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editAction}
                    onChangeText={setEditAction}
                    placeholder="例：買、寄、回電"
                    placeholderTextColor={C.textPlaceholder}
                  />
                </View>

                <View style={styles.fieldCard}>
                  <Text style={styles.fieldLabel}>名稱</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={editTarget}
                    onChangeText={setEditTarget}
                    placeholder="對象或物品"
                    placeholderTextColor={C.textPlaceholder}
                  />
                </View>

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

                <View style={styles.fieldCard}>
                  <Text style={styles.fieldLabel}>備註</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.notesInput]}
                    value={editNotes}
                    onChangeText={setEditNotes}
                    placeholder="補充說明（選填）"
                    placeholderTextColor={C.textPlaceholder}
                    multiline
                    textAlignVertical="top"
                  />
                  <ImagePickerSection
                    images={editImages}
                    onChange={setEditImages}
                    onView={uri => setViewerIndex(editImages.indexOf(uri))}
                  />
                </View>

                <View style={styles.fieldCard}>
                  <Text style={styles.fieldLabel}>優先級</Text>
                  <View style={styles.prioRow}>
                    {(['normal', 'important', 'urgent'] as Priority[]).map((p) => {
                      const isOn = editPriority === p;
                      const label = p === 'normal' ? '一般' : p === 'important' ? '重要' : '緊急';
                      const onBg = p === 'urgent' ? styles.prioBtnUrgent : p === 'important' ? styles.prioBtnImportant : styles.prioBtnNormalOn;
                      return (
                        <TouchableOpacity key={p} style={[styles.prioBtn, isOn && onBg]} onPress={() => setEditPriority(p)} activeOpacity={0.7}>
                          <Text style={[styles.prioBtnText, isOn && styles.prioBtnTextOn]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

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
        <ImageViewer
          images={isEditing ? editImages : (task.images ?? [])}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(-1)}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: S.s05, paddingHorizontal: S.s06,
    borderBottomWidth: 1, borderBottomColor: C.layer02,
  },
  title: { fontSize: TS.body02, fontWeight: '600', fontFamily: F.semiBold, color: C.textPrimary },
  headerBtn: { minWidth: 60, paddingVertical: S.s02 },
  editText: { fontSize: TS.body01, color: C.interactive, fontFamily: F.regular },
  cancelText: { fontSize: TS.body01, color: C.textSecondary, fontFamily: F.regular },
  saveText: { fontSize: TS.body01, color: C.interactive, fontFamily: F.semiBold, textAlign: 'right' },
  saveTextOff: { color: C.textDisabled },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-end' },
  closeBtnText: { fontSize: 18, color: C.textSecondary },

  body: { padding: S.s06, gap: S.s03 },

  heroCard: {
    backgroundColor: C.layer01, borderRadius: 4,
    padding: S.s06, marginBottom: S.s02, gap: S.s03,
  },
  heroAction: {
    fontSize: 11, fontWeight: '600', fontFamily: F.semiBold, color: C.interactive,
    letterSpacing: 1.5, textTransform: 'uppercase',
  },
  heroTarget: { fontSize: TS.heading04, fontWeight: '700', fontFamily: F.bold, color: C.textPrimary, lineHeight: 36 },
  heroBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: S.s02, marginTop: S.s02 },
  completedBadge: {
    backgroundColor: C.supportSuccessBg, borderRadius: 4,
    paddingHorizontal: S.s03, paddingVertical: S.s02,
  },
  completedBadgeText: { fontSize: 12, color: C.supportSuccess, fontFamily: F.semiBold },

  row: {
    backgroundColor: C.layer01, borderRadius: 4, padding: S.s04,
    flexDirection: 'row', alignItems: 'flex-start', gap: S.s04,
  },
  rowIcon: { fontSize: 16, color: C.textSecondary, marginTop: 1 },
  rowContent: { flex: 1 },
  rowLabel: {
    fontSize: TS.label01, color: C.textHelper, fontFamily: F.semiBold,
    marginBottom: S.s02, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  rowValue: { fontSize: TS.body02, color: C.textPrimary, fontFamily: F.regular },

  rawCard: {
    backgroundColor: C.layer01, borderRadius: 4, padding: S.s05,
    borderLeftWidth: 2, borderLeftColor: C.interactive,
  },
  rawLabel: {
    fontSize: TS.label01, color: C.interactive, fontFamily: F.semiBold,
    marginBottom: S.s03, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  rawText: { fontSize: TS.body01, color: C.textHelper, fontFamily: F.regular, fontStyle: 'italic', lineHeight: 20 },

  fieldCard: { backgroundColor: C.layer01, borderRadius: 4, padding: S.s04 },
  fieldLabel: {
    fontSize: TS.label01, color: C.textHelper, fontFamily: F.semiBold,
    marginBottom: S.s03, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  fieldInput: {
    fontSize: TS.body02, color: C.textPrimary, fontFamily: F.regular,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle01, paddingVertical: S.s02,
  },
  fieldPlaceholder: { color: C.textPlaceholder },
  notesInput: { minHeight: 56, borderBottomWidth: 0 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: S.s03 },
  timeClear: { fontSize: 14, color: C.textHelper, padding: S.s01 },
  prioRow: { flexDirection: 'row', gap: S.s02, marginTop: S.s03 },
  prioBtn: {
    flex: 1, height: 40, borderRadius: 10,
    backgroundColor: C.layer02, borderWidth: 1, borderColor: C.borderSubtle01,
    alignItems: 'center', justifyContent: 'center',
  },
  prioBtnText: { fontSize: TS.body01, fontFamily: F.semiBold, color: C.textHelper },
  prioBtnNormalOn:  { backgroundColor: C.interactive,  borderColor: C.interactive },
  prioBtnImportant: { backgroundColor: '#f0a93b',       borderColor: '#f0a93b' },
  prioBtnUrgent:    { backgroundColor: C.supportError,  borderColor: C.supportError },
  prioBtnTextOn:    { color: '#fff' },

  saveBtnWrap: {
    paddingHorizontal: S.s06,
    paddingBottom: Platform.OS === 'ios' ? 34 : S.s06,
    paddingTop: S.s04,
    borderTopWidth: 1, borderTopColor: C.layer02,
  },
  saveBtn: {
    backgroundColor: C.buttonPrimary, borderRadius: 4,
    paddingVertical: S.s05, alignItems: 'center',
    shadowColor: C.buttonPrimary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  saveBtnOff: { backgroundColor: C.buttonDisabled, shadowOpacity: 0, elevation: 0 },
  saveBtnText: { color: C.textOnColor, fontSize: 17, fontFamily: F.semiBold, letterSpacing: 0.5 },

  dateOverlay: { flex: 1, backgroundColor: C.background },
  dateHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: S.s06, paddingVertical: S.s04,
    borderBottomWidth: 1, borderBottomColor: C.layer02,
  },
  dateBtn: { paddingHorizontal: S.s02, paddingVertical: S.s02 },
  dateTitle: { fontSize: TS.body02, fontFamily: F.semiBold, color: C.textPrimary },
  dateCancel: { fontSize: TS.body02, color: C.textSecondary, fontFamily: F.regular },
  dateConfirm: { fontSize: TS.body02, color: C.interactive, fontFamily: F.semiBold },
  dateCols: { flexDirection: 'row', paddingHorizontal: S.s05, paddingTop: S.s06 },
});
