import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useColors } from "@/hooks/useColors";

export interface Lead {
  id: number;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  status: string | null;
  score: number | null;
  rating: number | null;
  outreach_step?: number | null;
  contacted_at?: string | null;
}

interface LeadCardProps {
  lead: Lead;
  onPress: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  new: "#00e663",
  contacted: "#f59e0b",
  converted: "#3b82f6",
  lost: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  lost: "Lost",
};

function ScoreDot({ score }: { score: number | null }) {
  const color =
    score == null ? "#6b7280"
    : score >= 80 ? "#00e663"
    : score >= 60 ? "#f59e0b"
    : "#f2564d";
  return <View style={[styles.scoreDot, { backgroundColor: color }]} />;
}

export function LeadCard({ lead, onPress }: LeadCardProps) {
  const colors = useColors();
  const status = lead.status ?? "new";
  const statusColor = STATUS_COLORS[status] ?? "#6b7280";

  const handleCall = () => {
    if (lead.phone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Linking.openURL(`tel:${lead.phone}`);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.row}>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <ScoreDot score={lead.score} />
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
              {lead.name}
            </Text>
          </View>
          <Text style={[styles.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
            {[lead.category, lead.city, lead.state].filter(Boolean).join(" · ")}
          </Text>
          {lead.phone ? (
            <Text style={[styles.phone, { color: colors.mutedForeground }]}>{lead.phone}</Text>
          ) : null}
        </View>
        <View style={styles.right}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "22" }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABELS[status] ?? status}
            </Text>
          </View>
          {lead.phone ? (
            <TouchableOpacity
              style={[styles.callBtn, { backgroundColor: colors.secondary }]}
              onPress={handleCall}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="phone" size={14} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scoreDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  meta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  phone: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  right: {
    alignItems: "flex-end",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  callBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
