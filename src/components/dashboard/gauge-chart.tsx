"use client"

import * as React from "react"
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts"

interface GaugeChartProps {
  value: number
  max?: number
  label?: string
  unit?: string
  color?: string
  size?: number
}

export function GaugeChart({
  value,
  max = 100,
  label = "",
  unit = "%",
  color = "#0095DA",
  size = 200,
}: GaugeChartProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100)

  return (
    <div className="gauge-container dash-gauge" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          data={[{ name: "gauge", value: pct, fill: color }]}
          startAngle={220}
          endAngle={-40}
          innerRadius="72%"
          outerRadius="100%"
          barSize={14}
        >
          <defs>
            <linearGradient id="gauge-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={color} stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            angleAxisId={0}
            fill="url(#gauge-grad)"
            cornerRadius={10}
            background={{ fill: "rgba(128,128,128,0.1)" }}
            style={{ filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.1))" }}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="gauge-center">
        <div className="gauge-value">
          {value.toFixed(value % 1 === 0 ? 0 : 1)}
          {unit !== "%" ? ` ${unit}` : "%"}
        </div>
        {label && <div className="gauge-label">{label}</div>}
      </div>
    </div>
  )
}
