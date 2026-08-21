/**
 * Access-token persistence. expo-secure-store's native module has no real
 * web implementation (its `.web.js` is an empty stub — calling it on web
 * throws), so this falls back to AsyncStorage there. Native builds get the
 * real Keychain/Keystore-backed encryption SecureStore provides; web gets
 * the same best-effort storage the rest of this app already uses for the
 * watchlist (see services/watchlist.ts) — never worse security than what's
 * already shipped, and real security on the platforms that support it.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const TOKEN_KEY = "biolens_access_token";

export async function getToken(): Promise<string | null> {
  if (Platform.OS === "web") return AsyncStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
