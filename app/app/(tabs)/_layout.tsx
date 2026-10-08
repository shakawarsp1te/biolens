import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { colors, fontFamily } from "../../constants/theme";
import { useIsWideWeb } from "../../utils/layout";

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

export default function TabsLayout() {
  const isWide = useIsWideWeb();

  return (
    <Tabs
      // Desktop: the app shell's sidebar is the navigation, so no tab bar.
      tabBar={isWide ? () => null : undefined}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.sidebar,
          borderTopWidth: 1,
          borderTopColor: colors.borderSubtle,
          height: 60,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: fontFamily.medium },
        // Each page sets its own width: research tables use the full width,
        // reading pages (ScreenShell) a narrower column.
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Overview",
          tabBarIcon: tabIcon({ active: "planet", inactive: "planet-outline" }),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Explorer",
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
