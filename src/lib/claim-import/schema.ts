// ═══════════════════════════════════════════════════════════════
// Esquema de campos para importación masiva de siniestros desde Excel
// ═══════════════════════════════════════════════════════════════
// Define los campos del sistema, sus sinónimos (nombres alternativos
// que pueden aparecer como headers del Excel), y si son requeridos.
// Se usa para:
//   1. Autodetectar qué columna del Excel mapea a qué campo
//   2. Sugerir mapeo cuando no hay match exacto (fuzzy)
//   3. Validar filas y producir errores claros y accionables
// ═══════════════════════════════════════════════════════════════

export interface ClaimField {
  /** Clave interna del campo (coincide con keys de data en ParsedRow) */
  key: string;
  /** Label humano para mostrar en UI */
  label: string;
  /** Si es true, la fila es inválida si este campo está vacío */
  required: boolean;
  /** Sinónimos: nombres de columna del Excel que mapean a este campo.
   *  Se comparan normalizados (lowercase, sin acentos, sin puntuación). */
  synonyms: string[];
  /** Descripción corta para tooltip/ayuda */
  description?: string;
}

export const CLAIM_FIELDS: ClaimField[] = [
  {
    key: "claimNumber",
    label: "N° Siniestro",
    required: true,
    description: "Número único del siniestro asignado por la aseguradora",
    synonyms: ["n siniestro", "numero siniestro", "nro siniestro", "siniestro", "claim number", "claim_number", "claimnumber", "n° siniestro", "num siniestro"],
  },
  {
    key: "policyNumber",
    label: "N° Póliza",
    required: true,
    description: "Número de la póliza de seguro",
    synonyms: ["n poliza", "numero poliza", "nro poliza", "poliza", "policy number", "policy_number", "policynumber", "n° poliza", "num poliza", "n póliza", "n° póliza", "póliza"],
  },
  {
    key: "insuredName",
    label: "Nombre Asegurado",
    required: true,
    description: "Nombre del asegurado (persona o empresa)",
    synonyms: ["nombre asegurado", "nombre", "asegurado", "insured name", "insured_name", "insuredname", "nombre del asegurado", "titular", "cliente"],
  },
  {
    key: "address",
    label: "Dirección Asegurado",
    required: true,
    description: "Dirección del asegurado",
    synonyms: ["direccion asegurado", "dirección asegurado", "domicilio asegurado", "address", "calle", "ubicacion", "ubicación", "domicilio", "lugar", "direccion del asegurado", "dirección del asegurado"],
  },
  {
    key: "city",
    label: "Ciudad Asegurado",
    required: true,
    description: "Ciudad del asegurado",
    synonyms: ["ciudad asegurado", "ciudad", "city", "localidad", "poblacion", "ciudad del asegurado"],
  },
  {
    key: "claimDate",
    label: "Fecha Siniestro",
    required: true,
    description: "Fecha en que ocurrió el siniestro (formato DD-MM-AAAA)",
    synonyms: ["fecha siniestro", "fecha del siniestro", "claim date", "claim_date", "claimdate", "fecha", "fecha ocurrencia", "f siniestro"],
  },
  {
    key: "claimType",
    label: "Tipo Siniestro",
    required: true,
    description: "Tipo de siniestro (Property, Auto, etc.)",
    synonyms: ["tipo siniestro", "tipo de siniestro", "claim type", "claim_type", "claimtype", "tiposiniestro", "tipo", "categoria", "categoría"],
  },
  {
    key: "insuranceCompany",
    label: "Empresa / Compañía de Seguros",
    required: true,
    description: "Compañía de seguros (HDI Seguros, Mapfre, etc.). Se busca por nombre en el catálogo de aseguradoras.",
    synonyms: ["empresa", "compañía de seguros", "compania seguros", "compañia seguros", "cia seguros", "compañía", "compañia", "insurance company", "insurance_company", "cia", "aseguradora", "company", "compania de seguros", "cia de seguros"],
  },
  // ── Opcionales ──
  // Nota: liquidation_number NO se pide — es correlativo automático de claims
  {
    key: "claimCause",
    label: "Causal Siniestro",
    required: false,
    synonyms: ["causal del siniestro", "causal", "causa", "claim cause", "claim_cause", "claimcause", "motivo", "origen"],
  },
  {
    key: "claimTime",
    label: "Hora Siniestro",
    required: false,
    synonyms: ["hora siniestro", "hora del siniestro", "claim time", "claim_time", "claimtime", "hora", "hora ocurrencia"],
  },
  {
    key: "reportDate",
    label: "Fecha Denuncio",
    required: false,
    synonyms: ["fecha denuncio", "fecha denuncia", "report date", "report_date", "reportdate", "denuncio", "f denuncio"],
  },
  {
    key: "assignmentDate",
    label: "Fecha Asignación",
    required: false,
    synonyms: ["fecha asignacion", "fecha asignación", "assignment date", "assignment_date", "assignmentdate", "asignacion", "asignación", "f asignacion"],
  },
  {
    key: "createdAt",
    label: "Fecha Creación",
    required: false,
    description: "Fecha de creación del registro original (para siniestros históricos importados)",
    synonyms: ["fecha creacion", "fecha creación", "created at", "created_at", "createdat", "fecha alta", "fecha registro", "f creacion", "f creación"],
  },
  {
    key: "summary",
    label: "Resumen Siniestro",
    required: false,
    synonyms: ["resumen siniestro", "resumen", "descripción", "descripcion", "summary", "descripción resumida", "descripcion resumida", "detalle", "observacion general", "descripcion siniestro", "descripción siniestro"],
  },
  {
    key: "lastName",
    label: "Apellido Asegurado",
    required: false,
    synonyms: ["apellido asegurado", "apellido", "apellidos", "last name", "last_name", "lastname", "apellido del asegurado"],
  },
  {
    key: "rut",
    label: "RUT Asegurado",
    required: false,
    synonyms: ["rut asegurado", "rut", "rut_asegurado", "documento", "identificacion", "rut del asegurado"],
  },
  {
    key: "insuredEmail",
    label: "E-mail Asegurado",
    required: false,
    synonyms: ["email asegurado", "e-mail asegurado", "correo asegurado", "email", "correo", "insured email", "insured_email", "insuredemail", "e-mail", "mail", "mail asegurado"],
  },
  {
    key: "insuredPhone",
    label: "Teléfono Asegurado",
    required: false,
    synonyms: ["teléfono asegurado", "telefono asegurado", "fono asegurado", "teléfono", "telefono", "fono", "insured phone", "insured_phone", "insuredphone", "telefono fijo"],
  },
  {
    key: "cellPhone",
    label: "Celular Asegurado",
    required: false,
    synonyms: ["celular asegurado", "celular", "móvil", "movil", "cell phone", "cell_phone", "cellphone", "mobile", "cel"],
  },
  {
    key: "commune",
    label: "Comuna Asegurado",
    required: false,
    synonyms: ["comuna asegurado", "comuna", "commune", "comuna del asegurado"],
  },
  {
    key: "region",
    label: "Región Asegurado",
    required: false,
    synonyms: ["region asegurado", "región asegurado", "región", "region", "state", "provincia", "estado", "region del asegurado"],
  },
  {
    key: "country",
    label: "País Asegurado",
    required: false,
    synonyms: ["pais asegurado", "país asegurado", "país", "pais", "country", "nacion", "nación", "pais del asegurado"],
  },
  // ── Contratante (va a claims_participants tipo "contractor") ──
  {
    key: "contractorName",
    label: "Nombre Contratante",
    required: false,
    synonyms: ["nombre contratante", "contratante", "nombre del contratante", "contractor name", "contractor_name"],
  },
  {
    key: "contractorLastName",
    label: "Apellido Contratante",
    required: false,
    synonyms: ["apellido contratante", "contractor last name", "contractor_last_name", "apellido del contratante"],
  },
  {
    key: "contractorRut",
    label: "RUT Contratante",
    required: false,
    synonyms: ["rut contratante", "contractor rut", "contractor_rut", "rut del contratante"],
  },
  {
    key: "contractorEmail",
    label: "E-mail Contratante",
    required: false,
    synonyms: ["email contratante", "e-mail contratante", "correo contratante", "mail contratante", "contractor email", "contractor_email"],
  },
  {
    key: "contractorPhone",
    label: "Teléfono Contratante",
    required: false,
    synonyms: ["telefono contratante", "teléfono contratante", "fono contratante", "contractor phone", "contractor_phone"],
  },
  {
    key: "contractorCellPhone",
    label: "Celular Contratante",
    required: false,
    synonyms: ["celular contratante", "contractor cell phone", "contractor_cell_phone", "movil contratante", "móvil contratante"],
  },
  {
    key: "contractorAddress",
    label: "Dirección Contratante",
    required: false,
    synonyms: ["direccion contratante", "dirección contratante", "domicilio contratante", "contractor address", "contractor_address", "direccion del contratante", "dirección del contratante"],
  },
  {
    key: "contractorCountry",
    label: "País Contratante",
    required: false,
    synonyms: ["pais contratante", "país contratante", "contractor country", "contractor_country", "pais del contratante"],
  },
  {
    key: "contractorRegion",
    label: "Región Contratante",
    required: false,
    synonyms: ["region contratante", "región contratante", "contractor region", "contractor_region", "region del contratante"],
  },
  {
    key: "contractorCity",
    label: "Ciudad Contratante",
    required: false,
    synonyms: ["ciudad contratante", "contractor city", "contractor_city", "ciudad del contratante"],
  },
  {
    key: "contractorCommune",
    label: "Comuna Contratante",
    required: false,
    synonyms: ["comuna contratante", "contractor commune", "contractor_commune", "comuna del contratante"],
  },
  // ── Dirección del Siniestro (separada de la del asegurado) ──
  // Nota: País/Región/Ciudad/Comuna del siniestro van por catálogo (claimCountryRef etc.)
  {
    key: "claimAddress",
    label: "Dirección Siniestro",
    required: false,
    synonyms: ["direccion siniestro", "dirección siniestro", "lugar siniestro", "domicilio siniestro", "claim address", "claim_address", "ubicacion siniestro", "ubicación siniestro", "calle siniestro"],
  },
  // ── No. Siniestro Compañía → company_report_number ──
  {
    key: "companyReportNumber",
    label: "No. Siniestro Compañía",
    required: false,
    synonyms: ["no siniestro compañia", "n siniestro compañia", "n° siniestro compañia", "numero siniestro compañia", "no siniestro cia", "n siniestro cia", "n° siniestro cia", "company report number", "company_report_number", "siniestro compañia", "siniestro cia", "no siniestro compañía", "n° siniestro compañía"],
  },
  // ── Ramo/Producto → insurance_product_id ──
  {
    key: "insuranceProduct",
    label: "Ramo/Producto",
    required: false,
    synonyms: ["ramo producto", "ramo/producto", "producto", "insurance product", "insurance_product", "insuranceproduct", "ramo", "producto seguros"],
  },
  // ── Evento → event_id ──
  {
    key: "event",
    label: "Evento",
    required: false,
    synonyms: ["evento", "event", "event_id", "tipo evento", "causa evento", "evento siniestro"],
  },
  {
    key: "inspector",
    label: "Inspector",
    required: false,
    description: "Nombre del inspector (se resuelve a inspector_id via profiles)",
    synonyms: ["inspector", "inspector id", "inspector_id", "inspectorid", "id inspector", "inspectora", "nombre inspector"],
  },
  {
    key: "adjuster",
    label: "Liquidador/Ajustador",
    required: false,
    description: "Nombre del liquidador/ajustador (se resuelve a adjuster_id via profiles)",
    synonyms: ["ajustador", "liquidador", "adjuster", "adjuster id", "adjuster_id", "adjusterid", "id ajustador", "id liquidador", "liquidador asignado", "nombre liquidador", "nombre ajustador"],
  },
  {
    key: "notes",
    label: "Notas",
    required: false,
    synonyms: ["notas", "observaciones", "notes", "comentarios", "notas adicionales", "observacion", "observación"],
  },
  // ── Campos del Excel de McLareens (opcionales) ──
  {
    key: "status",
    label: "Estatus",
    required: false,
    synonyms: ["estatus", "estado", "status", "state", "situacion", "situación"],
  },
  {
    key: "brokerExecutive",
    label: "Ejecutivo Cia",
    required: false,
    synonyms: ["ejecutivo cia", "ejecutivo compania", "ejecutivo compañía", "ejecutivo", "broker executive", "broker_executive", "ejecutivo aseguradora"],
  },
  {
    key: "businessLine",
    label: "Línea Negocio",
    required: false,
    synonyms: ["linea negocio", "línea negocio", "linea de negocio", "línea de negocio", "business line", "business_line", "ramo negocio", "area negocio"],
  },
  {
    key: "policyItem",
    label: "Ramo/Item Póliza",
    required: false,
    synonyms: ["ramo item poliza", "ramo/item poliza", "ramo item póliza", "ramo/item póliza", "item poliza", "item póliza", "policy item", "policy_item", "ramo", "item"],
  },
  {
    key: "policyStartDate",
    label: "Fecha Inicio Póliza",
    required: false,
    synonyms: ["fecha inicio poliza", "fecha inicio póliza", "inicio poliza", "inicio póliza", "policy start date", "policy_start_date", "vigencia inicio", "f inicio poliza"],
  },
  {
    key: "policyEndDate",
    label: "Fecha Fin Póliza",
    required: false,
    synonyms: ["fecha fin poliza", "fecha fin póliza", "fin poliza", "fin póliza", "policy end date", "policy_end_date", "vigencia fin", "f fin poliza", "vencimiento poliza"],
  },
  {
    key: "currency",
    label: "Moneda Póliza",
    required: false,
    synonyms: ["moneda poliza", "moneda póliza", "moneda", "currency", "currency_id", "moneda asegurada", "tipo moneda"],
  },
  {
    key: "policyAmount",
    label: "Monto Asegurado Póliza",
    required: false,
    synonyms: ["monto asegurado poliza", "monto asegurado póliza", "monto asegurado", "suma asegurada", "policy amount", "policy_amount", "valor asegurado", "monto poliza"],
  },
  {
    key: "policyPremium",
    label: "Prima Anual",
    required: false,
    synonyms: ["prima anual", "prima", "policy premium", "policy_premium", "prima poliza", "prima póliza", "valor prima"],
  },
  {
    key: "internalNumber",
    label: "N° McLarens One",
    required: false,
    synonyms: ["no mclarens one", "n mclarens one", "numero mclarens one", "mclarens one", "mcone", "n° mclarens one", "no mclarens", "n° mclarens", "internal number", "internal_number", "numero interno", "n° interno", "no interno"],
  },
  {
    key: "isSpecialClaim",
    label: "Siniestro Especial",
    required: false,
    synonyms: ["siniestro especial", "especial", "is special claim", "is_special_claim", "caso especial", "relevante"],
  },
  {
    key: "destination",
    label: "Destino",
    required: false,
    synonyms: ["destino", "destination", "destination_housing", "destino vivienda", "uso", "tipo destino"],
  },
  {
    key: "damageClassification",
    label: "Clasif. Daño",
    required: false,
    synonyms: ["clasif daño", "clasif dano", "clasificacion daño", "clasificación daño", "damage classification", "damage_classification", "grado daño", "nivel daño", "clasif daños"],
  },
  {
    key: "ownerSameAsInsured",
    label: "Propietario / Asegurado",
    required: false,
    synonyms: ["propietario asegurado", "propietario/asegurado", "owner same as insured", "owner_same_as_insured", "es propietario", "mismo propietario", "propietario"],
  },
  // ── Beneficiario (va a claims_participants tipo beneficiary) ──
  {
    key: "beneficiaryRut",
    label: "RUT Beneficiario",
    required: false,
    synonyms: ["rut beneficiario", "rut_beneficiario", "documento beneficiario", "rut benef"],
  },
  {
    key: "beneficiaryName",
    label: "Nombre Beneficiario",
    required: false,
    synonyms: ["nombre beneficiario", "beneficiario", "beneficiary name", "beneficiary_name", "nombre benef", "nombre del beneficiario"],
  },
  {
    key: "beneficiaryLastName",
    label: "Apellido Beneficiario",
    required: false,
    synonyms: ["apellido beneficiario", "apellido benef", "beneficiary last name", "beneficiary_last_name", "apellidos beneficiario"],
  },
  {
    key: "beneficiaryEmail",
    label: "E-mail Beneficiario",
    required: false,
    synonyms: ["e-mail beneficiario", "email beneficiario", "correo beneficiario", "beneficiary email", "beneficiary_email", "mail beneficiario"],
  },
  {
    key: "beneficiaryPhone",
    label: "Teléfono Beneficiario",
    required: false,
    synonyms: ["telefono beneficiario", "teléfono beneficiario", "fono beneficiario", "beneficiary phone", "beneficiary_phone", "tel benef"],
  },
  {
    key: "beneficiaryCellPhone",
    label: "Celular Beneficiario",
    required: false,
    synonyms: ["celular beneficiario", "cel benef", "beneficiary cell phone", "beneficiary_cell_phone", "movil beneficiario", "móvil beneficiario"],
  },
  {
    key: "beneficiaryAddress",
    label: "Dirección Beneficiario",
    required: false,
    synonyms: ["direccion beneficiario", "dirección beneficiario", "beneficiary address", "beneficiary_address", "domicilio beneficiario", "dir benef"],
  },
  {
    key: "beneficiaryCountry",
    label: "País Beneficiario",
    required: false,
    synonyms: ["pais beneficiario", "país beneficiario", "beneficiary country", "beneficiary_country", "pais benef"],
  },
  {
    key: "beneficiaryRegion",
    label: "Región Beneficiario",
    required: false,
    synonyms: ["region beneficiario", "región beneficiario", "beneficiary region", "beneficiary_region", "region benef"],
  },
  {
    key: "beneficiaryCity",
    label: "Ciudad Beneficiario",
    required: false,
    synonyms: ["ciudad beneficiario", "beneficiary city", "beneficiary_city", "ciudad benef"],
  },
  {
    key: "beneficiaryCommune",
    label: "Comuna Beneficiario",
    required: false,
    synonyms: ["comuna beneficiario", "beneficiary commune", "beneficiary_commune", "comuna benef"],
  },
  // ── Persona Contacto (va a claims_participants tipo contact) ──
  {
    key: "contactName",
    label: "Nombre Persona Contacto",
    required: false,
    synonyms: ["nombre persona contacto", "nombre contacto", "contacto", "contact name", "contact_name", "contactname", "persona contacto", "contacto siniestro"],
  },
  {
    key: "contactRole",
    label: "Cargo Persona Contacto",
    required: false,
    synonyms: ["cargo persona contacto", "cargo contacto", "cargo", "relación", "relacion", "contact role", "contact_role", "contactrole", "parentesco"],
  },
  {
    key: "contactEmail",
    label: "E-mail Persona Contacto",
    required: false,
    synonyms: ["e-mail persona contacto", "email persona contacto", "correo persona contacto", "contact email", "contact_email", "email contacto", "mail contacto"],
  },
  {
    key: "contactPhone",
    label: "Teléfono Persona Contacto",
    required: false,
    synonyms: ["telefono persona contacto", "teléfono persona contacto", "fono persona contacto", "contact phone", "contact_phone", "telefono contacto", "tel contacto"],
  },
  // ── Campos adicionales de claims (texto/boolean/numero) ──
  {
    key: "clientReference",
    label: "Referencia Cliente",
    required: false,
    synonyms: ["referencia cliente", "client reference", "client_reference", "clientreference", "ref cliente", "referencia"],
  },
  {
    key: "recoveryTypeLegal",
    label: "Recuperación Legal",
    required: false,
    synonyms: ["recuperacion legal", "recuperación legal", "recovery type legal", "recovery_type_legal", "recupero legal"],
  },
  {
    key: "recoveryTypeMaterial",
    label: "Recuperación Material",
    required: false,
    synonyms: ["recuperacion material", "recuperación material", "recovery type material", "recovery_type_material", "recupero material"],
  },
  {
    key: "recoveryComments",
    label: "Comentarios Recuperación",
    required: false,
    synonyms: ["comentarios recuperacion", "comentarios recuperación", "recovery comments", "recovery_comments", "obs recuperacion"],
  },
  {
    key: "claimLatitude",
    label: "Latitud Siniestro",
    required: false,
    synonyms: ["latitud siniestro", "latitud", "latitude", "claim latitude", "claim_latitude", "lat"],
  },
  {
    key: "claimLongitude",
    label: "Longitud Siniestro",
    required: false,
    synonyms: ["longitud siniestro", "longitud", "longitude", "claim longitude", "claim_longitude", "lon", "lng"],
  },
  // ── Campos de referencia → catálogos geográficos del siniestro (se resuelven a UUID) ──
  {
    key: "claimCountryRef",
    label: "País Siniestro (catálogo)",
    required: false,
    description: "Nombre del país del siniestro (se resuelve a country_id via catálogo countries)",
    synonyms: ["pais siniestro catalogo", "país siniestro catálogo", "pais claim ref", "país claim ref", "country ref", "country_ref"],
  },
  {
    key: "claimRegionRef",
    label: "Región Siniestro (catálogo)",
    required: false,
    description: "Nombre de la región del siniestro (se resuelve a region_id via catálogo regions)",
    synonyms: ["region siniestro catalogo", "región siniestro catálogo", "region claim ref", "región claim ref", "region ref", "region_ref"],
  },
  {
    key: "claimCityRef",
    label: "Ciudad Siniestro (catálogo)",
    required: false,
    description: "Nombre de la ciudad del siniestro (se resuelve a city_id via catálogo cities)",
    synonyms: ["ciudad siniestro catalogo", "city claim ref", "city ref", "city_ref"],
  },
  {
    key: "claimCommuneRef",
    label: "Comuna Siniestro (catálogo)",
    required: false,
    description: "Nombre de la comuna del siniestro (se resuelve a commune_id via catálogo communes)",
    synonyms: ["comuna siniestro catalogo", "commune claim ref", "commune ref", "commune_ref"],
  },
  // ── Campos de referencia → otros catálogos (se resuelven a UUID) ──
  {
    key: "broker",
    label: "Corredor",
    required: false,
    description: "Nombre del corredor (se resuelve a broker_id)",
    synonyms: ["corredor", "broker", "broker name", "nombre corredor"],
  },
  {
    key: "advisor",
    label: "Asesor",
    required: false,
    description: "Nombre del asesor (se resuelve a advisor_id)",
    synonyms: ["asesor", "advisor", "advisor name", "nombre asesor"],
  },
  {
    key: "propertyClassification",
    label: "Clasificación Propiedad",
    required: false,
    description: "Nombre de la clasificación de propiedad (se resuelve a property_classification_id)",
    synonyms: ["clasificacion propiedad", "clasificación propiedad", "property classification", "property_classification", "clasif propiedad", "tipo propiedad"],
  },
  {
    key: "policyRef",
    label: "Póliza (referencia)",
    required: false,
    description: "N° de póliza existente en el sistema (se resuelve a policy_id)",
    synonyms: ["poliza referencia", "póliza referencia", "policy ref", "policy_ref", "policyref", "poliza existente", "póliza existente"],
  },
  // ── Campos de referencia → profiles (usuarios del sistema, se resuelven a UUID) ──
  // Nota: "Liquidador/Ajustador" ya está arriba como campo "adjuster" → adjuster_id
  {
    key: "auditor",
    label: "Auditor",
    required: false,
    description: "Nombre del auditor (se resuelve a auditor_id)",
    synonyms: ["auditor", "auditor name", "nombre auditor"],
  },
  {
    key: "dispatcher",
    label: "Despachador",
    required: false,
    description: "Nombre del despachador (se resuelve a dispatcher_id)",
    synonyms: ["despachador", "dispatcher", "dispatcher name", "nombre despachador"],
  },
  {
    key: "assistant",
    label: "Asistente",
    required: false,
    description: "Nombre del asistente (se resuelve a assistant_id)",
    synonyms: ["asistente", "assistant", "assistant name", "nombre asistente"],
  },
];

export const REQUIRED_FIELDS = CLAIM_FIELDS.filter((f) => f.required);
export const OPTIONAL_FIELDS = CLAIM_FIELDS.filter((f) => !f.required);

// ═══════════════════════════════════════════════════════════════
// Normalización de strings para comparación
// ═══════════════════════════════════════════════════════════════

/** Normaliza un string: lowercase, sin acentos, sin puntuación, sin espacios extra */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita acentos
    .replace(/[°º·.,;:!?¿¡'"`´()\-_]/g, " ") // quita puntuación
    .replace(/\s+/g, " ")
    .trim();
}

// ═══════════════════════════════════════════════════════════════
// Autodetección de mapeo columna → campo
// ═══════════════════════════════════════════════════════════════

export interface ColumnMapping {
  /** key del campo del sistema (ClaimField.key) o null si no está mapeado */
  fieldKey: string | null;
  /** Header original del Excel (preserva mayúsculas/acentos para mostrar) */
  excelHeader: string;
  /** Si se autodetectó (vs mapeo manual del usuario) */
  autoDetected: boolean;
  /** Score de similitud [0..1] para sugerencias fuzzy */
  confidence: number;
}

/**
 * Dado los headers del Excel, produce un mapeo inicial autodetectando
 * qué columna corresponde a qué campo del sistema.
 *
 * Estrategia:
 *  1. Para cada campo, busca match exacto (normalizado) con algún sinónimo
 *  2. Si no hay match exacto, busca el header más similar (fuzzy) y lo marca
 *     como sugerencia con confidence < 1 (el usuario debe confirmar)
 *  3. Un header solo puede mapear a un campo (el primero que matchee)
 */
export function autoDetectMapping(excelHeaders: string[]): Record<string, ColumnMapping> {
  const normalizedHeaders = excelHeaders.map((h) => ({ original: h, normalized: normalize(h) }));
  const usedHeaders = new Set<string>(); // headers ya asignados a un campo
  const mapping: Record<string, ColumnMapping> = {};

  // Pasada 1: match exacto de sinónimos
  for (const field of CLAIM_FIELDS) {
    const synonyms = field.synonyms.map(normalize);
    let bestMatch: { header: string; confidence: number } | null = null;

    for (const { original, normalized } of normalizedHeaders) {
      if (usedHeaders.has(original)) continue;
      if (synonyms.includes(normalized)) {
        bestMatch = { header: original, confidence: 1 };
        break;
      }
    }

    if (bestMatch) {
      mapping[field.key] = {
        fieldKey: field.key,
        excelHeader: bestMatch.header,
        autoDetected: true,
        confidence: bestMatch.confidence,
      };
      usedHeaders.add(bestMatch.header);
    }
  }

  // Pasada 2: fuzzy matching para campos sin match exacto
  for (const field of CLAIM_FIELDS) {
    if (mapping[field.key]) continue;
    const synonyms = field.synonyms.map(normalize);
    let best: { header: string; score: number } | null = null;

    for (const { original, normalized } of normalizedHeaders) {
      if (usedHeaders.has(original)) continue;
      const score = bestSimilarity(normalized, synonyms);
      if (score > 0.6 && (!best || score > best.score)) {
        best = { header: original, score };
      }
    }

    if (best) {
      mapping[field.key] = {
        fieldKey: field.key,
        excelHeader: best.header,
        autoDetected: true,
        confidence: best.score,
      };
      usedHeaders.add(best.header);
    } else {
      mapping[field.key] = {
        fieldKey: null,
        excelHeader: "",
        autoDetected: false,
        confidence: 0,
      };
    }
  }

  return mapping;
}

// ═══════════════════════════════════════════════════════════════
// Similitud fuzzy
// ═══════════════════════════════════════════════════════════════

/**
 * Mejor score de similitud entre un string y una lista de sinónimos.
 * Usa combinación de:
 *  - substring (contiene o está contenido)
 *  - Jaccard de tokens (palabras)
 *  - Levenshtein normalizado
 * Retorna [0..1]
 */
function bestSimilarity(s: string, synonyms: string[]): number {
  let max = 0;
  for (const syn of synonyms) {
    const score = similarity(s, syn);
    if (score > max) max = score;
  }
  return max;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  // Substring: si uno contiene al otro, alta similitud
  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    return 0.7 + 0.3 * (shorter / longer);
  }

  // Jaccard de tokens (palabras)
  const tokensA = new Set(a.split(" ").filter(Boolean));
  const tokensB = new Set(b.split(" ").filter(Boolean));
  const intersection = [...tokensA].filter((t) => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // Levenshtein normalizado
  const lev = 1 - levenshtein(a, b) / Math.max(a.length, b.length);

  // Ponderar: 50% jaccard, 50% levenshtein
  return 0.5 * jaccard + 0.5 * lev;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// ═══════════════════════════════════════════════════════════════
// Validación con errores claros y accionables
// ═══════════════════════════════════════════════════════════════

export interface RowError {
  /** Campo del sistema afectado (ClaimField.key) */
  fieldKey: string;
  /** Label humano del campo */
  fieldLabel: string;
  /** Mensaje claro y accionable */
  message: string;
  /** Tipo de error para clasificación */
  kind: "missing_column" | "empty_value" | "invalid_value";
}

export interface ParsedRow {
  rowNum: number;
  data: Record<string, unknown>;
  valid: boolean;
  errors: RowError[];
}

/**
 * Valida una fila usando el mapeo activo.
 * Produce errores claros que distinguen entre:
 *  - missing_column: el campo no tiene columna mapeada (el usuario debe mapear)
 *  - empty_value: la columna está mapeada pero la celda está vacía
 *  - invalid_value: el valor existe pero no es válido (ej: fecha mal formada)
 */
export function validateRowWithMapping(
  row: Record<string, unknown>,
  mapping: Record<string, ColumnMapping>
): { valid: boolean; errors: RowError[] } {
  const errors: RowError[] = [];

  for (const field of CLAIM_FIELDS) {
    if (!field.required) continue;

    const m = mapping[field.key];
    const value = row[field.key];

    if (!m || !m.fieldKey || !m.excelHeader) {
      errors.push({
        fieldKey: field.key,
        fieldLabel: field.label,
        kind: "missing_column",
        message: `Falta "${field.label}" — no hay columna mapeada. Asigna una columna del Excel en el panel de mapeo, o agrega una columna llamada "${field.label}" en tu Excel.`,
      });
      continue;
    }

    if (value === undefined || value === null || String(value).trim() === "") {
      errors.push({
        fieldKey: field.key,
        fieldLabel: field.label,
        kind: "empty_value",
        message: `Falta "${field.label}" — la columna "${m.excelHeader}" está vacía en esta fila.`,
      });
      continue;
    }

    // Validaciones específicas por tipo de campo
    if (field.key === "claimDate") {
      const parsed = parseDate(String(value));
      if (!parsed) {
        errors.push({
          fieldKey: field.key,
          fieldLabel: field.label,
          kind: "invalid_value",
          message: `"${field.label}" inválido: "${value}" no es una fecha reconocida. Usa formato DD-MM-AAAA o AAAA-MM-DD.`,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Intenta parsear una fecha en varios formatos comunes. Retorna ISO o null. */
export function parseDate(value: string): string | null {
  const s = value.trim();
  if (!s) return null;

  // DD-MM-AAAA o DD/MM/AAAA
  let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // AAAA-MM-DD (ISO)
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Intentar con Date nativo (para fechas de Excel que vienen como números)
  const n = Number(s);
  if (!isNaN(n) && n > 30000 && n < 60000) {
    // Serial date de Excel (días desde 1900-01-01)
    const date = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return date.toISOString().slice(0, 10);
  }

  const date = new Date(s);
  if (!isNaN(date.getTime())) {
    return date.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Aplica el mapeo a una fila cruda del Excel, extrayendo los valores
 * de las columnas correctas y normalizándolos a las keys del sistema.
 */
export function applyMappingToRow(
  raw: Record<string, string | number | null>,
  mapping: Record<string, ColumnMapping>
): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  for (const field of CLAIM_FIELDS) {
    const m = mapping[field.key];
    if (m && m.excelHeader) {
      const val = raw[m.excelHeader];
      data[field.key] = val !== undefined && val !== null ? String(val).trim() : "";
    } else {
      data[field.key] = "";
    }
  }

  // Fallbacks de compatibilidad
  if (!data.city && data.commune) data.city = data.commune;
  if (!data.country) data.country = "Chile";

  // Normalizar fecha si viene en otro formato
  if (data.claimDate && typeof data.claimDate === "string") {
    const parsed = parseDate(data.claimDate);
    if (parsed) data.claimDate = parsed;
  }
  if (data.reportDate && typeof data.reportDate === "string") {
    const parsed = parseDate(data.reportDate);
    if (parsed) data.reportDate = parsed;
  }
  if (data.assignmentDate && typeof data.assignmentDate === "string") {
    const parsed = parseDate(data.assignmentDate);
    if (parsed) data.assignmentDate = parsed;
  }
  if (data.policyStartDate && typeof data.policyStartDate === "string") {
    const parsed = parseDate(data.policyStartDate);
    if (parsed) data.policyStartDate = parsed;
  }
  if (data.policyEndDate && typeof data.policyEndDate === "string") {
    const parsed = parseDate(data.policyEndDate);
    if (parsed) data.policyEndDate = parsed;
  }
  if (data.createdAt && typeof data.createdAt === "string") {
    const parsed = parseDate(data.createdAt);
    if (parsed) data.createdAt = parsed;
  }

  return data;
}
