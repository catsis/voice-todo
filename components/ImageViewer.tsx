import React, { useEffect, useRef, useState } from 'react';
import {
  View, Animated, Dimensions, StyleSheet,
  BackHandler, TouchableOpacity,
} from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const SWIPE_THRESHOLD = W * 0.28;
const SLIDE_MS        = 220;
const RUBBER          = 0.25;
const DOUBLE_TAP_MS   = 280;
const DOUBLE_TAP_DIST = 50;
const ZOOM_2X         = 2;

const PHOTO_TOP    = (H - H * 0.84) / 2;
const PHOTO_BOTTOM = PHOTO_TOP + H * 0.84;

interface Props {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

function pinchDist(t0: any, t1: any) {
  return Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
}

function maxPan(scale: number) {
  return { x: (W * scale - W) / 2, y: (H * 0.84 * scale - H * 0.84) / 2 };
}

export default function ImageViewer({ images, initialIndex, onClose }: Props) {
  const isOpen = initialIndex >= 0 && initialIndex < images.length;

  const [visible, setVisible] = useState(false);
  const [idx, setIdx]         = useState(0);

  const backdropOp = useRef(new Animated.Value(0)).current;
  const contentSc  = useRef(new Animated.Value(0.88)).current;

  const txPrev = useRef(new Animated.Value(-W)).current;
  const txCur  = useRef(new Animated.Value(0)).current;
  const txNext = useRef(new Animated.Value(W)).current;

  const zoomSc = useRef(new Animated.Value(1)).current;
  const zoomTX = useRef(new Animated.Value(0)).current;
  const zoomTY = useRef(new Animated.Value(0)).current;

  const idxRef      = useRef(0);
  const imgsRef     = useRef(images);
  const onCloseRef  = useRef(onClose);
  const curScale    = useRef(1);
  const savedTX     = useRef(0);
  const savedTY     = useRef(0);
  const grantX      = useRef(0);
  const grantY      = useRef(0);
  const pinching    = useRef(false);
  const initPinch   = useRef(0);
  const initScale   = useRef(1);
  const sliding     = useRef(false);
  const animating   = useRef(false);
  const liveSlideX  = useRef(0);   // overflow slide offset while zoomed
  const lastTapTime = useRef(0);
  const lastTapX    = useRef(0);
  const lastTapY    = useRef(0);

  useEffect(() => { idxRef.current = idx; }, [idx]);
  useEffect(() => { imgsRef.current = images; }, [images]);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // ── Zoom ──────────────────────────────────────────────────────────
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
  function springBackSlide() {
    Animated.parallel([
      Animated.spring(txPrev, { toValue: -W, useNativeDriver: true, tension: 130, friction: 15 }),
      Animated.spring(txCur,  { toValue: 0,  useNativeDriver: true, tension: 130, friction: 15 }),
      Animated.spring(txNext, { toValue: W,  useNativeDriver: true, tension: 130, friction: 15 }),
    ]).start(() => { animating.current = false; });
  }

  function commitSlide(direction: 1 | -1) {
    const newIdx = idxRef.current - direction;
    if (newIdx < 0 || newIdx >= imgsRef.current.length) { springBackSlide(); return; }
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

  // ── Touch handlers ─────────────────────────────────────────────────
  const handleTouchStart = (e: any) => {
    if (animating.current) return;
    const t = e.nativeEvent.touches;
    if (t.length >= 2) {
      pinching.current  = true;
      sliding.current   = false;
      initPinch.current = pinchDist(t[0], t[1]);
      initScale.current = curScale.current;
    } else if (t.length === 1 && !pinching.current) {
      grantX.current  = t[0].pageX;
      grantY.current  = t[0].pageY;
      sliding.current = false;
    }
  };

  const handleTouchMove = (e: any) => {
    if (animating.current) return;
    const t = e.nativeEvent.touches;

    if (t.length >= 2) {
      if (!pinching.current) {
        pinching.current  = true;
        sliding.current   = false;
        initPinch.current = pinchDist(t[0], t[1]);
        initScale.current = curScale.current;
      }
      const newSc = Math.max(1, Math.min(4,
        initScale.current * pinchDist(t[0], t[1]) / initPinch.current,
      ));
      zoomSc.setValue(newSc);
      curScale.current = newSc;
      return;
    }

    if (pinching.current) return;

    const touch = t[0];
    if (!touch) return;
    const dx = touch.pageX - grantX.current;
    const dy = touch.pageY - grantY.current;

    if (curScale.current > 1) {
      const { x: mx, y: my } = maxPan(curScale.current);
      const desiredTX = savedTX.current + dx;
      const clampedTY = Math.max(-my, Math.min(my, savedTY.current + dy));

      if (Math.abs(desiredTX) > mx) {
        // Pan hit the horizontal edge → overflow into slide
        const clamped  = desiredTX > 0 ? mx : -mx;
        const overflow = desiredTX - clamped;
        zoomTX.setValue(clamped);
        zoomTY.setValue(clampedTY);

        const canGoPrev = idxRef.current > 0;
        const canGoNext = idxRef.current < imgsRef.current.length - 1;
        let eff = overflow;
        if (overflow > 0 && !canGoPrev) eff = overflow * RUBBER;
        if (overflow < 0 && !canGoNext) eff = overflow * RUBBER;

        txPrev.setValue(-W + eff);
        txCur.setValue(eff);
        txNext.setValue(W + eff);
        liveSlideX.current = eff;
      } else {
        zoomTX.setValue(desiredTX);
        zoomTY.setValue(clampedTY);
        if (liveSlideX.current !== 0) {
          txPrev.setValue(-W); txCur.setValue(0); txNext.setValue(W);
          liveSlideX.current = 0;
        }
      }
      return;
    }

    // Horizontal slide between images
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

  const handleTouchEnd = (e: any) => {
    if (animating.current) return;
    const remaining = e.nativeEvent.touches;
    const changed   = e.nativeEvent.changedTouches ?? [];

    // One finger lifted during pinch — keep remaining finger as pan start
    if (pinching.current && remaining.length >= 1) {
      pinching.current = false;
      grantX.current   = remaining[0].pageX;
      grantY.current   = remaining[0].pageY;
      return;
    }
    if (remaining.length > 0) return;

    // All fingers lifted
    if (pinching.current) {
      pinching.current = false;
      if (curScale.current < 1.05) resetZoom(true);
      return;
    }

    const endTouch = changed[0] ?? e.nativeEvent;
    const dx = endTouch.pageX - grantX.current;
    const dy = endTouch.pageY - grantY.current;

    if (sliding.current) {
      sliding.current   = false;
      animating.current = true;
      if      (dx < -SWIPE_THRESHOLD) commitSlide(-1);
      else if (dx >  SWIPE_THRESHOLD) commitSlide(1);
      else                            springBackSlide();
      return;
    }

    if (curScale.current > 1) {
      const { x: mx, y: my } = maxPan(curScale.current);

      // Overflow slide committed
      if (Math.abs(liveSlideX.current) > SWIPE_THRESHOLD) {
        const dir = liveSlideX.current > 0 ? 1 : -1;
        liveSlideX.current = 0;
        resetZoom();
        animating.current = true;
        commitSlide(dir);
        return;
      }
      // Overflow not enough — snap slide positions back
      if (liveSlideX.current !== 0) {
        txPrev.setValue(-W); txCur.setValue(0); txNext.setValue(W);
        liveSlideX.current = 0;
      }
      // Save accumulated pan (clamped to valid range)
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        savedTX.current = Math.max(-mx, Math.min(mx, savedTX.current + dx));
        savedTY.current = Math.max(-my, Math.min(my, savedTY.current + dy));
        return;
      }
      // Tiny movement while zoomed — fall through for double-tap check
    }

    // Tap / double-tap
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
      const now  = Date.now();
      const tapX = endTouch.pageX;
      const tapY = endTouch.pageY;
      const isDoubleTap =
        now - lastTapTime.current < DOUBLE_TAP_MS &&
        Math.hypot(tapX - lastTapX.current, tapY - lastTapY.current) < DOUBLE_TAP_DIST;

      if (isDoubleTap) {
        lastTapTime.current = 0;
        if (curScale.current > 1) {
          resetZoom(true);
        } else {
          const s = ZOOM_2X;
          const { x: mx, y: my } = maxPan(s);
          const tx = (W / 2 - tapX) * (s - 1);
          const ty = (H / 2 - tapY) * (s - 1);
          curScale.current = s;
          savedTX.current  = Math.max(-mx, Math.min(mx, tx));
          savedTY.current  = Math.max(-my, Math.min(my, ty));
          Animated.parallel([
            Animated.spring(zoomSc, { toValue: s,               useNativeDriver: true }),
            Animated.spring(zoomTX, { toValue: savedTX.current, useNativeDriver: true }),
            Animated.spring(zoomTY, { toValue: savedTY.current, useNativeDriver: true }),
          ]).start();
        }
        return;
      }

      lastTapTime.current = now;
      lastTapX.current    = tapX;
      lastTapY.current    = tapY;

      // Single tap outside photo area → close (only when not zoomed)
      if (curScale.current <= 1 && (tapY < PHOTO_TOP || tapY > PHOTO_BOTTOM)) {
        onCloseRef.current();
      }
    }
  };

  const handleTouchCancel = () => {
    pinching.current   = false;
    sliding.current    = false;
    liveSlideX.current = 0;
    if (!animating.current) springBackSlide();
  };

  // ── Open / close ──────────────────────────────────────────────────
  const wasOpen     = useRef(false);
  const prevVisible = useRef(false);

  useEffect(() => {
    if (isOpen) {
      resetZoom();
      lastTapTime.current = 0;
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
      {/* Gesture layer — onTouch* provides reliable multi-touch data on Android */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ scale: contentSc }] }]}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        {prevUri && (
          <Animated.Image
            source={{ uri: prevUri }}
            style={[s.img, { transform: [{ translateX: txPrev }] }]}
            resizeMode="contain"
          />
        )}
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
