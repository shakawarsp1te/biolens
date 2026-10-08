import React from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../../constants/theme";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

/** Desktop frame around every route: sidebar | (top bar / page). */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <Sidebar />
      <View style={styles.main}>
        <TopBar />
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", backgroundColor: colors.background },
  main: { flex: 1, minWidth: 0 },
  content: { flex: 1, zIndex: 0 },
});
