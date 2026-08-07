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

interface NestedDonutData {
  outer: Array<{ name: string; value: number; color: string }>
  inner: Array<{ name: string; value: number; color: string }>
  selectedName?: string | null
  selectedPercent?: number
}

interface NestedDonutChartProps {
  data: NestedDonutData
  onSliceClick?: (name: string) => void
  showLegend?: boolean
  label?: string
}

function PieSliceLabel(props: {
  cx?: number
  cy?: number
  midAngle?: number
  innerRadius?: number
  outerRadius?: number
  percent?: number
}) {
  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props
  if (percent < 0.04) return null
  const RADIAN = Math.PI / 180
  const r = (innerRadius + outerRadius) / 2
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text
      x={x}
      y={y}
      className="recharts-pie-label-text"
      textAnchor="middle"
      dominantBaseline="central"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export function NestedDonutChart({
  data,
  onSliceClick,
  showLegend = true,
  label,
}: NestedDonutChartProps) {
  const uid = React.useId()
  const outerTotal = data.outer.reduce((sum, d) => sum + d.value, 0)
  const innerTotal = data.inner.reduce((sum, d) => sum + d.value, 0)

  const hasInner = data.inner.length > 0
  const outerGrad = (i: number) => `nested-outer-${uid}-${i}`
  const innerGrad = (i: number) => `nested-inner-${uid}-${i}`

  const centerValue = hasInner ? innerTotal : outerTotal

  return (
    <div className="dash-chart-wrap nested-donut-wrap">
      <div className="nested-donut-center">
        <span className="nested-donut-center-value">{centerValue}</span>
        <span className="nested-donut-center-label">total</span>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {data.outer.map((entry, index) => (
              <linearGradient key={outerGrad(index)} id={outerGrad(index)} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={entry.color} stopOpacity={0.9} />
                <stop offset="100%" stopColor={entry.color} stopOpacity={0.55} />
              </linearGradient>
            ))}
            {data.inner.map((entry, index) => (
              <linearGradient key={innerGrad(index)} id={innerGrad(index)} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={entry.color} stopOpacity={0.85} />
                <stop offset="100%" stopColor={entry.color} stopOpacity={0.5} />
              </linearGradient>
            ))}
          </defs>

          {/* Anillo exterior: por región */}
          <Pie
            data={data.outer}
            cx="50%"
            cy="48%"
            innerRadius={hasInner ? 72 : 55}
            outerRadius={hasInner ? 100 : 85}
            paddingAngle={2}
            cornerRadius={4}
            dataKey="value"
            stroke="none"
            isAnimationActive={false}
            label={PieSliceLabel}
            labelLine={false}
            onClick={(entry: { name?: string }) => {
              if (entry?.name && onSliceClick) onSliceClick(entry.name)
            }}
          >
            {data.outer.map((entry, index) => {
              const isSelected = !data.selectedName || data.selectedName === entry.name
              return (
                <Cell
                  key={`outer-cell-${index}`}
                  fill={`url(#${outerGrad(index)})`}
                  style={{
                    cursor: onSliceClick ? "pointer" : "default",
                    opacity: isSelected ? 1 : 0.25,
                    transition: "opacity 0.2s ease",
                  }}
                />
              )
            })}
          </Pie>

          {/* Anillo interior: por estado de la región seleccionada */}
          {hasInner && (
            <Pie
              data={data.inner}
              cx="50%"
              cy="48%"
              innerRadius={28}
              outerRadius={64}
              paddingAngle={2}
              cornerRadius={3}
              dataKey="value"
              stroke="none"
              isAnimationActive={false}
              label={PieSliceLabel}
              labelLine={false}
            >
              {data.inner.map((entry, index) => (
                <Cell
                  key={`inner-cell-${index}`}
                  fill={`url(#${innerGrad(index)})`}
                  style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.08))" }}
                />
              ))}
            </Pie>
          )}

          <Tooltip
            cursor={false}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "color-mix(in srgb, var(--card) 85%, transparent)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              fontSize: "11px",
            }}
            formatter={(value, _name, props) => {
              const dataKey = props?.payload?.name as string | undefined
              const total = props?.dataKey === "value" && data.inner.length > 0 ? innerTotal : outerTotal
              return [
                `${value} (${total > 0 ? ((Number(value) / total) * 100).toFixed(1) : 0}%)`,
                dataKey || "",
              ]
            }}
          />

          {hasInner && showLegend && (
            <Legend
              verticalAlign="bottom"
              height={28}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "9px" }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      <div className="nested-donut-selected-label">
        {label ? `${label}: ` : ""}
        <span className="nested-donut-selected-name">{data.selectedName || "—"}</span>
        {typeof data.selectedPercent === "number" && data.selectedPercent > 0 && (
          <span className="nested-donut-selected-percent">{` ${data.selectedPercent.toFixed(0)}%`}</span>
        )}
      </div>
    </div>
  )
}
