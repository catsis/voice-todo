import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { loadApiKey } from './lib/storage';
import HomeScreen from './screens/HomeScreen';
import SettingsScreen from './screens/SettingsScreen';

type Screen = 'home' | 'settings';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    loadApiKey().then((key) => setApiKey(key ?? ''));
  }, []);

  // Reload API key after returning from settings
  function handleBackFromSettings() {
    loadApiKey().then((key) => setApiKey(key ?? ''));
    setScreen('home');
  }

  return (
    <>
      <StatusBar style="light" backgroundColor="#0E0E11" />
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
