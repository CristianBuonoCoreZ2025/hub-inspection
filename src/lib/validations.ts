import { z } from "zod";
import { validateRut } from "./rut-validator";

export const loginSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  remember: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().min(2, "Nombre completo requerido"),
    email: z.string().email("Correo electrónico inválido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z.string(),
    companyName: z.string().min(2, "Nombre de empresa requerido"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Correo electrónico inválido"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ═══════════════════════════════════════════════════════════════
// SCHEMA COMPLETO (para edición en detalle)
// ═══════════════════════════════════════════════════════════════

export const claimSchema = z.object({
  claimNumber: z.string().min(1, "Número de siniestro requerido"),
  policyNumber: z.string().min(1, "Número de póliza requerido"),
  policyItem: z.string().optional(),
  insuranceCompany: z.string().optional(),
  insuredName: z.string().min(1, "Nombre del asegurado requerido"),
  lastName: z.string().optional(),
  rut: z.string().optional().or(z.literal("")),
  insuredEmail: z.string().email("Correo inválido").optional().or(z.literal("")),
  insuredPhone: z.string().optional(),
  cellPhone: z.string().optional(),
  address: z.string().min(1, "Dirección requerida"),
  city: z.string().min(1, "Ciudad requerida"),
  commune: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional().default("Chile"),
  claimDate: z.string().min(1, "Fecha del siniestro requerida"),
  claimTime: z.string().optional().or(z.literal("")),
  reportDate: z.string().optional().or(z.literal("")),
  assignmentDate: z.string().optional().or(z.literal("")),
  claimType: z.string().min(1, "Tipo de siniestro requerido"),
  claimCause: z.string().optional(),
  contactName: z.string().optional(),
  contactRole: z.string().optional(),
  contactEmail: z.string().email("Correo inválido").optional().or(z.literal("")),
  summary: z.string().optional(),

  contractorName: z.string().optional(),
  contractorLastName: z.string().optional(),
  contractorRut: z.string().optional().or(z.literal("")),
  contractorEmail: z.string().email("Correo inválido").optional().or(z.literal("")),
  contractorPhone: z.string().optional(),
  contractorCellPhone: z.string().optional(),

  beneficiaryName: z.string().optional(),
  beneficiaryLastName: z.string().optional(),
  beneficiaryRut: z.string().optional().or(z.literal("")),
  beneficiaryEmail: z.string().email("Correo inválido").optional().or(z.literal("")),
  beneficiaryPhone: z.string().optional(),
  beneficiaryCellPhone: z.string().optional(),

  assignedAdjusterId: z.string().optional(),
  inspectorId: z.string().optional(),
  adjusterId: z.string().optional(),
  brokerName: z.string().optional(),
  brokerNumber: z.string().optional(),
  advisor: z.string().optional(),
  clientReference: z.string().optional(),
  companyReportNumber: z.string().optional(),
  liquidationNumber: z.string().optional(),
  companyId: z.string().min(1, "Empresa requerida"),
  notes: z.string().optional(),
  statusId: z.string().optional(),
});

export type ClaimInput = z.infer<typeof claimSchema>;

// ═══════════════════════════════════════════════════════════════
// SCHEMA MÍNIMO (para creación rápida desde la grilla)
// ═══════════════════════════════════════════════════════════════

export const claimCreateMinimalSchema = z.object({
  // ── Paso 1: Detalles Siniestro ──
  companyId: z.string().min(1, "Empresa requerida"),
  insuranceCompanyId: z.string().min(1, "Compañía de seguros requerida"),
  claimNumber: z.string().min(1, "Número de siniestro requerido"),
  policyNumber: z.string().min(1, "Número de póliza requerido"),
  clientReference: z.string().optional().or(z.literal("")),
  claimDate: z.string().min(1, "Fecha del siniestro requerida"),
  assignmentDate: z.string().optional().or(z.literal("")),
  reportDate: z.string().optional().or(z.literal("")),
  businessLineId: z.string().optional().or(z.literal("")),
  insuranceProductId: z.string().optional().or(z.literal("")),
  eventId: z.string().optional().or(z.literal("")),
  claimTypeId: z.string().min(1, "Tipo de siniestro requerido"),
  advisorId: z.string().optional().or(z.literal("")),
  brokerId: z.string().optional().or(z.literal("")),
  inspectorId: z.string().min(1, "Inspector requerido"),
  adjusterId: z.string().optional().or(z.literal("")),
  auditorId: z.string().optional().or(z.literal("")),
  dispatcherId: z.string().optional().or(z.literal("")),
  assistantId: z.string().optional().or(z.literal("")),
  // ── Paso 2: Detalles Incidente ──
  claimCauseId: z.string().optional().or(z.literal("")),
  summary: z.string().optional().or(z.literal("")),
  constructionTypeId: z.string().optional().or(z.literal("")),
  habitabilityId: z.string().optional().or(z.literal("")),
  destinationHousingId: z.string().optional().or(z.literal("")),
  propertyClassificationId: z.string().optional().or(z.literal("")),
  ownerSameAsInsured: z.boolean().optional(),
  ownerType: z.string().optional().or(z.literal("")),
  damageClassificationId: z.string().optional().or(z.literal("")),
  // Asegurado
  insuredName: z.string().min(1, "Nombre del asegurado requerido"),
  lastName: z.string().optional().or(z.literal("")),
  rut: z.string().optional().or(z.literal("")),
  insuredEmail: z.string().email("Correo inválido").optional().or(z.literal("")),
  cellPhone: z.string().min(1, "Celular requerido"),
  insuredPhone: z.string().optional().or(z.literal("")),
  insuredAddress: z.string().optional().or(z.literal("")),
  insuredCountry: z.string().optional().or(z.literal("")),
  insuredRegion: z.string().optional().or(z.literal("")),
  insuredCity: z.string().optional().or(z.literal("")),
  insuredCommune: z.string().optional().or(z.literal("")),
  // Dirección del Siniestro
  claimAddress: z.string().min(1, "Dirección del siniestro requerida"),
  claimCountry: z.string().optional().default("Chile"),
  claimRegion: z.string().optional().or(z.literal("")),
  claimCity: z.string().min(1, "Ciudad del siniestro requerida"),
  claimCommune: z.string().optional().or(z.literal("")),
  claimLatitude: z.number().optional().or(z.literal(undefined)),
  claimLongitude: z.number().optional().or(z.literal(undefined)),
  // Contratante
  contractorName: z.string().optional().or(z.literal("")),
  contractorLastName: z.string().optional().or(z.literal("")),
  contractorRut: z.string().optional().or(z.literal("")),
  contractorEmail: z.string().optional().or(z.literal("")),
  contractorCellPhone: z.string().optional().or(z.literal("")),
  contractorPhone: z.string().optional().or(z.literal("")),
  contractorAddress: z.string().optional().or(z.literal("")),
  contractorCountry: z.string().optional().or(z.literal("")),
  contractorRegion: z.string().optional().or(z.literal("")),
  contractorCity: z.string().optional().or(z.literal("")),
  contractorCommune: z.string().optional().or(z.literal("")),
  // Beneficiario
  beneficiaryName: z.string().optional().or(z.literal("")),
  beneficiaryLastName: z.string().optional().or(z.literal("")),
  beneficiaryRut: z.string().optional().or(z.literal("")),
  beneficiaryEmail: z.string().optional().or(z.literal("")),
  beneficiaryCellPhone: z.string().optional().or(z.literal("")),
  beneficiaryPhone: z.string().optional().or(z.literal("")),
  beneficiaryAddress: z.string().optional().or(z.literal("")),
  beneficiaryCountry: z.string().optional().or(z.literal("")),
  beneficiaryRegion: z.string().optional().or(z.literal("")),
  beneficiaryCity: z.string().optional().or(z.literal("")),
  beneficiaryCommune: z.string().optional().or(z.literal("")),
})
  // Validar RUT del Asegurado solo si el país es Chile
  .refine(
    (data) => {
      if (data.insuredCountry !== "Chile") return true;
      if (!data.rut || data.rut.trim() === "") return true;
      return validateRut(data.rut);
    },
    { message: "RUT inválido", path: ["rut"] }
  )
  // Validar RUT del Contratante solo si el país es Chile
  .refine(
    (data) => {
      if (data.contractorCountry !== "Chile") return true;
      if (!data.contractorRut || data.contractorRut.trim() === "") return true;
      return validateRut(data.contractorRut);
    },
    { message: "RUT inválido", path: ["contractorRut"] }
  )
  // Validar RUT del Beneficiario solo si el país es Chile
  .refine(
    (data) => {
      if (data.beneficiaryCountry !== "Chile") return true;
      if (!data.beneficiaryRut || data.beneficiaryRut.trim() === "") return true;
      return validateRut(data.beneficiaryRut);
    },
    { message: "RUT inválido", path: ["beneficiaryRut"] }
  );

export type ClaimCreateMinimalInput = z.input<typeof claimCreateMinimalSchema>;

export const companySchema = z
  .object({
    name: z.string().min(1, "Nombre requerido"),
    slug: z.string().optional(),
    countryId: z.string().min(1, "País requerido"),
    rut: z.string().optional().or(z.literal("")),
    address: z.string().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
    email: z.string().email("Correo inválido").optional().or(z.literal("")),
    logoUrl: z.string().optional().or(z.literal("")),
    primaryColor: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      // Validar RUT solo si el país es Chile (code CL)
      if (!data.rut || data.rut.trim() === "") return true;
      return validateRut(data.rut);
    },
    {
      message: "RUT inválido",
      path: ["rut"],
    }
  );

export type CompanyInput = z.infer<typeof companySchema>;

export const inviteUserSchema = z.object({
  firstName: z.string().min(1, "Primer nombre requerido"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Apellido requerido"),
  email: z.string().email("Correo inválido"),
  countryId: z.string().min(1, "País requerido"),
  role: z.enum(["internal", "adjuster", "inspector", "assistant", "auditor", "dispatcher"]),
  clientIds: z.array(z.string()),
  phone: z.string().optional(),
  rut: z.string().optional(),
})
  // Cliente principal obligatorio si el rol requiere clientes
  .refine((d) => {
    const rolesWithClients = ["internal", "adjuster", "inspector", "assistant", "auditor", "dispatcher"];
    if (rolesWithClients.includes(d.role)) return d.clientIds.length > 0;
    return true;
  }, {
    message: "Debes seleccionar al menos un cliente para este rol",
    path: ["clientIds"],
  });

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

// ═══════════════════════════════════════════════════════════════
// ACTA DE INSPECCIÓN
// ═══════════════════════════════════════════════════════════════

export const actaSchema = z.object({
  inspection_date: z.string().optional().or(z.literal("")),
  inspection_time: z.string().optional().or(z.literal("")),
  interviewed_name: z.string().optional(),
  interviewed_email: z.string().email("Correo inválido").optional().or(z.literal("")),
  interviewed_relationship: z.string().optional(),
  police_report_number: z.string().optional(),
  police_report_name: z.string().optional(),
  police_report_rut: z.string().optional(),
  firefighters_company: z.string().optional(),
  other_insurances: z.boolean().default(false),
  other_insurance_company: z.string().optional(),
  inspector_observations: z.string().optional(),
  property_risk: z.object({
    risk_type: z.string().optional(),
    risk_class: z.string().optional(),
    property_type: z.string().optional(),
    apartment_number: z.string().optional(),
    floor_count: z.string().optional(),
    age_years: z.string().optional(),
    built_surface: z.string().optional(),
    room_count: z.string().optional(),
    bathroom_count: z.string().optional(),
    office_count: z.string().optional(),
    warehouse_count: z.string().optional(),
    is_habitable: z.boolean().default(false),
    owner_name: z.string().optional(),
    branch_count: z.string().optional(),
    worker_resident_count: z.string().optional(),
    business_line: z.string().optional(),
  }).optional(),
  property_materiality: z.object({
    walls: z.string().optional(),
    roof: z.string().optional(),
    interior_flooring: z.string().optional(),
    interior_ceilings: z.string().optional(),
    interior_finishes: z.string().optional(),
    exterior_finishes: z.string().optional(),
    perimeter_closure: z.string().optional(),
    others: z.string().optional(),
  }).optional(),
  security_measures: z.object({
    protections: z.object({ has_it: z.boolean().default(false), detail: z.string().optional() }).optional(),
    security_locks: z.object({ has_it: z.boolean().default(false), detail: z.string().optional() }).optional(),
    security_guards: z.object({ has_it: z.boolean().default(false), detail: z.string().optional() }).optional(),
    alarms: z.object({ has_it: z.boolean().default(false), detail: z.string().optional() }).optional(),
    cameras: z.object({ has_it: z.boolean().default(false), detail: z.string().optional() }).optional(),
    other_measures: z.object({ has_it: z.boolean().default(false), detail: z.string().optional() }).optional(),
  }).optional(),
  insured_statement: z.object({
    statement: z.string().optional(),
    entry_exit_point: z.string().optional(),
    alarm_activation: z.string().optional(),
    stolen_items_estimate: z.string().optional(),
    vehicle_use: z.string().optional(),
    incident_duration: z.string().optional(),
  }).optional(),
  third_parties: z.array(z.object({
    id: z.string().optional(),
    party_type: z.enum(["afectado", "responsable"]),
    full_name: z.string().optional(),
    rut: z.string().optional(),
    address: z.string().optional(),
    commune: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    company_name: z.string().optional(),
    has_insurance: z.boolean().default(false),
    insurance_company: z.string().optional(),
    claim_number: z.string().optional(),
    notes: z.string().optional(),
  })).default([]),
});

export type ActaInput = z.input<typeof actaSchema>;

// ═══════════════════════════════════════════════════════════════
// EDITAR SINIESTRO
// ═══════════════════════════════════════════════════════════════

export const editClaimSchema = z.object({
  claimNumber: z.string(),
  policyId: z.string(),
  policyNumber: z.string(),
  policyItem: z.string(),
  clientReference: z.string(),
  claimDate: z.string(),
  reportDate: z.string(),
  assignmentDate: z.string(),
  claimTypeId: z.string(),
  claimCauseId: z.string(),
  eventId: z.string(),
  summary: z.string(),
  companyId: z.string(),
  currencyId: z.string(),
  policyAmount: z.string(),
  policyPremium: z.string(),
  policyStartDate: z.string(),
  policyEndDate: z.string(),
  recoveryTypeLegal: z.boolean(),
  recoveryTypeMaterial: z.boolean(),
  recoveryComments: z.string(),
  insuredPersonType: z.string(),
  insuredFirstName: z.string(),
  insuredLastName: z.string(),
  insuredBusinessName: z.string(),
  insuredRut: z.string(),
  insuredEmail: z.string(),
  insuredPhones: z.string(),
  insuredAddress: z.string(),
  insuredCountry: z.string(),
  insuredRegion: z.string(),
  insuredCity: z.string(),
  insuredCommune: z.string(),
  contractorPersonType: z.string(),
  contractorFirstName: z.string(),
  contractorLastName: z.string(),
  contractorBusinessName: z.string(),
  contractorRut: z.string(),
  contractorEmail: z.string(),
  contractorPhones: z.string(),
  contractorAddress: z.string(),
  contractorCountry: z.string(),
  contractorRegion: z.string(),
  contractorCity: z.string(),
  contractorCommune: z.string(),
  beneficiaryPersonType: z.string(),
  beneficiaryFirstName: z.string(),
  beneficiaryLastName: z.string(),
  beneficiaryBusinessName: z.string(),
  beneficiaryRut: z.string(),
  beneficiaryEmail: z.string(),
  beneficiaryPhones: z.string(),
  beneficiaryAddress: z.string(),
  beneficiaryCountry: z.string(),
  beneficiaryRegion: z.string(),
  beneficiaryCity: z.string(),
  beneficiaryCommune: z.string(),
  contactPersonType: z.string(),
  contactFirstName: z.string(),
  contactLastName: z.string(),
  contactBusinessName: z.string(),
  contactRut: z.string(),
  contactEmail: z.string(),
  contactPhones: z.string(),
  claimAddress: z.string(),
  claimLatitude: z.number().optional(),
  claimLongitude: z.number().optional(),
  countryId: z.string(),
  regionId: z.string(),
  cityId: z.string(),
  communeId: z.string(),
  constructionTypeId: z.string(),
  destinationHousingId: z.string(),
  damageClassificationId: z.string(),
  habitabilityId: z.string(),
  ownerSameAsInsured: z.string(),
  insuranceCompanyId: z.string(),
  businessLineId: z.string(),
  insuranceProductId: z.string(),
  brokerId: z.string(),
  advisorId: z.string(),
  inspectorId: z.string(),
  adjusterId: z.string(),
  auditorId: z.string(),
  dispatcherId: z.string(),
  assistantId: z.string(),
});

export type EditClaimInput = z.infer<typeof editClaimSchema>;
