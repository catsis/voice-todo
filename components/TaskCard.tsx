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
        {/* Badges */}
        <View style={styles.badges}>
          <CategoryBadge category={task.category} />
          <PriorityBadge priority={task.priority} />
        </View>

        {/* Target */}
        <Text
          style={[styles.targetText, task.completed && styles.targetDone]}
          numberOfLines={2}
        >
          {task.target}
        </Text>

        {/* Time */}
        {task.time ? (
          <Text style={styles.timeText}>◷  {task.time}</Text>
        ) : null}
      </TouchableOpacity>

      {/* Actions */}
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
    backgroundColor: '#17171C',
    borderRadius: 14,
    marginHorizontal: 16,
    marginVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardUrgent: {
    borderLeftWidth: 3,
    borderLeftColor: '#F56565',
  },
  cardBody: {
    flex: 1,
    padding: 16,
    gap: 7,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  actions: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingRight: 16,
    paddingLeft: 4,
  },
  checkBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#50507A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: {
    fontSize: 13,
    color: '#50507A',
  },
  doneBtn: {
    backgroundColor: 'rgba(61, 204, 136, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3DCC88',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  doneBtnText: {
    fontSize: 11,
    color: '#3DCC88',
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 2,
  },
  deleteIcon: {
    fontSize: 13,
    color: '#555578',
  },
  targetText: {
    fontSize: 16,
    color: '#EAEAF0',
    fontWeight: '600',
    lineHeight: 22,
  },
  targetDone: {
    textDecorationLine: 'line-through',
    color: '#35354A',
  },
  timeText: {
    fontSize: 12,
    color: '#7878A0',
    marginTop: 2,
  },
});
