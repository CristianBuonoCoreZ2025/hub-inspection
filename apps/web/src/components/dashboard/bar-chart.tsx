"use client"

import * as React from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { useUiThemeId } from "@/hooks/use-ui-theme-id"

interface BarChartGlassProps {
  data: Array<{ name: string; value: number; color?: string; label?: string }>
  height?: number
  color?: string
  horizontal?: boolean
  valueInside?: boolean
  tickFormatter?: (value: number) => string
  seriesName?: string
}

export function getHorizontalBarLabelWidth(names: string[]): string {
  const longestName = names.reduce((longest, name) => name.length > longest.length ? name : longest, "")
  const fallbackWidth = longestName.length * 5.2 + 12

  if (typeof document === "undefined") {
    return `${Math.min(280, Math.max(96, Math.ceil(fallbackWidth)))}px`
  }

  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")
  if (!context) return `${Math.min(280, Math.max(96, Math.ceil(fallbackWidth)))}px`

  context.font = "500 9px system-ui, sans-serif"
  const measuredWidth = names.reduce(
    (longest, name) => Math.max(longest, context.measureText(name).width),
    0,
  )

  return `${Math.min(280, Math.max(96, Math.ceil(measuredWidth + 12)))}px`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace(/^#/, "")
  if (normalized.length !== 6) return null
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
  return { r, g, b }
}

function getReadableTextColor(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor)
  if (!rgb) return "#ffffff"
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.55 ? "#1f2937" : "#ffffff"
}

export function BarChartGlass({
  data,
  height,
  color = "#0095DA",
  horizontal = false,
  valueInside = false,
  tickFormatter,
  seriesName = "Cantidad",
}: BarChartGlassProps) {
  const themeId = useUiThemeId()
  const isNordicDark = themeId === "nordic-air-dark"
  const isAurora = themeId === "fluid-aurora"
  const uid = React.useId()
  const baseGradId = `bar-grad-${uid}`
  const itemGradId = (i: number) => `bar-grad-item-${uid}-${i}`

  const maxValue = React.useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data])
  const labelColumnWidth = React.useMemo(
    () => getHorizontalBarLabelWidth(data.map((entry) => entry.name)),
    [data],
  )

  if (horizontal) {
    return (
      <div
        className={`dash-chart-wrap horizontal-bar-list${valueInside ? " horizontal-bar-list-inside-values" : ""}${isNordicDark ? " horizontal-bar-list-outline" : ""}`}
        style={{
          ...(height ? { height } : {}),
          "--horizontal-bar-label-width": labelColumnWidth,
        } as React.CSSProperties}
        role="img"
        aria-label={`Gráfica de ${seriesName.toLowerCase()}`}
      >
        <div className="horizontal-bar-rows">
          {data.map((entry, index) => {
            const pct = (entry.value / maxValue) * 100;
            const display = entry.label ?? (tickFormatter ? tickFormatter(entry.value) : entry.value);
            const fill = entry.color || color;
            return (
              <div className="horizontal-bar-row" key={`${entry.name}-${index}`}>
                <div className="horizontal-bar-name" aria-label={entry.name}>
                  {entry.name}
                </div>
                <div
                  className="horizontal-bar-track"
                  aria-label={`${entry.name} — ${seriesName}: ${display}`}
                >
                  <div
                    className="horizontal-bar-fill"
                    style={
                      isNordicDark
                        ? {
                            width: `${pct}%`,
                            background: "transparent",
                            border: `1.5px solid ${fill}`,
                            borderRadius: "6px",
                          }
                        : isAurora
                        ? {
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${fill}cc, ${fill}66)`,
                            border: `1px solid ${fill}80`,
                            borderRadius: "6px",
                            boxShadow: `0 0 12px ${fill}60`,
                          }
                        : {
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${fill}e6, ${fill}80)`,
                          }
                    }
                  >
                    {valueInside && (
                      <span
                        className="horizontal-bar-value horizontal-bar-value-inside"
                        style={{ color: isNordicDark ? fill : getReadableTextColor(fill) }}
                      >
                        {display}
                      </span>
                    )}
                  </div>
                  {!valueInside && <span className="horizontal-bar-value">{display}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="dash-chart-wrap" style={height ? { height } : undefined}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
        <defs>
          <linearGradient id={baseGradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.9} />
            <stop offset="100%" stopColor={color} stopOpacity={0.5} />
          </linearGradient>
          {data.map((entry, index) => (
            entry.color ? (
              <linearGradient key={itemGradId(index)} id={itemGradId(index)} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={entry.color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={entry.color} stopOpacity={0.5} />
              </linearGradient>
            ) : null
          ))}
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={50}
        />
        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "color-mix(in srgb, var(--card) 85%, transparent)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            fontSize: "11px",
          }}
          cursor={{ fill: "rgba(0, 149, 218, 0.06)" }}
        />
        <Bar
          dataKey="value"
          name={seriesName}
          fill={isNordicDark ? "none" : `url(#${baseGradId})`}
          stroke={isNordicDark ? color : undefined}
          strokeWidth={isNordicDark ? 1.5 : undefined}
          fillOpacity={isAurora ? 0.75 : (isNordicDark ? 0 : undefined)}
          radius={[6, 6, 0, 0]}
          maxBarSize={50}
          isAnimationActive
          animationDuration={800}
        >
          {data.map((entry, index) => (
            <Cell
              key={`bar-cell-${index}`}
              fill={isNordicDark ? "none" : (entry.color ? `url(#${itemGradId(index)})` : `url(#${baseGradId})`)}
              stroke={isNordicDark ? (entry.color || color) : undefined}
              strokeWidth={isNordicDark ? 1.5 : undefined}
              fillOpacity={isAurora ? 0.75 : undefined}
            />
          ))}
        </Bar>
      </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
