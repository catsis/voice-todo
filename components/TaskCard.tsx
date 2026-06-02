import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
} from 'react-native';
import { Task } from '../types/task';
import { CategoryBadge, PriorityBadge } from './TagBadge';
import { C, S, F } from '../lib/theme';

const THRESHOLD = 88;

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPress: (task: Task) => void;
  onToast?: (msg: string) => void;
}

export default function TaskCard({ task, onToggle, onDelete, onPress, onToast }: Props) {
  // Keep latest props accessible inside stable PanResponder callbacks
  const taskRef = useRef(task);
  taskRef.current = task;
  const cbRef = useRef({ onToggle, onDelete, onPress, onToast });
  cbRef.current = { onToggle, onDelete, onPress, onToast };

  const translateX = useRef(new Animated.Value(0)).current;
  const rowOpacity = useRef(new Animated.Value(1)).current;

  function flyOff(dir: 'left' | 'right', callback: () => void) {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: dir === 'right' ? 600 : -600,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(rowOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => callback());
  }

  function snapBack() {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 70,
      friction: 10,
    }).start();
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) + 4 && Math.abs(g.dx) > 8,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > Math.abs(g.dy) + 4 && Math.abs(g.dx) > 8,
      onPanResponderMove: (_, g) => {
        // Rubber-band effect past threshold
        let val = g.dx;
        if (Math.abs(val) > THRESHOLD) {
          val = (val > 0 ? 1 : -1) * (THRESHOLD + (Math.abs(val) - THRESHOLD) * 0.4);
        }
        translateX.setValue(val);
      },
      onPanResponderRelease: (_, g) => {
        const { onToggle, onDelete, onToast } = cbRef.current;
        const t = taskRef.current;

        if (g.dx > THRESHOLD - 4) {
          // Right swipe → toggle complete/undone
          onToast?.(t.completed ? '已恢復待辦' : '已完成');
          flyOff('right', () => {
            onToggle(t.id);
            translateX.setValue(0);
            rowOpacity.setValue(1);
          });
        } else if (g.dx < -(THRESHOLD - 4)) {
          // Left swipe → delete
          onToast?.('已刪除');
          flyOff('left', () => onDelete(t.id));
        } else {
          snapBack();
        }
      },
      onPanResponderTerminate: () => snapBack(),
    })
  ).current;

  // Reveal action backgrounds based on swipe direction
  const leftBgOpacity = translateX.interpolate({
    inputRange: [0, THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const rightBgOpacity = translateX.interpolate({
    inputRange: [-THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.outer, { opacity: rowOpacity }]}>
      <View style={styles.inner}>
        {/* Complete / restore action (right swipe reveals) */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.actionLeft, { opacity: leftBgOpacity }]}>
          <Text style={styles.actionIcon}>{task.completed ? '↺' : '✓'}</Text>
          <Text style={styles.actionText}>{task.completed ? '待辦' : '完成'}</Text>
        </Animated.View>

        {/* Delete action (left swipe reveals) */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.actionRight, { opacity: rightBgOpacity }]}>
          <Text style={styles.actionText}>刪除</Text>
          <Text style={styles.actionIcon}>✕</Text>
        </Animated.View>

        {/* Card — translates on swipe */}
        <Animated.View
          style={[
            styles.card,
            task.completed && styles.cardDone,
            task.priority === 'urgent' && !task.completed && styles.cardUrgent,
            { transform: [{ translateX }] },
          ]}
          {...panResponder.panHandlers}
        >
          <TouchableOpacity
            onPress={() => cbRef.current.onPress(taskRef.current)}
            activeOpacity={0.75}
            style={styles.cardBody}
          >
            <View style={styles.badges}>
              <CategoryBadge category={task.category} />
              <PriorityBadge priority={task.priority} />
            </View>

            <Text
              style={[styles.targetText, task.completed && styles.targetDone]}
              numberOfLines={2}
            >
              {task.target}
            </Text>

            {task.time && !task.completed ? (
              <Text style={styles.timeText}>◷  {task.time}</Text>
            ) : null}

            {task.completed && (
              <View style={styles.doneLabel}>
                <Text style={styles.doneLabelText}>✓ 已完成</Text>
              </View>
            )}

            {(task.images?.length ?? 0) > 0 && (
              <View style={styles.imgBadge}>
                <View style={styles.imgCam}>
                  <View style={styles.imgCamLens} />
                </View>
                <Text style={styles.imgCount}>{task.images!.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginHorizontal: S.s05,
    marginVertical: 6,
  },
  inner: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  // Action backgrounds
  actionLeft: {
    backgroundColor: C.supportSuccess,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 26,
    gap: 10,
  },
  actionRight: {
    backgroundColor: C.supportError,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 26,
    gap: 10,
  },
  actionIcon: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700',
  },
  actionText: {
    fontSize: 17,
    color: '#fff',
    fontFamily: F.bold,
    letterSpacing: 0.5,
  },
  // Card
  card: {
    backgroundColor: C.layer01,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.borderSubtle01,
  },
  cardDone: {
    backgroundColor: '#111a14',
    borderColor: C.supportSuccessBorder,
  },
  cardUrgent: {
    borderLeftWidth: 3,
    borderLeftColor: C.supportError,
  },
  cardBody: {
    padding: S.s05,
    gap: S.s03,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: S.s02,
  },
  targetText: {
    fontSize: 20,
    fontFamily: F.bold,
    color: C.textPrimary,
    lineHeight: 26,
    marginTop: 2,
  },
  targetDone: {
    textDecorationLine: 'line-through',
    color: C.textHelper,
  },
  timeText: {
    fontSize: 12,
    color: C.textSecondary,
    fontFamily: F.regular,
  },
  doneLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: C.supportSuccessBg,
  },
  doneLabelText: {
    fontSize: 12,
    color: C.supportSuccess,
    fontFamily: F.bold,
  },
  imgBadge: {
    position: 'absolute', bottom: 8, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  imgCam: {
    width: 11, height: 8, borderRadius: 1.5,
    borderWidth: 1, borderColor: C.textHelper,
    alignItems: 'center', justifyContent: 'center',
  },
  imgCamLens: {
    width: 4, height: 4, borderRadius: 2,
    borderWidth: 1, borderColor: C.textHelper,
  },
  imgCount: {
    fontSize: 10, color: C.textHelper, fontFamily: F.semiBold,
  },
});
