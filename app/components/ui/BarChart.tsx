import React, { useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line, Path, Text as SvgText } from "react-native-svg";
import { colors, fontFamily, numeric, radii, spacing, typography } from "../../constants/theme";
import { Text } from "./Text";

export type BarSeries = {
  name: string;
  color: string;
  /** One value per category; null = not reported (no bar is drawn). */
  values: (number | null)[];
};

type Props = {
  categories: string[];
  series: BarSeries[];
  formatValue: (value: number) => string;
  formatAxis: (value: number) => string;
  height?: number;
  /** Whole-number axis ticks (for counts). */
  integer?: boolean;
};

const AXIS_WIDTH = 52;
const TOP_PAD = 8;
const BOTTOM_PAD = 22;
const MAX_BAR = 24;
const BAR_GAP = 2;
const END_RADIUS = 3;

/** ~4 round-number ticks spanning [min, max], always including zero.
 * `integer` keeps the step at 1 or more, for counts. */
function niceTicks(min: number, max: number, integer = false): number[] {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  const span = hi - lo || 1;
  const raw = span / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const step = integer ? Math.max(1, Math.ceil(nice)) : nice;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + step * 0.001; v += step) ticks.push(Number(v.toPrecision(12)));
  if (ticks[ticks.length - 1] < hi) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** A bar from the zero line to `y`, rounded only at its data end. */
function barPath(x: number, width: number, zeroY: number, y: number): string {
  const r = Math.min(END_RADIUS, width / 2, Math.abs(zeroY - y));
  if (y <= zeroY) {
    return `M${x},${zeroY} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${zeroY} Z`;
  }
  return `M${x},${zeroY} V${y - r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y - r} V${zeroY} Z`;
}

/**
 * Grouped column chart on one value axis (never two). Hovering a category
 * (or tapping it on touch screens) shows every series' exact value; a
 * series with no figure for a year draws no bar and the tooltip says "Not
 * reported" rather than implying zero. Pair with a table of the same
 * numbers for anyone who can't read the chart.
 */
export default function BarChart({
  categories,
  series,
  formatValue,
  formatAxis,
  height = 200,
  integer = false,
}: Props) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const values = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const ticks = niceTicks(Math.min(0, ...values), Math.max(0, ...values), integer);
  const domainMin = ticks[0];
  const domainMax = ticks[ticks.length - 1];
  const plotHeight = height - TOP_PAD - BOTTOM_PAD;
  const plotWidth = Math.max(0, width - AXIS_WIDTH);
  const y = (v: number) => TOP_PAD + ((domainMax - v) / (domainMax - domainMin || 1)) * plotHeight;
  const zeroY = y(0);

  const band = categories.length > 0 ? plotWidth / categories.length : 0;
  const barWidth = Math.min(MAX_BAR, (band * 0.6 - BAR_GAP * (series.length - 1)) / series.length);
  const groupWidth = barWidth * series.length + BAR_GAP * (series.length - 1);

  return (
    <View>
      {series.length > 1 ? (
        <View style={styles.legend}>
          {series.map((s) => (
            <View key={s.name} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.name}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View
        style={{ height }}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            {ticks.map((tick) => (
              <React.Fragment key={tick}>
                <Line
                  x1={AXIS_WIDTH}
                  x2={width}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={tick === 0 ? colors.borderStrong : colors.chartGrid}
                  strokeWidth={1}
                />
                <SvgText
                  x={AXIS_WIDTH - 8}
                  y={y(tick) + 4}
                  fontSize={11}
                  fontFamily={fontFamily.regular}
                  fill={colors.textTertiary}
                  textAnchor="end"
                >
                  {formatAxis(tick)}
                </SvgText>
              </React.Fragment>
            ))}
            {categories.map((category, ci) => {
              const groupX = AXIS_WIDTH + ci * band + (band - groupWidth) / 2;
              return (
                <React.Fragment key={category}>
                  {active === ci ? (
                    <Path
                      d={`M${AXIS_WIDTH + ci * band},${TOP_PAD} h${band} V${TOP_PAD + plotHeight} h${-band} Z`}
                      fill={colors.surfaceRaised}
                      opacity={0.6}
                    />
                  ) : null}
                  {series.map((s, si) => {
                    const v = s.values[ci];
                    if (v === null || v === 0) return null;
                    return (
                      <Path
                        key={s.name}
                        d={barPath(groupX + si * (barWidth + BAR_GAP), barWidth, zeroY, y(v))}
                        fill={s.color}
                      />
                    );
                  })}
                  <SvgText
                    x={AXIS_WIDTH + ci * band + band / 2}
                    y={height - 6}
                    fontSize={11}
                    fontFamily={fontFamily.regular}
                    fill={active === ci ? colors.textPrimary : colors.textTertiary}
                    textAnchor="middle"
                  >
                    {category}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        ) : null}
        {/* Hit targets: each whole category band, taller than any bar. */}
        <View style={[StyleSheet.absoluteFill, styles.hitRow, { left: AXIS_WIDTH }]}>
          {categories.map((category, ci) => (
            <Pressable
              key={category}
              style={styles.hit}
              onHoverIn={() => setActive(ci)}
              onHoverOut={() => setActive((a) => (a === ci ? null : a))}
              onPress={() => setActive((a) => (a === ci ? null : ci))}
              accessibilityLabel={`${category}: ${series
                .map(
                  (s) =>
                    `${s.name} ${s.values[ci] === null ? "not reported" : formatValue(s.values[ci] as number)}`,
                )
                .join(", ")}`}
            />
          ))}
        </View>
        {active !== null && width > 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.tooltip,
              {
                left: Math.min(
                  Math.max(0, AXIS_WIDTH + active * band + band / 2 - 80),
                  width - 160,
                ),
              },
            ]}
          >
            <Text style={styles.tooltipTitle}>{categories[active]}</Text>
            {series.map((s) => (
              <View key={s.name} style={styles.tooltipRow}>
                <View style={[styles.swatch, { backgroundColor: s.color }]} />
                <Text style={styles.tooltipLabel}>{s.name}</Text>
                <Text style={styles.tooltipValue}>
                  {s.values[active] === null
                    ? "Not reported"
                    : formatValue(s.values[active] as number)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 1 },
  legendText: { ...typography.caption, fontSize: 12, color: colors.textSecondary },
  hitRow: { flexDirection: "row" },
  hit: { flex: 1 },
  tooltip: {
    position: "absolute",
    top: 0,
    width: 160,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: 3,
  },
  tooltipTitle: { ...typography.caption, fontWeight: "600", color: colors.textPrimary },
  tooltipRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tooltipLabel: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  tooltipValue: { ...typography.caption, fontWeight: "500", color: colors.textPrimary, ...numeric },
});
