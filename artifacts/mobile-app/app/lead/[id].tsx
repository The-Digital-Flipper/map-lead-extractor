import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Lead } from "@/components/LeadCard";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiFetch } from "@/hooks/useApi";
import { useColors } from "@/hooks/useColors";

const STATUS_OPTIONS = ["new", "contacted", "converted", "lost"] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const STATUS_COLORS: Record<Status, string> = {
  new: "#00e663",
  contacted: "#f59e0b",
  converted: "#3b82f6",
  lost: "#6b7280",
};

function InfoRow({ icon, label, value, onPress }: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.infoRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <Feather name={icon} size={16} color={colors.mutedForeground} style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: onPress ? colors.primary : colors.foreground }]}>
          {value}
        </Text>
      </View>
      {onPress ? <Feather name="external-link" size={13} color={colors.primary} /> : null}
    </TouchableOpacity>
  );
}

export default function LeadDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { adminToken } = useAdminAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [editingNote, setEditingNote] = useState(false);

  const { data: lead, isLoading } = useQuery<Lead>({
    queryKey: ["lead", id],
    queryFn: async () => {
      const res = await apiFetch<{ leads: Lead[] }>(
        `/api/leads/?id=${id}`,
        { adminToken: adminToken ?? undefined }
      );
      return res.leads[0];
    },
    enabled: !!adminToken && !!id,
  });

  const { data: noteData } = useQuery<{ note: string | null }>({
    queryKey: ["lead-note", id],
    queryFn: () => apiFetch(`/api/leads/notes?ids=${id}`, { adminToken: adminToken ?? undefined }),
    enabled: !!adminToken && !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: Status) =>
      apiFetch(`/api/leads/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
        adminToken: adminToken ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead", id] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const noteMutation = useMutation({
    mutationFn: (noteText: string) =>
      apiFetch(`/api/leads/${id}/note`, {
        method: "PUT",
        body: JSON.stringify({ note: noteText }),
        adminToken: adminToken ?? undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-note", id] });
      setEditingNote(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (isLoading || !lead) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const currentStatus = (lead.status as Status) ?? "new";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Back button + header */}
      <View style={[styles.navBar, { paddingTop: topPad + 4 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      <View style={styles.titleSection}>
        <Text style={[styles.leadName, { color: colors.foreground }]}>{lead.name}</Text>
        {[lead.category, lead.city, lead.state].filter(Boolean).join(" · ") ? (
          <Text style={[styles.leadMeta, { color: colors.mutedForeground }]}>
            {[lead.category, lead.city, lead.state].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        {lead.rating != null ? (
          <Text style={[styles.rating, { color: "#f59e0b" }]}>{"★".repeat(Math.round(lead.rating))} {lead.rating.toFixed(1)}</Text>
        ) : null}
      </View>

      {/* Status row */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>STATUS</Text>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((s) => {
            const active = currentStatus === s;
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: active ? STATUS_COLORS[s] : colors.secondary,
                    borderColor: active ? STATUS_COLORS[s] : colors.border,
                  },
                ]}
                onPress={() => statusMutation.mutate(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.statusChipText, { color: active ? "#fff" : colors.mutedForeground }]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Contact info */}
      <View style={[styles.section]}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>CONTACT</Text>
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {lead.phone ? (
            <InfoRow
              icon="phone"
              label="Phone"
              value={lead.phone}
              onPress={() => Linking.openURL(`tel:${lead.phone}`)}
            />
          ) : null}
          {lead.email ? (
            <InfoRow
              icon="mail"
              label="Email"
              value={lead.email}
              onPress={() => Linking.openURL(`mailto:${lead.email}`)}
            />
          ) : null}
          {lead.website ? (
            <InfoRow
              icon="globe"
              label="Website"
              value={lead.website}
              onPress={() => Linking.openURL(lead.website!.startsWith("http") ? lead.website! : `https://${lead.website}`)}
            />
          ) : null}
          {!lead.phone && !lead.email && !lead.website ? (
            <Text style={[styles.emptyContact, { color: colors.mutedForeground }]}>No contact info</Text>
          ) : null}
        </View>
      </View>

      {/* Score */}
      {lead.score != null ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>OPPORTUNITY SCORE</Text>
          <View style={[styles.scoreBar, { backgroundColor: colors.secondary }]}>
            <View
              style={[
                styles.scoreBarFill,
                {
                  width: `${lead.score}%`,
                  backgroundColor:
                    lead.score >= 80 ? colors.primary : lead.score >= 60 ? "#f59e0b" : "#f2564d",
                },
              ]}
            />
          </View>
          <Text style={[styles.scoreText, { color: colors.foreground }]}>{lead.score}/100</Text>
        </View>
      ) : null}

      {/* Note */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>NOTE</Text>
        {editingNote ? (
          <View style={[styles.noteBox, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            <TextInput
              style={[styles.noteInput, { color: colors.foreground }]}
              placeholder="Add a note..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              value={note}
              onChangeText={setNote}
              autoFocus
            />
            <View style={styles.noteActions}>
              <TouchableOpacity onPress={() => { setEditingNote(false); setNote(""); }}>
                <Text style={[styles.noteCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.noteSaveBtn, { backgroundColor: colors.primary }]}
                onPress={() => noteMutation.mutate(note)}
                disabled={noteMutation.isPending}
              >
                <Text style={[styles.noteSaveBtnText, { color: colors.primaryForeground }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.noteBox, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              setNote(typeof noteData === "object" && noteData !== null ? String((noteData as Record<string, unknown>)?.note ?? "") : "");
              setEditingNote(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.notePlaceholder, { color: colors.mutedForeground }]}>
              {typeof noteData === "object" && noteData !== null && (noteData as Record<string, unknown>)?.note
                ? String((noteData as Record<string, unknown>).note)
                : "Tap to add a note..."}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  navBar: { paddingHorizontal: 16, paddingBottom: 8 },
  titleSection: { paddingHorizontal: 16, paddingBottom: 16, gap: 4 },
  leadName: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  leadMeta: { fontSize: 14, fontFamily: "Inter_400Regular" },
  rating: { fontSize: 14, fontFamily: "Inter_500Medium" },
  section: { paddingHorizontal: 16, paddingBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  infoCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 1 },
  infoValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
  emptyContact: { padding: 16, fontSize: 14, fontFamily: "Inter_400Regular" },
  scoreBar: { height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 6 },
  scoreBarFill: { height: "100%", borderRadius: 3 },
  scoreText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  noteBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    minHeight: 80,
  },
  noteInput: { fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 60, textAlignVertical: "top" },
  notePlaceholder: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  noteActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 10 },
  noteCancelText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  noteSaveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  noteSaveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
