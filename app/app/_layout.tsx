import {
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Link, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, View } from "react-native";
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
  // Space Grotesk (headlines, hero numbers, the wordmark) + JetBrains Mono
  // (tabular prices/percentages/stats) are what give BioLens its own
  // typographic identity instead of falling back to each platform's default
  // system sans — see constants/theme.ts's fontFamily doc comment.
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_700Bold,
    SpaceGrotesk_600SemiBold,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  });
  const isWide = useIsWideWeb();

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  // Shared by every screen that wants a plain back-arrow header on the
  // near-black canvas — company/[id] and every auth/* screen.
  const barebackHeaderOptions = {
    headerShown: true,
    title: "",
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.textPrimary,
    headerShadowVisible: false,
    contentStyle: {
      backgroundColor: colors.background,
      ...(isWide ? centeredColumn : null),
    },
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

  return (
    <ThemeProvider value={navigationTheme}>
      <AuthProvider>
        <CompaniesProvider>
          <WatchlistProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="company/[id]" options={withHomeFallback(barebackHeaderOptions)} />
              <Stack.Screen name="compare" options={withHomeFallback(barebackHeaderOptions)} />
              <Stack.Screen name="track-record" options={withHomeFallback(barebackHeaderOptions)} />
              <Stack.Screen name="disclaimer" options={withHomeFallback(barebackHeaderOptions)} />
              <Stack.Screen name="privacy" options={withHomeFallback(barebackHeaderOptions)} />
              <Stack.Screen
                name="stock-detail"
                options={{
                  presentation: "modal",
                  contentStyle: barebackHeaderOptions.contentStyle,
                }}
              />
              <Stack.Screen name="auth/sign-up" options={withHomeFallback(authHeaderOptions)} />
              <Stack.Screen name="auth/log-in" options={withHomeFallback(authHeaderOptions)} />
              <Stack.Screen
                name="auth/forgot-password"
                options={withHomeFallback(authHeaderOptions)}
              />
              <Stack.Screen
                name="auth/change-password"
                options={withHomeFallback(authHeaderOptions)}
              />
              <Stack.Screen
                name="auth/delete-account"
                options={withHomeFallback(authHeaderOptions)}
              />
            </Stack>
          </WatchlistProvider>
        </CompaniesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
