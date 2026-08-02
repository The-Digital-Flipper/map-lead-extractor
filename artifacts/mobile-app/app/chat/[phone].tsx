import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import React, { useRef, useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiFetch } from "@/hooks/useApi";
import { useColors } from "@/hooks/useColors";

interface SmsMessage {
  id: number;
  direction: "inbound" | "outbound";
  body: string;
  sentAt: string;
}

interface Thread {
  messages: SmsMessage[];
  phone: string;
  name: string | null;
}

function timeStr(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Bubble({ msg, isMine, colors }: { msg: SmsMessage; isMine: boolean; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.bubbleWrap, isMine ? styles.bubbleRight : styles.bubbleLeft]}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isMine ? colors.primary : colors.card,
            borderColor: isMine ? colors.primary : colors.border,
          },
        ]}
      >
        <Text style={[styles.bubbleText, { color: isMine ? colors.primaryForeground : colors.foreground }]}>
          {msg.body}
        </Text>
      </View>
      <Text style={[styles.bubbleTime, { color: colors.mutedForeground, alignSelf: isMine ? "flex-end" : "flex-start" }]}>
        {timeStr(msg.sentAt)}
      </Text>
    </View>
  );
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { adminToken } = useAdminAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const decodedPhone = decodeURIComponent(phone ?? "");

  const { data, isLoading } = useQuery<Thread>({
    queryKey: ["sms-thread", decodedPhone],
    queryFn: () =>
      apiFetch(`/api/sms/conversation/${encodeURIComponent(decodedPhone)}`, {
        adminToken: adminToken ?? undefined,
      }),
    enabled: !!adminToken && !!decodedPhone && decodedPhone !== "new",
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      apiFetch("/api/sms/reply", {
        method: "POST",
        body: JSON.stringify({ to: decodedPhone, body }),
        adminToken: adminToken ?? undefined,
      }),
    onSuccess: () => {
      setInput("");
      queryClient.invalidateQueries({ queryKey: ["sms-thread", decodedPhone] });
      queryClient.invalidateQueries({ queryKey: ["sms-conversations"] });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  });

  const messages = [...(data?.messages ?? [])].reverse();
  const contactName = data?.name ?? decodedPhone;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      {/* Nav bar */}
      <View
        style={[
          styles.navBar,
          {
            paddingTop: topPad + 4,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.navTitle}>
          <Text style={[styles.navName, { color: colors.foreground }]} numberOfLines={1}>
            {contactName}
          </Text>
          <Text style={[styles.navPhone, { color: colors.mutedForeground }]}>{decodedPhone}</Text>
        </View>
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <Bubble msg={item} isMine={item.direction === "outbound"} colors={colors} />
          )}
          inverted
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12 }}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8),
          },
        ]}
      >
        <TextInput
          style={[
            styles.inputField,
            { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground },
          ]}
          placeholder="Message..."
          placeholderTextColor={colors.mutedForeground}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={1600}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: input.trim() ? colors.primary : colors.secondary,
            },
          ]}
          onPress={() => {
            if (input.trim() && !sendMutation.isPending) {
              sendMutation.mutate(input.trim());
            }
          }}
          disabled={!input.trim() || sendMutation.isPending}
          activeOpacity={0.8}
        >
          <Feather name="send" size={16} color={input.trim() ? colors.primaryForeground : colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navTitle: { flex: 1 },
  navName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  navPhone: { fontSize: 12, fontFamily: "Inter_400Regular" },
  bubbleWrap: { marginBottom: 8, maxWidth: "80%" },
  bubbleLeft: { alignSelf: "flex-start" },
  bubbleRight: { alignSelf: "flex-end" },
  bubble: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bubbleTime: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 3, marginHorizontal: 4 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputField: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
