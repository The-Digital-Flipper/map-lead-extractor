import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiFetch } from "@/hooks/useApi";
import { useColors } from "@/hooks/useColors";

interface Conversation {
  phone: string;
  name: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  direction: "inbound" | "outbound";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function ConversationRow({ item, onPress }: { item: Conversation; onPress: () => void }) {
  const colors = useColors();
  const initials = item.name
    ? item.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : item.phone.slice(-2);

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primary + "33" }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>{initials}</Text>
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
            {item.name ?? item.phone}
          </Text>
          <Text style={[styles.rowTime, { color: colors.mutedForeground }]}>
            {timeAgo(item.lastMessageAt)}
          </Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={[styles.rowPreview, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.direction === "outbound" ? "You: " : ""}{item.lastMessage}
          </Text>
          {item.unreadCount > 0 ? (
            <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.unreadText, { color: colors.primaryForeground }]}>
                {item.unreadCount}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function InboxScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { adminToken } = useAdminAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data, isLoading, isError, refetch } = useQuery<Conversation[]>({
    queryKey: ["sms-conversations"],
    queryFn: () => apiFetch("/api/sms/conversations", { adminToken: adminToken ?? undefined }),
    enabled: !!adminToken,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  if (!adminToken) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState
          icon="lock"
          title="Owner access required"
          subtitle="Enter your admin key in the Account tab to view SMS conversations."
          actionLabel="Go to Account"
          onAction={() => router.push("/(tabs)/account")}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>SMS Inbox</Text>
        <TouchableOpacity
          style={[styles.composeBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/chat/new" as never)}
          activeOpacity={0.8}
        >
          <Feather name="edit-2" size={15} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isError ? (
        <EmptyState
          icon="alert-circle"
          title="Couldn't load conversations"
          subtitle="Check your admin key or Twilio configuration."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          icon="message-square"
          title="No conversations yet"
          subtitle="SMS replies from your leads will appear here."
        />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.phone}
          renderItem={({ item }) => (
            <ConversationRow
              item={item}
              onPress={() => router.push(`/chat/${encodeURIComponent(item.phone)}` as never)}
            />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  pageTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  composeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  rowContent: { flex: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 },
  rowName: { fontSize: 15, fontFamily: "Inter_600SemiBold", flex: 1 },
  rowTime: { fontSize: 12, fontFamily: "Inter_400Regular", marginLeft: 8 },
  rowBottom: { flexDirection: "row", alignItems: "center" },
  rowPreview: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  unreadText: { fontSize: 11, fontFamily: "Inter_700Bold" },
});
