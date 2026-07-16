"use client"

import * as React from "react"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"

interface DonutChartProps {
  data: Array<{ name: string; value: number; color: string }>
  height?: number
  innerRadius?: number
  outerRadius?: number
}

export function DonutChart({
  data,
  height,
  innerRadius = 55,
  outerRadius = 85,
}: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <div className="dash-chart-wrap" style={height ? { height } : undefined}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {data.map((entry, index) => (
              <linearGradient key={`grad-${index}`} id={`donut-grad-${index}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={entry.color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={entry.color} stopOpacity={0.6} />
              </linearGradient>
            ))}
          </defs>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={3}
            cornerRadius={6}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={`url(#donut-grad-${index})`}
                style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.1))" }}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "color-mix(in srgb, var(--card) 85%, transparent)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              fontSize: "11px",
            }}
            formatter={(value) => [
              `${value} (${total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0}%)`,
              "",
            ]}
          />
          <Legend
            verticalAlign="bottom"
            height={28}
            iconType="circle"
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
