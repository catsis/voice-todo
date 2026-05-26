import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TaskCategory, Priority } from '../types/task';
import { C, F } from '../lib/theme';

// Carbon g100 categorical color palette
const KNOWN_COLORS: Record<string, { bg: string; text: string }> = {
  請購: { bg: '#2D1000', text: '#FF832B' },
  聯絡: { bg: '#001D6C', text: '#4589FF' },
  聯繫: { bg: '#001D6C', text: '#4589FF' },
  繳費: { bg: '#2D0709', text: '#FF8389' },
  預約: { bg: '#022D0D', text: '#42BE65' },
  開會: { bg: '#1C0F30', text: '#D4BBFF' },
  會議: { bg: '#1C0F30', text: '#D4BBFF' },
  提醒: { bg: '#302400', text: '#F1C21B' },
  記得: { bg: '#302400', text: '#F1C21B' },
  確認: { bg: '#001D1D', text: '#3DDBD9' },
  其他: { bg: C.layer01, text: C.textSecondary },
  待辦: { bg: C.layer01, text: C.textSecondary },
};

const PALETTE = [
  { bg: '#022D0D', text: '#42BE65' },
  { bg: '#001D6C', text: '#4589FF' },
  { bg: '#1C0F30', text: '#D4BBFF' },
  { bg: '#2D1000', text: '#FF832B' },
  { bg: '#001D1D', text: '#3DDBD9' },
  { bg: '#57012A', text: '#FF7EB6' },
  { bg: '#293E00', text: '#A8C353' },
  { bg: '#100839', text: '#BE95FF' },
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
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: F.semiBold,
  },
  smallText: {
    fontSize: 11,
  },
  urgentBadge: {
    backgroundColor: C.supportErrorBg,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.supportErrorBorder,
  },
  urgentText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: F.semiBold,
    color: C.supportError,
  },
});
