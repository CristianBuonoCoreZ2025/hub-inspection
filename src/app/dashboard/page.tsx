import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Timer,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const metrics = [
  {
    label: "Casos abiertos",
    value: 124,
    change: "+12%",
    trend: "up" as const,
    icon: FileText,
  },
  {
    label: "Casos cerrados",
    value: 89,
    change: "+5%",
    trend: "up" as const,
    icon: CheckCircle,
  },
  {
    label: "Casos pendientes",
    value: 34,
    change: "-8%",
    trend: "down" as const,
    icon: Clock,
  },
  {
    label: "Casos en revisión",
    value: 18,
    change: "+2%",
    trend: "up" as const,
    icon: AlertCircle,
  },
  {
    label: "Inspecciones programadas",
    value: 42,
    change: "+15%",
    trend: "up" as const,
    icon: Calendar,
  },
  {
    label: "Tiempo promedio de resolución",
    value: "3.2 días",
    change: "-10%",
    trend: "down" as const,
    icon: Timer,
  },
]

const recentActivity = [
  {
    id: "1",
    text: "Nuevo siniestro creado #2025-001",
    time: "Hace 2 horas",
    icon: FileText,
  },
  {
    id: "2",
    text: "Inspección completada para #2024-089",
    time: "Hace 4 horas",
    icon: CheckCircle,
  },
  {
    id: "3",
    text: "Evidencia subida por Juan Pérez",
    time: "Hace 5 horas",
    icon: Activity,
  },
  {
    id: "4",
    text: "Usuario María García asignada a #2025-002",
    time: "Hace 8 horas",
    icon: Clock,
  },
  {
    id: "5",
    text: "Informe firmado para #2024-075",
    time: "Hace 1 día",
    icon: CheckCircle,
  },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Resumen general de la operación de inspecciones.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {metrics.map((metric) => {
          const Icon = metric.icon
          const TrendIcon =
            metric.trend === "up" ? ArrowUpRight : ArrowDownRight
          const trendColor =
            metric.trend === "up"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"

          return (
            <Card key={metric.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="size-4 text-primary" />
                  <span className="truncate">{metric.label}</span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight">
                    {metric.value}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs">
                  <TrendIcon className={trendColor} />
                  <span className={trendColor}>{metric.change}</span>
                  <span className="text-muted-foreground">vs. mes pasado</span>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {recentActivity.map((item, index) => {
              const Icon = item.icon
              return (
                <div key={item.id}>
                  <div className="flex items-start gap-3 py-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      <Icon className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <p className="text-sm font-medium">{item.text}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.time}
                      </p>
                    </div>
                  </div>
                  {index < recentActivity.length - 1 && (
                    <Separator />
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
