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
  Dimensions,
} from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { ExtractedData, TaskCategory, Task } from '../types/task';
import { extractTaskFromVoice } from '../lib/claude';
import { C, S, F, TS } from '../lib/theme';

type Stage = 'idle' | 'recording' | 'transcribed' | 'processing' | 'result';

interface Props {
  visible: boolean;
  apiKey: string;
  onClose: () => void;
  onAdd: (task: Omit<Task, 'id' | 'createdAt' | 'completed'>) => void;
}

const SCREEN_H = Dimensions.get('window').height;

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

// ── 自製麥克風圖示 ────────────────────────────────────────────
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
  return <View style={{ width: s, height: s, borderRadius: 3, backgroundColor: color }} />;
}

// ── 主元件 ────────────────────────────────────────────────────
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
          Animated.timing(pulseAnim, { toValue: 1.65, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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

  function handleBackdropPress() {
    if (stage !== 'recording') onClose();
  }

  const canAdd = stage === 'result' && editTarget.trim().length > 0;
  const isResultStage = stage === 'result';
  const bottomPad = Platform.OS === 'ios' ? 34 : S.s06;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => stage !== 'recording' && onClose()}
    >
      <View style={s.overlay}>
        {/* Backdrop – tap to close */}
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />

        {/* Bottom sheet */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[s.sheet, isResultStage && s.sheetLarge]}>
            {/* Drag handle */}
            <View style={s.handle} />

            {/* ── 日期選擇器 ── */}
            {showDatePicker && (
              <View style={s.dateWrap}>
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

            {/* ── idle / recording 階段 ── */}
            {(stage === 'idle' || stage === 'recording') && !showDatePicker && (
              <View style={s.voiceStage}>
                <Text style={s.hintText}>
                  {stage === 'recording' && transcript ? transcript : '說出你要做的事…'}
                </Text>

                <View style={s.micRow}>
                  {/* 左側佔位 (對齊用) */}
                  <View style={{ width: 44 }} />

                  {/* MicFAB */}
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

                  {/* 手動輸入按鈕 (idle 才顯示) */}
                  {stage === 'idle' ? (
                    <TouchableOpacity
                      onPress={handleManualInput}
                      style={s.manualBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={s.manualBtnText}>✎</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ width: 44 }} />
                  )}
                </View>

                <View style={{ height: bottomPad }} />
              </View>
            )}

            {/* ── transcribed 階段 ── */}
            {stage === 'transcribed' && !showDatePicker && (
              <View style={s.voiceStage}>
                <TextInput
                  style={s.transcriptInput}
                  value={transcript}
                  onChangeText={setTranscript}
                  multiline
                  textAlign="center"
                  textAlignVertical="center"
                  placeholder="輸入要辦的事…"
                  placeholderTextColor={C.textDisabled}
                  autoFocus
                />

                <View style={s.transcribedRow}>
                  <TouchableOpacity onPress={startRecording} style={s.reRecordBtn}>
                    <MicIcon size={20} color={C.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAnalyze}
                    style={[s.analyzeBtn, !transcript.trim() && s.analyzeBtnOff]}
                    disabled={!transcript.trim()}
                    activeOpacity={0.85}
                  >
                    <Text style={s.analyzeBtnText}>分析</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: bottomPad }} />
              </View>
            )}

            {/* ── processing 階段 ── */}
            {stage === 'processing' && !showDatePicker && (
              <View style={s.processingArea}>
                <ActivityIndicator size="large" color={C.interactive} />
                <Text style={s.processingText}>AI 分析中</Text>
                <Text style={s.processingRaw}>「{rawInput}」</Text>
                <View style={{ height: bottomPad }} />
              </View>
            )}

            {/* ── result 階段 ── */}
            {stage === 'result' && !showDatePicker && (
              <>
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
                      placeholderTextColor={C.textPlaceholder}
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
                      placeholderTextColor={C.textPlaceholder}
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

                <View style={[s.addBtnWrap, { paddingBottom: bottomPad }]}>
                  <TouchableOpacity
                    style={[s.addBtn, !canAdd && s.addBtnOff]}
                    onPress={handleAdd}
                    disabled={!canAdd}
                    activeOpacity={0.85}
                  >
                    <Text style={s.addBtnText}>新增</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // Overlay
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },

  // Sheet
  sheet: {
    backgroundColor: C.layer01,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.borderSubtle02,
    overflow: 'hidden',
  },
  sheetLarge: {
    maxHeight: SCREEN_H * 0.82,
  },

  // Drag handle
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.borderSubtle02,
    alignSelf: 'center',
    marginTop: S.s04,
    marginBottom: S.s03,
  },

  // Date picker
  dateWrap: { paddingBottom: S.s06 },
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

  // Voice stage wrapper
  voiceStage: { paddingHorizontal: S.s07 },
  hintText: {
    fontSize: 18, color: C.textHelper, textAlign: 'center',
    fontFamily: F.regular, marginTop: S.s06, marginBottom: S.s07,
    minHeight: 60,
  },

  // Mic row (idle / recording)
  micRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.s06,
    marginBottom: S.s06,
  },
  micCenter: { alignItems: 'center' },
  micPulse: {
    position: 'absolute',
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(47,107,255,0.1)',
  },
  micPulseRec: { backgroundColor: 'rgba(255,90,106,0.1)' },
  micFab: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.buttonPrimary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: C.buttonPrimary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6, shadowRadius: 20, elevation: 14,
  },
  micFabRec: { backgroundColor: C.supportError, shadowColor: C.supportError },
  manualBtn: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: C.borderSubtle02,
    justifyContent: 'center', alignItems: 'center',
  },
  manualBtnText: { fontSize: 20, color: C.textSecondary },

  // Transcript input (transcribed stage)
  transcriptInput: {
    fontSize: 20, color: C.textPrimary, textAlign: 'center',
    fontFamily: F.regular, width: '100%',
    paddingVertical: S.s05, lineHeight: 30,
    minHeight: 80, marginTop: S.s04,
  },
  transcribedRow: {
    flexDirection: 'row', gap: S.s04, alignItems: 'center', marginBottom: S.s06,
  },
  reRecordBtn: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 1.5, borderColor: C.borderSubtle02,
    justifyContent: 'center', alignItems: 'center',
  },
  analyzeBtn: {
    flex: 1, backgroundColor: C.buttonPrimary, borderRadius: 12,
    paddingVertical: 17, alignItems: 'center',
    shadowColor: C.buttonPrimary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  analyzeBtnOff: { backgroundColor: C.layer02, shadowOpacity: 0, elevation: 0 },
  analyzeBtnText: { color: C.textOnColor, fontSize: 17, fontFamily: F.semiBold },

  // Processing stage
  processingArea: {
    justifyContent: 'center', alignItems: 'center',
    gap: S.s05, paddingVertical: S.s09,
  },
  processingText: { fontSize: TS.body02, color: C.interactive, fontFamily: F.semiBold },
  processingRaw: { fontSize: TS.body01, color: C.textHelper, fontFamily: F.regular, fontStyle: 'italic' },

  // Result stage
  resultBody: { padding: S.s06, gap: S.s03, paddingBottom: S.s04 },
  autoCard: {
    backgroundColor: C.layer02, borderRadius: 12, padding: S.s04,
    borderLeftWidth: 2, borderLeftColor: C.interactive, gap: S.s03,
  },
  autoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: S.s03 },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 9,
    paddingHorizontal: S.s03, paddingVertical: S.s02,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  statusBadgeText: { fontSize: 13, color: C.textSecondary, fontFamily: F.semiBold },
  actionBadge: {
    backgroundColor: C.interactiveBg, borderRadius: 9,
    paddingHorizontal: S.s03, paddingVertical: S.s02,
  },
  actionBadgeText: { fontSize: 13, color: C.interactive, fontFamily: F.semiBold },
  urgentBadge: {
    backgroundColor: C.supportErrorBg, borderRadius: 9,
    paddingHorizontal: S.s03, paddingVertical: S.s02,
  },
  urgentBadgeText: { fontSize: 13, color: C.supportError, fontFamily: F.semiBold },
  autoRaw: { fontSize: TS.body01, color: C.textHelper, fontFamily: F.regular, fontStyle: 'italic' },

  fieldCard: { backgroundColor: C.layer02, borderRadius: 12, padding: S.s04 },
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

  urgentToggle: {
    backgroundColor: C.layer02, borderRadius: 12, padding: S.s04,
    alignItems: 'center', borderWidth: 1, borderColor: C.borderSubtle01,
  },
  urgentToggleOn: {
    backgroundColor: C.supportErrorBg, borderColor: C.supportErrorBorder,
  },
  urgentToggleText: { fontSize: TS.body01, color: C.textHelper, fontFamily: F.regular },
  urgentToggleTextOn: { color: C.supportError, fontFamily: F.semiBold },

  addBtnWrap: {
    paddingHorizontal: S.s06,
    paddingTop: S.s04,
    borderTopWidth: 1, borderTopColor: C.layer02,
  },
  addBtn: {
    backgroundColor: C.buttonPrimary, borderRadius: 12,
    paddingVertical: S.s05, alignItems: 'center',
    shadowColor: C.buttonPrimary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  addBtnOff: { backgroundColor: C.buttonDisabled, shadowOpacity: 0, elevation: 0 },
  addBtnText: { color: C.textOnColor, fontSize: 17, fontFamily: F.semiBold, letterSpacing: 0.5 },
});
