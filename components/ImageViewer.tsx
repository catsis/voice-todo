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

  // Mutable zoom state (no re-renders)
  const curSc    = useRef(1);
  const saveTX   = useRef(0);
  const saveTY   = useRef(0);
  const pinching = useRef(false);
  const pin0dist = useRef(0);
  const pin0sc   = useRef(1);
  const wasOpen  = useRef(false);

  // Stable refs
  const idxRef     = useRef(0);
  const imgsRef    = useRef(images);
  const onCloseRef = useRef(onClose);
  useEffect(() => { idxRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { imgsRef.current = images; },     [images]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // ── Zoom ────────────────────────────────────────────────────────
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
  const switchToRef = useRef<(idx: number) => void>(() => {});
  function switchTo(idx: number) {
    if (idx < 0 || idx >= imgsRef.current.length) return;
    resetZoom();
    imgOp.setValue(0);
    setCurrentIndex(idx);
    idxRef.current = idx;
    // setTimeout gives React one frame to update image source before fade-in
    setTimeout(() => {
      Animated.timing(imgOp, { toValue: 1, duration: 160, useNativeDriver: true }).start();
    }, 16);
  }
  useEffect(() => { switchToRef.current = switchTo; });

  // ── Open/close — isOpen effect is the ONLY place that drives animation ──
  // User actions just call onClose() — never run animation themselves.
  // This prevents the double-close loop (doClose → onClose → isOpen=false → doClose again).
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      idxRef.current = initialIndex;
      resetZoom();
      imgOp.setValue(1);
      if (!wasOpen.current) {
        wasOpen.current = true;
        setVisible(true); // open anim fires in prevVisible effect below
      } else {
        switchToRef.current(initialIndex); // already open, just switch
      }
    } else if (wasOpen.current) {
      wasOpen.current = false;
      // Close animation — we do NOT call onClose here (parent already called it)
      Animated.parallel([
        Animated.timing(contentSc,  { toValue: 0.88, duration: 180, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 0,    duration: 180, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }
  }, [isOpen, initialIndex]);

  // Open animation — fires once when visible transitions false→true
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

  // ── Android back button — calls onClose (parent drives close) ──
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseRef.current();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  // ── PanResponder ─────────────────────────────────────────────────
  // Fix: onStartShouldSetPanResponder always returns true so the gesture
  // layer reliably claims single-finger touches. The close button
  // (inside a separate sibling subtree via pointerEvents=box-none)
  // is unaffected — it claims via the normal responder bubble.
  const pr = useRef(PanResponder.create({
    onStartShouldSetPanResponder:        () => true,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder:         () => true,
    onMoveShouldSetPanResponderCapture:  () => false,

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
        // Transition 1-finger → 2-finger mid-gesture
        if (!pinching.current) {
          pinching.current = true;
          pin0dist.current = dist2(t[0], t[1]);
          pin0sc.current   = curSc.current;
        }
        const d = dist2(t[0], t[1]);
        const newSc = Math.max(1, Math.min(4, pin0sc.current * d / pin0dist.current));
        imgSc.setValue(newSc);
        curSc.current = newSc;
      } else if (curSc.current > 1 && !pinching.current) {
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
        if (ax > 50 && ax > ay * 1.5) {
          switchToRef.current(idxRef.current + (g.dx < 0 ? 1 : -1));
        } else if (ax < 10 && ay < 10) {
          onCloseRef.current(); // tap anywhere → close
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

      {/* UI overlay — box-none passes unhandled touches to gesture layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <TouchableOpacity
          style={s.closeBtn}
          onPress={() => onCloseRef.current()}
          activeOpacity={0.75}
        >
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
