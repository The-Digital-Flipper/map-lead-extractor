import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface Industry {
  slug: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  count: string;
}

const INDUSTRIES: Industry[] = [
  { slug: "plumbers", label: "Plumbers", icon: "tool", count: "2,400+" },
  { slug: "electricians", label: "Electricians", icon: "zap", count: "1,800+" },
  { slug: "hvac", label: "HVAC", icon: "wind", count: "1,200+" },
  { slug: "dentists", label: "Dentists", icon: "smile", count: "3,100+" },
  { slug: "restaurants", label: "Restaurants", icon: "coffee", count: "8,000+" },
  { slug: "real-estate-agents", label: "Real Estate", icon: "home", count: "5,200+" },
  { slug: "landscapers", label: "Landscapers", icon: "sun", count: "1,600+" },
  { slug: "auto-repair", label: "Auto Repair", icon: "settings", count: "2,900+" },
  { slug: "roofers", label: "Roofers", icon: "umbrella", count: "1,400+" },
  { slug: "lawyers", label: "Lawyers", icon: "briefcase", count: "2,200+" },
  { slug: "chiropractors", label: "Chiropractors", icon: "activity", count: "800+" },
  { slug: "gyms", label: "Gyms & Fitness", icon: "heart", count: "1,100+" },
  { slug: "cleaning-services", label: "Cleaning", icon: "star", count: "2,600+" },
  { slug: "pest-control", label: "Pest Control", icon: "shield", count: "900+" },
  { slug: "painters", label: "Painters", icon: "feather", count: "1,300+" },
  { slug: "contractors", label: "Contractors", icon: "package", count: "3,400+" },
  { slug: "accountants", label: "Accountants", icon: "file-text", count: "1,700+" },
  { slug: "salons", label: "Hair Salons", icon: "scissors", count: "4,200+" },
  { slug: "veterinarians", label: "Vets", icon: "heart", count: "1,000+" },
  { slug: "mortgage-brokers", label: "Mortgage", icon: "credit-card", count: "900+" },
];

const PACKS = [
  { leads: 100, price: "$29", tag: "Starter" },
  { leads: 500, price: "$99", tag: "Popular" },
  { leads: 1000, price: "$179", tag: "Pro" },
  { leads: 5000, price: "$799", tag: "Agency" },
];

function PackTier({ pack, industry, colors }: { pack: typeof PACKS[0]; industry: Industry; colors: ReturnType<typeof useColors> }) {
  const isPopular = pack.tag === "Popular";
  return (
    <TouchableOpacity
      style={[
        styles.packTier,
        {
          backgroundColor: isPopular ? colors.primary : colors.secondary,
          borderColor: isPopular ? colors.primary : colors.border,
        },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const domain = process.env.EXPO_PUBLIC_DOMAIN || "";
        WebBrowser.openBrowserAsync(`https://${domain}/leads/${industry.slug}`);
      }}
      activeOpacity={0.8}
    >
      <Text style={[styles.packLeads, { color: isPopular ? colors.primaryForeground : colors.foreground }]}>
        {pack.leads.toLocaleString()}
      </Text>
      <Text style={[styles.packLabel, { color: isPopular ? colors.primaryForeground + "bb" : colors.mutedForeground }]}>
        leads
      </Text>
      <Text style={[styles.packPrice, { color: isPopular ? colors.primaryForeground : colors.primary }]}>
        {pack.price}
      </Text>
      {isPopular ? (
        <View style={[styles.popularBadge, { backgroundColor: colors.primaryForeground + "33" }]}>
          <Text style={[styles.popularText, { color: colors.primaryForeground }]}>Popular</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

interface IndustryDetailProps {
  industry: Industry;
  onClose: () => void;
}

function IndustryDetail({ industry, onClose }: IndustryDetailProps) {
  const colors = useColors();
  return (
    <View style={[styles.detail, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.detailHeader}>
        <View style={[styles.detailIconWrap, { backgroundColor: colors.primary + "22" }]}>
          <Feather name={industry.icon} size={24} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.detailName, { color: colors.foreground }]}>{industry.label}</Text>
          <Text style={[styles.detailCount, { color: colors.mutedForeground }]}>
            {industry.count} leads available
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.detailSubtitle, { color: colors.mutedForeground }]}>
        Pick a pack size — CSV delivered to your inbox usually within hours.
      </Text>
      <View style={styles.packRow}>
        {PACKS.map((pack) => (
          <PackTier key={pack.leads} pack={pack} industry={industry} colors={colors} />
        ))}
      </View>
      <TouchableOpacity
        style={[styles.browseBtn, { borderColor: colors.border }]}
        onPress={() => {
          const domain = process.env.EXPO_PUBLIC_DOMAIN || "";
          WebBrowser.openBrowserAsync(`https://${domain}/leads/${industry.slug}`);
        }}
        activeOpacity={0.8}
      >
        <Text style={[styles.browseBtnText, { color: colors.mutedForeground }]}>
          Browse all {industry.label.toLowerCase()} leads on website →
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ShopScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Industry | null>(null);

  const filtered = INDUSTRIES.filter((i) =>
    i.label.toLowerCase().includes(search.toLowerCase())
  );

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const renderItem = ({ item }: { item: Industry }) => (
    <TouchableOpacity
      style={[
        styles.industryCard,
        {
          backgroundColor: selected?.slug === item.slug ? colors.primary + "22" : colors.card,
          borderColor: selected?.slug === item.slug ? colors.primary : colors.border,
        },
      ]}
      onPress={() => {
        Haptics.selectionAsync();
        setSelected(selected?.slug === item.slug ? null : item);
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.industryIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={item.icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.industryName, { color: colors.foreground }]}>{item.label}</Text>
        <Text style={[styles.industryCount, { color: colors.mutedForeground }]}>{item.count}</Text>
      </View>
      <Feather
        name={selected?.slug === item.slug ? "chevron-up" : "chevron-right"}
        size={16}
        color={colors.mutedForeground}
      />
    </TouchableOpacity>
  );

  return (
    <FlatList
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      data={filtered}
      keyExtractor={(item) => item.slug}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View>
          <View style={{ height: topPad + 8 }} />
          <View style={styles.pageHeader}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>Lead Packs</Text>
            <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
              Choose an industry — we source & deliver the CSV.
            </Text>
          </View>
          <View style={[styles.searchWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search industries..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
          </View>
          {selected ? <IndustryDetail industry={selected} onClose={() => setSelected(null)} /> : null}
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pageHeader: { paddingHorizontal: 16, paddingBottom: 12, gap: 4 },
  pageTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  detail: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  detailIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  detailName: { fontSize: 18, fontFamily: "Inter_700Bold" },
  detailCount: { fontSize: 13, fontFamily: "Inter_400Regular" },
  detailSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  packRow: { flexDirection: "row", gap: 8 },
  packTier: {
    flex: 1,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    gap: 2,
  },
  packLeads: { fontSize: 16, fontFamily: "Inter_700Bold" },
  packLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  packPrice: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  popularBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  popularText: { fontSize: 9, fontFamily: "Inter_600SemiBold" },
  browseBtn: { borderTopWidth: 1, paddingTop: 10 },
  browseBtnText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  industryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  industryIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  industryName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  industryCount: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
});
