import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { CampusBuilding, OperationalStatus } from "../types";

const STATUS_COLOR: Record<string, string> = {
  Operational: "#10B981",
  Warning: "#F59E0B",
  Disrupted: "#EF4444",
  Critical: "#EF4444",
  Recovering: "#7C3AED",
  Recovered: "#10B981",
  Selected: "#2563EB",
};

export function CampusBuildingMesh({
  building,
  status,
  isSelected,
  isHighlightedDept,
  onSelect,
}: {
  building: CampusBuilding;
  status: OperationalStatus;
  isSelected: boolean;
  isHighlightedDept: boolean;
  onSelect: (b: CampusBuilding) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const pulseRef = useRef<THREE.Mesh>(null);
  const [w, h, d] = building.size;
  const [x, y, z] = building.position;

  const isCritical = status === "Critical" || status === "Disrupted";
  const accentColor = isSelected
    ? STATUS_COLOR.Selected
    : STATUS_COLOR[status] || STATUS_COLOR.Operational;

  useFrame(({ clock }) => {
    if (pulseRef.current) {
      if (isCritical || status === "Recovering") {
        const s = 1 + Math.sin(clock.getElapsedTime() * 4.5) * 0.08;
        pulseRef.current.scale.set(s, 1, s);
      } else {
        pulseRef.current.scale.set(1, 1, 1);
      }
    }
  });

  // Bright white & light-blue architectural body tinted slightly on failure/selection
  const bodyColor = isSelected
    ? "#DBEAFE"
    : isCritical
      ? "#FEE2E2"
      : status === "Recovering"
        ? "#EDE9FE"
        : isHighlightedDept
          ? "#E0F2FE"
          : "#F8FAFC";

  return (
    <group position={[x, y, z]}>
      {/* Base status plinth */}
      <mesh ref={pulseRef} position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[w + 0.65, 0.24, d + 0.65]} />
        <meshStandardMaterial
          color={accentColor}
          transparent
          opacity={isCritical || isSelected ? 0.85 : 0.35}
        />
      </mesh>

      {/* Main architectural block */}
      <RoundedBox
        args={[w, h, d]}
        radius={0.18}
        smoothness={2}
        position={[0, h / 2 + 0.24, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect(building);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.08} />
      </RoundedBox>

      {/* Architectural sky-blue glass crown strip */}
      <mesh position={[0, h + 0.14, 0]}>
        <boxGeometry args={[w * 0.92, 0.26, d * 0.92]} />
        <meshStandardMaterial color={accentColor} roughness={0.25} metalness={0.2} />
      </mesh>

      {/* Subtle architectural window facade */}
      <mesh position={[0, h * 0.55 + 0.24, d / 2 + 0.02]}>
        <planeGeometry args={[w * 0.78, h * 0.55]} />
        <meshStandardMaterial color="#BFDBFE" transparent opacity={0.6} roughness={0.15} />
      </mesh>

      {(hovered || isSelected) && (
        <Html position={[0, h + 1.15, 0]} center distanceFactor={28}>
          <div className="pointer-events-none whitespace-nowrap rounded-xl border border-slate-200 bg-white/95 px-3 py-1.5 text-xs shadow-lg">
            <p className="font-semibold text-slate-900">{building.name}</p>
            <p className="text-[11px] text-slate-500">
              {building.building_id} • <span style={{ color: accentColor }} className="font-semibold">{status}</span>
            </p>
          </div>
        </Html>
      )}
    </group>
  );
}
