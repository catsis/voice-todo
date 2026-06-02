import React, { useState } from 'react';
import {
  View, TouchableOpacity, Image, Text, StyleSheet, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { C, S, F, TS } from '../lib/theme';

const THUMB = 80;

interface Props {
  images: string[];
  onView: (uri: string) => void;
  onChange?: (images: string[]) => void;
  editable?: boolean;
}

export default function ImagePickerSection({ images, onView, onChange, editable = true }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  async function pickLibrary() {
    setMenuOpen(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('需要權限', '請在設定中允許存取相片庫。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      onChange?.([...images, ...result.assets.map(a => a.uri)]);
    }
  }

  async function pickCamera() {
    setMenuOpen(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('需要權限', '請在設定中允許使用相機。');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      onChange?.([...images, result.assets[0].uri]);
    }
  }

  function remove(idx: number) {
    onChange?.(images.filter((_, i) => i !== idx));
  }

  if (!editable && images.length === 0) return null;

  return (
    <View style={s.wrap}>
      {images.length > 0 && (
        <View style={s.grid}>
          {images.map((uri, i) => (
            <View key={i} style={s.thumbWrap}>
              <TouchableOpacity onPress={() => onView(uri)} activeOpacity={0.8}>
                <Image source={{ uri }} style={s.thumb} resizeMode="cover" />
              </TouchableOpacity>
              {editable && (
                <TouchableOpacity
                  style={s.rmBtn}
                  onPress={() => remove(i)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Text style={s.rmText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}

      {editable && (
        <View>
          <TouchableOpacity style={s.addBtn} onPress={() => setMenuOpen(v => !v)} activeOpacity={0.75}>
            <View style={s.camBody}>
              <View style={s.camLens} />
            </View>
            <Text style={s.addText}>新增照片</Text>
          </TouchableOpacity>

          {menuOpen && (
            <View style={s.menu}>
              <TouchableOpacity style={s.menuRow} onPress={pickCamera} activeOpacity={0.7}>
                <Text style={s.menuText}>拍照</Text>
              </TouchableOpacity>
              <View style={s.menuDiv} />
              <TouchableOpacity style={s.menuRow} onPress={pickLibrary} activeOpacity={0.7}>
                <Text style={s.menuText}>從相簿選擇</Text>
              </TouchableOpacity>
              <View style={s.menuDiv} />
              <TouchableOpacity style={s.menuRow} onPress={() => setMenuOpen(false)} activeOpacity={0.7}>
                <Text style={[s.menuText, s.menuCancel]}>取消</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: S.s03 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: S.s03 },
  thumbWrap: { position: 'relative' },
  thumb: {
    width: THUMB, height: THUMB, borderRadius: 10,
    backgroundColor: C.layer02,
  },
  rmBtn: {
    position: 'absolute', top: -5, right: -5,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'center',
  },
  rmText: { color: '#fff', fontSize: 9, fontFamily: F.semiBold, lineHeight: 11 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: S.s02,
    alignSelf: 'flex-start', height: 36, paddingHorizontal: S.s04,
    backgroundColor: C.layer02, borderRadius: 10,
    borderWidth: 1, borderColor: C.borderSubtle01,
  },
  camBody: {
    width: 16, height: 12, borderRadius: 2,
    borderWidth: 1.5, borderColor: C.textSecondary,
    alignItems: 'center', justifyContent: 'center',
  },
  camLens: {
    width: 6, height: 6, borderRadius: 3,
    borderWidth: 1.2, borderColor: C.textSecondary,
  },
  addText: { fontSize: TS.body01, color: C.textSecondary, fontFamily: F.semiBold },
  menu: {
    marginTop: S.s02,
    backgroundColor: C.layerHi, borderRadius: 12,
    borderWidth: 1, borderColor: C.borderSubtle02,
    overflow: 'hidden', alignSelf: 'flex-start', minWidth: 160,
  },
  menuRow: { paddingVertical: S.s04, paddingHorizontal: S.s05 },
  menuDiv: { height: 1, backgroundColor: C.borderSubtle01 },
  menuText: { fontSize: TS.body01, color: C.textPrimary, fontFamily: F.regular },
  menuCancel: { color: C.textHelper },
});
