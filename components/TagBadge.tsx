import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TaskCategory, Priority } from '../types/task';

const KNOWN_COLORS: Record<string, { bg: string; text: string }> = {
  請購: { bg: '#2A1500', text: '#F97316' },
  聯絡: { bg: '#0F1830', text: '#60A5FA' },
  聯繫: { bg: '#0F1830', text: '#60A5FA' },
  繳費: { bg: '#2A0A0A', text: '#F87171' },
  預約: { bg: '#0A2015', text: '#34D399' },
  開會: { bg: '#1A0A2A', text: '#C084FC' },
  會議: { bg: '#1A0A2A', text: '#C084FC' },
  提醒: { bg: '#2A1E00', text: '#FCD34D' },
  記得: { bg: '#2A1E00', text: '#FCD34D' },
  確認: { bg: '#0A1F2A', text: '#38BDF8' },
  其他: { bg: '#1E1E26', text: '#6B6B7A' },
  待辦: { bg: '#1E1E26', text: '#6B6B7A' },
};

const PALETTE = [
  { bg: '#0A2015', text: '#34D399' },
  { bg: '#0F1830', text: '#60A5FA' },
  { bg: '#1A0A2A', text: '#C084FC' },
  { bg: '#2A1500', text: '#F97316' },
  { bg: '#0A2020', text: '#2DD4BF' },
  { bg: '#2A0A18', text: '#F472B6' },
  { bg: '#1A200A', text: '#A3E635' },
  { bg: '#100A2A', text: '#818CF8' },
];

function getCategoryColor(category: string): { bg: string; text: string } {
  if (KNOWN_COLORS[category]) return KNOWN_COLORS[category];
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

interface CategoryBadgeProps {
  category: TaskCategory;
  small?: boolean;
}

export function CategoryBadge({ category, small }: CategoryBadgeProps) {
  const colors = getCategoryColor(category);
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, small && styles.small]}>
      <Text style={[styles.text, { color: colors.text }, small && styles.smallText]}>
        {category}
      </Text>
    </View>
  );
}

interface PriorityBadgeProps {
  priority: Priority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  if (priority !== 'urgent') return null;
  return (
    <View style={styles.urgentBadge}>
      <Text style={styles.urgentText}>急</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
  },
  smallText: {
    fontSize: 11,
  },
  urgentBadge: {
    backgroundColor: 'rgba(245, 101, 101, 0.18)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 101, 101, 0.3)',
  },
  urgentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F56565',
  },
});
