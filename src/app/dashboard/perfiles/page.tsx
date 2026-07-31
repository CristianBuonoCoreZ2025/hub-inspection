"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Shield, Users } from "lucide-react";

import { usePermissions } from "@/hooks/use-permissions";
import { getAllUserTypeDataAccess, updateUserTypeDataAccess } from "@/services/user-type-data-access";
import { getAllPermissions, userTypeLabels, sectionLabels } from "@/services/permissions";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { UserTypeDataAccess, UserRole, UserTypePermission } from "@/types";

const ROLE_ORDER: UserRole[] = ["internal", "adjuster", "inspector", "assistant", "auditor", "dispatcher"];

export default function PerfilesPage() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canEdit = can("perfiles", "edit");

  const { data: allAccess, isLoading: isLoadingAccess } = useQuery({
    queryKey: ["user-type-data-access"],
    queryFn: getAllUserTypeDataAccess,
  });

  const { data: allPermissions, isLoading: isLoadingPermissions } = useQuery({
    queryKey: ["user-type-permissions-all"],
    queryFn: getAllPermissions,
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      userType,
      isAdmin,
      seeAll,
    }: { userType: UserRole; isAdmin?: boolean; seeAll?: boolean }) => {
      const set: Partial<Pick<UserTypeDataAccess, "is_admin" | "see_all_client_claims">> = {};
      if (isAdmin !== undefined) set.is_admin = isAdmin;
      if (seeAll !== undefined) set.see_all_client_claims = seeAll;
      return updateUserTypeDataAccess(userType, set);
    },
    onSuccess: () => {
      toast.success("Perfil actualizado");
      queryClient.invalidateQueries({ queryKey: ["user-type-data-access"] });
      queryClient.invalidateQueries({ queryKey: ["auth-data-access"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleToggle = (userType: UserRole, key: "is_admin" | "see_all_client_claims", value: boolean) => {
    const isAdmin = key === "is_admin" ? value : undefined;
    const seeAll = key === "is_admin" && value ? true : key === "see_all_client_claims" ? value : undefined;
    updateMutation.mutate({ userType, isAdmin, seeAll });
  };

  const accessMap = new Map(allAccess?.map((d) => [d.user_type, d]));
  const permissionsByType = new Map<UserRole, UserTypePermission[]>();
  for (const p of allPermissions || []) {
    const arr = permissionsByType.get(p.user_type) || [];
    arr.push(p);
    permissionsByType.set(p.user_type, arr);
  }

  const isLoading = isLoadingAccess || isLoadingPermissions;

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Perfiles</h1>
        <p className="app-page-lead">
          Configura el acceso a datos que tiene cada perfil de usuario.
        </p>
      </header>

      {isLoading ? (
        <div className="app-panel flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4">
          {ROLE_ORDER.map((role) => {
            const access = accessMap.get(role);
            const permissions = permissionsByType.get(role) || [];
            const viewSections = permissions
              .filter((p) => p.can_view)
              .map((p) => sectionLabels[p.section as keyof typeof sectionLabels] || p.section);

            return (
              <div key={role} className="app-panel p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="app-section-title">{userTypeLabels[role]}</h2>
                      <p className="app-body text-muted-foreground text-sm">{role}</p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          <Label htmlFor={`${role}-admin`} className="app-body font-medium">
                            Administrador
                          </Label>
                        </div>
                        <p className="app-body text-xs text-muted-foreground">
                          Acceso total. No aplica restricción de siniestros ni clientes.
                        </p>
                      </div>
                      <Switch
                        id={`${role}-admin`}
                        disabled={!canEdit}
                        checked={access?.is_admin ?? false}
                        onCheckedChange={(v) => handleToggle(role, "is_admin", v)}
                      />
                    </div>

                    <div
                      className={`flex items-center justify-between gap-4 p-3 rounded-lg border border-border ${
                        access?.is_admin ? "opacity-50" : ""
                      }`}
                    >
                      <div className="space-y-0.5">
                        <Label htmlFor={`${role}-see-all`} className="app-body font-medium">
                          Ver todos los siniestros de sus clientes
                        </Label>
                        <p className="app-body text-xs text-muted-foreground">
                          Puede ver todo lo de las compañías asignadas a su usuario.
                        </p>
                      </div>
                      <Switch
                        id={`${role}-see-all`}
                        disabled={!canEdit || access?.is_admin}
                        checked={access?.is_admin || access?.see_all_client_claims}
                        onCheckedChange={(v) => handleToggle(role, "see_all_client_claims", v)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="app-body text-sm font-medium text-muted-foreground">
                      Secciones visibles
                    </h3>
                    {viewSections.length === 0 ? (
                      <p className="app-body text-sm text-muted-foreground">Sin accesos configurados.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {viewSections.map((section) => (
                          <span
                            key={section}
                            className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
                          >
                            {section}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
