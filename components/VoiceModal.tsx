import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Animated,
  Easing,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { ExtractedData, TaskCategory, Task } from '../types/task';
import { extractTaskFromVoice } from '../lib/claude';

type Stage = 'idle' | 'recording' | 'transcribed' | 'processing' | 'result';

interface Props {
  visible: boolean;
  apiKey: string;
  onClose: () => void;
  onAdd: (task: Omit<Task, 'id' | 'createdAt' | 'completed'>) => void;
}

// ── 日期選擇器 ──────────────────────────────────────────────────
const ITEM_H = 48;
const today = new Date();
const CURRENT_YEAR = today.getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function PickerColumn({
  items, selectedValue, onSelect, label,
}: {
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

// ── 自製麥克風圖示 ───────────────────────────────────────────────
export function MicIcon({ size = 28, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const bw = Math.max(2, Math.round(size * 0.065));
  const bW = Math.round(size * 0.36);
  const bH = Math.round(size * 0.52);
  const aW = Math.round(size * 0.65);
  const aH = Math.round(size * 0.28);
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: bW, height: bH, borderRadius: bW / 2, backgroundColor: color }} />
      <View style={{
        width: aW, height: aH, marginTop: 1,
        borderLeftWidth: bw, borderRightWidth: bw, borderBottomWidth: bw,
        borderColor: color,
        borderBottomLeftRadius: aW / 2, borderBottomRightRadius: aW / 2,
      }} />
      <View style={{ width: bw, height: Math.round(size * 0.1), backgroundColor: color }} />
      <View style={{ width: Math.round(size * 0.5), height: bw, backgroundColor: color, borderRadius: bw / 2 }} />
    </View>
  );
}

function StopIcon({ size = 20, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const s = Math.round(size * 0.52);
  return <View style={{ width: s, height: s, borderRadius: 4, backgroundColor: color }} />;
}

// ── 主元件 ──────────────────────────────────────────────────────
export default function VoiceModal({ visible, apiKey, onClose, onAdd }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [transcript, setTranscript] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [editAction, setEditAction] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCategory, setEditCategory] = useState<TaskCategory>('');
  const [isUrgent, setIsUrgent] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth() + 1);
  const [pickerDay, setPickerDay] = useState(today.getDate());

  const maxDay = getDaysInMonth(pickerYear, pickerMonth);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  useEffect(() => {
    if (pickerDay > getDaysInMonth(pickerYear, pickerMonth)) {
      setPickerDay(getDaysInMonth(pickerYear, pickerMonth));
    }
  }, [pickerYear, pickerMonth]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (stage === 'recording') {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.6, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [stage]);

  useEffect(() => {
    if (!visible) {
      setStage('idle');
      setTranscript('');
      setRawInput('');
      setExtracted(null);
      setEditNotes('');
      setShowDatePicker(false);
    }
  }, [visible]);

  useSpeechRecognitionEvent('result', (event) => {
    setTranscript(event.results[0]?.transcript ?? '');
  });

  useSpeechRecognitionEvent('end', () => {
    if (stage === 'recording') {
      setStage(transcript.trim() ? 'transcribed' : 'idle');
    }
  });

  useSpeechRecognitionEvent('error', () => setStage('idle'));

  async function startRecording() {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('需要麥克風權限', '請在設定中允許麥克風存取。');
      return;
    }
    setTranscript('');
    setStage('recording');
    ExpoSpeechRecognitionModule.start({ lang: 'zh-TW', interimResults: true });
  }

  function stopRecording() {
    ExpoSpeechRecognitionModule.stop();
  }

  function handleMicPress() {
    if (stage === 'idle') startRecording();
    else if (stage === 'recording') stopRecording();
  }

  function handleManualInput() {
    setTranscript('');
    setStage('transcribed');
  }

  async function handleAnalyze() {
    const text = transcript.trim();
    if (!text || !apiKey) {
      if (!apiKey) Alert.alert('缺少 API Key', '請先到設定頁面輸入 Anthropic API Key。');
      return;
    }
    setRawInput(text);
    setStage('processing');
    try {
      const result = await extractTaskFromVoice(text, apiKey);
      setExtracted(result);
      setEditAction(result.action);
      setEditTarget(result.target);
      setEditTime(result.time ?? '');
      setEditCategory(result.category);
      setIsUrgent(result.priority === 'urgent');
      setStage('result');
    } catch {
      Alert.alert('分析失敗', '請確認 API Key 是否正確，或稍後再試。');
      setStage('transcribed');
    }
  }

  function handleAdd() {
    if (!editTarget.trim()) return;
    onAdd({
      rawText: rawInput,
      action: editAction,
      target: editTarget,
      time: editTime || undefined,
      notes: editNotes || undefined,
      priority: isUrgent ? 'urgent' : 'normal',
      category: editCategory,
    });
    onClose();
  }

  function confirmDate() {
    setEditTime(`${pickerYear}/${pickerMonth}/${pickerDay}`);
    setShowDatePicker(false);
  }

  const canAdd = stage === 'result' && editTarget.trim().length > 0;
  const isVoiceStage = stage === 'idle' || stage === 'recording' || stage === 'transcribed';

  const headerTitle =
    stage === 'result' ? '確認內容'
    : stage === 'processing' ? 'AI 分析中'
    : '語音輸入';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top']}>
        <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={s.title}>{headerTitle}</Text>
            <View style={{ width: 44 }} />
          </View>

          {/* Date picker 覆蓋 */}
          {showDatePicker && (
            <View style={s.dateOverlay}>
              <View style={s.dateHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)} style={s.dateBtn}>
                  <Text style={s.dateCancel}>取消</Text>
                </TouchableOpacity>
                <Text style={s.dateTitle}>選擇日期</Text>
                <TouchableOpacity onPress={confirmDate} style={s.dateBtn}>
                  <Text style={s.dateConfirm}>確認</Text>
                </TouchableOpacity>
              </View>
              <View style={s.dateCols}>
                <PickerColumn items={YEARS} selectedValue={pickerYear} onSelect={setPickerYear} label="年" />
                <PickerColumn items={MONTHS} selectedValue={pickerMonth} onSelect={setPickerMonth} label="月" />
                <PickerColumn items={days} selectedValue={pickerDay} onSelect={setPickerDay} label="日" />
              </View>
            </View>
          )}

          {/* ── 語音輸入階段 ── */}
          {isVoiceStage && !showDatePicker && (
            <View style={s.voiceWrap}>
              {/* 中央：轉錄文字 */}
              <View style={s.voiceCenter}>
                {transcript || stage === 'transcribed' ? (
                  <TextInput
                    style={s.transcriptInput}
                    value={transcript}
                    onChangeText={stage !== 'recording' ? setTranscript : undefined}
                    editable={stage !== 'recording'}
                    multiline
                    textAlign="center"
                    textAlignVertical="center"
                    placeholder="說出你要做的事…"
                    placeholderTextColor="#40405A"
                  />
                ) : (
                  <Text style={s.hintText}>說出你要做的事…</Text>
                )}
              </View>

              {/* 底部操作區 */}
              <View style={s.micBar}>
                {stage === 'transcribed' ? (
                  <View style={s.transcribedRow}>
                    {/* 重新錄音 */}
                    <TouchableOpacity onPress={startRecording} style={s.reRecordBtn}>
                      <MicIcon size={20} color="#7878A0" />
                    </TouchableOpacity>
                    {/* 分析 */}
                    <TouchableOpacity
                      onPress={handleAnalyze}
                      style={[s.analyzeBtn, !transcript.trim() && s.analyzeBtnOff]}
                      disabled={!transcript.trim()}
                      activeOpacity={0.85}
                    >
                      <Text style={s.analyzeBtnText}>分析</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={s.micRowWrap}>
                    {/* 左側佔位符，使麥克風保持視覺置中 */}
                    {stage === 'idle' && <View style={s.micSpacer} />}

                    <View style={s.micCenter}>
                      <Animated.View style={[
                        s.micPulse,
                        { transform: [{ scale: pulseAnim }] },
                        stage === 'recording' && s.micPulseRec,
                      ]} />
                      <TouchableOpacity
                        onPress={handleMicPress}
                        style={[s.micFab, stage === 'recording' && s.micFabRec]}
                        activeOpacity={0.85}
                      >
                        {stage === 'recording'
                          ? <StopIcon size={28} />
                          : <MicIcon size={28} />}
                      </TouchableOpacity>
                    </View>

                    {/* 手動輸入按鈕，僅 idle 顯示 */}
                    {stage === 'idle' && (
                      <TouchableOpacity
                        onPress={handleManualInput}
                        style={s.manualBtn}
                        activeOpacity={0.7}
                      >
                        <Text style={s.manualBtnText}>✎</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── 分析中 ── */}
          {stage === 'processing' && !showDatePicker && (
            <View style={s.processingArea}>
              <ActivityIndicator size="large" color="#6B85F0" />
              <Text style={s.processingText}>AI 分析中</Text>
              <Text style={s.processingRaw}>「{rawInput}」</Text>
            </View>
          )}

          {/* ── 確認結果 ── */}
          {stage === 'result' && !showDatePicker && (
            <ScrollView
              contentContainerStyle={s.resultBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={s.autoCard}>
                <View style={s.autoRow}>
                  <View style={s.statusBadge}>
                    <Text style={s.statusBadgeText}>待辦</Text>
                  </View>
                  {editAction && editAction !== '待辦' && (
                    <View style={s.actionBadge}>
                      <Text style={s.actionBadgeText}>{editAction}</Text>
                    </View>
                  )}
                  {isUrgent && (
                    <View style={s.urgentBadge}>
                      <Text style={s.urgentBadgeText}>急</Text>
                    </View>
                  )}
                </View>
                <Text style={s.autoRaw}>「{rawInput}」</Text>
              </View>

              <View style={s.fieldCard}>
                <Text style={s.fieldLabel}>名稱</Text>
                <TextInput
                  style={s.fieldInput}
                  value={editTarget}
                  onChangeText={setEditTarget}
                  placeholder="對象或物品"
                  placeholderTextColor="#646490"
                />
              </View>

              <TouchableOpacity style={s.fieldCard} onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                <Text style={s.fieldLabel}>時間</Text>
                <Text style={[s.fieldInput, !editTime && s.fieldPlaceholder]}>
                  {editTime || '選擇日期'}
                </Text>
              </TouchableOpacity>

              <View style={s.fieldCard}>
                <Text style={s.fieldLabel}>備註</Text>
                <TextInput
                  style={[s.fieldInput, s.notesInput]}
                  value={editNotes}
                  onChangeText={setEditNotes}
                  placeholder="補充說明（選填）"
                  placeholderTextColor="#646490"
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <TouchableOpacity
                style={[s.urgentToggle, isUrgent && s.urgentToggleOn]}
                onPress={() => setIsUrgent(!isUrgent)}
              >
                <Text style={[s.urgentToggleText, isUrgent && s.urgentToggleTextOn]}>
                  {isUrgent ? '● 緊急' : '○ 一般'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* 新增按鈕 */}
          {stage === 'result' && !showDatePicker && (
            <View style={s.addBtnWrap}>
              <TouchableOpacity
                style={[s.addBtn, !canAdd && s.addBtnOff]}
                onPress={handleAdd}
                disabled={!canAdd}
                activeOpacity={0.85}
              >
                <Text style={s.addBtnText}>新增</Text>
              </TouchableOpacity>
            </View>
          )}

        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0E0E11' },
  container: { flex: 1, backgroundColor: '#0E0E11' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: '#282840',
  },
  closeBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { fontSize: 18, color: '#7878A0' },
  title: { fontSize: 16, fontWeight: '700', color: '#EAEAF0' },

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

  // Voice stage
  voiceWrap: { flex: 1, flexDirection: 'column' },
  voiceCenter: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 32,
  },
  hintText: { fontSize: 18, color: '#35355A', textAlign: 'center' },
  transcriptInput: {
    fontSize: 22, color: '#EAEAF0', textAlign: 'center',
    width: '100%', padding: 16, lineHeight: 32,
  },

  // Mic bar
  micBar: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 44 : 36,
    paddingTop: 16,
  },
  micRowWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  micSpacer: { width: 44 },
  micCenter: { alignItems: 'center' },
  manualBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: '#40406A',
    justifyContent: 'center', alignItems: 'center',
  },
  manualBtnText: { fontSize: 20, color: '#7878A0' },
  micPulse: {
    position: 'absolute',
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(107,133,240,0.1)',
  },
  micPulseRec: { backgroundColor: 'rgba(245,101,101,0.1)' },
  micFab: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#6B85F0',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#6B85F0', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 22, elevation: 14,
  },
  micFabRec: { backgroundColor: '#F56565', shadowColor: '#F56565' },

  // Transcribed actions
  transcribedRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  reRecordBtn: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 1.5, borderColor: '#40406A',
    justifyContent: 'center', alignItems: 'center',
  },
  analyzeBtn: {
    flex: 1, backgroundColor: '#6B85F0', borderRadius: 14,
    paddingVertical: 17, alignItems: 'center',
    shadowColor: '#6B85F0', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  analyzeBtnOff: { backgroundColor: '#1C1C28', shadowOpacity: 0, elevation: 0 },
  analyzeBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },

  // Processing
  processingArea: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  processingText: { fontSize: 16, color: '#6B85F0', fontWeight: '600' },
  processingRaw: { fontSize: 14, color: '#646490', fontStyle: 'italic' },

  // Result
  resultBody: { padding: 20, gap: 10, paddingBottom: 16 },
  autoCard: {
    backgroundColor: '#17171C', borderRadius: 12, padding: 14,
    borderLeftWidth: 2, borderLeftColor: '#6B85F0', gap: 8,
  },
  autoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  statusBadgeText: { fontSize: 13, color: '#8888A8', fontWeight: '600' },
  actionBadge: {
    backgroundColor: 'rgba(107,133,240,0.18)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  actionBadgeText: { fontSize: 13, color: '#6B85F0', fontWeight: '700' },
  urgentBadge: {
    backgroundColor: 'rgba(245,101,101,0.18)',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  urgentBadgeText: { fontSize: 13, color: '#F56565', fontWeight: '700' },
  autoRaw: { fontSize: 13, color: '#646490', fontStyle: 'italic' },

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

  urgentToggle: {
    backgroundColor: '#17171C', borderRadius: 12, padding: 14,
    alignItems: 'center', borderWidth: 1, borderColor: '#40406A',
  },
  urgentToggleOn: {
    backgroundColor: 'rgba(245,101,101,0.08)',
    borderColor: 'rgba(245,101,101,0.3)',
  },
  urgentToggleText: { fontSize: 14, color: '#646490', fontWeight: '500' },
  urgentToggleTextOn: { color: '#F56565', fontWeight: '700' },

  addBtnWrap: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#282840',
  },
  addBtn: {
    backgroundColor: '#6B85F0', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: '#6B85F0', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  addBtnOff: { backgroundColor: '#1C1C28', shadowOpacity: 0, elevation: 0 },
  addBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
});
