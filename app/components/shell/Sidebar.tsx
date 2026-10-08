import { Ionicons } from "@expo/vector-icons";
import { Link, useGlobalSearchParams, usePathname } from "expo-router";
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { colors, spacing, typography } from "../../constants/theme";
import { useCompanies } from "../../context/CompaniesContext";
import { Text } from "../ui/Text";
import Wordmark from "../Wordmark";
import { activeNavHref, COMPANY_TABS, isCompanyTab, NAV_SECTIONS } from "./routes";

export const SIDEBAR_WIDTH = 232;

/**
 * Persistent desktop navigation. On a company page it also shows a
 * "Company" section -- the company's identity and its dashboard views --
 * so moving between views keeps the company in front of you, the way a
 * terminal keeps the security you're analyzing pinned in the sidebar.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ id?: string; tab?: string }>();
  const { getById } = useCompanies();
  const active = activeNavHref(pathname);
  const company = pathname.startsWith("/company/") && params.id ? getById(params.id) : undefined;
  const activeTab = isCompanyTab(params.tab) ? params.tab : "overview";

  return (
    <View style={styles.sidebar}>
      <Link href="/" asChild>
        <Pressable style={styles.brand} accessibilityLabel="BioLens home">
          <Wordmark size="sm" />
        </Pressable>
      </Link>
      <ScrollView contentContainerStyle={styles.scroll}>
        {NAV_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.items.map((item) => (
              <NavRow
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                selected={active === item.href}
              />
            ))}
          </View>
        ))}

        {company ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Company</Text>
            <View style={styles.companyCard}>
              <Text style={styles.companyTicker}>{company.ticker ?? "Private"}</Text>
              <Text style={styles.companyName} numberOfLines={1}>
                {company.name}
              </Text>
            </View>
            {COMPANY_TABS.map((tab) => (
              <NavRow
                key={tab.key}
                href={{ pathname: "/company/[id]", params: { id: company.id, tab: tab.key } }}
                label={tab.label}
                selected={activeTab === tab.key}
                indent
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <NavRow
          href="/profile"
          label="Account"
          icon="person-circle-outline"
          selected={pathname === "/profile"}
        />
        <NavRow
          href="/disclaimer"
          label="Disclaimer & methods"
          icon="information-circle-outline"
          selected={pathname === "/disclaimer"}
        />
      </View>
    </View>
  );
}

function NavRow({
  href,
  label,
  icon,
  selected,
  indent,
}: {
  href: React.ComponentProps<typeof Link>["href"];
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  indent?: boolean;
}) {
  return (
    <Link href={href} asChild>
      {/* Link's asChild merges only static styles, so the hover/selected
          styling lives on an inner View driven by Pressable's state. */}
      <Pressable accessibilityRole="link" accessibilityState={{ selected }}>
        {({ hovered }: { hovered?: boolean }) => (
          <View
            style={[
              styles.row,
              indent && styles.rowIndent,
              hovered && !selected && styles.rowHovered,
              selected && styles.rowSelected,
            ]}
          >
            {selected ? <View style={styles.selectedBar} /> : null}
            {icon ? (
              <Ionicons
                name={icon}
                size={16}
                color={selected ? colors.textPrimary : colors.textTertiary}
              />
            ) : null}
            <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    height: "100%",
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: colors.borderSubtle,
  },
  brand: {
    height: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  scroll: { paddingVertical: spacing.sm },
  section: { marginTop: spacing.md },
  sectionTitle: {
    ...typography.caption,
    fontWeight: "500",
    color: colors.textTertiary,
    paddingHorizontal: spacing.lg,
    marginBottom: 4,
  },
  row: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.lg,
  },
  rowIndent: { paddingLeft: spacing.lg + 6 },
  rowHovered: { backgroundColor: colors.surface },
  rowSelected: { backgroundColor: colors.surfaceRaised },
  selectedBar: {
    position: "absolute",
    left: 0,
    top: 6,
    bottom: 6,
    width: 2,
    backgroundColor: colors.accent,
  },
  rowLabel: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  rowLabelSelected: { color: colors.textPrimary, fontWeight: "500" },
  companyCard: {
    marginHorizontal: spacing.md,
    marginBottom: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 3,
  },
  companyTicker: { fontSize: 13, fontWeight: "600", color: colors.textPrimary },
  companyName: { ...typography.caption, color: colors.textSecondary },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingVertical: spacing.sm,
  },
});
