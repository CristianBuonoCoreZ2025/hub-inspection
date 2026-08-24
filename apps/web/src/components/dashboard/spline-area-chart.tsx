"use client"

import * as React from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { useUiThemeId } from "@/hooks/use-ui-theme-id"

interface SplineAreaData {
  name: string
  value: number
}

interface SplineAreaChartProps {
  data: SplineAreaData[]
  color?: string
  height?: string
}

export function SplineAreaChart({
  data,
  color = "#00f2ff",
  height,
}: SplineAreaChartProps) {
  const themeId = useUiThemeId()
  const isAurora = themeId === "fluid-aurora"
  const isDark = themeId === "nordic-air-dark" || isAurora
  const uid = React.useId()
  const gradId = `spline-area-${uid}`

  const chartColor = isAurora ? color : color
  const tickFill = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"
  const gridStroke = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)"
  const tooltipBg = isDark ? "rgba(15, 20, 24, 0.9)" : "rgba(255,255,255,0.95)"
  const tooltipBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
  const tooltipColor = isDark ? "#dee3e9" : "#1f2937"
  const labelColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.6)"

  return (
    <div
      className="dash-chart-wrap"
      style={height ? { height } : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartColor} stopOpacity={isAurora ? 0.5 : 0.8} />
              <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={gridStroke}
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: tickFill }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: tickFill }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: tooltipBg,
              border: `1px solid ${tooltipBorder}`,
              borderRadius: "8px",
              backdropFilter: "blur(12px)",
              fontSize: "12px",
              color: tooltipColor,
            }}
            labelStyle={{ color: labelColor }}
            itemStyle={{ color: chartColor }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={chartColor}
            strokeWidth={isAurora ? 2.5 : 2}
            fill={`url(#${gradId})`}
            isAnimationActive
            animationDuration={800}
            dot={{
              fill: isDark ? "#fff" : chartColor,
              r: isAurora ? 4 : 3,
              stroke: chartColor,
              strokeWidth: 2,
            }}
            activeDot={{
              fill: isDark ? "#fff" : chartColor,
              r: isAurora ? 6 : 5,
              stroke: chartColor,
              strokeWidth: 2,
            }}
            style={isAurora ? {
              filter: `drop-shadow(0 0 8px ${chartColor}80)`,
            } : undefined}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
