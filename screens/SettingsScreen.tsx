import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveApiKey, loadApiKey } from '../lib/storage';
import { C, S, F, TS } from '../lib/theme';

interface Props {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    loadApiKey().then((key) => {
      if (key) setApiKey(key);
    });
  }, []);

  async function handleSave() {
    const trimmed = apiKey.trim();
    if (!trimmed.startsWith('sk-ant-')) {
      Alert.alert('格式錯誤', 'Anthropic API Key 應以 sk-ant- 開頭。');
      return;
    }
    await saveApiKey(trimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClear() {
    Alert.alert('確認清除', '確定要清除儲存的 API Key？', [
      { text: '取消', style: 'cancel' },
      {
        text: '清除',
        style: 'destructive',
        onPress: async () => {
          await saveApiKey('');
          setApiKey('');
        },
      },
    ]);
  }

  const maskedKey =
    apiKey.length > 12
      ? apiKey.slice(0, 8) + '••••••••' + apiKey.slice(-4)
      : apiKey;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹ 返回</Text>
          </TouchableOpacity>
          <Text style={styles.title}>設定</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.sectionTitle}>API Key</Text>
          <View style={styles.card}>
            <Text style={styles.desc}>
              語音輸入後，系統使用 Claude API 分析並擷取關鍵資訊。
              {'\n'}請至 console.anthropic.com 取得 API Key。
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="sk-ant-api03-..."
                placeholderTextColor={C.textDisabled}
                value={showKey ? apiKey : maskedKey}
                onChangeText={setApiKey}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowKey(!showKey)}
                style={styles.showBtn}
              >
                <Text style={styles.showBtnText}>
                  {showKey ? '隱藏' : '顯示'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.saveBtn, saved && styles.saveBtnSuccess]}
                onPress={handleSave}
              >
                <Text style={styles.saveBtnText}>
                  {saved ? '已儲存 ✓' : '儲存'}
                </Text>
              </TouchableOpacity>
              {apiKey ? (
                <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                  <Text style={styles.clearBtnText}>清除</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <Text style={styles.sectionTitle}>關於</Text>
          <View style={styles.card}>
            <Text style={styles.aboutText}>語音待辦 v1.0.0</Text>
            <View style={styles.divider} />
            <Text style={styles.aboutSubtext}>AI 模型：Claude Haiku 4.5</Text>
            <Text style={styles.aboutSubtext}>語音辨識：Android SpeechRecognizer</Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: S.s05,
    paddingHorizontal: S.s06,
    borderBottomWidth: 1,
    borderBottomColor: C.layer02,
  },
  backBtn: { padding: S.s02 },
  backBtnText: { fontSize: TS.body02, color: C.interactive, fontFamily: F.regular },
  title: { fontSize: TS.body02, fontFamily: F.semiBold, color: C.textPrimary },
  body: { padding: S.s06, gap: S.s03 },
  sectionTitle: {
    fontSize: TS.label01,
    fontFamily: F.semiBold,
    color: C.textHelper,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: S.s05,
    marginBottom: S.s03,
    marginLeft: S.s02,
  },
  card: {
    backgroundColor: C.layer01,
    borderRadius: 4,
    padding: S.s05,
    gap: S.s04,
  },
  desc: {
    fontSize: TS.body01,
    color: C.textSecondary,
    fontFamily: F.regular,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: S.s03,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.borderSubtle01,
    borderRadius: 4,
    paddingHorizontal: S.s04,
    paddingVertical: S.s03,
    fontSize: TS.body01,
    color: C.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: C.background,
  },
  showBtn: {
    paddingHorizontal: S.s03,
    paddingVertical: S.s03,
  },
  showBtnText: { fontSize: TS.body01, color: C.interactive, fontFamily: F.regular },
  btnRow: { flexDirection: 'row', gap: S.s03 },
  saveBtn: {
    flex: 1,
    backgroundColor: C.buttonPrimary,
    borderRadius: 4,
    paddingVertical: S.s04,
    alignItems: 'center',
  },
  saveBtnSuccess: { backgroundColor: C.supportSuccess },
  saveBtnText: { color: C.textOnColor, fontSize: TS.body02, fontFamily: F.semiBold },
  clearBtn: {
    paddingHorizontal: S.s05,
    paddingVertical: S.s04,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.supportErrorBorder,
    alignItems: 'center',
  },
  clearBtnText: { color: C.supportError, fontSize: TS.body02, fontFamily: F.regular },
  aboutText: { fontSize: TS.body02, fontFamily: F.semiBold, color: C.textPrimary },
  aboutSubtext: { fontSize: TS.body01, color: C.textSecondary, fontFamily: F.regular },
  divider: { height: 1, backgroundColor: C.layer02 },
});
