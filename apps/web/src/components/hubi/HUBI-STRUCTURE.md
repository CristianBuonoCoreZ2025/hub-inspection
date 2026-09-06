# BRIEF PARA CODEX / FABLE — MEJORAR HUBI MASCOT

## MISIÓN
Mejorar TODAS las animaciones, efectos visuales y el modelo 3D de Hubi.
Sin limitaciones creativas. Toquen todo. Hagan que sea lo más impresionante posible.

## ARCHIVOS A MODIFICAR
- `src/components/hubi/hubi-mascot-3d.tsx` (1393 líneas) — modelo 3D + animaciones
- `src/components/hubi/hubi-clippy.tsx` (692 líneas) — chat + detección de mood
- `src/components/hubi/hubi-mascot-3d.css` — estilos del Canvas
- `src/components/hubi/hubi-clippy.css` — estilos del panel

## NO TOCAR
- La lógica de drag & drop del robot
- La conexión a `/api/hubi/chat`
- El sistema de localStorage de posición
- La detección de palabras clave (a menos que agreguen nuevas)

---

## MEJORA 1 — CUERPO MÁS REDONDO

**Archivo:** `hubi-mascot-3d.tsx`, línea ~1161 (dentro de `bodyRef`)

**Actual:**
```tsx
<mesh position={[0, -0.5, 0]}>
  <capsuleGeometry args={[0.55, 0.7, 8, 16]} />
  <meshStandardMaterial color={COLORS.body} metalness={0.15} roughness={0.2} />
</mesh>
```

**Cambiar a:**
```tsx
<mesh position={[0, -0.5, 0]} scale={[0.95, 1.05, 0.85]} castShadow receiveShadow>
  <sphereGeometry args={[0.62, 48, 48]} />
  <meshPhysicalMaterial
    color="#ffffff" metalness={0.22} roughness={0.14}
    emissive="#e2e8f0" emissiveIntensity={0.025}
    clearcoat={1.0} clearcoatRoughness={0.1}
  />
</mesh>
```

**Por qué:** Esfera escalada da forma de ovoide más redondo y orgánico. `meshPhysicalMaterial` con clearcoat da aspecto premium tipo EVE/Wall-E. Segmentos 48x48 para superficie suave.

**Importante:** Los brazos se anclan en `[side*0.58, -0.12, 0.35]` — verificar que sigan pegados al cuerpo con la nueva forma. Si se despegan, mover el pivote del hombro a `[side*0.52, -0.15, 0.32]`.

---

## MEJORA 2 — GORRO DE CUMPLEAÑOS EN fistPump

**Archivo:** `hubi-mascot-3d.tsx` — crear nuevo componente `BirthdayHat`

**Implementar:**
```tsx
function BirthdayHat({ active }: { active: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    // Pop-in: escala de 0 a 1 en 0.3s cuando se activa
    const targetScale = active ? 1 : 0;
    ref.current.scale.x = THREE.MathUtils.lerp(ref.current.scale.x, targetScale, 0.15);
    ref.current.scale.y = THREE.MathUtils.lerp(ref.current.scale.y, targetScale, 0.15);
    ref.current.scale.z = THREE.MathUtils.lerp(ref.current.scale.z, targetScale, 0.15);
    // Wobble suave
    if (active) {
      ref.current.rotation.z = Math.sin(t * 4) * 0.08;
    }
  });
  return (
    <group ref={ref} position={[0, 0.55, 0]}>
      {/* Cono del gorro */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <coneGeometry args={[0.14, 0.35, 24]} />
        <meshPhysicalMaterial color="#f43f5e" metalness={0.1} roughness={0.3} clearcoat={0.5} />
      </mesh>
      {/* Pompón arriba */}
      <mesh position={[0, 0.38, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} />
      </mesh>
      {/* Banda inferior */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.04, 24]} />
        <meshStandardMaterial color="#0ea5e9" metalness={0.3} roughness={0.2} />
      </mesh>
      {/* Bola decorativa colgante */}
      <mesh position={[0.12, -0.02, 0]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}
```

**Colocar dentro de `headRef` group** (para que rote con la cabeza):
```tsx
<BirthdayHat active={mood === "fistPump"} />
```

---

## MEJORA 3 — CONFETTI MÁS ELABORADO

**Archivo:** `hubi-mascot-3d.tsx` — mejorar `VictoryConfetti` (línea ~1251)

**Mejoras:**
1. Aumentar COUNT de 180 a 250
2. Agregar formas variadas: además de cajas, usar esferas y cilindros
3. Agregar más colores: rosa, dorado, plateado
4. Hacer que algunas partículas sean estrellas (usar `octahedronGeometry`)
5. Las partículas más grandes caen más lento (paracaídas)
6. Algunas partículas giran mientras caen (rotación aleatoria)

```typescript
const CONFETTI_COLORS = [
  "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
  "#ec4899", "#f97316", "#06b6d4", "#eab308", "#84cc16",
  "#fbbf24", "#f472b6", "#a78bfa",  // dorado, rosa, lavanda
];
```

En la inicialización de partículas, asignar `shape: "box" | "sphere" | "star"` aleatoriamente.
En el render, usar 3 InstancedMesh diferentes (uno por forma) o un solo mesh con geometría variable.

---

## MEJORA 4 — APLAUSO CON ONDAS DE IMPACTO

**Archivo:** `hubi-mascot-3d.tsx` — crear `ClapShockwave`

**Implementar:**
```tsx
function ClapShockwave({ active }: { active: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const startTimeRef = useRef<number>(0);
  useFrame((state) => {
    if (!ringRef.current || !active) return;
    const t = state.clock.elapsedTime;
    const CLAP_FREQ = 5; // 5 aplausos por segundo
    const phase = (t * CLAP_FREQ) % 1;
    // Onda expande desde 0.05 a 0.4 y fade out
    const scale = 0.05 + phase * 0.35;
    const opacity = (1 - phase) * 0.6;
    ringRef.current.scale.set(scale, scale, scale);
    const mat = ringRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = opacity;
    ringRef.current.visible = phase < 0.8;
  });
  return (
    <mesh ref={ringRef} position={[0, -0.1, 0.4]} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.8, 1.0, 32]} />
      <meshBasicMaterial color="#fbbf24" transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  );
}
```

**Colocar en el modelo:**
```tsx
<ClapShockwave active={mood === "clap"} />
```

**Además en RobotArm:** Cuando `mood === "clap"`, las manos deben juntarse de verdad en el centro del cuerpo (no solo acercarse). Ajustar la animación de clap para que las manos se toquen en `[0, -0.1, 0.4]`.

---

## MEJORA 5 — AMOR MÁS ELABORADO

**Archivo:** `hubi-mascot-3d.tsx` — mejorar `GivenHeart` y `FloatingHearts`

### GivenHeart — mejoras:
1. Corazón más brillante: usar `meshPhysicalMaterial` con `clearcoat=1`, `emissiveIntensity` pulsante
2. Trail de corazones pequeños detrás del corazón principal (5-8 corazones que siguen la trayectoria con delay)
3. Explosión al final (fase 3): 12 corazones pequeños salen en todas direcciones
4. Aura/rosa: anillo de luz rosa alrededor del robot durante love

### FloatingHearts — mejoras:
1. Diferentes tamaños (0.04 a 0.12)
2. Rotación aleatoria mientras suben
3. Colores variados: rosa `#f472b6`, rojo `#ef4444`, naranja `#fb923c`
4. Trayectorias curvas (sin + cos, no solo sin)
5. Fade out más suave (smoothstep en vez de sin)

```typescript
// Trayectoria curva para cada corazón
const x = baseX + Math.sin(rise * Math.PI * 2 + phase) * 0.15;
const y = baseY + rise * 1.2;
const z = baseZ + Math.cos(rise * Math.PI + phase) * 0.1;
// Rotación aleatoria
const rotZ = rise * Math.PI * 2 * (phase % 2 === 0 ? 1 : -1);
```

---

## MEJORA 6 — IDLE MÁS VIVO

**Archivo:** `hubi-mascot-3d.tsx` — en `RobotModel` useFrame (línea ~888)

### Respiración visible:
```typescript
// Dentro del useFrame de RobotModel, caso idle:
if (mood === "idle") {
  const breathe = 1 + Math.sin(time * 1.2) * 0.015; // 1.5% de escala
  if (bodyRef.current) {
    bodyRef.current.scale.set(breathe, breathe, breathe);
  }
}
```

### Micro-movimientos de cabeza más frecuentes:
```typescript
// En idle, cabeza mira ligeramente a los lados cada 3-5s
const microLook = Math.sin(time * 0.3) * 0.05;
headRef.current.rotation.y = microLook + Math.sin(time * 0.8) * 0.03;
```

### Parpadeo más natural:
- Intervalo aleatorio entre 2s y 6s (no fijo)
- A veces doble parpadeo rápido

---

## MEJORA 7 — THINKING CON DEDO EN LA BARBILLA

**Archivo:** `hubi-mascot-3d.tsx` — en `RobotArm` (línea ~604)

**Cuando `mood === "thinking"`:**
- Brazo derecho sube hasta que la mano toca la barbilla
- `shoulderRef.rotation.x = -1.2` (brazo sube)
- `shoulderRef.rotation.z = 0.3` (brazo hacia adentro)
- `elbowRef.rotation.x = -0.6` (codo flexionado)
- Cabeza inclinada: `headRef.rotation.x = 0.15`, `headRef.rotation.z = -0.1`
- Micro idle: cabeza oscila ligeramente

**Actualmente thinking solo mueve la cabeza.** Agregar el brazo derecho a la barbilla.

---

## MEJORA 8 — ERROR MÁS DRAMÁTICO

**Archivo:** `hubi-mascot-3d.tsx`

**Cuando `mood === "error"`:**
1. Sacudida más fuerte: `groupRef.position.x = Math.sin(time * 30) * 0.04`
2. Chispas: 5-8 puntos de luz amarilla que salen de la cabeza y caen
3. Color del cuerpo tinte rojo: `material.emissive = new THREE.Color("#f43f5e")`, `emissiveIntensity = 0.15`
4. Ojos X más grandes: escalar `XEye` a 1.3x

---

## MEJORA 9 — SLEEPY MÁS TIERNO

**Archivo:** `hubi-mascot-3d.tsx`

**Cuando `mood === "sleepy"`:**
1. Más Zzz: 4-5 letras Z de diferentes tamaños (actualmente 3)
2. Cuerpo se inclina ligeramente: `bodyRef.rotation.x = 0.1`
3. Ronquido visual: ondas concéntricas desde la boca cada 2s
4. Cabeza cae ligeramente: `headRef.rotation.x = 0.25`

---

## MEJORA 10 — CHARGING MÁS TECNOLÓGICO

**Archivo:** `hubi-mascot-3d.tsx`

**Cuando `mood === "charging"`:**
1. Rayo eléctrico que entra desde arriba: línea zigzag de `y=2` a `y=0.5` que pulsa
2. Ondas electromagnéticas: 3 anillos expandiendo desde el cuerpo
3. Color del cuerpo pulsa en amarillo: `emissive` alterna entre `#fbbf24` y `#000000`
4. Batería más detallada: agregar percentage text 3D o barras

---

## MEJORA 11 — SURPRISED MÁS EXPRESIVO

**Archivo:** `hubi-mascot-3d.tsx`

**Cuando `mood === "surprised"`:**
1. Retroceso más marcado: `groupRef.position.z = -0.08` (se echa atrás)
2. Estrellas orbitando la cabeza: 5 estrellas pequeñas en órbita circular
3. Boca forma "O" grande: `Mouth` component, escalar boca a 2x
4. Brazos se abren: `shoulderRef.rotation.z = side * 0.8` (ambos brazos se abren)

---

## MEJORA 12 — BAILE MÁS EXPRESIVO

**Archivo:** `hubi-mascot-3d.tsx`

**En el sistema de baile (línea ~567):**
1. Subir de 3 poses a 5 poses en `movePose`
2. Cabeza sigue el ritmo: `headRef.rotation.y = Math.sin(beat * Math.PI) * 0.15`
3. En algunos beats, giro de cuerpo: `groupRef.rotation.y += 0.5` en beat 4 y 8
4. Brazos más exagerados: aumentar amplitud de `sz` y `sx` en 20%
5. Efecto de ondas de sonido: 2-3 anillos expandiendo desde el cuerpo al ritmo del beat

---

## MEJORA 13 — NUEVAS ANIMACIONES

**Agregar al type `HubiState3D`:**
```typescript
| "birthday"   // Gorro + confetti + salto + canción visual
| "magic"      // Varita mágica + estrellas + efecto mágico
| "bow"        // Reverencia (cuerpo se inclina adelante)
| "thumbsUp"   // Pulgar arriba
| "wink"       // Guiño con un ojo
```

### birthday:
- Gorro de cumpleaños (usar `BirthdayHat`)
- Confetti extra denso (usar `VictoryConfetti` con COUNT=300)
- Robot salta 3 veces (reusar animación de jump)
- Cabeza mira arriba
- Duración: 5000ms

### magic:
- Varita mágica en mano derecha (cilindro + estrella en la punta)
- Estrellas salen de la varita (10-15 estrellas pequeñas)
- Cuerpo brilla: `emissiveIntensity` sube a 0.3
- Ojos brillan más
- Duración: 4000ms

### bow:
- `groupRef.rotation.x = 0.3` (inclinación adelante)
- Brazos pegados al cuerpo
- Cabeza baja: `headRef.rotation.x = 0.3`
- Vuelve suavemente
- Duración: 2000ms

### thumbsUp:
- Brazo derecho doblado, mano a la altura del pecho
- Pulgar arriba (cilindro pequeño que sobresale de la mano)
- Cabeza asiente: `headRef.rotation.x = -0.1`
- Duración: 2500ms

### wink:
- Ojo derecho cierra (escala Y a 0.1)
- Ojo izquierdo normal
- Sonrisa: boca más ancha
- Duración: 1500ms

---

## MEJORA 14 — OJOS Y BOCA MEJORADOS

### Ojos:
- Agregar brillo/pupila: esfera blanca pequeña dentro del ojo (reflejo de luz)
- Cuando `talking`: ojos miran ligeramente hacia abajo (lectura)
- Cuando `love`: ojos corazón pulsan (escala 1.0 → 1.1 → 1.0)

### Boca:
- Más expresiva: diferentes formas según mood
  - `talking`: elipse que escala Y rítmicamente
  - `happy/grateful/love`: sonrisa (arco invertido)
  - `error`: línea recta con dientes (rectángulos pequeños)
  - `surprised`: "O" grande (esfera escalada)
  - `sleepy`: línea suave curva
  - `thinking`: línea recta ladeada

---

## MEJORA 15 — ILUMINACIÓN Y RENDER PREMIUM

**Archivo:** `hubi-mascot-3d.tsx` — en el Canvas (línea ~1459)

**Cambiar:**
```tsx
<Canvas
  camera={{ position: [0, 0, 4.5], fov: 45 }}
  gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
  dpr={[1.5, 2.5]}
  shadows
  onCreated={({ gl }) => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.0;
  }}
>
  <ambientLight intensity={0.85} />
  <directionalLight
    position={[5, 8, 5]} intensity={1.4} color="#ffffff"
    castShadow
    shadow-mapSize-width={2048}
    shadow-mapSize-height={2048}
    shadow-radius={3}
  />
  <directionalLight position={[-5, 5, -5]} intensity={0.6} color="#e0f2fe" />
  <pointLight position={[-5, 5, 5]} intensity={0.4} color="#38bdf8" />
  <pointLight position={[5, -5, 5]} intensity={0.3} color="#0284c7" />
```

---

## REGLAS TÉCNICAS OBLIGATORIAS

1. **NO romper las animaciones existentes** — mejorarlas, no reemplazarlas
2. **Mantener la jerarquía de refs**: `groupRef`, `headRef`, `bodyRef`, `shoulderRef`, `elbowRef`, `handRef`
3. **Usar `useFrame` para animaciones** — no mutar refs durante render
4. **Performance**: no recalcular geometrías/materiales por frame
5. **Sin inline styles** — usar clases CSS (regla del proyecto)
6. **Sin `title=""`** — usar componente Tooltip (regla del proyecto)
7. **Sin `alert/confirm/prompt`** — usar useConfirm/useAlert (regla del proyecto)
8. **Botones de una sola palabra** (regla del proyecto)
9. **Español neutro** — sin argentismos (regla del proyecto)
10. **TypeScript estricto** — sin `any`, sin errores
11. **ESLint sin warnings** — `--max-warnings=0`
12. **Mantener `HubiState3D`** — agregar nuevos estados al type, no reemplazar
13. **No usar emojis en código** a menos que sea necesario para UI

---

## STACK TECNOLÓGICO
- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript estricto
- @react-three/fiber (R3F) — Canvas, useFrame
- @react-three/drei — useGLTF, ContactShadows, Html, etc.
- three.js — THREE namespace
- Tailwind CSS v4
- shadcn/ui
- lucide-react (iconos)

---

## VERIFICACIÓN
1. `npx eslint "src/components/hubi/hubi-mascot-3d.tsx" --max-warnings=0`
2. `npx eslint "src/components/hubi/hubi-clippy.tsx" --max-warnings=0`
3. `npx tsc --noEmit` — sin errores
4. Probar cada animación desde el menú de emociones del chat
5. Verificar que el robot no se desarme visualmente (brazos pegados al cuerpo)
