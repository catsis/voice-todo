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
  const opacity = React.useRef(new Animated.Value(task.completed ? 0.55 : 1)).current;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: task.completed ? 0.55 : 1,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [task.completed]);

  return (
    <Animated.View
      style={[
        styles.card,
        task.completed && styles.cardDone,
        task.priority === 'urgent' && !task.completed && styles.cardUrgent,
        { opacity },
      ]}
    >
      <TouchableOpacity
        onPress={() => onPress(task)}
        activeOpacity={0.75}
        style={styles.cardBody}
      >
        {/* Top row: badges + actions */}
        <View style={styles.cardTop}>
          <View style={styles.badges}>
            <CategoryBadge category={task.category} />
            <PriorityBadge priority={task.priority} />
          </View>
          <View style={styles.actions}>
            {task.completed ? (
              <TouchableOpacity
                onPress={() => onToggle(task.id)}
                style={styles.undoBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.undoBtnText}>↺</Text>
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
        </View>

        {/* Title */}
        <Text
          style={[styles.targetText, task.completed && styles.targetDone]}
          numberOfLines={2}
        >
          {task.target}
        </Text>

        {/* Time (hidden when done) */}
        {task.time && !task.completed ? (
          <Text style={styles.timeText}>◷  {task.time}</Text>
        ) : null}

        {/* Done label */}
        {task.completed && (
          <View style={styles.doneLabel}>
            <Text style={styles.doneLabelText}>✓ 已完成</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.layer01,
    borderRadius: 20,
    marginHorizontal: S.s05,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: C.borderSubtle01,
    overflow: 'hidden',
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
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: S.s03,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: S.s02,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.s04,
    flexShrink: 0,
    paddingTop: 2,
  },
  checkBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: C.borderSubtle02,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    fontSize: 10,
    color: C.borderSubtle02,
  },
  undoBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.supportSuccessBorder,
    backgroundColor: C.supportSuccessBg,
  },
  undoBtnText: {
    fontSize: 12,
    color: C.supportSuccess,
    fontFamily: F.semiBold,
  },
  deleteBtn: {
    padding: S.s01,
  },
  deleteIcon: {
    fontSize: 12,
    color: C.iconDisabled,
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
});
