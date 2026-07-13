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

interface AreaChartGlassProps {
  data: Array<{ name: string; value: number; value2?: number }>
  height?: number
  color?: string
  color2?: string
  label?: string
  label2?: string
}

export function AreaChartGlass({
  data,
  height = 220,
  color = "#0095DA",
  color2 = "#8b5cf6",
  label = "Siniestros",
  label2,
}: AreaChartGlassProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="area-grad-1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
          {label2 && (
            <linearGradient id="area-grad-2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color2} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color2} stopOpacity={0.02} />
            </linearGradient>
          )}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10 }}
          axisLine={false}
          tickLine={false}
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
          cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Area
          type="monotone"
          dataKey="value"
          name={label}
          stroke={color}
          strokeWidth={2.5}
          fill="url(#area-grad-1)"
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: color, strokeWidth: 2, stroke: "rgba(255,255,255,0.8)" }}
        />
        {label2 && (
          <Area
            type="monotone"
            dataKey="value2"
            name={label2}
            stroke={color2}
            strokeWidth={2.5}
            fill="url(#area-grad-2)"
            dot={{ r: 3, fill: color2, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: color2, strokeWidth: 2, stroke: "rgba(255,255,255,0.8)" }}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}
