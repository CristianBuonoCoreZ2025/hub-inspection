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
  Legend,
} from "recharts"
import { getHorizontalBarLabelWidth } from "./bar-chart"

interface BarChartQuadProps {
  data: Array<{ name: string; agendadas: number; enProceso: number; completadas: number; canceladas: number }>
  height?: number
  horizontal?: boolean
}

export function BarChartQuad({
  data,
  height,
  horizontal = false,
}: BarChartQuadProps) {
  const colors = {
    agendadas: "#3b82f6",
    enProceso: "#f59e0b",
    completadas: "#10b981",
    canceladas: "#ef4444",
  }

  const maxValue = React.useMemo(() => Math.max(1, ...data.map((d) => d.agendadas + d.enProceso + d.completadas + d.canceladas)), [data])
  const labelColumnWidth = React.useMemo(
    () => getHorizontalBarLabelWidth(data.map((entry) => entry.name)),
    [data],
  )

  if (horizontal) {
    return (
      <div
        className="dash-chart-wrap horizontal-bar-list"
        style={{
          ...(height ? { height } : {}),
          "--horizontal-bar-label-width": labelColumnWidth,
        } as React.CSSProperties}
      >
        <div className="horizontal-bar-rows">
          {data.map((entry, index) => {
            const total = entry.agendadas + entry.enProceso + entry.completadas + entry.canceladas;
            const pct = (total / maxValue) * 100;
            const segments = [
              { value: entry.agendadas, color: colors.agendadas, name: "Agendadas" },
              { value: entry.enProceso, color: colors.enProceso, name: "En proceso" },
              { value: entry.completadas, color: colors.completadas, name: "Completadas" },
              { value: entry.canceladas, color: colors.canceladas, name: "Canceladas" },
            ];
            const title = `${entry.name} — Total: ${total}`;
            return (
              <div className="horizontal-bar-row" key={`${entry.name}-${index}`} title={title}>
                <div className="horizontal-bar-name">
                  {entry.name}
                </div>
                <div className="horizontal-bar-track quad-track">
                  <div className="horizontal-bar-segments" style={{ width: `${pct}%` }}>
                    {segments.map((s, i) => {
                      if (s.value === 0) return null;
                      const segPct = (s.value / total) * 100;
                      return (
                        <div
                          key={i}
                          className="horizontal-bar-segment"
                          style={{
                            width: `${segPct}%`,
                            background: `linear-gradient(90deg, ${s.color}e6, ${s.color}8c)`,
                          }}
                          title={`${s.name}: ${s.value}`}
                        />
                      );
                    })}
                  </div>
                  <span className="horizontal-bar-value">{total}</span>
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
            <linearGradient id="bar-grad-agend" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.agendadas} stopOpacity="0.9" />
              <stop offset="100%" stopColor={colors.agendadas} stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="bar-grad-proc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.enProceso} stopOpacity="0.9" />
              <stop offset="100%" stopColor={colors.enProceso} stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="bar-grad-compl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.completadas} stopOpacity="0.9" />
              <stop offset="100%" stopColor={colors.completadas} stopOpacity="0.5" />
            </linearGradient>
            <linearGradient id="bar-grad-canc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.canceladas} stopOpacity="0.9" />
              <stop offset="100%" stopColor={colors.canceladas} stopOpacity="0.5" />
            </linearGradient>
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
          <Legend iconType="circle" wrapperStyle={{ fontSize: 9, paddingTop: 0 }} />
          <Bar dataKey="agendadas" name="Agendadas" fill="url(#bar-grad-agend)" radius={[3, 3, 0, 0]} maxBarSize={16} />
          <Bar dataKey="enProceso" name="En proceso" fill="url(#bar-grad-proc)" radius={[3, 3, 0, 0]} maxBarSize={16} />
          <Bar dataKey="completadas" name="Completadas" fill="url(#bar-grad-compl)" radius={[3, 3, 0, 0]} maxBarSize={16} />
          <Bar dataKey="canceladas" name="Canceladas" fill="url(#bar-grad-canc)" radius={[3, 3, 0, 0]} maxBarSize={16} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
