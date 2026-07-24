import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { Lead, LeadCard } from "@/components/LeadCard";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiFetch } from "@/hooks/useApi";
import { useColors } from "@/hooks/useColors";

const STATUSES = ["all", "new", "contacted", "converted", "lost"] as const;
type StatusFilter = (typeof STATUSES)[number];

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  lost: "Lost",
};

interface LeadsResponse {
  leads: Lead[];
  total: number;
}

function AuthWall({ onSignIn }: { onSignIn: () => void }) {
  const colors = useColors();
  return (
    <View style={[styles.authWall, { backgroundColor: colors.background }]}>
      <EmptyState
        icon="lock"
        title="Owner access required"
        subtitle="Enter your admin key in the Account tab to manage your lead CRM."
        actionLabel="Go to Account"
        onAction={onSignIn}
      />
    </View>
  );
}

export default function LeadsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { adminToken } = useAdminAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery<LeadsResponse>({
    queryKey: ["leads", statusFilter, search, page],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: "30",
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(search ? { search } : {}),
      });
      return apiFetch(`/api/leads/?${params}`, { adminToken: adminToken ?? undefined });
    },
    enabled: !!adminToken,
    staleTime: 30_000,
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (!adminToken) {
    return <AuthWall onSignIn={() => router.push("/(tabs)/account")} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.headerWrap, { paddingTop: topPad + 8, backgroundColor: colors.background }]}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>Leads</Text>

        {/* Search bar */}
        <View style={[styles.searchWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search leads..."
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={(t) => { setSearch(t); setPage(1); }}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Feather name="x" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Status filter tabs */}
        <FlatList
          horizontal
          data={STATUSES}
          keyExtractor={(s) => s}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => {
            const active = statusFilter === item;
            return (
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.secondary,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => { setStatusFilter(item); setPage(1); }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {STATUS_LABELS[item]}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Lead list */}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isError ? (
        <EmptyState
          icon="alert-circle"
          title="Couldn't load leads"
          subtitle="Check your admin key and connection."
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : (data?.leads ?? []).length === 0 ? (
        <EmptyState
          icon="users"
          title="No leads yet"
          subtitle="Install the Chrome extension to start scraping leads."
        />
      ) : (
        <FlatList
          data={data?.leads ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <LeadCard lead={item} onPress={() => router.push(`/lead/${item.id}` as never)} />
          )}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
          }
          ListFooterComponent={
            data && data.leads.length < data.total ? (
              <TouchableOpacity
                style={[styles.loadMore, { borderColor: colors.border }]}
                onPress={() => setPage((p) => p + 1)}
              >
                <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load more</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  authWall: { flex: 1 },
  headerWrap: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  pageTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  filterRow: { gap: 8, paddingBottom: 4 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadMore: {
    margin: 16,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  loadMoreText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
