import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Task } from '../types/task';
import { CategoryBadge, PriorityBadge } from './TagBadge';
import { C, S, F } from '../lib/theme';

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onPress: (task: Task) => void;
}

export default function TaskCard({ task, onToggle, onDelete, onPress }: Props) {
  const opacity = React.useRef(
    new Animated.Value(task.completed ? 0.38 : 1)
  ).current;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: task.completed ? 0.38 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [task.completed]);

  return (
    <Animated.View
      style={[
        styles.card,
        { opacity },
        task.priority === 'urgent' && styles.cardUrgent,
      ]}
    >
      <TouchableOpacity
        onPress={() => onPress(task)}
        activeOpacity={0.7}
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

        {task.time ? (
          <Text style={styles.timeText}>◷  {task.time}</Text>
        ) : null}
      </TouchableOpacity>

      <View style={styles.actions}>
        {task.completed ? (
          <TouchableOpacity
            onPress={() => onToggle(task.id)}
            style={styles.doneBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.doneBtnText}>完成</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => onToggle(task.id)}
            style={styles.checkBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.checkIcon}>○</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => onDelete(task.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.deleteBtn}
        >
          <Text style={styles.deleteIcon}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.layer01,
    borderRadius: 4,
    marginHorizontal: S.s05,
    marginVertical: S.s02,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardUrgent: {
    borderLeftWidth: 3,
    borderLeftColor: C.supportError,
  },
  cardBody: {
    flex: 1,
    padding: S.s05,
    gap: S.s03,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: S.s03,
  },
  actions: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: S.s04,
    paddingRight: S.s05,
    paddingLeft: S.s02,
  },
  checkBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.borderSubtle01,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    fontSize: 13,
    color: C.borderSubtle01,
  },
  doneBtn: {
    backgroundColor: C.supportSuccessBg,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.supportSuccess,
    paddingHorizontal: 6,
    paddingVertical: S.s02,
  },
  doneBtnText: {
    fontSize: 11,
    color: C.supportSuccess,
    fontWeight: '600',
    fontFamily: F.semiBold,
  },
  deleteBtn: {
    padding: S.s01,
  },
  deleteIcon: {
    fontSize: 13,
    color: C.iconDisabled,
  },
  targetText: {
    fontSize: 16,
    color: C.textPrimary,
    fontWeight: '600',
    fontFamily: F.semiBold,
    lineHeight: 22,
  },
  targetDone: {
    textDecorationLine: 'line-through',
    color: C.textDisabled,
  },
  timeText: {
    fontSize: 12,
    color: C.textSecondary,
    fontFamily: F.regular,
    marginTop: S.s01,
  },
});
