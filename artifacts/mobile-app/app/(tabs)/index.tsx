import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAdminAuth } from "@/hooks/useAdminAuth";
import { BASE_URL, apiFetch } from "@/hooks/useApi";
import { useColors } from "@/hooks/useColors";

interface Stats {
  total?: number;
  today?: number;
  week?: number;
}

interface RecentOrdersCount {
  count: number;
  days: number;
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors = useColors();
  return (
    <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  accent,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[
        styles.quickAction,
        {
          backgroundColor: accent ? colors.primary : colors.card,
          borderColor: accent ? colors.primary : colors.border,
        },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      activeOpacity={0.75}
    >
      <Feather name={icon} size={20} color={accent ? colors.primaryForeground : colors.primary} />
      <Text
        style={[
          styles.quickActionLabel,
          { color: accent ? colors.primaryForeground : colors.foreground },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { adminToken } = useAdminAuth();

  const { data: orderCount, refetch: refetchOrders } = useQuery<RecentOrdersCount>({
    queryKey: ["recent-orders"],
    queryFn: () => apiFetch("/api/stripe/recent-orders-count"),
    staleTime: 60_000,
  });

  const { data: stats, refetch: refetchStats } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: () => apiFetch("/api/admin/stats", { adminToken: adminToken ?? undefined }),
    enabled: !!adminToken,
    staleTime: 60_000,
  });

  const [refreshing, setRefreshing] = React.useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchOrders(), adminToken ? refetchStats() : Promise.resolve()]);
    setRefreshing(false);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: insets.bottom + 100 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.brand, { color: colors.primary }]}>MapLead</Text>
          <Text style={[styles.brandSub, { color: colors.mutedForeground }]}>Extractor</Text>
        </View>
        <TouchableOpacity
          style={[styles.webBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
          onPress={() => WebBrowser.openBrowserAsync(`https://${process.env.EXPO_PUBLIC_DOMAIN || ""}`)}
          activeOpacity={0.8}
        >
          <Feather name="globe" size={15} color={colors.mutedForeground} />
          <Text style={[styles.webBtnText, { color: colors.mutedForeground }]}>Website</Text>
        </TouchableOpacity>
      </View>

      {/* Headline stat */}
      {orderCount && orderCount.count > 0 ? (
        <View style={[styles.heroBanner, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "33" }]}>
          <View style={[styles.heroDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.heroText, { color: colors.primary }]}>
            {orderCount.count} businesses ordered leads this week
          </Text>
        </View>
      ) : null}

      {/* Owner stats (if admin token is set) */}
      {adminToken && stats ? (
        <View style={styles.statsRow}>
          <StatBox label="Total Leads" value={stats.total ?? "—"} color={colors.primary} />
          <StatBox label="This Week" value={stats.week ?? "—"} color={colors.foreground} />
          <StatBox label="Today" value={stats.today ?? "—"} color={colors.foreground} />
        </View>
      ) : null}

      {/* Quick actions */}
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>QUICK ACTIONS</Text>
      <View style={styles.quickGrid}>
        <QuickAction
          icon="shopping-bag"
          label="Browse Lead Packs"
          onPress={() => router.push("/(tabs)/shop")}
          accent
        />
        <QuickAction
          icon="users"
          label="Lead CRM"
          onPress={() => router.push("/(tabs)/leads")}
        />
        <QuickAction
          icon="message-square"
          label="SMS Inbox"
          onPress={() => router.push("/(tabs)/inbox")}
        />
        <QuickAction
          icon="user"
          label="Account & Orders"
          onPress={() => router.push("/(tabs)/account")}
        />
      </View>

      {/* Call to action for customers */}
      <View style={[styles.ctaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.ctaTitle, { color: colors.foreground }]}>
          Ready-made leads, delivered in hours
        </Text>
        <Text style={[styles.ctaBody, { color: colors.mutedForeground }]}>
          Pick any industry and city. We deliver a clean CSV with names, phones, emails, and websites.
        </Text>
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/(tabs)/shop")}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaBtnText, { color: colors.primaryForeground }]}>
            Browse Lead Packs →
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 0 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  brand: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: -4,
  },
  webBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  webBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  heroBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  heroDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  heroText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    gap: 3,
  },
  statValue: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 4,
  },
  quickGrid: {
    gap: 10,
    marginBottom: 24,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  quickActionLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  ctaCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 10,
  },
  ctaTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    lineHeight: 24,
  },
  ctaBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  ctaBtn: {
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  ctaBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
