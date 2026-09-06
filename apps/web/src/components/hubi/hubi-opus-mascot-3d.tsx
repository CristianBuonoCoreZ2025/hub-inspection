"use client";

import { useRef, useMemo, useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import "./hubi-mascot-3d.css";

/* ============================================================
   FUNDACIÓN — helpers de animación (sin allocations por frame)
   ============================================================ */
const D = THREE.MathUtils.damp;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (v: number) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const smoothstepRange = (edge0: number, edge1: number, x: number) =>
  smoothstep((x - edge0) / (edge1 - edge0));
const easeOutBack = (x: number) => {
  const c = clamp01(x) - 1;
  return 1 + 2.70158 * c * c * c + 1.70158 * c * c;
};
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SCRATCH_OBJ = new THREE.Object3D();
const SCRATCH_COLOR = new THREE.Color();
const SCRATCH_COLOR_B = new THREE.Color();

/* ---------- geometría de corazón (singleton) ---------- */
const HEART_GEOMETRY = (() => {
  const s = new THREE.Shape();
  s.moveTo(0, 0.32);
  s.bezierCurveTo(0, 0.54, -0.3, 0.74, -0.55, 0.48);
  s.bezierCurveTo(-0.86, 0.18, -0.44, -0.26, 0, -0.6);
  s.bezierCurveTo(0.44, -0.26, 0.86, 0.18, 0.55, 0.48);
  s.bezierCurveTo(0.3, 0.74, 0, 0.54, 0, 0.32);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.22,
    bevelEnabled: true,
    bevelSize: 0.06,
    bevelThickness: 0.06,
    bevelSegments: 2,
    curveSegments: 14,
  });
  g.center();
  g.scale(0.82, 0.82, 0.82);
  g.computeVertexNormals();
  return g;
})();

/* ---------- tipos ---------- */
export type HubiState3D =
  | "idle" | "thinking" | "talking" | "error" | "grateful" | "confused"
  | "surprised" | "love" | "sleepy" | "charging" | "fistPump" | "stretch"
  | "shrug" | "nod" | "shake" | "lookAround" | "dance" | "spin" | "jump"
  | "clap" | "greeting"
  | "birthday" | "magic" | "bow" | "thumbsUp" | "wink" | "presidential" | "superhero";

interface HubiMascot3DProps {
  state?: HubiState3D;
  size?: number;
  className?: string;
}

/* ---------- duraciones por mood ---------- */
export const HUBI_MOOD_DURATION: Partial<Record<HubiState3D, number>> = {
  jump: 2200, clap: 3000, fistPump: 3200, love: 4200, grateful: 2800,
  dance: 6000, surprised: 2000, error: 2600, stretch: 2800,
  birthday: 5000, magic: 4000, bow: 2000, thumbsUp: 2500, wink: 1500, presidential: 3200, superhero: 7000,
};

/* ---------- constantes de color ---------- */
const BODY_BASE = new THREE.Vector3(0.95, 1.05, 0.85);
const BODY_EMISSIVE_BASE = new THREE.Color("#e2e8f0");
const ERROR_EMISSIVE = new THREE.Color("#f43f5e");
const CHARGE_EMISSIVE = new THREE.Color("#fbbf24");
const MAGIC_EMISSIVE = new THREE.Color("#a78bfa");
const LOVE_EMISSIVE = new THREE.Color("#fb7185");
const BIRTHDAY_EMISSIVE = new THREE.Color("#f472b6");
const BODY_WHITE_COLOR = new THREE.Color("#ffffff");
const SUPERHERO_BODY_COLOR = new THREE.Color("#1565d8");

const DANCE_BPS = 2.2;
const CLAP_FREQ = 5;
const ARM_SIGN = 1;

/* ---------- poses de cabeza ---------- */
interface HeadPose { x: number; y: number; z: number; stiff: number }
const HEAD_POSE_DEFAULT: HeadPose = { x: 0, y: 0, z: 0, stiff: 5 };
const MOOD_HEAD_POSE: Record<HubiState3D, HeadPose> = {
  idle: HEAD_POSE_DEFAULT,
  talking: { x: 0.06, y: 0, z: 0, stiff: 6 },
  thinking: { x: 0.15, y: -0.12, z: -0.1, stiff: 5 },
  grateful: { x: 0.12, y: 0, z: 0, stiff: 5 },
  error: { x: 0.05, y: 0, z: 0, stiff: 14 },
  sleepy: { x: 0.25, y: -0.06, z: 0.14, stiff: 3 },
  charging: { x: -0.06, y: 0, z: 0, stiff: 4 },
  surprised: { x: -0.16, y: 0, z: 0, stiff: 13 },
  jump: { x: -0.12, y: 0, z: 0, stiff: 9 },
  birthday: { x: -0.24, y: 0, z: 0, stiff: 8 },
  magic: { x: -0.1, y: 0.14, z: -0.06, stiff: 6 },
  bow: { x: 0.3, y: 0, z: 0, stiff: 6 },
  thumbsUp: { x: -0.1, y: 0, z: 0, stiff: 8 },
  wink: { x: -0.04, y: 0.06, z: 0.1, stiff: 8 },
  love: { x: -0.06, y: 0, z: 0.1, stiff: 6 },
  clap: { x: -0.1, y: 0, z: 0, stiff: 8 },
  fistPump: { x: -0.18, y: 0, z: 0, stiff: 8 },
  presidential: { x: -0.18, y: 0, z: 0, stiff: 8 },
  superhero: { x: -0.22, y: 0, z: 0, stiff: 10 },
  dance: HEAD_POSE_DEFAULT,
  confused: { x: 0, y: 0, z: 0.12, stiff: 6 },
  greeting: { x: -0.05, y: 0.12, z: 0.08, stiff: 7 },
  stretch: { x: -0.2, y: 0, z: 0, stiff: 6 },
  shrug: { x: 0.08, y: 0, z: 0, stiff: 8 },
  nod: { x: 0, y: 0, z: 0, stiff: 8 },
  shake: { x: 0, y: 0, z: 0, stiff: 8 },
  lookAround: { x: 0, y: 0, z: 0, stiff: 6 },
  spin: { x: 0, y: 0, z: 0, stiff: 8 },
};

/* ---------- poses de baile ---------- */
const DANCE_POSES: ReadonlyArray<{ sx: number; sz: number; ex: number }> = [
  { sx: -1.95, sz: 0.55, ex: -0.35 },
  { sx: -0.35, sz: 1.15, ex: -1.25 },
  { sx: -1.25, sz: -0.25, ex: -1.65 },
  { sx: -2.35, sz: 0.95, ex: -0.15 },
  { sx: 0.25, sz: 0.15, ex: -0.55 },
];

/* ============================================================
   MEJORA 2 — BirthdayHat
   ============================================================ */
function BirthdayHat({ active }: { active: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const tRef = useRef(0);
  useFrame((state, delta) => {
    const g = ref.current;
    if (!g) return;
    const dt = Math.min(delta, 1 / 30);
    tRef.current = clamp01(tRef.current + (active ? dt / 0.32 : -dt / 0.2));
    const p = tRef.current;
    g.visible = p > 0.001;
    if (!g.visible) return;
    const s = easeOutBack(p);
    g.scale.setScalar(s);
    const t = state.clock.elapsedTime;
    g.rotation.z = Math.sin(t * 4) * 0.08 * p;
    g.rotation.x = Math.cos(t * 3.1) * 0.04 * p;
    g.position.y = 0.55 + Math.sin(t * 6) * 0.008 * p;
  });
  return (
    <group ref={ref} position={[0, 0.55, 0]} scale={0} visible={false}>
      <mesh position={[0, 0.18, 0]} castShadow>
        <coneGeometry args={[0.14, 0.35, 24]} />
        <meshStandardMaterial color="#f43f5e" metalness={0.1} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.04, 24]} />
        <meshStandardMaterial color="#0ea5e9" metalness={0.3} roughness={0.2} />
      </mesh>
      <mesh position={[0.12, -0.02, 0.03]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[-0.11, -0.02, -0.04]}>
        <sphereGeometry args={[0.026, 12, 12]} />
        <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.2} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0.09 + i * 0.09, 0]} rotation={[0, i * 1.1, 0]}>
          <torusGeometry args={[0.115 - i * 0.032, 0.007, 6, 24]} />
          <meshStandardMaterial color="#fef3c7" emissive="#fde68a" emissiveIntensity={0.25} />
        </mesh>
      ))}
    </group>
  );
}

/* ============================================================
   MagicHat — copa abierta + conejo visible
   ============================================================ */
function MagicHat({ active }: { active: boolean }) {
  const hatRef = useRef<THREE.Group>(null);
  const rabbitRef = useRef<THREE.Group>(null);
  const appearanceRef = useRef(0);
  const cycleRef = useRef(0);
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const hat = hatRef.current;
    const rabbit = rabbitRef.current;
    if (!hat || !rabbit) return;
    appearanceRef.current = clamp01(
      appearanceRef.current + (active ? dt / 0.4 : -dt / 0.25)
    );
    const appearance = appearanceRef.current;
    hat.visible = appearance > 0.001;
    hat.scale.setScalar(easeOutBack(appearance));
    if (!hat.visible) {
      cycleRef.current = 0;
      rabbit.visible = false;
      return;
    }
    const time = state.clock.elapsedTime;
    hat.position.y = 0.55 + Math.sin(time * 2) * 0.008;
    hat.rotation.z = Math.sin(time * 1.8) * 0.025 * appearance;
    if (active) {
      cycleRef.current += dt;
    }
    const cycle = cycleRef.current % 4;
    let reveal = 0;
    let jump = 0;
    if (cycle < 0.85) {
      const progress = cycle / 0.85;
      reveal = smoothstep(progress);
      jump = Math.sin(progress * Math.PI) * 0.065;
    } else if (cycle < 2.55) {
      reveal = 1;
      jump = Math.sin((cycle - 0.85) * 4) * 0.008;
    } else if (cycle < 3.4) {
      reveal = 1 - smoothstep((cycle - 2.55) / 0.85);
    }
    rabbit.visible = reveal > 0.015;
    rabbit.position.set(0, 0.14 + reveal * 0.4 + jump, 0);
    rabbit.scale.setScalar(0.23 * (0.12 + reveal * 0.88));
    rabbit.rotation.z = Math.sin(time * 3) * 0.035 * reveal;
    rabbit.rotation.x = Math.sin(time * 2.5) * 0.025 * reveal;
  });
  return (
    <group ref={hatRef} position={[0, 0.55, 0]} scale={0} visible={false}>
      {/* Ala ancha, algo ovalada */}
      <mesh position={[0, 0.02, 0]} scale={[1.08, 1, 1]} castShadow>
        <cylinderGeometry args={[0.29, 0.29, 0.035, 64]} />
        <meshStandardMaterial color="#191a2d" roughness={0.48} metalness={0.12} />
      </mesh>
      {/* Perfil del ala */}
      <mesh position={[0, 0.035, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1.08, 1, 1]}>
        <torusGeometry args={[0.279, 0.009, 12, 64]} />
        <meshStandardMaterial color="#34334e" roughness={0.5} />
      </mesh>
      {/* Copa ABIERTA: openEnded=true elimina las tapas */}
      <mesh position={[0, 0.245, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.15, 0.43, 64, 1, true]} />
        <meshStandardMaterial color="#202137" roughness={0.42} metalness={0.12} side={THREE.DoubleSide} />
      </mesh>
      {/* Fondo oscuro dentro del sombrero; NO tapa la salida */}
      <mesh position={[0, 0.042, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.147, 64]} />
        <meshBasicMaterial color="#080812" side={THREE.DoubleSide} />
      </mesh>
      {/* Labio superior: hace legible la abertura */}
      <mesh position={[0, 0.46, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.012, 16, 64]} />
        <meshStandardMaterial color="#45415e" roughness={0.35} metalness={0.15} />
      </mesh>
      {/* Cinta violeta alrededor de la base */}
      <mesh position={[0, 0.105, 0]}>
        <cylinderGeometry args={[0.1605, 0.1555, 0.065, 64, 1, true]} />
        <meshStandardMaterial color="#8b5cf6" roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Bordes dorados de la cinta */}
      {[0.073, 0.137].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15 + ((y - 0.03) / 0.43) * 0.03 + 0.002, 0.0035, 8, 64]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.45} roughness={0.3} />
        </mesh>
      ))}
      {/* Adorno frontal, fuera de la superficie de la copa */}
      <mesh position={[0, 0.105, 0.163]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.032, 0.032, 0.009]} />
        <meshStandardMaterial color="#fcd34d" metalness={0.45} roughness={0.3} />
      </mesh>
      {/* ================= CONEJO ================= */}
      <group ref={rabbitRef} visible={false}>
        {/* Cuerpo */}
        <mesh scale={[0.42, 0.48, 0.34]} castShadow>
          <sphereGeometry args={[1, 32, 24]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.85} />
        </mesh>
        {/* Barriga */}
        <mesh position={[0, -0.02, 0.285]} scale={[0.28, 0.32, 0.08]}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial color="#ffffff" roughness={0.9} />
        </mesh>
        {/* Cabeza grande */}
        <mesh position={[0, 0.45, 0.035]} scale={[0.39, 0.35, 0.33]} castShadow>
          <sphereGeometry args={[1, 32, 24]} />
          <meshStandardMaterial color="#ffffff" roughness={0.8} />
        </mesh>
        {/* Orejas: el interior rosa está delante, no enterrado */}
        {([-1, 1] as const).map((side) => (
          <group key={`ear-${side}`} position={[side * 0.17, 0.93, 0.025]} rotation={[0, 0, -side * 0.13]}>
            <mesh scale={[0.115, 0.39, 0.095]} castShadow>
              <sphereGeometry args={[1, 24, 20]} />
              <meshStandardMaterial color="#ffffff" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.01, 0.081]} scale={[0.061, 0.285, 0.025]}>
              <sphereGeometry args={[1, 24, 16]} />
              <meshStandardMaterial color="#f9a8d4" roughness={0.85} />
            </mesh>
          </group>
        ))}
        {/* Ojos con brillo y mejillas */}
        {([-1, 1] as const).map((side) => (
          <group key={`face-${side}`}>
            <mesh position={[side * 0.135, 0.49, 0.337]} scale={[0.049, 0.063, 0.028]}>
              <sphereGeometry args={[1, 20, 16]} />
              <meshBasicMaterial color="#141424" />
            </mesh>
            <mesh position={[side * 0.135 - 0.012, 0.513, 0.362]}>
              <sphereGeometry args={[0.015, 12, 12]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[side * 0.21, 0.36, 0.299]} scale={[0.066, 0.035, 0.017]}>
              <sphereGeometry args={[1, 16, 12]} />
              <meshStandardMaterial color="#fbcfe8" roughness={0.9} />
            </mesh>
            {/* Hocico */}
            <mesh position={[side * 0.061, 0.34, 0.349]} scale={[0.085, 0.064, 0.045]}>
              <sphereGeometry args={[1, 20, 16]} />
              <meshStandardMaterial color="#fffafa" roughness={0.9} />
            </mesh>
            {/* Patitas delanteras */}
            <mesh position={[side * 0.29, -0.12, 0.24]} scale={[0.13, 0.2, 0.15]} rotation={[0, 0, side * 0.2]} castShadow>
              <sphereGeometry args={[1, 24, 16]} />
              <meshStandardMaterial color="#ffffff" roughness={0.85} />
            </mesh>
          </group>
        ))}
        {/* Nariz */}
        <mesh position={[0, 0.375, 0.392]} scale={[0.042, 0.03, 0.025]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshStandardMaterial color="#f472b6" roughness={0.65} />
        </mesh>
        {/* Dos dientecitos */}
        {[-0.023, 0.023].map((x) => (
          <mesh key={x} position={[x, 0.275, 0.359]}>
            <boxGeometry args={[0.036, 0.055, 0.025]} />
            <meshStandardMaterial color="#ffffff" roughness={0.7} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ============================================================
   PresidentialSash — banda presidencial celeste-blanco-celeste + escudo
   ============================================================ */
const SASH_CENTER_Y = -0.35;
const SASH_FRONT_Z = 0.52;
const SASH_LENGTH = 0.85;
const SASH_WIDTH = 0.2;
const SASH_DEPTH = 0.025;
const SASH_ANGLE = THREE.MathUtils.degToRad(36);

function PresidentialSash({ active }: { active: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(delta, 1 / 30);
    progressRef.current = clamp01(progressRef.current + (active ? dt / 0.32 : -dt / 0.2));
    const progress = progressRef.current;
    group.visible = progress > 0.001;
    if (!group.visible) {
      group.scale.setScalar(0);
      return;
    }
    group.scale.setScalar(easeOutBack(progress));
  });
  const stripeWidth = SASH_WIDTH / 3;
  return (
    <group ref={groupRef} position={[0, SASH_CENTER_Y, SASH_FRONT_Z]} scale={0} visible={false}>
      <group rotation={[0, 0, SASH_ANGLE]}>
        {/* Ribete dorado detrás de las franjas */}
        <mesh position={[0, 0, -0.005]}>
          <boxGeometry args={[SASH_WIDTH + 0.012, SASH_LENGTH + 0.012, SASH_DEPTH]} />
          <meshStandardMaterial color="#d4a32c" metalness={0.65} roughness={0.32} />
        </mesh>
        {/* Rojo (izquierda) */}
        <mesh position={[-stripeWidth, 0, 0.006]}>
          <boxGeometry args={[stripeWidth, SASH_LENGTH, SASH_DEPTH]} />
          <meshStandardMaterial color="#dc2626" metalness={0.05} roughness={0.65} />
        </mesh>
        {/* Blanco (centro) */}
        <mesh position={[0, 0, 0.006]}>
          <boxGeometry args={[stripeWidth, SASH_LENGTH, SASH_DEPTH]} />
          <meshStandardMaterial color="#ffffff" metalness={0.02} roughness={0.7} />
        </mesh>
        {/* Azul (derecha) */}
        <mesh position={[stripeWidth, 0, 0.006]}>
          <boxGeometry args={[stripeWidth, SASH_LENGTH, SASH_DEPTH]} />
          <meshStandardMaterial color="#1e40af" metalness={0.05} roughness={0.65} />
        </mesh>
      </group>
      {/* Escudo estilizado */}
      <group position={[0, 0, 0.038]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.058, 0.058, 0.018, 32]} />
          <meshStandardMaterial color="#dca82c" metalness={0.75} roughness={0.28} />
        </mesh>
        <mesh position={[0, 0, 0.015]} scale={[1, 1.15, 0.35]}>
          <sphereGeometry args={[0.039, 20, 16]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.6} roughness={0.25} emissive="#b7791f" emissiveIntensity={0.12} />
        </mesh>
      </group>
    </group>
  );
}

/* ============================================================
   PresidentialOpenHand — mano abierta con dedos extendidos
   ============================================================ */
const OPEN_FINGERS = [
  { x: -0.036, length: 0.071, spread: 0.13 },
  { x: -0.012, length: 0.085, spread: 0.04 },
  { x: 0.012, length: 0.079, spread: -0.04 },
  { x: 0.036, length: 0.064, spread: -0.14 },
] as const;

function PresidentialOpenHand() {
  return (
    <group>
      {/* Palma */}
      <mesh position={[0, 0.04, 0]} castShadow>
        <boxGeometry args={[0.105, 0.08, 0.04]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.35} roughness={0.4} />
      </mesh>
      {/* Cuatro dedos extendidos */}
      {OPEN_FINGERS.map((finger, index) => (
        <group key={index} position={[finger.x, 0.077, 0]} rotation={[0, 0, finger.spread]}>
          <mesh position={[0, finger.length / 2, 0]} castShadow>
            <boxGeometry args={[0.019, finger.length, 0.03]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.35} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* Pulgar */}
      <group position={[-0.048, 0.025, 0]} rotation={[0, 0, 0.85]}>
        <mesh position={[0, 0.027, 0]} castShadow>
          <boxGeometry args={[0.024, 0.054, 0.032]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.35} roughness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

/* ============================================================
   SuperheroCostume — escudo pentagonal + capa oscura (sin pechera)
   ============================================================ */
const SUPER_COLORS = {
  suit: "#1565d8",
  cape: "#dc2626",
  emblemRed: "#dc2626",
  emblemGold: "#facc15",
  emblemEdge: "#352A28",
} as const;

const BODY_CENTER_Y = -0.5;
const BODY_RX = 0.62 * 0.95;
const BODY_RY = 0.62 * 1.05;
const BODY_RZ = 0.62 * 0.85;

function getTorsoFront(x: number, y: number) {
  const dy = y - BODY_CENTER_Y;
  const remaining = 1 - (x * x) / (BODY_RX * BODY_RX) - (dy * dy) / (BODY_RY * BODY_RY);
  if (remaining <= 0) return null;
  const z = BODY_RZ * Math.sqrt(remaining);
  const point = new THREE.Vector3(x, y, z);
  const normal = new THREE.Vector3(
    x / (BODY_RX * BODY_RX),
    dy / (BODY_RY * BODY_RY),
    z / (BODY_RZ * BODY_RZ),
  ).normalize();
  return { point, normal };
}

function createShieldOutline(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-0.72, 0.72);
  shape.lineTo(0.72, 0.72);
  shape.lineTo(1, 0.28);
  shape.lineTo(0, -1);
  shape.lineTo(-1, 0.28);
  shape.closePath();
  return shape;
}

function createCurvedSuperS(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(0.56, 0.48);
  shape.bezierCurveTo(0.25, 0.64, -0.34, 0.61, -0.56, 0.39);
  shape.bezierCurveTo(-0.78, 0.13, -0.40, -0.01, -0.09, -0.06);
  shape.bezierCurveTo(0.19, -0.11, 0.39, -0.18, 0.27, -0.31);
  shape.bezierCurveTo(0.12, -0.45, -0.16, -0.41, -0.37, -0.28);
  shape.lineTo(-0.18, -0.53);
  shape.bezierCurveTo(0.04, -0.65, 0.35, -0.46, 0.48, -0.24);
  shape.bezierCurveTo(0.66, 0.05, 0.27, 0.17, -0.04, 0.21);
  shape.bezierCurveTo(-0.27, 0.24, -0.43, 0.29, -0.32, 0.38);
  shape.bezierCurveTo(-0.15, 0.50, 0.22, 0.45, 0.40, 0.32);
  shape.lineTo(0.56, 0.48);
  shape.closePath();
  return shape;
}

function SuperChestShield() {
  const outline = createShieldOutline();
  const letter = createCurvedSuperS();
  return (
    <group scale={[0.32, 0.32, 0.32]}>
      {/* Base oscura con grosor */}
      <mesh position={[0, 0, -0.045]}>
        <extrudeGeometry args={[outline, { depth: 0.045, steps: 1, bevelEnabled: false, curveSegments: 24 }]} />
        <meshStandardMaterial color={SUPER_COLORS.emblemEdge} metalness={0.35} roughness={0.55} />
      </mesh>
      {/* Contorno rojo */}
      <mesh position={[0, 0, 0.008]} scale={[0.95, 0.95, 1]}>
        <shapeGeometry args={[outline]} />
        <meshStandardMaterial color={SUPER_COLORS.emblemRed} metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Fondo dorado apagado */}
      <mesh position={[0, 0, 0.018]} scale={[0.8, 0.8, 1]}>
        <shapeGeometry args={[outline]} />
        <meshStandardMaterial color={SUPER_COLORS.emblemGold} metalness={0.45} roughness={0.6} />
      </mesh>
      {/* S curva */}
      <mesh position={[0, 0, 0.03]}>
        <shapeGeometry args={[letter, 32]} />
        <meshStandardMaterial color={SUPER_COLORS.emblemRed} metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
}

function SuperheroCostume({ active }: { active: boolean }) {
  const rootRef = useRef<THREE.Group>(null);
  const capeGeometryRef = useRef<THREE.PlaneGeometry>(null);
  const progressRef = useRef(0);
  const capeWidth = 1.5;
  const capeLength = 1.12;
  const capeTopY = -0.12;
  // Escudo: posición y orientación sobre la superficie del torso
  const badgeFront = getTorsoFront(0, -0.38);
  const badge = badgeFront
    ? {
        position: badgeFront.point.clone().addScaledVector(badgeFront.normal, 0.009),
        quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), badgeFront.normal),
      }
    : { position: new THREE.Vector3(0, -0.38, 0.52), quaternion: new THREE.Quaternion() };
  // Hebilla discreta
  const beltY = -0.72;
  const beltDy = beltY - BODY_CENTER_Y;
  const beltSection = Math.sqrt(Math.max(0, 1 - (beltDy * beltDy) / (BODY_RY * BODY_RY)));
  const beltRadiusZ = BODY_RZ * beltSection + 0.014;
  useFrame((state, delta) => {
    const root = rootRef.current;
    if (!root) return;
    const dt = Math.min(delta, 1 / 30);
    progressRef.current = clamp01(progressRef.current + (active ? dt / 0.32 : -dt / 0.2));
    const progress = progressRef.current;
    root.visible = progress > 0.001;
    root.scale.setScalar(root.visible ? easeOutBack(progress) : 0);
    if (!root.visible) return;
    const geometry = capeGeometryRef.current;
    if (!geometry) return;
    const positions = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    const time = state.clock.elapsedTime;
    for (let i = 0; i < positions.count; i++) {
      const u = uv.getX(i);
      const v = uv.getY(i);
      const down = 1 - v;
      const width = capeWidth * (0.62 + 0.38 * down);
      const x = (u - 0.5) * width;
      const y = (v - 0.5) * capeLength;
      const flutter = Math.sin(time * 5.5 - down * 7 + u * 4) * 0.065 * down;
      const folds = Math.sin(u * Math.PI * 8) * 0.018 * down;
      const z = -down * 0.22 + flutter + folds;
      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  });
  return (
    <group position={[0, BODY_CENTER_Y, 0]}>
      <group ref={rootRef} scale={0} visible={false}>
        <group position={[0, -BODY_CENTER_Y, 0]}>
          {/* Hebilla discreta dorada envejecida */}
          <mesh position={[0, beltY, beltRadiusZ + 0.006]} scale={[1, 0.65, 0.3]}>
            <sphereGeometry args={[0.052, 24, 16]} />
            <meshStandardMaterial color={SUPER_COLORS.emblemGold} metalness={0.55} roughness={0.55} />
          </mesh>
          {/* Escudo pentagonal sobre el pecho */}
          <group position={badge.position} quaternion={badge.quaternion}>
            <SuperChestShield />
          </group>
          {/* Capa roja oscura — detrás del torso */}
          <mesh position={[0, capeTopY - capeLength / 2, -0.57]} frustumCulled={false}>
            <planeGeometry ref={capeGeometryRef} args={[capeWidth, capeLength, 24, 28]} />
            <meshStandardMaterial color={SUPER_COLORS.cape} side={THREE.DoubleSide} roughness={0.85} metalness={0} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/* ============================================================
   VictoryCup — trofeo dorado con cuenco hueco y asas
   ============================================================ */
function VictoryCup({ active }: { active: boolean }) {
  const popRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  useFrame((_, delta) => {
    const group = popRef.current;
    if (!group) return;
    if (!active) {
      progressRef.current = 0;
      group.visible = false;
      group.scale.setScalar(0);
      return;
    }
    const dt = Math.min(delta, 1 / 30);
    progressRef.current = Math.min(1, progressRef.current + dt / 0.34);
    group.visible = true;
    group.scale.setScalar(easeOutBack(progressRef.current));
  });
  const gold = {
    color: "#ffc83d", metalness: 0.85, roughness: 0.22,
    emissive: "#a85b08", emissiveIntensity: 0.12,
  } as const;
  return (
    <group ref={popRef} scale={0} visible={false}>
      {/* Base oscura */}
      <mesh position={[0, -0.10, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.064, 0.074, 0.028, 48]} />
        <meshStandardMaterial color="#202338" metalness={0.3} roughness={0.35} />
      </mesh>
      {/* Placa dorada sobre la base */}
      <mesh position={[0, -0.079, 0]} castShadow>
        <cylinderGeometry args={[0.058, 0.066, 0.014, 48]} />
        <meshStandardMaterial {...gold} />
      </mesh>
      {/* Pie del tallo */}
      <mesh position={[0, -0.060, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.047, 0.026, 48]} />
        <meshStandardMaterial {...gold} />
      </mesh>
      {/* Tallo */}
      <mesh position={[0, -0.004, 0]} castShadow>
        <cylinderGeometry args={[0.017, 0.021, 0.096, 32]} />
        <meshStandardMaterial {...gold} />
      </mesh>
      {/* Unión tallo-cuenco */}
      <mesh position={[0, 0.046, 0]} scale={[1, 0.65, 1]} castShadow>
        <sphereGeometry args={[0.031, 24, 16]} />
        <meshStandardMaterial {...gold} />
      </mesh>
      {/* Cuenco — cono abierto hacia arriba */}
      <mesh position={[0, 0.13, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.11, 0.05, 0.14, 32, 1, true]} />
        <meshStandardMaterial {...gold} side={THREE.DoubleSide} />
      </mesh>
      {/* Fondo del cuenco */}
      <mesh position={[0, 0.063, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.05, 32]} />
        <meshStandardMaterial {...gold} side={THREE.DoubleSide} />
      </mesh>
      {/* Borde redondeado de la abertura */}
      <mesh position={[0, 0.20, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.108, 0.008, 12, 64]} />
        <meshStandardMaterial {...gold} />
      </mesh>
      {/* Asas clásicas */}
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <mesh position={[side * 0.105, 0.13, 0]} scale={[0.78, 1, 1]} castShadow>
            <torusGeometry args={[0.05, 0.009, 12, 48]} />
            <meshStandardMaterial {...gold} />
          </mesh>
          <mesh position={[side * 0.103, 0.175, 0]} castShadow>
            <sphereGeometry args={[0.012, 16, 12]} />
            <meshStandardMaterial {...gold} />
          </mesh>
        </group>
      ))}
      {/* Medallón frontal */}
      <mesh position={[0, 0.135, 0.108]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.008, 32]} />
        <meshStandardMaterial color="#fff0a3" metalness={0.7} roughness={0.24} emissive="#d68a15" emissiveIntensity={0.12} />
      </mesh>
    </group>
  );
}

/* ============================================================
   MEJORA 3 — Confetti multi-forma
   ============================================================ */
const CONFETTI_COLORS = [
  "#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6",
  "#ec4899", "#f97316", "#06b6d4", "#eab308", "#84cc16",
  "#fbbf24", "#f472b6", "#a78bfa", "#e2e8f0", "#fcd34d",
] as const;
type ConfettiGroupIndex = 0 | 1 | 2 | 3;
interface ConfettiParticle {
  group: ConfettiGroupIndex;
  slot: number;
  ox: number; oy: number; oz: number;
  vx: number; vy: number; vz: number;
  spinX: number; spinY: number; spinZ: number;
  size: number;
  drag: number;
  swirl: number;
  phase: number;
  life: number;
  delay: number;
  colorIndex: number;
}
const CONFETTI_GRAVITY = 3.1;

function VictoryConfetti({ active, count = 250 }: { active: boolean; count?: number }) {
  const boxRef = useRef<THREE.InstancedMesh>(null);
  const sphereRef = useRef<THREE.InstancedMesh>(null);
  const starRef = useRef<THREE.InstancedMesh>(null);
  const streamerRef = useRef<THREE.InstancedMesh>(null);
  const { particles, counts } = useMemo(() => {
    const rnd = mulberry32(0xc0ffee + count);
    const slots: [number, number, number, number] = [0, 0, 0, 0];
    const list: ConfettiParticle[] = [];
    for (let i = 0; i < count; i++) {
      const r = rnd();
      const group: ConfettiGroupIndex = r < 0.5 ? 0 : r < 0.72 ? 1 : r < 0.88 ? 2 : 3;
      const size = 0.55 + rnd() * 1.15;
      const angle = rnd() * Math.PI * 2;
      const speed = 0.85 + rnd() * 1.5;
      list.push({
        group, slot: slots[group]++,
        ox: Math.cos(angle) * 0.16 * rnd(),
        oy: -0.15 + rnd() * 0.2,
        oz: 0.1 + rnd() * 0.3,
        vx: Math.cos(angle) * speed * (0.55 + rnd() * 0.7),
        vy: 1.9 + rnd() * 1.9,
        vz: Math.sin(angle) * speed * 0.45 + rnd() * 0.25,
        spinX: (rnd() - 0.5) * 9,
        spinY: (rnd() - 0.5) * 9,
        spinZ: (rnd() - 0.5) * 11,
        size,
        drag: 1.15 - (size - 0.55) * 0.5,
        swirl: 2 + rnd() * 5,
        phase: rnd() * Math.PI * 2,
        life: 2.1 + rnd() * 1.6,
        delay: rnd() * 0.5,
        colorIndex: Math.floor(rnd() * CONFETTI_COLORS.length),
      });
    }
    return { particles: list, counts: slots };
  }, [count]);

  useEffect(() => {
    const allRefs = [boxRef.current, sphereRef.current, starRef.current, streamerRef.current];
    for (const p of particles) {
      const mesh = allRefs[p.group];
      if (!mesh) continue;
      SCRATCH_COLOR.set(CONFETTI_COLORS[p.colorIndex]);
      mesh.setColorAt(p.slot, SCRATCH_COLOR);
    }
    for (const mesh of allRefs) {
      if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }, [particles]);

  const startRef = useRef(-1);
  const wasActive = useRef(false);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (active && !wasActive.current) startRef.current = t;
    wasActive.current = active;
    const visible = active || (startRef.current >= 0 && t - startRef.current < 4.2);
    if (boxRef.current) boxRef.current.visible = visible;
    if (sphereRef.current) sphereRef.current.visible = visible;
    if (starRef.current) starRef.current.visible = visible;
    if (streamerRef.current) streamerRef.current.visible = visible;
    if (!visible) return;
    const base = t - startRef.current;
    const allRefs = [boxRef.current, sphereRef.current, starRef.current, streamerRef.current];
    for (const p of particles) {
      const mesh = allRefs[p.group];
      if (!mesh) continue;
      const age = base - p.delay;
      if (age < 0) {
        SCRATCH_OBJ.scale.setScalar(0);
        SCRATCH_OBJ.position.set(0, 0, 0);
        SCRATCH_OBJ.rotation.set(0, 0, 0);
      } else {
        const loop = active ? age % p.life : age;
        const fall = 0.5 * CONFETTI_GRAVITY * p.drag * loop * loop;
        SCRATCH_OBJ.position.set(
          p.ox + p.vx * loop + Math.sin(loop * p.swirl + p.phase) * 0.14 * loop,
          p.oy + p.vy * loop - fall,
          p.oz + p.vz * loop + Math.cos(loop * p.swirl * 0.7 + p.phase) * 0.1 * loop,
        );
        SCRATCH_OBJ.rotation.set(loop * p.spinX, loop * p.spinY, loop * p.spinZ);
        const fadeIn = smoothstep(loop / 0.12);
        const fadeOut = 1 - smoothstep((loop - p.life * 0.68) / (p.life * 0.32));
        SCRATCH_OBJ.scale.setScalar(p.size * fadeIn * fadeOut);
      }
      SCRATCH_OBJ.updateMatrix();
      mesh.setMatrixAt(p.slot, SCRATCH_OBJ.matrix);
    }
    for (const mesh of allRefs) {
      if (mesh) mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group position={[0, -0.2, 0]}>
      <instancedMesh ref={boxRef} args={[undefined, undefined, counts[0]]} frustumCulled={false}>
        <boxGeometry args={[0.075, 0.045, 0.012]} />
        <meshStandardMaterial roughness={0.35} metalness={0.15} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={sphereRef} args={[undefined, undefined, counts[1]]} frustumCulled={false}>
        <sphereGeometry args={[0.032, 10, 8]} />
        <meshStandardMaterial roughness={0.25} metalness={0.35} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={starRef} args={[undefined, undefined, counts[2]]} frustumCulled={false}>
        <octahedronGeometry args={[0.05, 0]} />
        <meshStandardMaterial roughness={0.18} metalness={0.55} emissiveIntensity={0.3} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={streamerRef} args={[undefined, undefined, counts[3]]} frustumCulled={false}>
        <cylinderGeometry args={[0.008, 0.008, 0.16, 6]} />
        <meshStandardMaterial roughness={0.4} metalness={0.1} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/* ============================================================
   PulseRings — componente reutilizable
   ============================================================ */
interface PulseRingsProps {
  active: boolean;
  count?: number;
  color?: string;
  from?: number;
  to?: number;
  speed?: number;
  thickness?: number;
  maxOpacity?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}
function PulseRings({
  active, count = 3, color = "#38bdf8", from = 0.08, to = 1.15,
  speed = 0.75, thickness = 0.07, maxOpacity = 0.5,
  position = [0, -0.45, 0], rotation = [Math.PI / 2, 0, 0],
}: PulseRingsProps) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    g.visible = active;
    if (!active) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < g.children.length; i++) {
      const ring = g.children[i] as THREE.Mesh;
      const phase = (t * speed + i / count) % 1;
      const s = from + phase * (to - from);
      ring.scale.set(s, s, s);
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - smoothstep(phase)) * maxOpacity;
    }
  });
  return (
    <group ref={groupRef} position={position} rotation={rotation} visible={false}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i}>
          <ringGeometry args={[1 - thickness, 1, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ============================================================
   MEJORA 4 — ClapShockwave
   ============================================================ */
function ClapShockwave({ active }: { active: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    g.visible = active;
    if (!active) return;
    const phase = (state.clock.elapsedTime * CLAP_FREQ) % 1;
    for (let i = 0; i < g.children.length; i++) {
      const ring = g.children[i] as THREE.Mesh;
      const p = clamp01(phase - i * 0.12);
      const s = 0.05 + p * (0.42 + i * 0.1);
      ring.scale.set(s, s, s);
      ring.visible = p > 0.001 && p < 0.85;
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - p) * (0.6 - i * 0.18);
    }
  });
  return (
    <group ref={groupRef} position={[0, -0.1, 0.42]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <mesh>
        <ringGeometry args={[0.8, 1.0, 32]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.86, 1.0, 32]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh rotation={[0, 0, 0.4]}>
        <ringGeometry args={[0.9, 1.0, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ============================================================
   MEJORA 13 — ThumbUp + MagicWand
   ============================================================ */
function ThumbUp({ active }: { active: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const pRef = useRef(0);
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    pRef.current = clamp01(pRef.current + (active ? delta / 0.25 : -delta / 0.15));
    g.visible = pRef.current > 0.01;
    g.scale.setScalar(easeOutBack(pRef.current));
  });
  return (
    <group ref={ref} position={[0, 0.07, 0.02]} scale={0} visible={false}>
      <mesh position={[0, 0.055, 0]} castShadow>
        <capsuleGeometry args={[0.024, 0.06, 6, 12]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.2} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.098, 0]}>
        <sphereGeometry args={[0.026, 14, 14]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.45} toneMapped={false} />
      </mesh>
    </group>
  );
}

const WAND_STARS = 14;
function MagicWand({ active }: { active: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const starsRef = useRef<THREE.InstancedMesh>(null);
  const pRef = useRef(0);
  const seeds = useMemo(() => {
    const rnd = mulberry32(0x5ee5);
    return Array.from({ length: WAND_STARS }, () => ({
      ax: (rnd() - 0.5) * 1.6,
      ay: 0.5 + rnd() * 1.4,
      az: (rnd() - 0.5) * 1.2,
      life: 0.7 + rnd() * 0.9,
      delay: rnd() * 0.9,
      size: 0.5 + rnd() * 0.9,
      spin: (rnd() - 0.5) * 10,
    }));
  }, []);
  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    pRef.current = clamp01(pRef.current + (active ? delta / 0.3 : -delta / 0.2));
    g.visible = pRef.current > 0.01;
    if (!g.visible) return;
    g.scale.setScalar(easeOutBack(pRef.current));
    const mesh = starsRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < WAND_STARS; i++) {
      const s = seeds[i];
      const age = (t - s.delay) % s.life;
      const u = age / s.life;
      SCRATCH_OBJ.position.set(s.ax * u * 0.28, 0.22 + s.ay * u * 0.34, s.az * u * 0.28);
      SCRATCH_OBJ.rotation.set(0, 0, age * s.spin);
      const fade = smoothstep(u / 0.15) * (1 - smoothstep((u - 0.55) / 0.45));
      SCRATCH_OBJ.scale.setScalar(s.size * fade * pRef.current);
      SCRATCH_OBJ.updateMatrix();
      mesh.setMatrixAt(i, SCRATCH_OBJ.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <group ref={groupRef} position={[0, 0.05, 0.03]} scale={0} visible={false}>
      <mesh position={[0, 0.13, 0]} castShadow>
        <cylinderGeometry args={[0.011, 0.014, 0.26, 10]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.29, 0]}>
        <octahedronGeometry args={[0.055, 0]} />
        <meshStandardMaterial color="#fde047" emissive="#facc15" emissiveIntensity={1.1} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 0.29, 0]} intensity={0.7} distance={1.4} color="#fde047" />
      <instancedMesh ref={starsRef} args={[undefined, undefined, WAND_STARS]} frustumCulled={false}>
        <octahedronGeometry args={[0.028, 0]} />
        <meshStandardMaterial color="#fef9c3" emissive="#fde047" emissiveIntensity={0.9} toneMapped={false} transparent />
      </instancedMesh>
    </group>
  );
}

/* ============================================================
   MEJORA 5 — GivenHeart + FloatingHearts
   ============================================================ */
const HEART_TRAIL = 7;
const HEART_BURST = 12;
const HEART_CYCLE = 1.7;
const LOVE_COLORS = ["#f472b6", "#ef4444", "#fb923c", "#fb7185", "#f9a8d4"] as const;

function GivenHeart({ active }: { active: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const mainRef = useRef<THREE.Mesh>(null);
  const mainMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const trailRef = useRef<THREE.InstancedMesh>(null);
  const burstRef = useRef<THREE.InstancedMesh>(null);
  const startRef = useRef(-1);
  const wasActive = useRef(false);
  const burstSeeds = useMemo(() => {
    const rnd = mulberry32(0xbeef);
    return Array.from({ length: HEART_BURST }, (_, i) => {
      const a = (i / HEART_BURST) * Math.PI * 2 + rnd() * 0.3;
      return {
        dx: Math.cos(a), dy: Math.sin(a) * 0.75 + 0.25, dz: (rnd() - 0.5) * 0.7,
        size: 0.055 + rnd() * 0.05, spin: (rnd() - 0.5) * 8,
      };
    });
  }, []);
  const pathAt = useCallback((u: number, out: THREE.Vector3) => {
    out.set(Math.sin(u * Math.PI * 2) * 0.13, -0.14 + u * 0.9, 0.4 + u * 0.6);
  }, []);
  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    if (active && !wasActive.current) startRef.current = t;
    wasActive.current = active;
    g.visible = active;
    if (!active || startRef.current < 0) return;
    const u = ((t - startRef.current) % HEART_CYCLE) / HEART_CYCLE;
    if (mainRef.current) {
      pathAt(u, mainRef.current.position);
      const pulse = 1 + Math.sin(t * 9) * 0.09;
      const grow = easeOutBack(clamp01(u / 0.18));
      const fade = 1 - smoothstep((u - 0.78) / 0.22);
      mainRef.current.scale.setScalar(0.2 * grow * fade * pulse);
      mainRef.current.rotation.z = Math.sin(t * 2.4) * 0.18;
      mainRef.current.rotation.y = u * Math.PI * 0.6;
      if (mainMatRef.current) mainMatRef.current.emissiveIntensity = 0.55 + Math.sin(t * 9) * 0.35;
    }
    const trail = trailRef.current;
    if (trail) {
      for (let i = 0; i < HEART_TRAIL; i++) {
        const tu = u - (i + 1) * 0.045;
        if (tu <= 0) {
          SCRATCH_OBJ.scale.setScalar(0);
          SCRATCH_OBJ.position.set(0, 0, 0);
        } else {
          pathAt(tu, SCRATCH_OBJ.position);
          const decay = 1 - i / HEART_TRAIL;
          const fade = 1 - smoothstep((tu - 0.78) / 0.22);
          SCRATCH_OBJ.scale.setScalar(0.13 * decay * decay * fade);
        }
        SCRATCH_OBJ.rotation.set(0, 0, Math.sin(t * 3 + i) * 0.4);
        SCRATCH_OBJ.updateMatrix();
        trail.setMatrixAt(i, SCRATCH_OBJ.matrix);
      }
      trail.instanceMatrix.needsUpdate = true;
    }
    const burst = burstRef.current;
    if (burst) {
      const bp = clamp01((u - 0.74) / 0.26);
      pathAt(0.78, SCRATCH_OBJ.position);
      const bx = SCRATCH_OBJ.position.x;
      const by = SCRATCH_OBJ.position.y;
      const bz = SCRATCH_OBJ.position.z;
      const ease = 1 - Math.pow(1 - bp, 3);
      for (let i = 0; i < HEART_BURST; i++) {
        const s = burstSeeds[i];
        SCRATCH_OBJ.position.set(bx + s.dx * ease * 0.52, by + s.dy * ease * 0.46 - bp * bp * 0.14, bz + s.dz * ease * 0.4);
        SCRATCH_OBJ.rotation.set(0, 0, bp * s.spin);
        SCRATCH_OBJ.scale.setScalar(bp > 0 ? s.size * (1 - smoothstep(bp)) * 2.2 : 0);
        SCRATCH_OBJ.updateMatrix();
        burst.setMatrixAt(i, SCRATCH_OBJ.matrix);
      }
      burst.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <group ref={groupRef} visible={false}>
      <mesh ref={mainRef} geometry={HEART_GEOMETRY} castShadow>
        <meshStandardMaterial ref={mainMatRef} color="#f43f5e" emissive="#fb7185" emissiveIntensity={0.6} metalness={0.1} roughness={0.12} toneMapped={false} />
      </mesh>
      <instancedMesh ref={trailRef} args={[HEART_GEOMETRY, undefined, HEART_TRAIL]} frustumCulled={false}>
        <meshStandardMaterial color="#fb7185" emissive="#f472b6" emissiveIntensity={0.7} transparent opacity={0.85} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={burstRef} args={[HEART_GEOMETRY, undefined, HEART_BURST]} frustumCulled={false}>
        <meshStandardMaterial color="#f9a8d4" emissive="#ec4899" emissiveIntensity={0.8} transparent opacity={0.95} toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

const FLOAT_HEARTS = 16;
function FloatingHearts({ active }: { active: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const seeds = useMemo(() => {
    const rnd = mulberry32(0xfeed);
    return Array.from({ length: FLOAT_HEARTS }, () => ({
      baseX: (rnd() - 0.5) * 0.9,
      baseY: -0.55 + rnd() * 0.25,
      baseZ: (rnd() - 0.5) * 0.55,
      size: 0.04 + rnd() * 0.08,
      speed: 0.32 + rnd() * 0.42,
      phase: rnd() * Math.PI * 2,
      dir: rnd() > 0.5 ? 1 : -1,
      colorIndex: Math.floor(rnd() * LOVE_COLORS.length),
    }));
  }, []);
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    seeds.forEach((s, i) => {
      SCRATCH_COLOR.set(LOVE_COLORS[s.colorIndex]);
      mesh.setColorAt(i, SCRATCH_COLOR);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [seeds]);
  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.visible = active;
    if (!active) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < FLOAT_HEARTS; i++) {
      const s = seeds[i];
      const rise = (t * s.speed + s.phase) % 1;
      SCRATCH_OBJ.position.set(
        s.baseX + Math.sin(rise * Math.PI * 2 + s.phase) * 0.15,
        s.baseY + rise * 1.2,
        s.baseZ + Math.cos(rise * Math.PI + s.phase) * 0.1,
      );
      SCRATCH_OBJ.rotation.set(0, rise * Math.PI, rise * Math.PI * 2 * s.dir);
      const fade = smoothstep(rise / 0.18) * (1 - smoothstep((rise - 0.62) / 0.38));
      SCRATCH_OBJ.scale.setScalar(s.size * fade * 2.4);
      SCRATCH_OBJ.updateMatrix();
      mesh.setMatrixAt(i, SCRATCH_OBJ.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[HEART_GEOMETRY, undefined, FLOAT_HEARTS]} frustumCulled={false} visible={false}>
      <meshStandardMaterial emissive="#ffffff" emissiveIntensity={0.35} roughness={0.2} metalness={0.05} transparent toneMapped={false} />
    </instancedMesh>
  );
}

/* ============================================================
   MEJORA 8 — ErrorSparks
   ============================================================ */
const SPARK_COUNT = 8;
function ErrorSparks({ active }: { active: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const seeds = useMemo(() => {
    const rnd = mulberry32(0x5aa4);
    return Array.from({ length: SPARK_COUNT }, (_, i) => {
      const a = (i / SPARK_COUNT) * Math.PI * 2 + rnd() * 0.5;
      return {
        vx: Math.cos(a) * (0.7 + rnd() * 0.9),
        vy: 1.1 + rnd() * 1.0,
        vz: Math.sin(a) * (0.4 + rnd() * 0.5),
        life: 0.45 + rnd() * 0.4,
        delay: rnd() * 0.6,
        size: 0.5 + rnd() * 0.8,
      };
    });
  }, []);
  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.visible = active;
    if (lightRef.current) lightRef.current.intensity = active ? 0.5 + Math.abs(Math.sin(state.clock.elapsedTime * 17)) * 1.2 : 0;
    if (!active) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < SPARK_COUNT; i++) {
      const s = seeds[i];
      const age = (t - s.delay) % (s.life + 0.35);
      if (age > s.life) {
        SCRATCH_OBJ.scale.setScalar(0);
        SCRATCH_OBJ.position.set(0, 0, 0);
      } else {
        SCRATCH_OBJ.position.set(s.vx * age * 0.55, 0.42 + s.vy * age * 0.5 - 4.2 * age * age * 0.5, s.vz * age * 0.5 + 0.2);
        const fade = 1 - smoothstep(age / s.life);
        SCRATCH_OBJ.scale.set(s.size * fade, s.size * fade * (1 + age * 3), s.size * fade);
      }
      SCRATCH_OBJ.updateMatrix();
      mesh.setMatrixAt(i, SCRATCH_OBJ.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, SPARK_COUNT]} frustumCulled={false} visible={false}>
        <sphereGeometry args={[0.022, 8, 6]} />
        <meshStandardMaterial color="#fef08a" emissive="#fbbf24" emissiveIntensity={2.2} toneMapped={false} transparent />
      </instancedMesh>
      <pointLight ref={lightRef} position={[0, 0.4, 0.4]} intensity={0} distance={2} color="#fca5a5" />
    </group>
  );
}

/* ============================================================
   MEJORA 9 — SleepyZzz
   ============================================================ */
const ZZZ_SEEDS = [
  { size: 0.9, speed: 0.34, delay: 0.0, drift: 0.28 },
  { size: 1.25, speed: 0.3, delay: 0.55, drift: 0.36 },
  { size: 0.7, speed: 0.4, delay: 1.05, drift: 0.2 },
  { size: 1.05, speed: 0.28, delay: 1.6, drift: 0.44 },
  { size: 0.8, speed: 0.36, delay: 2.15, drift: 0.16 },
] as const;

function SleepyZzz({ active }: { active: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    g.visible = active;
    if (!active) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < g.children.length; i++) {
      const z = g.children[i] as THREE.Group;
      const s = ZZZ_SEEDS[i];
      const u = ((t * s.speed + s.delay) % 1);
      z.position.set(0.34 + u * s.drift + Math.sin(u * Math.PI * 3) * 0.06, 0.42 + u * 0.95, 0.1);
      z.rotation.z = 0.28 + Math.sin(u * Math.PI * 2) * 0.22;
      const fade = smoothstep(u / 0.16) * (1 - smoothstep((u - 0.55) / 0.45));
      z.scale.setScalar(s.size * fade * 0.14);
    }
  });
  return (
    <group ref={groupRef} visible={false}>
      {ZZZ_SEEDS.map((_, i) => (
        <group key={i}>
          {/* Barra superior */}
          <mesh position={[0, 0.32, 0]}>
            <boxGeometry args={[0.55, 0.1, 0.06]} />
            <meshStandardMaterial color="#bae6fd" emissive="#7dd3fc" emissiveIntensity={0.7} toneMapped={false} />
          </mesh>
          {/* Diagonal: de arriba-izquierda a abajo-derecha (Z correcta) */}
          <mesh rotation={[0, 0, 0.72]}>
            <boxGeometry args={[0.82, 0.1, 0.06]} />
            <meshStandardMaterial color="#bae6fd" emissive="#7dd3fc" emissiveIntensity={0.7} toneMapped={false} />
          </mesh>
          {/* Barra inferior */}
          <mesh position={[0, -0.32, 0]}>
            <boxGeometry args={[0.55, 0.1, 0.06]} />
            <meshStandardMaterial color="#bae6fd" emissive="#7dd3fc" emissiveIntensity={0.7} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ============================================================
   MEJORA 10 — ChargeBolt + BatteryGauge
   ============================================================ */
const BOLT_SEGMENTS = 9;
function ChargeBolt({ active }: { active: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const strikeRef = useRef(0);
  const zig = useMemo(() => {
    const rnd = mulberry32(0xb017);
    return Array.from({ length: BOLT_SEGMENTS }, () => (rnd() - 0.5) * 0.34);
  }, []);
  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.visible = active;
    if (lightRef.current) lightRef.current.intensity = 0;
    if (!active) return;
    const t = state.clock.elapsedTime;
    const cycle = t % 1.1;
    const strike = cycle < 0.22 ? 1 - cycle / 0.22 : 0;
    strikeRef.current = D(strikeRef.current, strike, 24, Math.min(delta, 1 / 30));
    const flash = strikeRef.current;
    const yTop = 2.0;
    const yBot = 0.5;
    const step = (yTop - yBot) / (BOLT_SEGMENTS - 1);
    const jitterSeed = Math.floor(t * 24);
    for (let i = 0; i < BOLT_SEGMENTS; i++) {
      const y0 = yTop - i * step;
      const y1 = y0 - step;
      const x0 = zig[i] * (1 + Math.sin(jitterSeed + i) * 0.35);
      const x1 = zig[(i + 1) % BOLT_SEGMENTS] * (1 + Math.cos(jitterSeed + i) * 0.35);
      const midX = (x0 + x1) * 0.5;
      const midY = (y0 + y1) * 0.5;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      SCRATCH_OBJ.position.set(midX, midY, 0.05);
      SCRATCH_OBJ.rotation.set(0, 0, Math.atan2(dy, dx) - Math.PI / 2);
      SCRATCH_OBJ.scale.set(flash * (1.1 - i * 0.05), len, flash);
      SCRATCH_OBJ.updateMatrix();
      mesh.setMatrixAt(i, SCRATCH_OBJ.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (matRef.current) matRef.current.emissiveIntensity = 1.4 + flash * 2.6;
    if (lightRef.current) lightRef.current.intensity = flash * 2.2;
  });
  return (
    <group>
      <instancedMesh ref={meshRef} args={[undefined, undefined, BOLT_SEGMENTS]} frustumCulled={false} visible={false}>
        <cylinderGeometry args={[0.018, 0.018, 1, 5]} />
        <meshStandardMaterial ref={matRef} color="#fef9c3" emissive="#fde047" emissiveIntensity={2} toneMapped={false} transparent opacity={0.95} />
      </instancedMesh>
      <pointLight ref={lightRef} position={[0, 0.9, 0.3]} intensity={0} distance={3} color="#fde047" />
    </group>
  );
}

const BATTERY_BARS = 5;
function BatteryGauge({ active }: { active: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const pRef = useRef(0);
  useFrame((state, delta) => {
    const g = groupRef.current;
    if (!g) return;
    pRef.current = clamp01(pRef.current + (active ? delta / 0.3 : -delta / 0.2));
    g.visible = pRef.current > 0.01;
    if (!g.visible) return;
    g.scale.setScalar(easeOutBack(pRef.current));
    const t = state.clock.elapsedTime;
    const level = (t * 0.55) % 1.25;
    for (let i = 0; i < BATTERY_BARS; i++) {
      const bar = g.children[i + 2] as THREE.Mesh;
      const on = level > i / BATTERY_BARS;
      const mat = bar.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = on ? 1.3 : 0.05;
      SCRATCH_COLOR.set(i < 2 ? "#f97316" : "#22c55e");
      SCRATCH_COLOR_B.set("#334155");
      mat.color.copy(on ? SCRATCH_COLOR : SCRATCH_COLOR_B);
      bar.scale.x = on ? 1 : 0.86;
    }
  });
  return (
    <group ref={groupRef} position={[0, -0.5, 0.53]} scale={0} visible={false}>
      <mesh>
        <boxGeometry args={[0.34, 0.18, 0.04]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.19, 0, 0]}>
        <boxGeometry args={[0.04, 0.07, 0.04]} />
        <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.4} />
      </mesh>
      {Array.from({ length: BATTERY_BARS }, (_, i) => (
        <mesh key={i} position={[-0.128 + i * 0.064, 0, 0.028]}>
          <boxGeometry args={[0.046, 0.11, 0.02]} />
          <meshStandardMaterial color="#334155" emissive="#22c55e" emissiveIntensity={0.05} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ============================================================
   MEJORA 11 — OrbitStars
   ============================================================ */
const ORBIT_STARS = 5;
function OrbitStars({ active }: { active: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const pRef = useRef(0);
  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    pRef.current = clamp01(pRef.current + (active ? delta / 0.28 : -delta / 0.2));
    mesh.visible = pRef.current > 0.01;
    if (!mesh.visible) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < ORBIT_STARS; i++) {
      const a = (i / ORBIT_STARS) * Math.PI * 2 + t * 2.6;
      SCRATCH_OBJ.position.set(Math.cos(a) * 0.46, 0.5 + Math.sin(a * 2) * 0.07, Math.sin(a) * 0.34);
      SCRATCH_OBJ.rotation.set(t * 2, t * 3, t * 1.5);
      const depth = 0.75 + Math.sin(a) * 0.25;
      SCRATCH_OBJ.scale.setScalar(easeOutBack(pRef.current) * depth);
      SCRATCH_OBJ.updateMatrix();
      mesh.setMatrixAt(i, SCRATCH_OBJ.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, ORBIT_STARS]} frustumCulled={false} visible={false}>
      <octahedronGeometry args={[0.055, 0]} />
      <meshStandardMaterial color="#fef9c3" emissive="#fbbf24" emissiveIntensity={1.4} toneMapped={false} />
    </instancedMesh>
  );
}

/* ============================================================
   MEJORA 14 — RobotEye (iris + pupila + reflejo especular)
   ============================================================ */
interface EyeProps {
  side: 1 | -1;
  mood: HubiState3D;
  openRef: React.MutableRefObject<number>;
}
const EYE_BASE_Y = 0.06;
const EYE_BASE_X = 0.19;

function RobotEye({ side, mood, openRef }: EyeProps) {
  const lidRef = useRef<THREE.Group>(null);
  const pupilRef = useRef<THREE.Group>(null);
  const irisMatRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const t = state.clock.elapsedTime;
    const lid = lidRef.current;
    if (!lid) return;
    let open = openRef.current;
    if (mood === "sleepy" || mood === "charging") open = 0.16 + Math.sin(t * 0.9) * 0.05;
    if (mood === "surprised") open = 1.35;
    if (mood === "grateful" || mood === "thumbsUp") open = 0.72;
    if (mood === "wink" && side > 0) open = 0.1;
    if (mood === "love") open = 1 + Math.sin(t * 7) * 0.05;
    lid.scale.y = D(lid.scale.y, open, 20, dt);
    const wide = mood === "surprised" ? 1.22 : 1;
    lid.scale.x = D(lid.scale.x, wide, 14, dt);
    const pupil = pupilRef.current;
    if (pupil) {
      let lx = 0;
      let ly = 0;
      if (mood === "talking") ly = -0.016;
      else if (mood === "thinking") { lx = -0.02; ly = 0.018; }
      else if (mood === "idle") { lx = Math.sin(t * 0.3) * 0.012; ly = Math.sin(t * 0.47) * 0.006; }
      else if (mood === "magic") lx = 0.016;
      pupil.position.x = D(pupil.position.x, lx, 7, dt);
      pupil.position.y = D(pupil.position.y, ly, 7, dt);
    }
    if (irisMatRef.current) {
      const glow =
        mood === "magic" ? 1.5 :
        mood === "love" ? 1.1 + Math.sin(t * 7) * 0.3 :
        mood === "charging" ? 0.9 + Math.max(0, Math.sin(t * 3.4)) * 0.6 :
        mood === "error" ? 0.4 : 1.2;
      irisMatRef.current.emissiveIntensity = D(irisMatRef.current.emissiveIntensity, glow, 8, dt);
      // Color del iris según mood (igual que el borde de la panza)
      let irisColor = "#7dd3fc";
      let irisEmissive = "#38bdf8";
      if (mood === "error") { irisColor = "#f43f5e"; irisEmissive = "#f43f5e"; }
      else if (mood === "love") { irisColor = "#fb7185"; irisEmissive = "#f43f5e"; }
      else if (mood === "charging") { irisColor = "#fbbf24"; irisEmissive = "#fde047"; }
      else if (mood === "magic") { irisColor = "#a78bfa"; irisEmissive = "#a78bfa"; }
      else if (mood === "birthday") { irisColor = "#f472b6"; irisEmissive = "#f472b6"; }
      else if (mood === "surprised") { irisColor = "#fbbf24"; irisEmissive = "#fbbf24"; }
      else if (mood === "sleepy") { irisColor = "#7dd3fc"; irisEmissive = "#38bdf8"; }
      SCRATCH_COLOR.set(irisColor);
      irisMatRef.current.color.lerp(SCRATCH_COLOR, 1 - Math.exp(-8 * dt));
      SCRATCH_COLOR.set(irisEmissive);
      irisMatRef.current.emissive.lerp(SCRATCH_COLOR, 1 - Math.exp(-8 * dt));
    }
  });
  const isX = mood === "error";
  const isHeart = mood === "love";
  const showIris = !isX && !isHeart;
  return (
    <group position={[side * EYE_BASE_X, EYE_BASE_Y, 0.55]}>
      <group ref={lidRef}>
        {/* Iris siempre montado — se oculta pero no se desmonta */}
        <group visible={showIris}>
          <mesh>
            <sphereGeometry args={[0.09, 24, 24]} />
            <meshStandardMaterial ref={irisMatRef} color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={1.2} roughness={0.15} metalness={0.1} toneMapped={false} />
          </mesh>
          <group ref={pupilRef} position={[0, 0, 0.05]}>
            <mesh>
              <sphereGeometry args={[0.04, 16, 16]} />
              <meshStandardMaterial color="#082f49" roughness={0.3} />
            </mesh>
            <mesh position={[-0.026, 0.028, 0.028]}>
              <sphereGeometry args={[0.02, 12, 12]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
            <mesh position={[0.024, -0.02, 0.026]}>
              <sphereGeometry args={[0.01, 10, 10]} />
              <meshBasicMaterial color="#e0f2fe" toneMapped={false} />
            </mesh>
          </group>
        </group>
        {/* Ojos X — error */}
        {isX && (
          <group scale={1.3}>
            {[0.785, -0.785].map((r) => (
              <mesh key={r} rotation={[0, 0, r]}>
                <boxGeometry args={[0.13, 0.026, 0.02]} />
                <meshStandardMaterial color="#fecdd3" emissive="#f43f5e" emissiveIntensity={1.2} toneMapped={false} />
              </mesh>
            ))}
          </group>
        )}
        {/* Ojos corazón — love */}
        {isHeart && (
          <mesh geometry={HEART_GEOMETRY} scale={0.1}>
            <meshStandardMaterial color="#fb7185" emissive="#f43f5e" emissiveIntensity={1.3} toneMapped={false} />
          </mesh>
        )}
      </group>
    </group>
  );
}

/* ============================================================
   Sistema de poses de brazo — armTargetsFor
   ============================================================ */
interface ArmTargets {
  sx: number; sy: number; sz: number;
  ex: number; hx: number; hz: number;
  stiff: number;
}

function armTargetsFor(
  mood: HubiState3D, side: 1 | -1, t: number,
  beatIndex: number, beatPhase: number,
): ArmTargets | null {
  const s = side * ARM_SIGN;
  const isActingArm = side > 0;
  switch (mood) {
    case "thinking": {
      if (!isActingArm) return { sx: 0.1, sy: 0, sz: -s * 0.06, ex: -0.18, hx: 0, hz: 0, stiff: 5 };
      const tap = Math.sin(t * 3.4) * 0.06;
      return { sx: -1.2 + tap, sy: 0, sz: s * 0.3, ex: -0.6 - tap * 0.5, hx: -0.35, hz: -s * 0.25, stiff: 6 };
    }
    case "clap": {
      const swing = (Math.sin(t * CLAP_FREQ * Math.PI * 2) + 1) * 0.5;
      return { sx: -1.30, sy: 0, sz: -s * (0.75 + swing * 0.65), ex: -0.42 - swing * 0.22, hx: -0.2, hz: -s * 0.7, stiff: 22 };
    }
    case "surprised": {
      const jitter = Math.sin(t * 16) * 0.03;
      return { sx: -0.32 + jitter, sy: 0, sz: s * 0.8, ex: -0.2, hx: -0.3, hz: s * 0.35, stiff: 12 };
    }
    case "dance": {
      const a = DANCE_POSES[beatIndex % DANCE_POSES.length];
      const b = DANCE_POSES[(beatIndex + 1) % DANCE_POSES.length];
      const k = smoothstep(beatPhase);
      const mirror = beatIndex % 2 === 0 ? 1 : 0.72;
      return {
        sx: THREE.MathUtils.lerp(a.sx, b.sx, k) * 1.2 * mirror,
        sy: 0, sz: s * THREE.MathUtils.lerp(a.sz, b.sz, k) * 1.2,
        ex: THREE.MathUtils.lerp(a.ex, b.ex, k),
        hx: Math.sin(t * 12) * 0.25, hz: s * 0.2, stiff: 14,
      };
    }
    case "birthday": {
      const up = Math.sin(t * 7 + (side > 0 ? 0 : Math.PI)) * 0.22;
      return { sx: -2.15 + up, sy: 0, sz: s * 0.42, ex: -0.28, hx: -0.4, hz: 0, stiff: 10 };
    }
    case "magic": {
      if (!isActingArm) return { sx: -0.18, sy: 0, sz: -s * 0.1, ex: -0.3, hx: 0, hz: 0, stiff: 5 };
      const flourish = Math.sin(t * 2.6);
      return { sx: -1.42 + flourish * 0.2, sy: flourish * 0.18, sz: -s * 0.12, ex: -0.34, hx: -0.2 + Math.cos(t * 3.2) * 0.25, hz: -s * 0.15, stiff: 7 };
    }
    case "bow":
      return { sx: 0.16, sy: 0, sz: -s * 0.12, ex: -0.22, hx: 0.1, hz: 0, stiff: 6 };
    case "thumbsUp": {
      if (!isActingArm) return { sx: 0.12, sy: 0, sz: -s * 0.05, ex: -0.16, hx: 0, hz: 0, stiff: 5 };
      const pump = Math.sin(t * 5) * 0.07;
      return { sx: -1.0 + pump, sy: 0, sz: -s * 0.35, ex: -1.2, hx: -0.1, hz: -s * 0.15, stiff: 9 };
    }
    case "wink":
      return { sx: 0.1, sy: 0, sz: -s * 0.08, ex: -0.15, hx: 0, hz: 0, stiff: 5 };
    default:
      return null;
  }
}

/* ============================================================
   Saludo idle articulado (hombro + codo + muñeca + cabeza)
   ============================================================ */
function getIdleGreeting(t: number, enabled: boolean) {
  if (!enabled) return { lift: 0, wave: 0 };
  const CYCLE = 5;
  const START = 2;
  const RISE = 0.5;
  const HOLD = 2;
  const FALL = 0.5;
  const ease = (v: number) => {
    const x = THREE.MathUtils.clamp(v, 0, 1);
    return x * x * (3 - 2 * x);
  };
  const tw = (t % CYCLE) - START;
  if (tw <= 0 || tw >= RISE + HOLD + FALL) {
    return { lift: 0, wave: 0 };
  }
  const lift = ease(tw / RISE) * (1 - ease((tw - RISE - HOLD) / FALL));
  const holdTime = tw - RISE;
  const waveEnvelope = ease(holdTime / 0.25) * (1 - ease((holdTime - (HOLD - 0.25)) / 0.25));
  const wave = Math.sin(holdTime * Math.PI * 2 * 1.8) * waveEnvelope;
  return { lift, wave };
}

/* ============================================================
   RobotArm
   ============================================================ */
function RobotArm({ side, mood }: { side: 1 | -1; mood: HubiState3D }) {
  const shoulderRef = useRef<THREE.Group>(null);
  const elbowRef = useRef<THREE.Group>(null);
  const handRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const t = state.clock.elapsedTime;
    const greeting = getIdleGreeting(t, mood === "idle" && side > 0);
    const beatIndex = Math.floor(t * DANCE_BPS);
    const beatPhase = (t * DANCE_BPS) % 1;
    const target = armTargetsFor(mood, side, t, beatIndex, beatPhase);
    if (target && shoulderRef.current && elbowRef.current) {
      const sh = shoulderRef.current;
      sh.rotation.x = D(sh.rotation.x, target.sx, target.stiff, dt);
      sh.rotation.y = D(sh.rotation.y, target.sy, target.stiff, dt);
      sh.rotation.z = D(sh.rotation.z, target.sz, target.stiff, dt);
      elbowRef.current.rotation.x = D(elbowRef.current.rotation.x, target.ex, target.stiff, dt);
      if (handRef.current) {
        handRef.current.rotation.x = D(handRef.current.rotation.x, target.hx, target.stiff, dt);
        handRef.current.rotation.z = D(handRef.current.rotation.z, target.hz, target.stiff, dt);
      }
      return;
    }
    // Pose por defecto para moods no manejados por armTargetsFor
    if (shoulderRef.current) {
      const rest = side * 0.12;
      if (mood === "superhero") {
        const targetZ = side > 0 ? side * 2.7 : side * 0.2;
        const targetX = side > 0 ? -0.45 : 0.12;
        shoulderRef.current.rotation.z = D(shoulderRef.current.rotation.z, targetZ, 12, dt);
        shoulderRef.current.rotation.x = D(shoulderRef.current.rotation.x, targetX, 12, dt);
      } else if ((mood === "fistPump" || mood === "presidential") && side > 0) {
        shoulderRef.current.rotation.z = D(shoulderRef.current.rotation.z, side * 2.55, 12, dt);
        shoulderRef.current.rotation.x = D(shoulderRef.current.rotation.x, -0.35, 12, dt);
        if (handRef.current) {
          handRef.current.rotation.x = D(handRef.current.rotation.x, 0, 12, dt);
          handRef.current.rotation.z = D(handRef.current.rotation.z, 0, 12, dt);
        }
      } else if (mood === "love") {
        shoulderRef.current.rotation.z = D(shoulderRef.current.rotation.z, side * 0.85, 8, dt);
        shoulderRef.current.rotation.x = D(shoulderRef.current.rotation.x, -1.0, 8, dt);
      } else if (mood === "grateful") {
        shoulderRef.current.rotation.z = D(shoulderRef.current.rotation.z, side * 0.85 + Math.sin(t * 4) * 0.25, 8, dt);
      } else if (mood === "talking" && side > 0) {
        shoulderRef.current.rotation.z = D(shoulderRef.current.rotation.z, 0.7 + Math.sin(t * 4) * 0.3, 8, dt);
        shoulderRef.current.rotation.x = D(shoulderRef.current.rotation.x, 0.15 + Math.sin(t * 4) * 0.1, 8, dt);
      } else if (mood === "error") {
        shoulderRef.current.rotation.z = D(shoulderRef.current.rotation.z, side * 0.45 + Math.sin(t * 8) * 0.1, 8, dt);
      } else if (mood === "sleepy" || mood === "charging") {
        shoulderRef.current.rotation.z = D(shoulderRef.current.rotation.z, side * 0.04, 6, dt);
      } else if (mood === "stretch") {
        // Estirar (despertar): ambos brazos hacia arriba en "V", codos doblados
        const u = (t % 2.8) / 2.5;
        const lag = side === 1 ? 0 : 0.04;
        const env = smoothstepRange(0.00 + lag, 0.30 + lag, u) * (1 - smoothstepRange(0.60, 1.00, u));
        const hold = smoothstepRange(0.30, 0.45, u) * (1 - smoothstepRange(0.55, 0.62, u));
        const tremble = Math.sin(t * 22) * 0.025 * hold;
        shoulderRef.current.rotation.z = D(shoulderRef.current.rotation.z, side * (0.12 + 2.45 * env) + side * tremble, 8, dt);
        shoulderRef.current.rotation.x = D(shoulderRef.current.rotation.x, 0.30 * (1 - env) * env * 4 - 0.25 * env, 8, dt);
        if (elbowRef.current) {
          elbowRef.current.rotation.z = D(elbowRef.current.rotation.z, side * 0.75 * env, 8, dt);
          elbowRef.current.rotation.x = D(elbowRef.current.rotation.x, 0, 8, dt);
        }
      } else if (mood === "shrug") {
        const env = Math.max(0, Math.sin(t * 2));
        shoulderRef.current.rotation.z = D(shoulderRef.current.rotation.z, side * 0.12 + env * 0.5, 8, dt);
      } else if (mood === "idle" && side > 0) {
        const { lift, wave } = greeting;
        const shoulderZ = THREE.MathUtils.lerp(rest, 1.55, lift) + 0.035 * wave;
        const shoulderX = -0.16 * lift;
        shoulderRef.current.rotation.z = D(shoulderRef.current.rotation.z, shoulderZ, 10, dt);
        shoulderRef.current.rotation.x = D(shoulderRef.current.rotation.x, shoulderX, 10, dt);
      } else {
        shoulderRef.current.rotation.z = D(shoulderRef.current.rotation.z, rest, 8, dt);
        shoulderRef.current.rotation.x = D(shoulderRef.current.rotation.x, 0, 8, dt);
      }
    }
    if (elbowRef.current) {
      const { lift, wave } = greeting;
      const elbowZ = 0.65 * lift + 0.20 * wave;
      const elbowX = -0.20 * lift;
      elbowRef.current.rotation.z = D(elbowRef.current.rotation.z, elbowZ, 12, dt);
      elbowRef.current.rotation.x = D(elbowRef.current.rotation.x, elbowX, 10, dt);
    }
    if (handRef.current) {
      const { lift, wave } = greeting;
      handRef.current.rotation.z = D(handRef.current.rotation.z, 0.10 * lift + 0.24 * wave, 14, dt);
    }
  });

  return (
    <group ref={shoulderRef} position={[side * 0.52, -0.15, 0.32]}>
      <mesh castShadow>
        <sphereGeometry args={[0.115, 20, 20]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.3} roughness={0.18} />
      </mesh>
      {/* Brazo superior */}
      <mesh position={[0, -0.13, 0]}>
        <capsuleGeometry args={[0.07, 0.18, 8, 16]} />
        <meshStandardMaterial color="#ffffff" metalness={0.15} roughness={0.2} />
      </mesh>
      {/* Codo + antebrazo */}
      <group ref={elbowRef} position={[0, -0.26, 0]}>
        <mesh>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#f1f5f9" metalness={0.2} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.11, 0]}>
          <capsuleGeometry args={[0.06, 0.14, 8, 16]} />
          <meshStandardMaterial color="#ffffff" metalness={0.15} roughness={0.2} />
        </mesh>
        {/* Mano */}
        <group ref={handRef} position={[0, -0.22, 0]}>
          {/* Puño normal (oculto en presidential) */}
          <group visible={!(mood === "presidential" && side > 0)}>
            <mesh scale={[1, 1.3, 0.6]}>
              <sphereGeometry args={[0.08, 16, 16]} />
              <meshStandardMaterial color="#ffffff" metalness={0.12} roughness={0.18} />
            </mesh>
            {side > 0 && <MagicWand active={mood === "magic"} />}
            {side > 0 && <ThumbUp active={mood === "thumbsUp"} />}
          </group>
          {/* Mano abierta para presidential */}
          {side > 0 && mood === "presidential" && (
            <PresidentialOpenHand />
          )}
          {/* Copa/trofeo solo para fistPump */}
          {side > 0 && mood === "fistPump" && (
            <group position={[0, -0.12, 0]} scale={1.8} rotation={[Math.PI, 0, 0]}>
              <VictoryCup active={mood === "fistPump"} />
            </group>
          )}
        </group>
      </group>
    </group>
  );
}

/* ============================================================
   Hook de parpadeo
   ============================================================ */
function useBlink(mood: HubiState3D) {
  const openRef = useRef(1);
  const timerRef = useRef(0);
  const isBlinkingRef = useRef(false);
  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const canBlink = mood === "idle" || mood === "talking" || mood === "grateful";
    if (canBlink) {
      timerRef.current += dt;
      if (timerRef.current > 2 + Math.random() * 4 && !isBlinkingRef.current) {
        isBlinkingRef.current = true;
        timerRef.current = 0;
      }
    }
    if (isBlinkingRef.current) {
      openRef.current = Math.max(0.08, openRef.current - dt * 15);
      if (openRef.current <= 0.1) {
        isBlinkingRef.current = false;
      }
    } else if (canBlink) {
      openRef.current = Math.min(1, openRef.current + dt * 12);
    } else {
      openRef.current = D(openRef.current, 1, 14, dt);
    }
  });
  return openRef;
}

/* ============================================================
   RobotModel
   ============================================================ */
function RobotModel({ mood }: { mood: HubiState3D }) {
  const groupRef = useRef<THREE.Group>(null);
  const fxRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Mesh>(null);
  const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const ringMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const lastMoodRef = useRef(mood);
  const moodStartedAtRef = useRef<number | null>(null);
  const spinRef = useRef(0);
  const lastBeatRef = useRef(-1);
  const eyeOpenRef = useBlink(mood);
  const isLove = mood === "love" || mood === "grateful";

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const time = state.clock.elapsedTime;
    // Tiempo relativo desde que entró el mood (para saltos únicos)
    if (moodStartedAtRef.current === null || lastMoodRef.current !== mood) {
      lastMoodRef.current = mood;
      moodStartedAtRef.current = time;
    }
    const moodTime = time - moodStartedAtRef.current;

    /* === Escala del torso (respiración / sorpresa / error) === */
    const torso = torsoRef.current;
    if (torso) {
      let bx = 1, by = 1;
      if (mood === "idle" || mood === "thinking" || mood === "sleepy") {
        const rate = mood === "sleepy" ? 0.7 : 1.2;
        const amp = mood === "sleepy" ? 0.028 : 0.015;
        const breathe = Math.sin(time * rate);
        by = 1 + breathe * amp;
        bx = 1 - breathe * amp * 0.45;
      } else if (mood === "surprised") {
        by = 1 + Math.sin(time * 14) * 0.02 + 0.035;
        bx = 1 + 0.03;
      } else if (mood === "charging") {
        by = 1 + Math.sin(time * 5.5) * 0.012;
        bx = 1 - Math.sin(time * 5.5) * 0.008;
      } else if (mood === "error") {
        by = 1 + Math.sin(time * 26) * 0.012;
        bx = 1 - Math.sin(time * 26) * 0.012;
      }
      torso.scale.x = D(torso.scale.x, BODY_BASE.x * bx, 9, dt);
      torso.scale.y = D(torso.scale.y, BODY_BASE.y * by, 9, dt);
      torso.scale.z = D(torso.scale.z, BODY_BASE.z * bx, 9, dt);
    }

    /* === Cabeza === */
    const head = headRef.current;
    if (head) {
      const pose = MOOD_HEAD_POSE[mood];
      const microY = Math.sin(time * 0.3) * 0.05 + Math.sin(time * 0.8) * 0.03;
      const microX = Math.sin(time * 0.47 + 1.2) * 0.022;
      const microZ = Math.sin(time * 0.23 + 2.4) * 0.018;
      const idleLike = mood === "idle" || mood === "talking" || mood === "thinking";
      const wMicro = idleLike ? 1 : 0.25;
      const greeting = getIdleGreeting(time, mood === "idle");
      const greetingTiltZ = -0.065 * greeting.lift;
      const greetingNodX = 0.025 * greeting.lift;
      head.rotation.x = D(head.rotation.x, pose.x + microX * wMicro + greetingNodX, pose.stiff, dt);
      head.rotation.y = D(head.rotation.y, pose.y + microY * wMicro, pose.stiff, dt);
      head.rotation.z = D(head.rotation.z, pose.z + microZ * wMicro + greetingTiltZ, pose.stiff, dt);
      // Overrides dinámicos
      if (mood === "dance") {
        const beat = time * DANCE_BPS;
        head.rotation.y = Math.sin(beat * Math.PI) * 0.15;
        head.rotation.z = Math.cos(beat * Math.PI * 0.5) * 0.12;
        head.rotation.x = -0.05 + Math.abs(Math.sin(beat * Math.PI * 2)) * 0.1;
      }
      if (mood === "thumbsUp") head.rotation.x = -0.1 + Math.sin(time * 5.5) * 0.07;
      if (mood === "sleepy") head.rotation.x = 0.25 + Math.sin(time * 0.7) * 0.06;
      if (mood === "stretch") {
        const u = (time % 2.8) / 2.5;
        const env = smoothstepRange(0, 0.30, u) * (1 - smoothstepRange(0.60, 1.00, u));
        head.rotation.x = -0.32 * env;
      }
    }

    /* === Grupo FX: rotación + offsets === */
    const grp = fxRef.current;
    if (grp) {
      // Giro de baile en beats 4 y 8
      if (mood === "dance") {
        const beat = Math.floor(time * DANCE_BPS);
        if (beat !== lastBeatRef.current) {
          lastBeatRef.current = beat;
          const inBar = beat % 8;
          if (inBar === 3 || inBar === 7) spinRef.current += Math.PI * 0.5;
        }
        grp.rotation.y = D(grp.rotation.y, spinRef.current, 6, dt);
      } else if (mood === "spin") {
        // Giro completo continuo como Codex
        grp.rotation.y += dt * 4;
      } else {
        spinRef.current = 0;
        lastBeatRef.current = -1;
        grp.rotation.y = D(grp.rotation.y, mood === "magic" ? Math.sin(time * 0.8) * 0.12 : 0, 4, dt);
      }
      // Sacudida de error
      const shake = mood === "error" ? Math.sin(time * 30) * 0.04 : 0;
      grp.position.x = D(grp.position.x, shake, 30, dt);
      if (mood === "error") grp.rotation.z = Math.sin(time * 24) * 0.03;
      else grp.rotation.z = D(grp.rotation.z, 0, 6, dt);
      // Retroceso / bow / birthday
      const targetZ = mood === "surprised" ? -0.08 : 0;
      grp.position.z = D(grp.position.z, targetZ, 10, dt);
      const bowX = mood === "bow" ? 0.3 : 0;
      grp.rotation.x = D(grp.rotation.x, bowX, 5, dt);
      if (mood === "birthday") {
        const hop = Math.abs(Math.sin(time * 3.6));
        grp.position.y = D(grp.position.y, hop * 0.22, 16, dt);
      } else if (mood === "jump") {
        grp.position.y = Math.max(0, Math.sin(time * 4)) * 0.5;
      } else if (mood === "fistPump") {
        const u = time % 3;
        const h = (p: number) => { const x = (u - p) / 0.52; return x < 0 || x > 1 ? 0 : 0.38 * 4 * x * (1 - x); };
        grp.position.y = h(0.48) + h(0.48 + 0.62);
      } else if (mood === "presidential") {
        // Salto único usando tiempo relativo al mood
        const jumpStart = 0.48;
        const jumpDuration = 0.52;
        const jumpHeight = 0.38;
        const x = (moodTime - jumpStart) / jumpDuration;
        grp.position.y = x >= 0 && x <= 1 ? jumpHeight * 4 * x * (1 - x) : D(grp.position.y, 0, 8, dt);
      } else if (mood === "superhero") {
        // Despegue suave + flotación
        const launchProgress = clamp01(moodTime / 0.65);
        const lift = 1 - Math.pow(1 - launchProgress, 3);
        grp.position.y = lift * (0.18 + Math.sin(moodTime * 3.2) * 0.025);
      } else if (mood === "sleepy") {
        grp.position.y = Math.sin(time * 0.5) * 0.03 - 0.05;
      } else if (mood === "magic") {
        grp.position.y = Math.sin(time * 2) * 0.05 + 0.05;
      } else if (mood === "thumbsUp" || mood === "wink") {
        grp.position.y = Math.sin(time * 1.5) * 0.08;
      } else {
        grp.position.y = D(grp.position.y, Math.sin(time * 1.5) * 0.08, 8, dt);
      }
    }

    /* === Inclinación del cuerpo === */
    const bodyGrp = bodyRef.current;
    if (bodyGrp) {
      bodyGrp.rotation.x = D(bodyGrp.rotation.x, mood === "sleepy" ? 0.1 : 0, 4, dt);
    }

    /* === Emisivo del cuerpo por mood === */
    const bodyMat = bodyMatRef.current;
    if (bodyMat) {
      // Color del torso: azul cuando es superhéroe, blanco en el resto
      const targetBodyColor = mood === "superhero" ? SUPERHERO_BODY_COLOR : BODY_WHITE_COLOR;
      bodyMat.color.lerp(targetBodyColor, 1 - Math.exp(-10 * dt));
      let targetColor = BODY_EMISSIVE_BASE;
      let targetIntensity = 0.025;
      if (mood === "error") { targetColor = ERROR_EMISSIVE; targetIntensity = 0.15; }
      else if (mood === "charging") { targetColor = CHARGE_EMISSIVE; targetIntensity = Math.max(0, Math.sin(time * 3.4)) * 0.32; }
      else if (mood === "magic") { targetColor = MAGIC_EMISSIVE; targetIntensity = 0.3 + Math.sin(time * 4) * 0.08; }
      else if (mood === "love") { targetColor = LOVE_EMISSIVE; targetIntensity = 0.12 + Math.sin(time * 6) * 0.05; }
      else if (mood === "birthday") { targetColor = BIRTHDAY_EMISSIVE; targetIntensity = 0.16; }
      bodyMat.emissive.lerp(targetColor, 1 - Math.exp(-10 * dt));
      bodyMat.emissiveIntensity = D(bodyMat.emissiveIntensity, targetIntensity, 8, dt);
    }

    /* === Borde de la panza: color según mood (igual que ojos) === */
    const ringMat = ringMatRef.current;
    if (ringMat) {
      let ringColor = "#7dd3fc";
      let ringEmissive = "#38bdf8";
      let ringGlow = 1.4;
      if (mood === "error") { ringColor = "#f43f5e"; ringEmissive = "#f43f5e"; ringGlow = 1.6; }
      else if (mood === "love") { ringColor = "#fb7185"; ringEmissive = "#f43f5e"; ringGlow = 1.3 + Math.sin(time * 7) * 0.3; }
      else if (mood === "charging") { ringColor = "#fbbf24"; ringEmissive = "#fde047"; ringGlow = 1.2 + Math.max(0, Math.sin(time * 3.4)) * 0.6; }
      else if (mood === "magic") { ringColor = "#a78bfa"; ringEmissive = "#a78bfa"; ringGlow = 1.8; }
      else if (mood === "birthday") { ringColor = "#f472b6"; ringEmissive = "#f472b6"; ringGlow = 1.6; }
      else if (mood === "surprised") { ringColor = "#fbbf24"; ringEmissive = "#fbbf24"; ringGlow = 2.0; }
      else if (mood === "sleepy") { ringColor = "#7dd3fc"; ringEmissive = "#38bdf8"; ringGlow = 0.6; }
      SCRATCH_COLOR.set(ringColor);
      ringMat.color.lerp(SCRATCH_COLOR, 1 - Math.exp(-8 * dt));
      SCRATCH_COLOR.set(ringEmissive);
      ringMat.emissive.lerp(SCRATCH_COLOR, 1 - Math.exp(-8 * dt));
      ringMat.emissiveIntensity = D(ringMat.emissiveIntensity, ringGlow, 8, dt);
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={fxRef}>
        {/* ---------- CUERPO ---------- */}
        <group ref={bodyRef}>
          <mesh ref={torsoRef} position={[0, -0.5, 0]} scale={[BODY_BASE.x, BODY_BASE.y, BODY_BASE.z]} castShadow receiveShadow>
            <sphereGeometry args={[0.62, 48, 48]} />
            <meshStandardMaterial ref={bodyMatRef} color="#ffffff" metalness={0.22} roughness={0.14} emissive={BODY_EMISSIVE_BASE} emissiveIntensity={0.025} />
          </mesh>
          {/* Borde de energía en la panza — cambia de color según mood (oculto en superhero) */}
          <mesh position={[0, -0.5, 0.505]} visible={mood !== "superhero"}>
            <torusGeometry args={[0.24, 0.014, 12, 64]} />
            <meshStandardMaterial ref={ringMatRef} color="#7dd3fc" emissive="#38bdf8" emissiveIntensity={1.4} metalness={0.3} roughness={0.15} toneMapped={false} />
          </mesh>
          {/* Cuello */}
          <mesh position={[0, 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.14, 0.12, 16]} />
            <meshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.18} />
          </mesh>
          <BatteryGauge active={mood === "charging"} />
          {/* Disfraz de superhéroe dentro de bodyRef */}
          <SuperheroCostume active={mood === "superhero"} />
        </group>

        {/* Banda presidencial — fuera del bodyRef para no heredar su escala/posición */}
        <PresidentialSash active={mood === "presidential"} />

        {/* ---------- CABEZA ---------- */}
        <group ref={headRef} position={[0, 0.42, 0]}>
          {/* Casco */}
          <mesh castShadow>
            <sphereGeometry args={[0.5, 32, 32]} />
            <meshStandardMaterial color="#ffffff" metalness={0.1} roughness={0.15} emissive="#ffffff" emissiveIntensity={0.02} />
          </mesh>
          {/* Visor */}
          <mesh position={[0, 0.03, 0.32]} scale={[1, 0.65, 0.45]}>
            <sphereGeometry args={[0.46, 32, 32]} />
            <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.15} transparent opacity={0.9} />
          </mesh>
          <RobotEye side={1} mood={mood} openRef={eyeOpenRef} />
          <RobotEye side={-1} mood={mood} openRef={eyeOpenRef} />
          <BirthdayHat active={mood === "birthday"} />
          <MagicHat active={mood === "magic"} />
          <OrbitStars active={mood === "surprised"} />
        </group>

        {/* ---------- BRAZOS ---------- */}
        <RobotArm side={1} mood={mood} />
        <RobotArm side={-1} mood={mood} />

        {/* ---------- EFECTOS ---------- */}
        <ClapShockwave active={mood === "clap"} />
        <SleepyZzz active={mood === "sleepy"} />
        <ErrorSparks active={mood === "error"} />
        <ChargeBolt active={mood === "charging"} />
        <FloatingHearts active={isLove} />
        <GivenHeart active={mood === "love"} />

        {/* Anillos */}
        <PulseRings active={mood === "dance"} count={3} color="#a78bfa" speed={DANCE_BPS} to={1.5} position={[0, -1.25, 0]} />
        <PulseRings active={mood === "charging"} count={3} color="#fbbf24" speed={0.85} to={1.3} position={[0, -0.5, 0]} />
        <PulseRings active={mood === "love"} count={2} color="#f472b6" speed={0.5} to={1.35} maxOpacity={0.35} position={[0, -1.2, 0]} />
        <PulseRings active={mood === "sleepy"} count={2} color="#7dd3fc" from={0.03} to={0.34} speed={0.5} thickness={0.12} maxOpacity={0.3} position={[0, 0.02, 0.52]} rotation={[0, 0, 0]} />

        {/* Luces contextuales */}
        {isLove && <pointLight position={[0, -0.2, 0.9]} intensity={0.85} distance={2.6} color="#fb7185" />}
        {mood === "magic" && <pointLight position={[0, 0.2, 0.9]} intensity={1} distance={3} color="#a78bfa" />}

        {/* Anillo base */}
        <mesh position={[0, -1.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.28, 0.45, 32]} />
          <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={0.4} transparent opacity={0.4} />
        </mesh>
      </group>

      {/* Confetti fuera de fxRef para que no rote con el baile */}
      {(mood === "fistPump" || mood === "birthday" || mood === "presidential") && (
        <VictoryConfetti key={mood} active={true} count={mood === "birthday" ? 300 : 250} />
      )}
    </group>
  );
}

/* ============================================================
   Export — HubiMascotOpus
   ============================================================ */
export function HubiMascotOpus({
  state = "idle",
  size = 100,
  className = "",
}: HubiMascot3DProps) {
  return (
    <div
      className={`hubi-mascot-3d ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Hubi ${state}`}
    >
      <Canvas
        className="hubi-canvas-gl"
        camera={{ position: [0, 0, 4.5], fov: 45 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        dpr={[1.5, 2.5]}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFShadowMap;
        }}
      >
        <ambientLight intensity={0.85} />
        <hemisphereLight args={["#e0f2fe", "#94a3b8", 0.45]} />
        <directionalLight
          position={[5, 8, 5]} intensity={1.4} color="#ffffff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-radius={3}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[-5, 5, -5]} intensity={0.6} color="#e0f2fe" />
        <spotLight position={[0, 2.2, -3]} angle={0.9} penumbra={1} intensity={1.1} color="#7dd3fc" />
        <pointLight position={[-5, 5, 5]} intensity={0.4} color="#38bdf8" />
        <pointLight position={[5, -5, 5]} intensity={0.3} color="#0284c7" />
        <RobotModel mood={state} />
        <ContactShadows
          position={[0, -1.32, 0]}
          opacity={0.42}
          scale={4}
          blur={2.6}
          far={2.2}
          resolution={512}
          color="#0f172a"
        />
      </Canvas>
    </div>
  );
}
