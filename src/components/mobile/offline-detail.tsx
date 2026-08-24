"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, FileCheck, ShieldCheck, Camera, PenTool, Pencil } from "lucide-react";
import { getDownloadedSession } from "@/lib/offline/download-session";
import { getGlobalCatalogs, type OfflineSession, type OfflineCatalogs } from "@/db/offline-db";
import MobileActaTab from "@/app/mobile/inspecciones/[id]/tabs/acta-tab";
import MobileDamagesTab from "@/app/mobile/inspecciones/[id]/tabs/damages-tab";
import MobileEvidencesTab from "@/app/mobile/inspecciones/[id]/tabs/evidences-tab";
import MobileSignaturesTab from "@/app/mobile/inspecciones/[id]/tabs/signatures-tab";
import MobileSketchesTab from "@/app/mobile/inspecciones/[id]/tabs/sketches-tab";

type OfflineTab = "acta" | "danos" | "evidencias" | "croquis" | "firmas";

interface MobileOfflineDetailProps {
  sessionId: string;
  onBack: () => void;
}

const TABS: { id: OfflineTab; label: string; icon: typeof FileCheck }[] = [
  { id: "acta", label: "Acta", icon: FileCheck },
  { id: "danos", label: "Daños", icon: ShieldCheck },
  { id: "evidencias", label: "Fotos", icon: Camera },
  { id: "croquis", label: "Croquis", icon: Pencil },
  { id: "firmas", label: "Firmas", icon: PenTool },
];

/**
 * Panel de detalle offline que se renderiza inline en /mobile/inspecciones
 * sin navegar a otra ruta. En dev no hay Service Worker, por lo que no se
 * puede cargar /mobile/inspecciones/[id] estando offline.
 */
export function MobileOfflineDetail({ sessionId, onBack }: MobileOfflineDetailProps) {
  const [offline, setOffline] = useState<OfflineSession | null>(null);
  const [catalogs, setCatalogs] = useState<OfflineCatalogs | null>(null);
  const [activeTab, setActiveTab] = useState<OfflineTab>("acta");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    getDownloadedSession(sessionId).then(setOffline);
    getGlobalCatalogs().then(setCatalogs);
  }, [sessionId, refreshKey]);

  const session = offline?.session;
  const address = session?.claim?.claim_address || "Sin dirección";
  const insured = session?.claim?.claims_participants?.find((p) => p.type === "insured");

  if (!session) {
    return (
      <div className="flex flex-col min-h-dvh items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">Cargando inspección offline...</p>
      </div>
    );
  }

  const onSaved = () => setRefreshKey((k) => k + 1);

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background border-b">
        <div className="px-4 py-3 flex items-center gap-2">
          <button onClick={onBack} className="mobile-offline-icon-btn" aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="mobile-inspection-code truncate flex-1">
            {session.inspection_number || "Sin código"}
          </span>
        </div>
        <div className="px-4 pb-3 space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="truncate">{address}</span>
          </div>
          {insured && (
            <div className="text-xs text-muted-foreground truncate">
              {insured.full_name}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="mobile-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`mobile-tab ${activeTab === t.id ? "active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                <Icon className="h-3 w-3" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === "acta" && (
          <MobileActaTab
            sessionId={sessionId}
            offlineMode
            onOfflineSaved={onSaved}
          />
        )}
        {activeTab === "danos" && (
          <MobileDamagesTab
            sessionId={sessionId}
            propertyClassification={session.property_risk?.risk_class || null}
            countryId={session.claim?.country_id || null}
            sessionStatus={session.status}
            offlineMode
            onOfflineSaved={onSaved}
            offlineCatalogs={catalogs}
            session={session}
          />
        )}
        {activeTab === "evidencias" && (
          <MobileEvidencesTab
            sessionId={sessionId}
            sessionStatus={session.status}
            offlineMode
            onOfflineSaved={onSaved}
          />
        )}
        {activeTab === "croquis" && (
          <MobileSketchesTab
            sessionId={sessionId}
            sessionStatus={session.status}
            offlineMode
            onOfflineSaved={onSaved}
          />
        )}
        {activeTab === "firmas" && (
          <MobileSignaturesTab
            sessionId={sessionId}
            sessionStatus={session.status}
            magicLinkToken={session.magic_link_token || undefined}
            inspectionType={session.inspection_type as "onsite" | "remote"}
            signatureWaiverReason={session.signature_waiver_reason || null}
            offlineMode
            onOfflineSaved={onSaved}
          />
        )}
      </div>
    </div>
  );
}
