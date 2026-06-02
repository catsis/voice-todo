import React, { useEffect, useRef, useState } from 'react';
import {
  View, Animated, Dimensions, StyleSheet,
  BackHandler, TouchableOpacity,
} from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const SWIPE_THRESHOLD = W * 0.28;
const SLIDE_MS = 220;
const RUBBER = 0.25;

interface Props {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

function pinchDist(t0: any, t1: any) {
  return Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
}

export default function ImageViewer({ images, initialIndex, onClose }: Props) {
  const isOpen = initialIndex >= 0 && initialIndex < images.length;

  const [visible, setVisible] = useState(false);
  const [idx, setIdx]         = useState(0);

  // Open / close
  const backdropOp = useRef(new Animated.Value(0)).current;
  const contentSc  = useRef(new Animated.Value(0.88)).current;

  // Slide — three absolute X positions (prev / cur / next)
  const txPrev = useRef(new Animated.Value(-W)).current;
  const txCur  = useRef(new Animated.Value(0)).current;
  const txNext = useRef(new Animated.Value(W)).current;

  // Zoom (applied to current image only)
  const zoomSc = useRef(new Animated.Value(1)).current;
  const zoomTX = useRef(new Animated.Value(0)).current;
  const zoomTY = useRef(new Animated.Value(0)).current;

  // Mutable refs
  const idxRef     = useRef(0);
  const imgsRef    = useRef(images);
  const onCloseRef = useRef(onClose);
  const curScale   = useRef(1);
  const savedTX    = useRef(0);
  const savedTY    = useRef(0);

  // Gesture tracking
  const grantX    = useRef(0);
  const grantY    = useRef(0);
  const pinching  = useRef(false);
  const initPinch = useRef(0);
  const initScale = useRef(1);
  const sliding   = useRef(false);
  const animating = useRef(false);

  useEffect(() => { idxRef.current = idx; }, [idx]);
  useEffect(() => { imgsRef.current = images; }, [images]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // ── Zoom ─────────────────────────────────────────────────────────
  function resetZoom(animated = false) {
    curScale.current = 1; savedTX.current = 0; savedTY.current = 0;
    if (animated) {
      Animated.parallel([
        Animated.spring(zoomSc, { toValue: 1, useNativeDriver: true }),
        Animated.spring(zoomTX, { toValue: 0, useNativeDriver: true }),
        Animated.spring(zoomTY, { toValue: 0, useNativeDriver: true }),
      ]).start();
    } else {
      zoomSc.setValue(1); zoomTX.setValue(0); zoomTY.setValue(0);
    }
  }

  // ── Slide ─────────────────────────────────────────────────────────
  function springBack() {
    Animated.parallel([
      Animated.spring(txPrev, { toValue: -W, useNativeDriver: true, tension: 130, friction: 15 }),
      Animated.spring(txCur,  { toValue: 0,  useNativeDriver: true, tension: 130, friction: 15 }),
      Animated.spring(txNext, { toValue: W,  useNativeDriver: true, tension: 130, friction: 15 }),
    ]).start(() => { animating.current = false; });
  }

  // direction: -1 = go to next (slide left), +1 = go to prev (slide right)
  function commitSlide(direction: 1 | -1) {
    const newIdx = idxRef.current - direction;
    if (newIdx < 0 || newIdx >= imgsRef.current.length) { springBack(); return; }

    const target = direction * W;
    Animated.parallel([
      Animated.timing(txPrev, { toValue: -W + target, duration: SLIDE_MS, useNativeDriver: true }),
      Animated.timing(txCur,  { toValue: target,       duration: SLIDE_MS, useNativeDriver: true }),
      Animated.timing(txNext, { toValue: W + target,   duration: SLIDE_MS, useNativeDriver: true }),
    ]).start(() => {
      txPrev.setValue(-W); txCur.setValue(0); txNext.setValue(W);
      resetZoom();
      idxRef.current = newIdx;
      setIdx(newIdx);
      animating.current = false;
    });
  }

  // ── Responder handlers ────────────────────────────────────────────
  const handleGrant = (e: any) => {
    if (animating.current) return;
    const t = e.nativeEvent.touches;
    pinching.current = false; sliding.current = false;

    if (t.length >= 2) {
      pinching.current  = true;
      initPinch.current = pinchDist(t[0], t[1]);
      initScale.current = curScale.current;
    } else {
      const touch = t[0] ?? e.nativeEvent;
      grantX.current = touch.pageX;
      grantY.current = touch.pageY;
    }
  };

  const handleMove = (e: any) => {
    if (animating.current) return;
    const t = e.nativeEvent.touches;

    if (t.length >= 2) {
      if (!pinching.current) {
        pinching.current  = true;
        initPinch.current = pinchDist(t[0], t[1]);
        initScale.current = curScale.current;
      }
      const newSc = Math.max(1, Math.min(4,
        initScale.current * pinchDist(t[0], t[1]) / initPinch.current));
      zoomSc.setValue(newSc);
      curScale.current = newSc;
      return;
    }

    if (pinching.current) return;

    const touch = t[0] ?? e.nativeEvent;
    const dx = touch.pageX - grantX.current;
    const dy = touch.pageY - grantY.current;

    if (curScale.current > 1) {
      zoomTX.setValue(savedTX.current + dx);
      zoomTY.setValue(savedTY.current + dy);
      return;
    }

    // Start sliding only if movement is predominantly horizontal
    if (!sliding.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      sliding.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!sliding.current) return;

    const canGoPrev = idxRef.current > 0;
    const canGoNext = idxRef.current < imgsRef.current.length - 1;
    let eff = dx;
    if (dx > 0 && !canGoPrev) eff = dx * RUBBER;
    if (dx < 0 && !canGoNext) eff = dx * RUBBER;

    txPrev.setValue(-W + eff);
    txCur.setValue(eff);
    txNext.setValue(W + eff);
  };

  const handleRelease = (e: any) => {
    if (animating.current) return;

    if (pinching.current) {
      pinching.current = false;
      if (curScale.current < 1.05) resetZoom(true);
      return;
    }

    const touch = (e.nativeEvent.changedTouches ?? [])[0] ?? e.nativeEvent;
    const dx = touch.pageX - grantX.current;
    const dy = touch.pageY - grantY.current;

    if (curScale.current > 1) {
      savedTX.current += dx;
      savedTY.current += dy;
      return;
    }

    if (sliding.current) {
      sliding.current   = false;
      animating.current = true;
      if      (dx < -SWIPE_THRESHOLD) commitSlide(-1);
      else if (dx >  SWIPE_THRESHOLD) commitSlide(1);
      else                            springBack();
      return;
    }

    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) onCloseRef.current();
  };

  const handleTerminate = () => {
    pinching.current = false; sliding.current = false;
    if (animating.current) return;
    springBack();
  };

  // ── Open / close ──────────────────────────────────────────────────
  const wasOpen     = useRef(false);
  const prevVisible = useRef(false);

  useEffect(() => {
    if (isOpen) {
      resetZoom();
      txPrev.setValue(-W); txCur.setValue(0); txNext.setValue(W);
      idxRef.current = initialIndex;
      setIdx(initialIndex);
      if (!wasOpen.current) { wasOpen.current = true; setVisible(true); }
    } else if (wasOpen.current) {
      wasOpen.current = false;
      Animated.parallel([
        Animated.timing(contentSc,  { toValue: 0.88, duration: 180, useNativeDriver: true }),
        Animated.timing(backdropOp, { toValue: 0,    duration: 180, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }
  }, [isOpen, initialIndex]);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      contentSc.setValue(0.88); backdropOp.setValue(0);
      Animated.parallel([
        Animated.spring(contentSc,  { toValue: 1, useNativeDriver: true, tension: 90, friction: 11 }),
        Animated.timing(backdropOp, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    prevVisible.current = visible;
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onCloseRef.current(); return true;
    });
    return () => sub.remove();
  }, [visible]);

  if (!visible || images.length === 0) return null;

  const n       = images.length;
  const prevUri = idx > 0     ? images[idx - 1] : null;
  const curUri  = images[idx] ?? images[0];
  const nextUri = idx < n - 1 ? images[idx + 1] : null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.wrap, { opacity: backdropOp }]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ scale: contentSc }] }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleGrant}
        onResponderMove={handleMove}
        onResponderRelease={handleRelease}
        onResponderTerminate={handleTerminate}
      >
        {prevUri && (
          <Animated.Image
            source={{ uri: prevUri }}
            style={[s.img, { transform: [{ translateX: txPrev }] }]}
            resizeMode="contain"
          />
        )}

        {/* Current image: slide offset + zoom pan + zoom scale */}
        <Animated.Image
          source={{ uri: curUri }}
          style={[s.img, {
            transform: [
              { translateX: txCur },
              { translateX: zoomTX },
              { translateY: zoomTY },
              { scale: zoomSc },
            ],
          }]}
          resizeMode="contain"
        />

        {nextUri && (
          <Animated.Image
            source={{ uri: nextUri }}
            style={[s.img, { transform: [{ translateX: txNext }] }]}
            resizeMode="contain"
          />
        )}
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
              <View key={i} style={[s.dot, i === idx && s.dotOn]} />
            ))}
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { backgroundColor: 'rgba(0,0,0,0.93)', zIndex: 999 },
  img: {
    position: 'absolute',
    width: W,
    height: H * 0.84,
    top: (H - H * 0.84) / 2,
    left: 0,
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
