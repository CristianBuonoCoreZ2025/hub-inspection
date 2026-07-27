"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Users, Building2, UserCircle2, Globe } from "lucide-react";
import { fetchClaimContacts, type EmailContact } from "@/services/email-contacts";

interface EmailContactBookProps {
  /** ID del siniestro para cargar los contactos */
  claimId: string;
  /** Si el panel está abierto */
  open: boolean;
  /** Callback para cerrar el panel */
  onClose: () => void;
  /** Agregar email a un campo (Para/CC/CCO) */
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
 * Panel lateral con contactos agrupados:
 *  - Participantes del siniestro (asegurado, beneficiario, contratista, contacto)
 *  - Equipo del siniestro (liquidador, inspector, asistente, auditor, despachador)
 *  - Asesor
 *  - Directorio global (todos los usuarios del sistema)
 *
 * Deduplicado por email con roles combinados.
 * Search en tiempo real por nombre o email.
 * Click en Para/CC/CCO para agregar al campo correspondiente.
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
    staleTime: 30_000, // 30s — los contactos no cambian cada segundo
  });

  // Filtrar por search
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

  // Agrupar por group
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
    <div className="app-contact-book w-72">
      {/* Header */}
      <div className="app-contact-book-header">
        <div className="app-contact-book-title">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          Contactos
          {contacts && (
            <span className="app-contact-book-count">{contacts.length}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="app-compose-btn h-6 w-6"
          title="Cerrar libreta"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Search */}
      <div className="app-contact-book-search">
        <Search className="h-3 w-3 text-muted-foreground shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email o rol…"
          className="app-contact-book-search-input"
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
      <div className="app-contact-book-list">
        {isLoading ? (
          <div className="app-contact-empty">
            <p className="text-[11px]">Cargando contactos…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="app-contact-empty">
            <Users className="h-6 w-6 opacity-40" />
            <p className="text-[11px]">
              {search ? "Sin resultados" : "No hay contactos"}
            </p>
          </div>
        ) : (
          Array.from(grouped.entries()).map(([group, items]) => {
            const meta = GROUP_LABELS[group];
            const Icon = meta.icon;
            return (
              <div key={group}>
                <div className="app-contact-group-header">
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
                      className="app-contact-item"
                      onClick={() => onAddRecipient(contact.email, "to")}
                      title={`Agregar ${contact.email} a Para`}
                    >
                      <div className="app-contact-item-avatar">{initials}</div>
                      <div className="app-contact-item-info">
                        <span className="app-contact-item-name">
                          {contact.fullName || contact.email}
                        </span>
                        {contact.fullName && (
                          <span className="app-contact-item-email">{contact.email}</span>
                        )}
                      </div>
                      <div className="app-contact-item-roles">
                        {contact.roles.slice(0, 2).map((role) => (
                          <span
                            key={role}
                            className={`app-contact-item-role ${
                              contact.isInternal ? "app-contact-item-role-internal" : ""
                            }`}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                      <div className="app-contact-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => onAddRecipient(contact.email, "to")}
                          className="app-contact-action-btn"
                          title="Para"
                        >
                          Para
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddRecipient(contact.email, "cc")}
                          className="app-contact-action-btn"
                          title="CC"
                        >
                          CC
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddRecipient(contact.email, "bcc")}
                          className="app-contact-action-btn"
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
