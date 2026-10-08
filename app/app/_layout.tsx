import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from "@expo-google-fonts/ibm-plex-sans";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Link, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, View } from "react-native";
import AppShell from "../components/shell/AppShell";
import Wordmark from "../components/Wordmark";
import { colors, spacing } from "../constants/theme";
import { AuthProvider } from "../context/AuthContext";
import { CompaniesProvider } from "../context/CompaniesContext";
import { WatchlistProvider } from "../context/WatchlistContext";
import { centeredColumn, FORM_MAX_WIDTH, useIsWideWeb } from "../utils/layout";

// React Navigation paints its own containers (the area around a centered
// page on desktop, the tab bar's frame) from its theme, which defaults to
// light gray -- match it to BioLens's canvas instead.
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.border,
    primary: colors.accent,
    text: colors.textPrimary,
  },
};

/** Header-left for a page opened straight from a link (a shared URL, a
 * bookmark): there's no history to go back to, so link home instead of
 * leaving the visitor stranded with no navigation. */
function HomeLink() {
  return (
    <Link href="/" asChild>
      <Pressable style={{ paddingHorizontal: spacing.md }}>
        <Wordmark size="sm" />
      </Pressable>
    </Link>
  );
}

type ScreenOptionsArgs = { navigation: { canGoBack: () => boolean } };

function withHomeFallback<T extends object>(options: T) {
  return ({ navigation }: ScreenOptionsArgs) =>
    navigation.canGoBack() ? options : { ...options, headerLeft: HomeLink };
}

export default function RootLayout() {
  // IBM Plex Sans, one family per weight -- see constants/theme.ts's
  // fontFamily and components/ui/Text.tsx.
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });
  const isWide = useIsWideWeb();

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  // Phones: a plain back-arrow header on the canvas. Desktop: no stack
  // header at all -- the app shell's sidebar and top bar (breadcrumb,
  // search) do that job for every page.
  const barebackHeaderOptions = {
    headerShown: !isWide,
    title: "",
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.textPrimary,
    headerShadowVisible: false,
    contentStyle: {
      backgroundColor: colors.background,
      ...(isWide ? centeredColumn : null),
    },
  };
  // Research dashboards use the full width on desktop; they lay out their
  // own columns.
  const dashboardOptions = {
    ...barebackHeaderOptions,
    contentStyle: { backgroundColor: colors.background },
  };
  // Forms read better as a narrow column than stretched to the full
  // content width on desktop.
  const authHeaderOptions = {
    ...barebackHeaderOptions,
    contentStyle: {
      ...barebackHeaderOptions.contentStyle,
      ...(isWide ? { maxWidth: FORM_MAX_WIDTH } : null),
    },
  };

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="company/[id]" options={withHomeFallback(dashboardOptions)} />
      <Stack.Screen name="compare" options={withHomeFallback(barebackHeaderOptions)} />
      <Stack.Screen name="track-record" options={withHomeFallback(barebackHeaderOptions)} />
      <Stack.Screen name="disclaimer" options={withHomeFallback(barebackHeaderOptions)} />
      <Stack.Screen name="privacy" options={withHomeFallback(barebackHeaderOptions)} />
      <Stack.Screen
        name="stock-detail"
        options={{
          presentation: isWide ? "card" : "modal",
          contentStyle: barebackHeaderOptions.contentStyle,
        }}
      />
      <Stack.Screen name="auth/sign-up" options={withHomeFallback(authHeaderOptions)} />
      <Stack.Screen name="auth/log-in" options={withHomeFallback(authHeaderOptions)} />
      <Stack.Screen name="auth/forgot-password" options={withHomeFallback(authHeaderOptions)} />
      <Stack.Screen name="auth/change-password" options={withHomeFallback(authHeaderOptions)} />
      <Stack.Screen name="auth/delete-account" options={withHomeFallback(authHeaderOptions)} />
    </Stack>
  );

  return (
    <ThemeProvider value={navigationTheme}>
      <AuthProvider>
        <CompaniesProvider>
          <WatchlistProvider>
            <StatusBar style="light" />
            {isWide ? <AppShell>{stack}</AppShell> : stack}
          </WatchlistProvider>
        </CompaniesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
