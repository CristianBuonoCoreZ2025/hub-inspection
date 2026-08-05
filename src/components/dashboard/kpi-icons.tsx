"use client";

import Image from "next/image";

export function KpiTodayIcon() {
  return (
    <Image
      src="/icons/kpi-today.svg"
      alt="Inspecciones Hoy"
      width={96}
      height={96}
      className="h-24 w-24"
    />
  );
}

export function KpiActiveIcon() {
  return (
    <Image
      src="/icons/kpi-active.svg"
      alt="En curso"
      width={96}
      height={96}
      className="h-24 w-24"
    />
  );
}

export function KpiScheduledIcon() {
  return (
    <Image
      src="/icons/kpi-scheduled.svg"
      alt="Agendadas"
      width={96}
      height={96}
      className="h-24 w-24"
    />
  );
}

export function KpiCompletedIcon() {
  return (
    <Image
      src="/icons/kpi-completed.svg"
      alt="Completadas"
      width={80}
      height={80}
      className="h-20 w-20"
    />
  );
}

export function KpiOverdueIcon() {
  return (
    <Image
      src="/icons/kpi-overdue.svg"
      alt="Con retraso"
      width={96}
      height={96}
      className="h-24 w-24"
    />
  );
}

export function KpiTimeIcon() {
  return (
    <Image
      src="/icons/kpi-time.svg"
      alt="Tiempo Promedio"
      width={96}
      height={96}
      className="h-24 w-24"
    />
  );
}
