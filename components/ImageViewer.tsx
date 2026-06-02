import React, { useEffect, useRef, useState } from 'react';
import {
  View, Animated, Dimensions, StyleSheet,
  BackHandler, PanResponder, TouchableOpacity,
} from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

interface Props {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

function dist2(a: any, b: any) {
  return Math.sqrt((a.pageX - b.pageX) ** 2 + (a.pageY - b.pageY) ** 2);
}

export default function ImageViewer({ images, initialIndex, onClose }: Props) {
  const isOpen = initialIndex >= 0 && initialIndex < images.length;

  const [visible, setVisible]           = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Animations
  const backdropOp = useRef(new Animated.Value(0)).current;
  const contentSc  = useRef(new Animated.Value(0.88)).current;
  const imgOp      = useRef(new Animated.Value(1)).current;
  const imgSc      = useRef(new Animated.Value(1)).current;
  const imgTX      = useRef(new Animated.Value(0)).current;
  const imgTY      = useRef(new Animated.Value(0)).current;

  // Mutable zoom state (no re-renders needed)
  const curSc    = useRef(1);
  const saveTX   = useRef(0);
  const saveTY   = useRef(0);
  const pinching = useRef(false);
  const pin0dist = useRef(0);
  const pin0sc   = useRef(1);

  // Always-current refs for PanResponder callbacks
  const idxRef     = useRef(0);
  const imgsRef    = useRef(images);
  const visRef     = useRef(false);
  const onCloseRef = useRef(onClose);
  const doGoRef    = useRef<(i: number) => void>(() => {});
  const doCloseRef = useRef<() => void>(() => {});

  useEffect(() => { idxRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { imgsRef.current = images; },     [images]);
  useEffect(() => { visRef.current = visible; },     [visible]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // ── Zoom helpers ────────────────────────────────────────────────
  function resetZoom(anim = false) {
    curSc.current = 1; saveTX.current = 0; saveTY.current = 0;
    if (anim) {
      Animated.parallel([
        Animated.spring(imgSc, { toValue: 1, useNativeDriver: true }),
        Animated.spring(imgTX, { toValue: 0, useNativeDriver: true }),
        Animated.spring(imgTY, { toValue: 0, useNativeDriver: true }),
      ]).start();
    } else {
      imgSc.setValue(1); imgTX.setValue(0); imgTY.setValue(0);
    }
  }

  // ── Image switch ────────────────────────────────────────────────
  function doGo(idx: number) {
    if (idx < 0 || idx >= imgsRef.current.length) return;
    resetZoom();
    imgOp.setValue(0);
    setCurrentIndex(idx);
    idxRef.current = idx;
    Animated.timing(imgOp, { toValue: 1, duration: 140, useNativeDriver: true }).start();
  }
  useEffect(() => { doGoRef.current = doGo; });

  // ── Open / close ────────────────────────────────────────────────
  function doClose() {
    Animated.parallel([
      Animated.timing(contentSc,  { toValue: 0.88, duration: 180, useNativeDriver: true }),
      Animated.timing(backdropOp, { toValue: 0,    duration: 180, useNativeDriver: true }),
    ]).start(() => { setVisible(false); onCloseRef.current(); });
  }
  useEffect(() => { doCloseRef.current = doClose; });

  // Track open state to avoid re-firing open anim on index change while open
  const wasOpen = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      idxRef.current = initialIndex;
      resetZoom();
      imgOp.setValue(1);
      if (!wasOpen.current) {
        wasOpen.current = true;
        setVisible(true);
        // open animation fires in the visible effect below
      } else {
        // Viewer already open — switch image
        doGoRef.current(initialIndex);
      }
    } else if (wasOpen.current) {
      wasOpen.current = false;
      doCloseRef.current();
    }
  }, [isOpen, initialIndex]);

  // Start open animation once the component is actually visible in the tree
  const prevVisible = useRef(false);
  useEffect(() => {
    if (visible && !prevVisible.current) {
      contentSc.setValue(0.88);
      backdropOp.setValue(0);
      Animated.parallel([
        Animated.spring(contentSc,  { toValue: 1, useNativeDriver: true, tension: 90, friction: 11 }),
        Animated.timing(backdropOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    prevVisible.current = visible;
  }, [visible]);

  // ── Android back button ──────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      doCloseRef.current();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  // ── PanResponder — pinch zoom + swipe navigation ────────────────
  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder:        (e)    => e.nativeEvent.touches.length >= 2,
    onStartShouldSetPanResponderCapture: (e)    => e.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponder:         (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,

    onPanResponderGrant: (e) => {
      const t = e.nativeEvent.touches;
      if (t.length >= 2) {
        pinching.current = true;
        pin0dist.current = dist2(t[0], t[1]);
        pin0sc.current   = curSc.current;
      } else {
        pinching.current = false;
      }
    },

    onPanResponderMove: (e, g) => {
      const t = e.nativeEvent.touches;
      if (t.length >= 2) {
        if (!pinching.current) {
          pinching.current = true;
          pin0dist.current = dist2(t[0], t[1]);
          pin0sc.current   = curSc.current;
        }
        const newSc = Math.max(1, Math.min(4, pin0sc.current * dist2(t[0], t[1]) / pin0dist.current));
        imgSc.setValue(newSc);
        curSc.current = newSc;
      } else if (curSc.current > 1) {
        imgTX.setValue(saveTX.current + g.dx);
        imgTY.setValue(saveTY.current + g.dy);
      }
    },

    onPanResponderRelease: (_, g) => {
      if (pinching.current) {
        pinching.current = false;
        if (curSc.current < 1.05) resetZoom(true);
      } else if (curSc.current > 1) {
        saveTX.current += g.dx;
        saveTY.current += g.dy;
      } else {
        const ax = Math.abs(g.dx), ay = Math.abs(g.dy);
        if (ax > 60 && ax > ay * 1.5) {
          doGoRef.current(idxRef.current + (g.dx < 0 ? 1 : -1));
        } else if (ax < 8 && ay < 8) {
          doCloseRef.current();
        }
      }
    },

    onPanResponderTerminate: () => { pinching.current = false; },
  })).current;

  if (!visible || images.length === 0) return null;

  const uri = images[currentIndex] ?? images[0];
  const n   = images.length;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.wrap, { opacity: backdropOp }]}>
      {/* Gesture layer */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ scale: contentSc }] }]}
        {...pr.panHandlers}
      >
        <Animated.Image
          source={{ uri }}
          style={[s.img, {
            opacity: imgOp,
            transform: [{ scale: imgSc }, { translateX: imgTX }, { translateY: imgTY }],
          }]}
          resizeMode="contain"
        />
      </Animated.View>

      {/* UI overlay — pointerEvents=box-none lets touches pass through to gesture layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <TouchableOpacity style={s.closeBtn} onPress={() => doCloseRef.current()} activeOpacity={0.75}>
          <View style={s.xL1} />
          <View style={s.xL2} />
        </TouchableOpacity>

        {n > 1 && (
          <View style={s.dots} pointerEvents="none">
            {Array.from({ length: n }, (_, i) => (
              <View key={i} style={[s.dot, i === currentIndex && s.dotOn]} />
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(0,0,0,0.93)', zIndex: 999 },
  img:  {
    width: W, height: H * 0.84,
    alignSelf: 'center',
    marginTop: (H - H * 0.84) / 2,
  },
  closeBtn: {
    position: 'absolute', top: 48, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  xL1: {
    position: 'absolute', width: 16, height: 2,
    backgroundColor: '#fff', borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  xL2: {
    position: 'absolute', width: 16, height: 2,
    backgroundColor: '#fff', borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
  dots: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  dot:   { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotOn: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
});
