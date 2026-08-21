import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  GestureResponderEvent,
  PanResponder,
  PanResponderInstance,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle, Defs, Line as SvgLine, LinearGradient, Path, Stop } from "react-native-svg";
import { colors, radii, spacing, typography } from "../constants/theme";
import { StockHistoryPoint } from "../services/api";

interface Props {
  points: StockHistoryPoint[];
  width: number;
  height: number;
  /** Tapping (not dragging) the chart calls this — used by the compact
   * card to open the detailed view. Omit on the detail screen itself. */
  onExpand?: () => void;
}

// A tap is allowed this much finger movement before it's treated as a
// crosshair drag instead — small enough to feel deliberate, large enough
// to absorb an imprecise finger.
const TAP_MOVEMENT_THRESHOLD = 6;

function formatTime(unixSeconds: number, spanSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  // Intraday ranges show a clock time; anything spanning multiple days
  // shows a calendar date instead — matching what's actually useful to
  // read off the crosshair at that zoom level.
  if (spanSeconds <= 60 * 60 * 24 * 6) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/**
 * Self-contained SVG line chart with a drag-to-scrub crosshair (built on
 * core RN PanResponder, no gesture-handler dependency) and tap-to-expand.
 * Used both as the compact sparkline on StockQuoteCard and, larger, on the
 * detailed stock view (app/app/stock-detail.tsx) — same component, same
 * interaction, just a different size and an omitted onExpand.
 */
export default function PriceChart({ points, width, height, onExpand }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const dragDistance = useRef(0);
  const startXY = useRef({ x: 0, y: 0 });

  const { path, areaPath, min, max, color, coords } = useMemo(
    () => buildChartGeometry(points, width, height),
    [points, width, height],
  );

  // `latest` lets the PanResponder's callbacks (created once, below) always
  // read the current coords/width/onExpand without needing to be recreated
  // on every render. Both the ref write and the PanResponder construction
  // happen inside useEffect rather than in the render body — writing to or
  // reading a ref's `.current` during render itself is disallowed by the
  // stricter react-hooks/refs rule, since render is supposed to be a pure
  // function of props/state.
  const latest = useRef({ coords, width, onExpand });
  useEffect(() => {
    latest.current = { coords, width, onExpand };
  });

  function updateActiveIndex(locationX: number) {
    const { coords: currentCoords, width: currentWidth } = latest.current;
    if (currentCoords.length === 0) return;
    const clamped = Math.max(0, Math.min(currentWidth, locationX));
    const index = Math.round((clamped / currentWidth) * (currentCoords.length - 1));
    setActiveIndex(Math.max(0, Math.min(currentCoords.length - 1, index)));
  }

  const [panResponder, setPanResponder] = useState<PanResponderInstance | null>(null);
  useEffect(() => {
    setPanResponder(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event: GestureResponderEvent) => {
          dragDistance.current = 0;
          startXY.current = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
          updateActiveIndex(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event: GestureResponderEvent) => {
          const { locationX, locationY } = event.nativeEvent;
          dragDistance.current = Math.max(
            dragDistance.current,
            Math.hypot(locationX - startXY.current.x, locationY - startXY.current.y),
          );
          updateActiveIndex(locationX);
        },
        onPanResponderRelease: () => {
          const wasTap = dragDistance.current < TAP_MOVEMENT_THRESHOLD;
          setActiveIndex(null);
          if (wasTap && latest.current.onExpand) latest.current.onExpand();
        },
      }),
    );
  }, []);

  if (points.length < 2) {
    return (
      <View style={[styles.emptyState, { width, height }]}>
        <Text style={styles.emptyStateText}>Not enough data to chart yet.</Text>
      </View>
    );
  }

  const active = activeIndex !== null ? coords[activeIndex] : null;
  const spanSeconds = points[points.length - 1].time - points[0].time;

  return (
    <View style={{ width, height }} {...(panResponder?.panHandlers ?? {})}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.25} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={areaPath} fill="url(#areaFill)" stroke="none" />
        <Path d={path} fill="none" stroke={color} strokeWidth={2} />
        {active ? (
          <>
            <SvgLine
              x1={active.x}
              y1={0}
              x2={active.x}
              y2={height}
              stroke={colors.textTertiary}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <Circle cx={active.x} cy={active.y} r={4.5} fill={color} />
          </>
        ) : null}
      </Svg>

      {active ? (
        <View
          pointerEvents="none"
          style={[
            styles.tooltip,
            { left: Math.min(Math.max(active.x - 55, 0), width - 110) },
          ]}
        >
          <Text style={styles.tooltipPrice}>${points[activeIndex!].close.toFixed(2)}</Text>
          <Text style={styles.tooltipTime}>
            {formatTime(points[activeIndex!].time, spanSeconds)}
          </Text>
        </View>
      ) : null}

      {!active ? (
        <View pointerEvents="none" style={styles.rangeLabelRow}>
          <Text style={styles.rangeLabel}>${min.toFixed(2)}</Text>
          <Text style={styles.rangeLabel}>${max.toFixed(2)}</Text>
        </View>
      ) : null}
    </View>
  );
}

function buildChartGeometry(points: StockHistoryPoint[], width: number, height: number) {
  const closes = points.map((p) => p.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  // Small vertical padding so the line never touches the very top/bottom
  // edge (a peak flattened against the frame reads as clipped, not high).
  const padding = height * 0.1;

  const coords = points.map((point, i) => {
    const x = points.length === 1 ? 0 : (i / (points.length - 1)) * width;
    const y = padding + (1 - (point.close - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(" ");
  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  const isUp = closes[closes.length - 1] >= closes[0];
  const color = isUp ? colors.gain : colors.loss;

  return { path, areaPath, min, max, color, coords };
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  tooltip: {
    position: "absolute",
    top: 4,
    width: 110,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
  },
  tooltipPrice: {
    ...typography.mono,
    fontSize: 14,
    color: colors.textPrimary,
  },
  tooltipTime: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: "400",
  },
  rangeLabelRow: {
    position: "absolute",
    bottom: 2,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  rangeLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: "400",
  },
});
