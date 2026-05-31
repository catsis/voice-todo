import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import {
  useFonts,
  IBMPlexSans_400Regular,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import { loadApiKey } from './lib/storage';
import { C } from './lib/theme';
import HomeScreen from './screens/HomeScreen';
import SettingsScreen from './screens/SettingsScreen';

type Screen = 'home' | 'settings';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [apiKey, setApiKey] = useState('');

  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });

  useEffect(() => {
    loadApiKey().then((key) => setApiKey(key ?? ''));
    if (!__DEV__) checkAndApplyUpdate();
  }, []);

  async function checkAndApplyUpdate() {
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch {
      // 無網路或非 OTA 環境時忽略
    }
  }

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: C.background }} />;
  }

  function handleBackFromSettings() {
    loadApiKey().then((key) => setApiKey(key ?? ''));
    setScreen('home');
  }

  return (
    <>
      <StatusBar style="light" backgroundColor={C.background} />
      {screen === 'home' ? (
        <HomeScreen
          apiKey={apiKey}
          onOpenSettings={() => setScreen('settings')}
        />
      ) : (
        <SettingsScreen onBack={handleBackFromSettings} />
      )}
    </>
  );
}
