import { Ionicons } from "@expo/vector-icons";
import { BottomTabBar, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import Wordmark from "../../components/Wordmark";
import { colors, spacing } from "../../constants/theme";
import { centeredColumn, useIsWideWeb } from "../../utils/layout";

type IconPair = {
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
};

function tabIcon({ active, inactive }: IconPair) {
  function TabIcon({ color, size, focused }: { color: string; size: number; focused: boolean }) {
    return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
  }
  return TabIcon;
}

const SIDEBAR_WIDTH = 220;

/** Desktop sidebar: the wordmark above the same tab bar React Navigation
 * renders, laid out vertically because tabBarPosition is "left". */
function SidebarTabBar(props: BottomTabBarProps) {
  return (
    <View style={styles.sidebar}>
      <View style={styles.sidebarWordmark}>
        <Wordmark size="sm" />
      </View>
      <BottomTabBar {...props} />
    </View>
  );
}

export default function TabsLayout() {
  const isWide = useIsWideWeb();

  return (
    <Tabs
      tabBar={isWide ? SidebarTabBar : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        ...(isWide
          ? {
              tabBarPosition: "left",
              tabBarLabelPosition: "beside-icon",
              tabBarStyle: {
                backgroundColor: colors.surface,
                borderRightWidth: 0,
                // React Navigation's own sidebar sizing sets a 360px
                // minWidth -- far wider than five short labels need.
                width: SIDEBAR_WIDTH,
                minWidth: SIDEBAR_WIDTH,
                flex: 1,
                paddingTop: 0,
                paddingHorizontal: spacing.sm,
              },
              tabBarItemStyle: {
                justifyContent: "flex-start",
                paddingHorizontal: spacing.md,
                borderRadius: 8,
                maxHeight: 44,
              },
              tabBarActiveBackgroundColor: colors.accentMuted,
              tabBarLabelStyle: {
                fontSize: 15,
                fontWeight: "600",
                marginLeft: spacing.md,
              },
              sceneStyle: { ...centeredColumn, backgroundColor: colors.background },
            }
          : {
              tabBarStyle: {
                backgroundColor: colors.surface,
                borderTopWidth: 0,
                height: 64,
                paddingTop: 8,
              },
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: "600",
              },
            }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: tabIcon({ active: "planet", inactive: "planet-outline" }),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: tabIcon({ active: "compass", inactive: "compass-outline" }),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: tabIcon({ active: "search", inactive: "search-outline" }),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: "Watchlist",
          tabBarIcon: tabIcon({ active: "bookmark", inactive: "bookmark-outline" }),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: tabIcon({ active: "person", inactive: "person-outline" }),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    height: "100%",
    backgroundColor: colors.surface,
  },
  sidebarWordmark: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
});
