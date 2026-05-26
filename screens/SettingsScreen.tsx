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
                placeholderTextColor="#35354A"
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1C28',
  },
  backBtn: {
    padding: 4,
  },
  backBtnText: {
    fontSize: 16,
    color: '#6B85F0',
    fontWeight: '500',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EAEAF0',
  },
  body: {
    padding: 20,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#646490',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#17171C',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  desc: {
    fontSize: 13,
    color: '#7878A0',
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#40406A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#EAEAF0',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#0E0E11',
  },
  showBtn: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  showBtnText: {
    fontSize: 13,
    color: '#6B85F0',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#6B85F0',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnSuccess: {
    backgroundColor: '#3DCC88',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 101, 101, 0.3)',
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#F56565',
    fontSize: 15,
  },
  aboutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EAEAF0',
  },
  aboutSubtext: {
    fontSize: 13,
    color: '#7878A0',
  },
  divider: {
    height: 1,
    backgroundColor: '#282840',
  },
});
