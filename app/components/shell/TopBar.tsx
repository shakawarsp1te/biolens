import { Ionicons } from "@expo/vector-icons";
import { Link, useGlobalSearchParams, usePathname } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, spacing } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useCompanies } from "../../context/CompaniesContext";
import { Text } from "../ui/Text";
import GlobalSearch from "./GlobalSearch";
import { breadcrumbFor } from "./routes";

/** Desktop top bar: where you are, the global search, and your account. */
export default function TopBar() {
  const pathname = usePathname();
  const { id } = useGlobalSearchParams<{ id?: string }>();
  const { getById } = useCompanies();
  const { user } = useAuth();
  const crumbs = breadcrumbFor(pathname, id ? getById(id)?.name : undefined);

  return (
    <View style={styles.bar}>
      <View style={styles.crumbs}>
        {crumbs.map((crumb, i) => (
          <React.Fragment key={crumb + i}>
            {i > 0 ? (
              <Ionicons name="chevron-forward" size={12} color={colors.textTertiary} />
            ) : null}
            {i < crumbs.length - 1 && crumb === "Company Explorer" ? (
              <Link href="/discover" asChild>
                <Pressable>
                  <Text style={styles.crumbLink}>{crumb}</Text>
                </Pressable>
              </Link>
            ) : (
              <Text style={styles.crumb} numberOfLines={1}>
                {crumb}
              </Text>
            )}
          </React.Fragment>
        ))}
      </View>
      <GlobalSearch />
      <View style={styles.right}>
        {user ? (
          <Link href="/profile" asChild>
            <Pressable style={styles.account}>
              <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.accountText} numberOfLines={1}>
                {user.email}
              </Text>
            </Pressable>
          </Link>
        ) : (
          <Link href="/auth/log-in" asChild>
            <Pressable style={styles.account}>
              <Text style={styles.accountText}>Log in</Text>
            </Pressable>
          </Link>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.sidebar,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    zIndex: 10,
  },
  crumbs: { flexDirection: "row", alignItems: "center", gap: 6, width: 240 },
  crumb: { fontSize: 13, fontWeight: "600", color: colors.textPrimary, flexShrink: 1 },
  crumbLink: { fontSize: 13, color: colors.textSecondary },
  right: { flex: 1, alignItems: "flex-end" },
  account: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 220 },
  accountText: { fontSize: 13, color: colors.textSecondary },
});
