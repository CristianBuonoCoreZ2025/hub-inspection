"use client";

import { useQuery } from "@tanstack/react-query";
import { getInspectionSessionById } from "@/services/inspections";
import { useAuth } from "@/hooks/use-auth";
import ReportTab from "@/app/dashboard/inspecciones/[id]/report-tab";
import { Loader2, AlertCircle } from "lucide-react";

export default function MobileReportTab({ sessionId }: { sessionId: string }) {
  const { profile } = useAuth();

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ["inspection-session", sessionId],
    queryFn: () => getInspectionSessionById(sessionId),
    enabled: !!sessionId,
  });

  if (isLoading) {
    return (
      <div className="mobile-empty">
        <Loader2 className="h-6 w-6 animate-spin mobile-empty-icon" />
        <p className="mobile-empty-text">Cargando informe...</p>
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="mobile-empty">
        <AlertCircle className="h-6 w-6 mobile-empty-icon" />
        <p className="mobile-empty-text">No se pudo cargar el informe</p>
      </div>
    );
  }

  const claim = session.claim;
  const insured = claim?.claims_participants?.find((p) => p.type === "insured");

  return (
    <ReportTab
      session={session}
      profile={profile ? {
        id: profile.id,
        company: profile.company ? {
          name: profile.company.name,
          logo_url: profile.company.logo_url,
          phone: profile.company.phone,
          email: profile.company.email,
          address: profile.company.address,
        } : null,
      } : null}
      claimNumber={claim?.claim_number}
      claimLiquidationNumber={claim?.liquidation_number}
      claimAddress={claim?.claim_address}
      insuredName={insured?.full_name}
      insuredRut={insured?.rut}
      insuredPhone={insured?.phone}
      insuredEmail={insured?.email}
      claimCause={claim?.claim_cause?.name}
      claimDate={claim?.claim_date}
      commune={claim?.commune?.name}
      hideZip
    />
  );
}
