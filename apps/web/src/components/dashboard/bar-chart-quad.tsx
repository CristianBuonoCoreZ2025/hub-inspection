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
import { useUiThemeId } from "@/hooks/use-ui-theme-id"

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
  const themeId = useUiThemeId()
  const isNordicDark = themeId === "nordic-air-dark"
  const isAurora = themeId === "fluid-aurora"
  const colors = isAurora
    ? { agendadas: "#38bdf8", enProceso: "#f97316", completadas: "#10b981", canceladas: "#f43f5e" }
    : { agendadas: "#3b82f6", enProceso: "#f59e0b", completadas: "#10b981", canceladas: "#ef4444" }

  const maxValue = React.useMemo(() => Math.max(1, ...data.map((d) => d.agendadas + d.enProceso + d.completadas + d.canceladas)), [data])
  const labelColumnWidth = React.useMemo(
    () => getHorizontalBarLabelWidth(data.map((entry) => entry.name)),
    [data],
  )

  if (horizontal) {
    return (
      <div
        className={`dash-chart-wrap horizontal-bar-list${isNordicDark ? " horizontal-bar-list-outline" : ""}`}
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
              <div className="horizontal-bar-row" key={`${entry.name}-${index}`} data-title={title}>
                <div className="horizontal-bar-name">
                  {entry.name}
                </div>
                <div className="horizontal-bar-track quad-track">
                  {isNordicDark ? (() => {
                    const visible = segments.filter((s) => s.value > 0);
                    let cum = 0;
                    const stops: string[] = [];
                    visible.forEach((s) => {
                      const segPct = (s.value / total) * 100;
                      // Rojo con leve transición para suavizar visualmente
                      if (s.color === colors.canceladas) {
                        stops.push(`${s.color}cc ${cum}%`, `${s.color}cc ${cum + segPct}%`);
                      } else {
                        stops.push(`${s.color} ${cum}%`, `${s.color} ${cum + segPct}%`);
                      }
                      cum += segPct;
                    });
                    const borderGradient = `linear-gradient(90deg, ${stops.join(", ")})`;
                    return (
                      <div
                        className="horizontal-bar-segments"
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          borderRadius: "6px",
                          background: borderGradient,
                          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                          WebkitMaskComposite: "xor",
                          maskComposite: "exclude",
                          padding: "1.5px",
                          display: "flex",
                          position: "relative",
                        }}
                      >
                        {segments.map((s, i) => {
                          if (s.value === 0) return null;
                          const segPct = (s.value / total) * 100;
                          return (
                            <div
                              key={i}
                              className="horizontal-bar-segment bg-transparent"
                              style={{ width: `${segPct}%` }}
                            />
                          );
                        })}
                      </div>
                    );
                  })() : (
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
                              background: isAurora
                                ? `linear-gradient(90deg, ${s.color}cc, ${s.color}66)`
                                : `linear-gradient(90deg, ${s.color}e6, ${s.color}8c)`,
                              border: isAurora ? `1px solid ${s.color}80` : undefined,
                              boxShadow: isAurora ? `0 0 10px ${s.color}60` : undefined,
                            }}
                            aria-label={`${s.name}: ${s.value}`}
                          />
                        );
                      })}
                    </div>
                  )}
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
          <Bar dataKey="agendadas" name="Agendadas" fill={isNordicDark ? "none" : "url(#bar-grad-agend)"} fillOpacity={isAurora ? 0.75 : (isNordicDark ? 0 : undefined)} stroke={isNordicDark ? colors.agendadas : undefined} strokeWidth={isNordicDark ? 1.5 : undefined} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive animationDuration={800} />
          <Bar dataKey="enProceso" name="En proceso" fill={isNordicDark ? "none" : "url(#bar-grad-proc)"} fillOpacity={isAurora ? 0.75 : (isNordicDark ? 0 : undefined)} stroke={isNordicDark ? colors.enProceso : undefined} strokeWidth={isNordicDark ? 1.5 : undefined} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive animationDuration={800} />
          <Bar dataKey="completadas" name="Completadas" fill={isNordicDark ? "none" : "url(#bar-grad-compl)"} fillOpacity={isAurora ? 0.75 : (isNordicDark ? 0 : undefined)} stroke={isNordicDark ? colors.completadas : undefined} strokeWidth={isNordicDark ? 1.5 : undefined} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive animationDuration={800} />
          <Bar dataKey="canceladas" name="Canceladas" fill={isNordicDark ? "none" : "url(#bar-grad-canc)"} fillOpacity={isAurora ? 0.75 : (isNordicDark ? 0 : undefined)} stroke={isNordicDark ? colors.canceladas : undefined} strokeWidth={isNordicDark ? 1.5 : undefined} radius={[3, 3, 0, 0]} maxBarSize={16} isAnimationActive animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
