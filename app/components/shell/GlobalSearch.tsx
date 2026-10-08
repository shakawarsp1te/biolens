import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View, type TextInput as RNTextInput } from "react-native";
import { colors, radii, spacing, typography } from "../../constants/theme";
import { useCompanies } from "../../context/CompaniesContext";
import type { CompanyRecord } from "../../types/domain";
import { Text, TextInput } from "../ui/Text";

const MAX_RESULTS = 8;

type Option = { kind: "company"; company: CompanyRecord } | { kind: "search"; query: string };

function rank(company: CompanyRecord, q: string): number {
  const ticker = company.ticker?.toLowerCase() ?? "";
  const name = company.name.toLowerCase();
  if (ticker === q) return 0;
  if (ticker.startsWith(q)) return 1;
  if (name.startsWith(q)) return 2;
  if (name.includes(q) || ticker.includes(q)) return 3;
  return -1;
}

/**
 * The top bar's company/ticker search. Matches the companies BioLens
 * tracks (exact ticker first, then prefixes, then substrings); the last
 * option always hands the query to the full ClinicalTrials.gov + PubMed
 * search. Keyboard: "/" focuses, arrows move, Enter opens, Esc closes.
 */
export default function GlobalSearch() {
  const router = useRouter();
  const { companies } = useCompanies();
  const inputRef = useRef<RNTextInput>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const options = useMemo<Option[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const matches = companies
      .map((company) => ({ company, score: rank(company, q) }))
      .filter((m) => m.score >= 0)
      .sort((a, b) => a.score - b.score || a.company.name.localeCompare(b.company.name))
      .slice(0, MAX_RESULTS)
      .map(({ company }): Option => ({ kind: "company", company }));
    return [...matches, { kind: "search", query: query.trim() }];
  }, [companies, query]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function choose(option: Option) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    if (option.kind === "company") {
      router.push({ pathname: "/company/[id]", params: { id: option.company.id } });
    } else {
      router.push({ pathname: "/search", params: { q: option.query } });
    }
  }

  function onKeyPress(key: string) {
    if (key === "ArrowDown") setHighlight((h) => Math.min(h + 1, options.length - 1));
    else if (key === "ArrowUp") setHighlight((h) => Math.max(h - 1, 0));
    else if (key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.field}>
        <Ionicons name="search" size={14} color={colors.textTertiary} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setOpen(true);
          }}
          onBlur={() => {
            // Let a click on a result land before the list disappears.
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          onKeyPress={(e) => onKeyPress(e.nativeEvent.key)}
          onSubmitEditing={() => options[highlight] && choose(options[highlight])}
          placeholder="Search company or ticker"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search companies by name or ticker"
        />
        {Platform.OS === "web" ? (
          <View style={styles.kbd}>
            <Text style={styles.kbdText}>/</Text>
          </View>
        ) : null}
      </View>
      {open && options.length > 0 ? (
        <View style={styles.menu} accessibilityRole="menu">
          {options.map((option, i) => (
            <Pressable
              key={option.kind === "company" ? option.company.id : "search"}
              onPress={() => choose(option)}
              onHoverIn={() => setHighlight(i)}
              style={[styles.option, i === highlight && styles.optionActive]}
            >
              {option.kind === "company" ? (
                <>
                  <Text style={styles.optionTicker}>{option.company.ticker ?? "—"}</Text>
                  <Text style={styles.optionName} numberOfLines={1}>
                    {option.company.name}
                  </Text>
                  <Text style={styles.optionMeta}>{option.company.stage}</Text>
                </>
              ) : (
                <>
                  <Ionicons name="flask-outline" size={13} color={colors.textTertiary} />
                  <Text style={styles.optionName} numberOfLines={1}>
                    Search trials and papers for “{option.query}”
                  </Text>
                </>
              )}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 380, maxWidth: "100%", zIndex: 10 },
  field: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  input: {
    flex: 1,
    height: 28,
    fontSize: 13,
    color: colors.textPrimary,
    // RN web draws a focus ring on inputs; the field border is the focus cue.
    outlineStyle: "none",
  } as object,
  kbd: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 2,
    paddingHorizontal: 5,
  },
  kbdText: { ...typography.caption, color: colors.textTertiary },
  menu: {
    position: "absolute",
    top: 34,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 4,
  },
  option: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: 10,
  },
  optionActive: { backgroundColor: colors.surfaceRaised },
  optionTicker: { width: 48, fontSize: 12, fontWeight: "600", color: colors.textPrimary },
  optionName: { flex: 1, fontSize: 13, color: colors.textSecondary },
  optionMeta: { ...typography.caption, color: colors.textTertiary },
});
