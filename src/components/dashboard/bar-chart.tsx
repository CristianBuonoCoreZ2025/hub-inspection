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

interface BarChartGlassProps {
  data: Array<{ name: string; value: number; color?: string }>
  height?: number
  color?: string
  horizontal?: boolean
}

export function BarChartGlass({
  data,
  height,
  color = "#0095DA",
  horizontal = false,
}: BarChartGlassProps) {
  return (
    <div className="dash-chart-wrap" style={height ? { height } : undefined}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? "vertical" : "horizontal"}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
        <defs>
          <linearGradient id="bar-grad" x1="0" y1="0" x2={horizontal ? "1" : "0"} y2={horizontal ? "0" : "1"}>
            <stop offset="0%" stopColor={color} stopOpacity={0.9} />
            <stop offset="100%" stopColor={color} stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          horizontal={!horizontal}
          vertical={horizontal}
        />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={90}
            />
          </>
        ) : (
          <>
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
          </>
        )}
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
          fill="url(#bar-grad)"
          radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
          maxBarSize={50}
        >
          {data.map((entry, index) => (
            <Cell
              key={`bar-cell-${index}`}
              fill={entry.color ? entry.color : "url(#bar-grad)"}
            />
          ))}
        </Bar>
      </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
