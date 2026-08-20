import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "../constants/theme";
import { WatchlistProvider } from "../context/WatchlistContext";

export default function RootLayout() {
  return (
    <WatchlistProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="company/[id]"
          options={{
            headerShown: true,
            title: "",
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.textPrimary,
            headerShadowVisible: false,
          }}
        />
      </Stack>
    </WatchlistProvider>
  );
}
