import React, { useState, useRef, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, Easing, Platform, Alert, Keyboard,
  ScrollView, Dimensions, ActivityIndicator,
} from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { TaskCategory, Task, Priority } from '../types/task';
import ImagePickerSection from './ImagePickerSection';
import ImageViewer from './ImageViewer';
import { extractTaskFromVoice } from '../lib/claude';
import { C, S, F, TS } from '../lib/theme';

type Stage = 'recording' | 'transcribed' | 'processing' | 'result';

interface Props {
  visible: boolean;
  apiKey: string;
  onClose: () => void;
  onAdd: (task: Omit<Task, 'id' | 'createdAt' | 'completed'>) => void;
}

const SCREEN_H = Dimensions.get('window').height;

// ── Date Picker ────────────────────────────────────────────────
const ITEM_H = 48;
const today = new Date();
const CURRENT_YEAR = today.getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];
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
    const t = setTimeout(() => ref.current?.scrollTo({ y: Math.max(0, idx) * ITEM_H, animated: false }), 60);
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
        <ScrollView ref={ref} showsVerticalScrollIndicator={false} snapToInterval={ITEM_H}
          decelerationRate="fast" onMomentumScrollEnd={onEnd} onScrollEndDrag={onEnd}
          contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}>
          {items.map((v) => (
            <View key={v} style={col.item}>
              <Text style={[col.text, v === selectedValue && col.textSel]}>{String(v)}</Text>
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
    backgroundColor: C.interactiveHighlight, borderRadius: 4,
    borderWidth: 1, borderColor: C.interactiveBorder,
  },
  label: { fontSize: TS.label01, color: C.textSecondary, marginTop: S.s03, fontFamily: F.regular },
});

// ── MicIcon export (used by HomeScreen FAB) ────────────────────
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

// ── MicOrb (46px, 三種狀態：idle / live / think) ─────────────
type OrbState = 'idle' | 'live' | 'think';

function MicOrb({ state }: { state: OrbState }) {
  const r1Scale   = useRef(new Animated.Value(1)).current;
  const r1Opacity = useRef(new Animated.Value(0)).current;
  const r2Scale   = useRef(new Animated.Value(1)).current;
  const r2Opacity = useRef(new Animated.Value(0)).current;
  const spinVal   = useRef(new Animated.Value(0)).current;
  const loopsRef  = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    loopsRef.current.forEach(l => l.stop());
    loopsRef.current = [];
    r1Scale.setValue(1); r1Opacity.setValue(0);
    r2Scale.setValue(1); r2Opacity.setValue(0);
    spinVal.setValue(0);

    if (state === 'live') {
      const makeRing = (sc: Animated.Value, op: Animated.Value, delay: number) =>
        Animated.loop(Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(sc, { toValue: 1.7, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
            Animated.timing(op, { toValue: 0,   duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(sc, { toValue: 1,   duration: 0, useNativeDriver: true }),
            Animated.timing(op, { toValue: 0.6, duration: 0, useNativeDriver: true }),
          ]),
        ]));
      r1Opacity.setValue(0.6);
      r2Opacity.setValue(0.6);
      const l1 = makeRing(r1Scale, r1Opacity, 0);
      const l2 = makeRing(r2Scale, r2Opacity, 800);
      loopsRef.current = [l1, l2];
      l1.start(); l2.start();
    } else if (state === 'think') {
      const l = Animated.loop(
        Animated.timing(spinVal, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true })
      );
      loopsRef.current = [l];
      l.start();
    }
  }, [state]);

  const rotate = spinVal.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={orb.container}>
      {state === 'live' && (
        <>
          <Animated.View style={[orb.ring, { transform: [{ scale: r1Scale }], opacity: r1Opacity }]} />
          <Animated.View style={[orb.ring, { transform: [{ scale: r2Scale }], opacity: r2Opacity }]} />
        </>
      )}
      <View style={[orb.body, state === 'think' && orb.bodyThink]}>
        {state === 'think' ? (
          <Animated.View style={{ transform: [{ rotate }] }}>
            <View style={orb.arc} />
          </Animated.View>
        ) : (
          <MicIcon size={22} color="#fff" />
        )}
      </View>
    </View>
  );
}

const orb = StyleSheet.create({
  container: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute', width: 46, height: 46, borderRadius: 23,
    borderWidth: 2, borderColor: C.interactive,
  },
  body: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.interactive,
  },
  bodyThink: { backgroundColor: C.layerHi },
  arc: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2.4,
    borderColor: 'rgba(47,107,255,0.30)',
    borderTopColor: C.interactive,
  },
});

// ── Wave Bars (12 根，active 時逐一動畫) ─────────────────────
function WaveBars({ active }: { active: boolean }) {
  const N = 12;
  const anims = useRef(Array.from({ length: N }, () => new Animated.Value(0))).current;
  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    loopsRef.current.forEach(l => l.stop());
    loopsRef.current = [];
    if (active) {
      anims.forEach((anim, i) => {
        const loop = Animated.loop(Animated.sequence([
          Animated.delay((i * 80) % 1000),
          Animated.timing(anim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        ]));
        loopsRef.current.push(loop);
        loop.start();
      });
    } else {
      anims.forEach(a => a.setValue(0));
    }
  }, [active]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 26 }}>
      {anims.map((anim, i) => (
        <Animated.View key={i} style={{
          width: 4,
          height: anim.interpolate({ inputRange: [0, 1], outputRange: [7, 24] }),
          borderRadius: 2,
          backgroundColor: C.interactive,
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
        }} />
      ))}
    </View>
  );
}

// ── 主元件 ────────────────────────────────────────────────────
export default function VoiceModal({ visible, apiKey, onClose, onAdd }: Props) {
  const [stage, setStage]             = useState<Stage>('recording');
  const [transcript, setTranscript]   = useState('');
  const [rawInput, setRawInput]       = useState('');
  const [editAction, setEditAction]   = useState('');
  const [editTarget, setEditTarget]   = useState('');
  const [editTime, setEditTime]       = useState('');
  const [editNotes, setEditNotes]     = useState('');
  const [editCategory, setEditCategory] = useState<TaskCategory>('');
  const [editPriority, setEditPriority] = useState<Priority>('normal');
  const [editImages, setEditImages]     = useState<string[]>([]);
  const [viewerIndex, setViewerIndex]   = useState(-1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear]   = useState(today.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(today.getMonth() + 1);
  const [pickerDay, setPickerDay]     = useState(today.getDate());
  const [inputFocused, setInputFocused] = useState(false);

  const textInputRef  = useRef<TextInput>(null);
  const isVisibleRef  = useRef(false);
  const stageRef      = useRef<Stage>('recording');
  const kbAnim        = useRef(new Animated.Value(8)).current;

  // 鍵盤出現時把 sheet 往上推
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvt, (e) => {
      Animated.timing(kbAnim, {
        toValue: e.endCoordinates.height + 8,
        duration: Platform.OS === 'ios' ? (e.duration ?? 250) : 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    });
    const onHide = Keyboard.addListener(hideEvt, (e) => {
      Animated.timing(kbAnim, {
        toValue: 8,
        duration: Platform.OS === 'ios' ? (e.duration ?? 200) : 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    });
    return () => { onShow.remove(); onHide.remove(); };
  }, []);

  function updateStage(s: Stage) { stageRef.current = s; setStage(s); }

  const maxDay = getDaysInMonth(pickerYear, pickerMonth);
  const days   = Array.from({ length: maxDay }, (_, i) => i + 1);

  useEffect(() => {
    if (pickerDay > getDaysInMonth(pickerYear, pickerMonth))
      setPickerDay(getDaysInMonth(pickerYear, pickerMonth));
  }, [pickerYear, pickerMonth]);

  // 開啟時自動開始錄音
  useEffect(() => {
    isVisibleRef.current = visible;
    if (visible) {
      setTranscript('');
      setRawInput('');
      setEditNotes('');
      setEditImages([]);
      setViewerIndex(-1);
      setShowDatePicker(false);
      setInputFocused(false);
      updateStage('recording');
      startRecording();
    } else {
      Keyboard.dismiss();
      kbAnim.setValue(8);
      try { ExpoSpeechRecognitionModule.stop(); } catch (_) {}
    }
  }, [visible]);

  useSpeechRecognitionEvent('result', (event) => {
    setTranscript(event.results[0]?.transcript ?? '');
  });

  useSpeechRecognitionEvent('end', () => {
    if (!isVisibleRef.current) return;
    if (stageRef.current === 'recording') updateStage('transcribed');
  });

  useSpeechRecognitionEvent('error', () => {
    if (!isVisibleRef.current) return;
    if (stageRef.current === 'recording') updateStage('transcribed');
  });

  async function startRecording() {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('需要麥克風權限', '請在設定中允許麥克風存取。');
      updateStage('transcribed');
      return;
    }
    setTranscript('');
    updateStage('recording');
    ExpoSpeechRecognitionModule.start({ lang: 'zh-TW', interimResults: true });
  }

  // 手動輸入：停止錄音、切換到 transcribed，自動喚出鍵盤
  function handleManualInput() {
    if (stageRef.current === 'recording') {
      try { ExpoSpeechRecognitionModule.stop(); } catch (_) {}
    }
    updateStage('transcribed');
    setTimeout(() => textInputRef.current?.focus(), 120);
  }

  async function handleAnalyze() {
    const text = transcript.trim();
    if (!text) return;
    if (!apiKey) { Alert.alert('缺少 API Key', '請先到設定頁面輸入 Anthropic API Key。'); return; }
    setRawInput(text);
    updateStage('processing');
    try {
      const result = await extractTaskFromVoice(text, apiKey);
      setEditAction(result.action);
      setEditTarget(result.target);
      setEditTime(result.time ?? '');
      setEditCategory(result.category);
      setEditPriority(result.priority);
      updateStage('result');
    } catch {
      Alert.alert('分析失敗', '請確認 API Key 是否正確，或稍後再試。');
      updateStage('transcribed');
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
      images: editImages.length > 0 ? editImages : undefined,
      priority: editPriority,
      category: editCategory,
    });
    onClose();
  }

  function confirmDate() {
    setEditTime(`${pickerYear}/${pickerMonth}/${pickerDay}`);
    setShowDatePicker(false);
  }

  function handleClose() {
    if (stageRef.current === 'recording') {
      try { ExpoSpeechRecognitionModule.stop(); } catch (_) {}
    }
    Keyboard.dismiss();
    kbAnim.setValue(8);
    onClose();
  }

  const isRecording  = stage === 'recording';
  const isProcessing = stage === 'processing';
  const isResult     = stage === 'result';
  const canAnalyze   = stage === 'transcribed' && transcript.trim().length > 0;
  const canAdd       = isResult && editTarget.trim().length > 0;
  const bottomPad    = Platform.OS === 'ios' ? 34 : S.s06;

  const orbState: OrbState = isRecording ? 'live' : isProcessing ? 'think' : 'idle';
  const sheetTitle = isRecording ? '聆聽中…' : isProcessing ? '分析中…' : isResult ? '分析完成' : '辨識結果';
  const sheetSub   = isRecording
    ? '請說出你要辦的事，點手動輸入可切換'
    : isProcessing ? '判斷分類並建立項目'
    : isResult     ? '可編輯後加入清單'
    : '可編輯或直接分析';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
          if (viewerIndex >= 0) { setViewerIndex(-1); return; }
          handleClose();
        }}
    >
      <View style={s.overlay}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={() => {
            if (showDatePicker) { setShowDatePicker(false); }
            else if (stage === 'result') { Keyboard.dismiss(); }
            else { handleClose(); }
          }}
        />

          <Animated.View style={[s.sheet, isResult && s.sheetLarge, { marginBottom: kbAnim }]}>
            {/* Grab handle */}
            <View style={s.handle} />

            {/* 日期選擇器 */}
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

            {/* ── 錄音 / 辨識結果 / 處理中 ── */}
            {!showDatePicker && !isResult && (
              <>
                {/* Header: mic-orb + 標題 + 關閉 */}
                <View style={s.sheetHead}>
                  <MicOrb state={orbState} />
                  <View style={s.sheetMeta}>
                    <Text style={s.sheetTitle}>{sheetTitle}</Text>
                    <Text style={s.sheetSub}>{sheetSub}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleClose}
                    style={s.closeBtn}
                    activeOpacity={0.7}
                  >
                    <View style={s.xLine1} />
                    <View style={s.xLine2} />
                  </TouchableOpacity>
                </View>

                {/* Textarea */}
                <TextInput
                  ref={textInputRef}
                  style={[s.sheetInput, inputFocused && s.sheetInputFocused]}
                  value={transcript}
                  onChangeText={setTranscript}
                  multiline
                  placeholder="辨識結果會顯示在這裡，可直接編輯…"
                  placeholderTextColor={C.textHelper}
                  editable={!isRecording && !isProcessing}
                  onFocus={() => {
                    if (isRecording) handleManualInput();
                    setInputFocused(true);
                  }}
                  onBlur={() => setInputFocused(false)}
                />

                {/* Wave bars */}
                <View style={s.waveWrap}>
                  <WaveBars active={isRecording} />
                </View>

                {/* Actions: 手動輸入 | 分析 */}
                <View style={[s.sheetActions, { paddingBottom: bottomPad }]}>
                  <TouchableOpacity
                    style={[s.btnGhost, isProcessing && s.btnDisabled]}
                    onPress={handleManualInput}
                    disabled={isProcessing}
                    activeOpacity={0.7}
                  >
                    {/* 鍵盤圖示 (簡化) */}
                    <View style={s.kbIcon}>
                      <View style={s.kbRow}>
                        {[0, 1, 2, 3].map(i => <View key={i} style={s.kbDot} />)}
                      </View>
                      <View style={s.kbBar} />
                    </View>
                    <Text style={s.btnGhostText}>手動輸入</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[s.btnPrimary, !canAnalyze && s.btnPrimaryOff]}
                    onPress={handleAnalyze}
                    disabled={!canAnalyze}
                    activeOpacity={0.85}
                  >
                    {isProcessing
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.btnPrimaryText}>分析</Text>
                    }
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* ── 結果編輯 ── */}
            {!showDatePicker && isResult && (
              <>
                <ScrollView
                  contentContainerStyle={s.resultBody}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={s.autoCard}>
                    <View style={s.autoRow}>
                      <View style={s.statusBadge}><Text style={s.statusBadgeText}>待辦</Text></View>
                      {editAction && editAction !== '待辦' && (
                        <View style={s.actionBadge}><Text style={s.actionBadgeText}>{editAction}</Text></View>
                      )}
                      {editPriority === 'urgent' && (
                        <View style={s.urgentBadge}><Text style={s.urgentBadgeText}>急</Text></View>
                      )}
                      {editPriority === 'important' && (
                        <View style={s.importantBadge}><Text style={s.importantBadgeText}>重要</Text></View>
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
                    <ImagePickerSection
                      images={editImages}
                      onChange={setEditImages}
                      onView={uri => setViewerIndex(editImages.indexOf(uri))}
                    />
                  </View>

                  <View style={s.prioRow}>
                    {(['normal', 'important', 'urgent'] as Priority[]).map((p) => {
                      const isOn = editPriority === p;
                      const label = p === 'normal' ? '一般' : p === 'important' ? '重要' : '緊急';
                      const onBg = p === 'urgent' ? s.prioBtnUrgent : p === 'important' ? s.prioBtnImportant : s.prioBtnNormalOn;
                      return (
                        <TouchableOpacity key={p} style={[s.prioBtn, isOn && onBg]} onPress={() => setEditPriority(p)} activeOpacity={0.7}>
                          <Text style={[s.prioBtnText, isOn && s.prioBtnTextOn]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>

                <View style={[s.addBtnWrap, { paddingBottom: bottomPad }]}>
                  <TouchableOpacity style={s.backBtn} onPress={() => updateStage('transcribed')} activeOpacity={0.7}>
                    <Text style={s.backBtnText}>← 重新辨識</Text>
                  </TouchableOpacity>
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
          </Animated.View>

        <ImageViewer images={editImages} initialIndex={viewerIndex} onClose={() => setViewerIndex(-1)} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  // Overlay
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },

  // Sheet — 浮動卡片，四角圓角，左右下各留 8px
  sheet: {
    backgroundColor: C.layer01,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: C.borderSubtle02,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  sheetLarge: { maxHeight: SCREEN_H * 0.82 },

  // Grab handle
  handle: {
    width: 42, height: 5, borderRadius: 3,
    backgroundColor: C.borderSubtle02,
    alignSelf: 'center',
    marginTop: S.s04, marginBottom: S.s04,
  },

  // Header row
  sheetHead: {
    flexDirection: 'row', alignItems: 'center', gap: S.s04,
    paddingHorizontal: S.s05, marginBottom: S.s05,
  },
  sheetMeta: { flex: 1, minWidth: 0 },
  sheetTitle: { fontSize: 18, fontFamily: F.semiBold, color: C.textPrimary, lineHeight: 22 },
  sheetSub:   { fontSize: 13, fontFamily: F.regular, color: C.textHelper, marginTop: 3 },

  // Close button (34×34 圓形)
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.layer02,
    alignItems: 'center', justifyContent: 'center',
  },
  xLine1: {
    position: 'absolute', width: 14, height: 2,
    backgroundColor: C.textSecondary, borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  xLine2: {
    position: 'absolute', width: 14, height: 2,
    backgroundColor: C.textSecondary, borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },

  // Textarea
  sheetInput: {
    marginHorizontal: S.s05,
    backgroundColor: C.layer02,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.borderSubtle01,
    color: C.textPrimary,
    fontFamily: F.semiBold,
    fontSize: 19,
    lineHeight: 27,
    padding: S.s05,
    minHeight: 78,
    textAlignVertical: 'top',
  },
  sheetInputFocused: { borderColor: C.interactive },

  // Wave
  waveWrap: { height: 26, justifyContent: 'center', marginTop: S.s04, marginBottom: S.s02 },

  // Action buttons
  sheetActions: {
    flexDirection: 'row', gap: 11,
    paddingHorizontal: S.s05, paddingTop: S.s05,
  },
  btnGhost: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 52, paddingHorizontal: 18,
    backgroundColor: C.layer02,
    borderRadius: 16, borderWidth: 1, borderColor: C.borderSubtle01,
  },
  btnGhostText: { fontSize: 16, fontFamily: F.semiBold, color: C.textPrimary },
  btnDisabled: { opacity: 0.4 },

  // 鍵盤圖示
  kbIcon: {
    width: 20, height: 14, borderRadius: 2,
    borderWidth: 1.5, borderColor: C.textSecondary,
    alignItems: 'center', justifyContent: 'center', gap: 3,
    paddingHorizontal: 2,
  },
  kbRow: { flexDirection: 'row', gap: 2 },
  kbDot: { width: 2, height: 2, borderRadius: 1, backgroundColor: C.textSecondary },
  kbBar: { width: 9, height: 1.5, borderRadius: 1, backgroundColor: C.textSecondary },

  btnPrimary: {
    flex: 1, height: 52, borderRadius: 16,
    backgroundColor: C.interactive,
    alignItems: 'center', justifyContent: 'center',
  },
  btnPrimaryOff: { opacity: 0.4 },
  btnPrimaryText: { fontSize: 17, fontFamily: F.semiBold, color: '#fff', letterSpacing: 1 },

  // Date picker
  dateWrap: { paddingBottom: S.s06 },
  dateHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: S.s06, paddingVertical: S.s04,
    borderBottomWidth: 1, borderBottomColor: C.layer02,
  },
  dateBtn:    { paddingHorizontal: S.s02, paddingVertical: S.s02 },
  dateTitle:  { fontSize: TS.body02, fontFamily: F.semiBold, color: C.textPrimary },
  dateCancel: { fontSize: TS.body02, fontFamily: F.regular,  color: C.textSecondary },
  dateConfirm:{ fontSize: TS.body02, fontFamily: F.semiBold, color: C.interactive },
  dateCols:   { flexDirection: 'row', paddingHorizontal: S.s05, paddingTop: S.s06 },

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
  statusBadgeText: { fontSize: 13, fontFamily: F.semiBold, color: C.textSecondary },
  actionBadge: {
    backgroundColor: C.interactiveBg, borderRadius: 9,
    paddingHorizontal: S.s03, paddingVertical: S.s02,
  },
  actionBadgeText: { fontSize: 13, fontFamily: F.semiBold, color: C.interactive },
  urgentBadge: {
    backgroundColor: C.supportErrorBg, borderRadius: 9,
    paddingHorizontal: S.s03, paddingVertical: S.s02,
  },
  urgentBadgeText: { fontSize: 13, fontFamily: F.semiBold, color: C.supportError },
  autoRaw: { fontSize: TS.body01, fontFamily: F.regular, color: C.textHelper, fontStyle: 'italic' },
  fieldCard: { backgroundColor: C.layer02, borderRadius: 12, padding: S.s04 },
  fieldLabel: {
    fontSize: TS.label01, fontFamily: F.semiBold, color: C.textHelper,
    marginBottom: S.s03, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  fieldInput: {
    fontSize: TS.body02, fontFamily: F.regular, color: C.textPrimary,
    borderBottomWidth: 1, borderBottomColor: C.borderSubtle01, paddingVertical: S.s02,
  },
  fieldPlaceholder: { color: C.textPlaceholder },
  notesInput: { minHeight: 56, borderBottomWidth: 0 },
  // 三段式優先級選擇器
  prioRow: { flexDirection: 'row', gap: S.s02 },
  prioBtn: {
    flex: 1, height: 42, borderRadius: 10,
    backgroundColor: C.layer02, borderWidth: 1, borderColor: C.borderSubtle01,
    alignItems: 'center', justifyContent: 'center',
  },
  prioBtnText: { fontSize: TS.body01, fontFamily: F.semiBold, color: C.textHelper },
  prioBtnNormalOn:  { backgroundColor: C.interactive,    borderColor: C.interactive },
  prioBtnImportant: { backgroundColor: '#f0a93b',         borderColor: '#f0a93b' },
  prioBtnUrgent:    { backgroundColor: C.supportError,    borderColor: C.supportError },
  prioBtnTextOn:    { color: '#fff' },

  // importantBadge in autoCard
  importantBadge: {
    backgroundColor: 'rgba(240,169,59,0.15)', borderRadius: 9,
    paddingHorizontal: S.s03, paddingVertical: S.s02,
  },
  importantBadgeText: { fontSize: 13, fontFamily: F.semiBold, color: '#f0a93b' },

  addBtnWrap: {
    flexDirection: 'row', gap: S.s03,
    paddingHorizontal: S.s06, paddingTop: S.s04,
    borderTopWidth: 1, borderTopColor: C.layer02,
  },
  backBtn: {
    height: 54, paddingHorizontal: S.s05,
    backgroundColor: C.layer02, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.borderSubtle01,
  },
  backBtnText: { fontSize: TS.body01, fontFamily: F.semiBold, color: C.textSecondary },
  addBtn: {
    flex: 1, backgroundColor: C.buttonPrimary, borderRadius: 12,
    height: 54, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.buttonPrimary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  addBtnOff:  { backgroundColor: C.buttonDisabled, shadowOpacity: 0, elevation: 0 },
  addBtnText: { color: C.textOnColor, fontSize: 17, fontFamily: F.semiBold, letterSpacing: 0.5 },
});
