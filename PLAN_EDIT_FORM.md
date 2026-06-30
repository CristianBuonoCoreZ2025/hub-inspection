# Plan: Completar Edit Form con features del Wizard

## Objetivo
El edit form (`edit-claim-form.tsx`) no tiene las mismas interacciones que el wizard de creación. Este plan detalla qué falta y cómo se va a implementar.

---

## Gaps Identificados

### 1. Geo de participantes son text inputs (ALTO)
**Wizard:** selects cascading country→region→city→commune para asegurado, contratante, beneficiario.
**Edit form:** inputs de texto simples.
**Solución:** Reemplazar los 12 text inputs (4 por participante × 3) por selects cascading. Los participantes guardan geo como texto (nombres), así que los selects usan `name` como value.

### 2. Cascading Tipo Siniestro → Línea → Producto (ALTO)
**Wizard:** al cambiar claimTypeId, limpia businessLineId y insuranceProductId. Al cambiar businessLineId, limpia insuranceProductId y filtra productos.
**Edit form:** todos los selects independientes.
**Solución:** Agregar `onValueChange` a claimTypeId y businessLineId. Filtrar insuranceProducts por businessLineId. Disable insuranceProductId si no hay businessLineId.

### 3. Filtrado por país de catálogos (ALTO)
**Wizard:** insurance_companies, brokers, advisors, business_lines, claim_causes se filtran por el país del siniestro.
**Edit form:** muestra todos sin filtrar.
**Solución:** Usar `countryId` del tab Incidente para filtrar. Al cambiar countryId, resetear los campos dependientes.

### 4. Linking de participantes (MEDIO)
**Wizard:** botones "Copiar de Asegurado" / "Desligar Asegurado" para contratante, beneficiario y dirección del incidente.
**Edit form:** no existe.
**Solución:** Agregar estado `contractorLinked`, `beneficiaryLinked`, `claimAddressLinked`. Al ligar, copiar campos del asegurado y bloquear los inputs. Al desligar, desbloquear.

### 5. Autocomplete por RUT (MEDIO)
**Wizard:** debounce 600ms, busca `findParticipantByRut(rut, country)`, muestra sugerencia.
**Edit form:** no existe.
**Solución:** Agregar useEffect con debounce para cada participante (insured, contractor, beneficiary). Mostrar banner de sugerencia con botón "Usar datos existentes".

### 6. Paneles colapsables (BAJO)
**Wizard:** contratante y beneficiario son expandibles/colapsables.
**Edit form:** siempre visibles.
**Solución:** Agregar estado `expandedPanels`. Header con chevron para expandir/colapsar. Por defecto: expandido si tiene datos, colapsado si no.

---

## Cambios por Archivo

### `src/app/dashboard/claims/[id]/edit-claim-form.tsx` (reescritura completa)

#### Imports a agregar
```ts
import { useEffect } from "react";
import { useWatch } from "react-hook-form";
import { findParticipantByRut } from "@/services/claims";
import { ChevronDown, ChevronRight, Copy, Unlink } from "lucide-react";
```

#### Interfaz Catalog
```ts
interface Catalog {
  id: string;
  name: string;
  country_id?: string | null;  // ← agregar
}
```

#### Estado adicional
```ts
const [contractorLinked, setContractorLinked] = useState(false);
const [beneficiaryLinked, setBeneficiaryLinked] = useState(false);
const [claimAddressLinked, setClaimAddressLinked] = useState(false);
const [expandedPanels, setExpandedPanels] = useState({
  contractor: !!contractor?.full_name,
  beneficiary: !!beneficiary?.full_name,
});
const [participantSuggestion, setParticipantSuggestion] = useState<{
  section: "insured" | "contractor" | "beneficiary";
  data: any;
} | null>(null);
```

#### Queries de geo para participantes (3 sets)
Por cada participante (insured, contractor, beneficiary):
- Watch de country/region/city (nombres texto)
- Query de regions: buscar country_id por nombre → getRegions(countryId)
- Query de cities: buscar region_id por nombre → getCities(regionId)
- Query de communes: buscar city_id por nombre → getCommunes(cityId)
- Items usan `name` como value (no `id`)

#### Filtrado por país
```ts
const watchedCountryId = watch("countryId"); // del tab Incidente
const filteredInsuranceCompanies = catalogs.insuranceCompanies.filter(
  c => !watchedCountryId || c.country_id === watchedCountryId
);
// Igual para brokers, advisors, businessLines, claimCauses
```

#### Cascading Tipo → Línea → Producto
- claimTypeId select: `onValueChange` limpia businessLineId + insuranceProductId
- businessLineId select: `onValueChange` limpia insuranceProductId, items filtrados por claimTypeId si aplica
- insuranceProductId select: disabled si no hay businessLineId, items filtrados por businessLineId

#### Linking
```ts
const toggleContractorLink = () => {
  if (!contractorLinked) {
    // Copiar del asegurado
    form.setValue("contractorFullName", `${insuredFirstName} ${insuredLastName}`.trim());
    form.setValue("contractorRut", form.getValues("insuredRut"));
    // ... copiar todos los campos
    setContractorLinked(true);
  } else {
    setContractorLinked(false);
  }
};
// Igual para beneficiary y claimAddress
```

#### Autocomplete por RUT
```ts
useEffect(() => {
  if (!watchedInsuredRut || watchedInsuredRut.trim().length < 3) {
    setParticipantSuggestion(null);
    return;
  }
  const timer = setTimeout(async () => {
    const found = await findParticipantByRut(watchedInsuredRut, watchedInsuredCountry);
    if (found) setParticipantSuggestion({ section: "insured", data: found });
  }, 600);
  return () => clearTimeout(timer);
}, [watchedInsuredRut, watchedInsuredCountry]);
// Igual para contractor y beneficiary
```

#### Paneles colapsables
```tsx
<button onClick={() => setExpandedPanels(p => ({ ...p, contractor: !p.contractor }))}>
  {expandedPanels.contractor ? <ChevronDown /> : <ChevronRight />}
  Contratante
</button>
{expandedPanels.contractor && (
  // campos del contratante
)}
```

### `src/app/dashboard/claims/[id]/page.tsx` (sin cambios)
El parent ya pasa todos los catálogos necesarios. La interfaz Catalog del edit form se actualiza para aceptar `country_id` opcional, así que no hay breaking changes.

---

## Orden de Implementación

1. ~~Escribir este plan~~ ✅
2. Reescribir `edit-claim-form.tsx` con todos los cambios
3. Build para verificar que compila
4. Fix de errores de TypeScript si hay
5. Commit

---

## Notas

- Los participantes guardan geo como TEXTO (nombres), no como FKs. Esto es consistente con el wizard.
- El `findParticipantByRut` busca por `rut` + `country` (texto, no ID).
- Los catálogos del parent ya incluyen `country_id` en sus tipos (InsuranceCompanyCatalog, BrokerCatalog, etc.) pero el edit form los tipaba como `Catalog` simple. Hay que actualizar la interfaz.
- No se agregan campos nuevos a la DB ni migraciones.
- No se cambia el save mutation (sigue guardando geo de participantes como texto).
