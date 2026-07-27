"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Users, Building2, UserCircle2, Globe } from "lucide-react";
import { fetchClaimContacts, type EmailContact } from "@/services/email-contacts";

interface EmailContactBookProps {
  claimId: string;
  open: boolean;
  onClose: () => void;
  onAddRecipient: (email: string, field: "to" | "cc" | "bcc") => void;
}

const GROUP_LABELS: Record<EmailContact["group"], { label: string; icon: typeof Users }> = {
  participants: { label: "Participantes del Siniestro", icon: Users },
  team: { label: "Equipo del Siniestro", icon: Building2 },
  advisor: { label: "Asesor", icon: UserCircle2 },
  global: { label: "Directorio Global", icon: Globe },
};

/**
 * Libreta de direcciones reutilizable — mini Outlook contact book.
 *
 * Panel lateral con contactos agrupados, deduplicados por email.
 * Usa los mismos patrones visuales que el resto del sistema:
 *  - bg-background, border-border, text-muted-foreground
 *  - Sin clases custom paralelas, inline Tailwind como el preview
 */
export function EmailContactBook({
  claimId,
  open,
  onClose,
  onAddRecipient,
}: EmailContactBookProps) {
  const [search, setSearch] = useState("");

  const { data: contacts, isLoading } = useQuery<EmailContact[]>({
    queryKey: ["email-contacts", claimId],
    queryFn: () => fetchClaimContacts(claimId),
    enabled: open,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    if (!contacts) return [];
    const q = search.toLowerCase().trim();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.fullName?.toLowerCase().includes(q) ?? false) ||
        c.roles.some((r) => r.toLowerCase().includes(q))
    );
  }, [contacts, search]);

  const grouped = useMemo(() => {
    const map = new Map<EmailContact["group"], EmailContact[]>();
    for (const c of filtered) {
      const arr = map.get(c.group) || [];
      arr.push(c);
      map.set(c.group, arr);
    }
    return map;
  }, [filtered]);

  if (!open) return null;

  return (
    <div className="flex flex-col overflow-hidden w-72 border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          Contactos
          {contacts && (
            <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40">
              {contacts.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Cerrar"
          className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/10 shrink-0">
        <Search className="h-3 w-3 text-muted-foreground shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar…"
          className="flex-1 bg-transparent border-0 outline-none text-[11px] text-foreground"
          autoFocus
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
            <p className="text-[11px]">Cargando contactos…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
            <Users className="h-6 w-6 opacity-40" />
            <p className="text-[11px]">{search ? "Sin resultados" : "No hay contactos"}</p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([group, items]) => {
            const meta = GROUP_LABELS[group];
            const Icon = meta.icon;
            return (
              <div key={group}>
                <div className="sticky top-0 z-10 px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground bg-background/80 backdrop-blur-sm border-b border-border/20">
                  <Icon className="h-2.5 w-2.5 inline mr-1" />
                  {meta.label} ({items.length})
                </div>
                {items.map((contact) => {
                  const initials = (contact.fullName || contact.email)
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  return (
                    <div
                      key={contact.email}
                      className="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors border-b border-border/15 hover:bg-primary/8"
                      onClick={() => onAddRecipient(contact.email, "to")}
                      title={`Agregar ${contact.email} a Para`}
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-medium text-white shrink-0 email-icon-gradient">
                        {initials}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-[11px] font-medium text-foreground truncate">
                          {contact.fullName || contact.email}
                        </span>
                        {contact.fullName && (
                          <span className="text-[10px] text-muted-foreground truncate font-mono">
                            {contact.email}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-0.5 shrink-0">
                        {contact.roles.slice(0, 2).map((role) => (
                          <span
                            key={role}
                            className={`text-[8px] px-1 py-0.5 rounded font-medium ${
                              contact.isInternal
                                ? "bg-primary/12 text-primary"
                                : "bg-muted/40 text-muted-foreground"
                            }`}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onAddRecipient(contact.email, "to")}
                          className="text-[8px] px-1 py-0.5 rounded font-medium bg-muted/30 text-muted-foreground hover:bg-primary/15 hover:text-primary transition-colors"
                          title="Para"
                        >
                          Para
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddRecipient(contact.email, "cc")}
                          className="text-[8px] px-1 py-0.5 rounded font-medium bg-muted/30 text-muted-foreground hover:bg-primary/15 hover:text-primary transition-colors"
                          title="CC"
                        >
                          CC
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddRecipient(contact.email, "bcc")}
                          className="text-[8px] px-1 py-0.5 rounded font-medium bg-muted/30 text-muted-foreground hover:bg-primary/15 hover:text-primary transition-colors"
                          title="CCO"
                        >
                          CCO
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
