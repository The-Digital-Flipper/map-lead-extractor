import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiFetch } from "@/hooks/useApi";
import { useColors } from "@/hooks/useColors";

function Row({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.menuRow, { borderBottomColor: colors.border }]}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      activeOpacity={0.7}
    >
      <Feather name={icon} size={18} color={destructive ? colors.destructive : colors.mutedForeground} />
      <Text
        style={[styles.menuLabel, { color: destructive ? colors.destructive : colors.foreground }]}
      >
        {label}
      </Text>
      <Feather name="chevron-right" size={16} color={colors.border} />
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{title}</Text>
  );
}

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { adminToken, setAdminToken } = useAdminAuth();
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState("");
  const [showOrderLookup, setShowOrderLookup] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [orderStatus, setOrderStatus] = useState<string | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSaveKey = async () => {
    const trimmed = keyInput.trim();
    if (!trimmed) { setKeyError("Enter a key first."); return; }
    try {
      await apiFetch("/api/admin/stats", { adminToken: trimmed });
      await setAdminToken(trimmed);
      setShowKeyInput(false);
      setKeyInput("");
      setKeyError("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setKeyError("Key is invalid or unreachable.");
    }
  };

  const handleRemoveKey = () => {
    Alert.alert("Remove admin key", "This will sign you out of owner features.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await setAdminToken(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  };

  const handleOrderLookup = async () => {
    if (!orderId.trim()) return;
    setOrderLoading(true);
    setOrderStatus(null);
    try {
      const res = await apiFetch<{ status: string; industry?: string; city?: string }>(
        `/api/leads/pack-order-received?orderId=${encodeURIComponent(orderId.trim())}`
      );
      setOrderStatus(`Status: ${res.status}${res.industry ? ` · ${res.industry}` : ""}${res.city ? `, ${res.city}` : ""}`);
    } catch {
      setOrderStatus("Order not found. Double-check your order ID or email.");
    } finally {
      setOrderLoading(false);
    }
  };

  const domain = process.env.EXPO_PUBLIC_DOMAIN || "";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 8, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>Account</Text>

        {/* Owner access */}
        <SectionHeader title="OWNER ACCESS" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {adminToken ? (
            <>
              <View style={styles.keyRow}>
                <View style={[styles.keyDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.keyConnected, { color: colors.primary }]}>Admin key connected</Text>
              </View>
              <Text style={[styles.keyHint, { color: colors.mutedForeground }]}>
                You have owner access to the Lead CRM and SMS Inbox.
              </Text>
              <TouchableOpacity
                style={[styles.dangerBtn, { borderColor: colors.destructive + "55" }]}
                onPress={handleRemoveKey}
                activeOpacity={0.8}
              >
                <Text style={[styles.dangerBtnText, { color: colors.destructive }]}>Remove key</Text>
              </TouchableOpacity>
            </>
          ) : showKeyInput ? (
            <>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                Enter your admin key (from Settings → Admin Secret)
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                placeholder="sk-admin-..."
                placeholderTextColor={colors.mutedForeground}
                value={keyInput}
                onChangeText={(t) => { setKeyInput(t); setKeyError(""); }}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
              />
              {keyError ? <Text style={[styles.errorText, { color: colors.destructive }]}>{keyError}</Text> : null}
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.outlineBtn, { borderColor: colors.border }]}
                  onPress={() => { setShowKeyInput(false); setKeyInput(""); setKeyError(""); }}
                >
                  <Text style={[styles.outlineBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}
                  onPress={handleSaveKey}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Connect</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.keyHint, { color: colors.mutedForeground }]}>
                Connect your admin key to access the Lead CRM and SMS Inbox.
              </Text>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowKeyInput(true)}
                activeOpacity={0.85}
              >
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>Enter admin key</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Order lookup */}
        <SectionHeader title="TRACK YOUR ORDER" />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.keyHint, { color: colors.mutedForeground }]}>
            Bought a lead pack? Enter your order ID to check status or get your download link.
          </Text>
          {showOrderLookup ? (
            <>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }]}
                placeholder="Order ID..."
                placeholderTextColor={colors.mutedForeground}
                value={orderId}
                onChangeText={setOrderId}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {orderStatus ? (
                <View style={[styles.orderStatusBox, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Text style={[styles.orderStatusText, { color: colors.foreground }]}>{orderStatus}</Text>
                </View>
              ) : null}
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={handleOrderLookup}
                disabled={orderLoading}
                activeOpacity={0.85}
              >
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                  {orderLoading ? "Checking..." : "Check Status"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.outlineBtn, { borderColor: colors.border }]}
              onPress={() => setShowOrderLookup(true)}
            >
              <Feather name="package" size={15} color={colors.primary} />
              <Text style={[styles.outlineBtnText, { color: colors.primary }]}>Track an order</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Links */}
        <SectionHeader title="MORE" />
        <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row icon="globe" label="Visit Website" onPress={() => WebBrowser.openBrowserAsync(`https://${domain}`)} />
          <Row icon="shopping-bag" label="Buy Lead Packs" onPress={() => WebBrowser.openBrowserAsync(`https://${domain}/#leads-for-sale`)} />
          <Row icon="chrome" label="Get Free Extension" onPress={() => WebBrowser.openBrowserAsync(`https://${domain}/free-tool`)} />
          <Row icon="help-circle" label="FAQ" onPress={() => WebBrowser.openBrowserAsync(`https://${domain}/faq`)} />
        </View>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          MapLeadExtractor · v1.0.0
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 0 },
  pageTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5, marginBottom: 20 },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 20,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 4,
  },
  keyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  keyDot: { width: 8, height: 8, borderRadius: 4 },
  keyConnected: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  keyHint: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  inputLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  btnRow: { flexDirection: "row", gap: 10 },
  primaryBtn: { borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  primaryBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  outlineBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  outlineBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  dangerBtn: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  dangerBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  orderStatusBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  orderStatusText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  menuCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  version: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 28 },
});
