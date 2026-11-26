import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { CampusBuilding, CampusConnection, OperationalStatus } from "../types";
import { CampusBuildingMesh } from "./CampusBuilding";
import { DependencyLines } from "./DependencyLines";
import { StatusBadge } from "../components/ui/Primitives";

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function CameraRig({
  cameraMode,
  resetSignal,
}: {
  cameraMode: "perspective" | "top";
  resetSignal: number;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (cameraMode === "top") {
      camera.position.set(0, 44, 0.01);
    } else {
      camera.position.set(24, 22, 28);
    }
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [cameraMode, resetSignal, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI / 2 - 0.06}
      minDistance={12}
      maxDistance={65}
    />
  );
}

const TREE_POSITIONS: [number, number][] = [
  [-21, -8], [-21, -2], [-15, -1], [-6, -2], [3, -12], [11, -12],
  [21, -8], [21, 5], [19, 13], [4, 15], [-6, 15], [-21, 14],
];

function CampusLandscaping() {
  return (
    <group>
      {/* Main green campus grounds */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[56, 42]} />
        <meshStandardMaterial color="#E6F4EA" roughness={0.95} />
      </mesh>
      {/* Clean paved internal campus roads */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -1]}>
        <planeGeometry args={[48, 2.6]} />
        <meshStandardMaterial color="#CBD5E1" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-3, 0.01, 1]}>
        <planeGeometry args={[2.6, 34]} />
        <meshStandardMaterial color="#CBD5E1" roughness={0.85} />
      </mesh>
      {/* Lightweight procedural trees */}
      {TREE_POSITIONS.map(([tx, tz], i) => (
        <group key={i} position={[tx, 0, tz]}>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.14, 0.2, 1.1, 6]} />
            <meshStandardMaterial color="#92400E" />
          </mesh>
          <mesh position={[0, 1.65, 0]}>
            <coneGeometry args={[0.95, 1.8, 7]} />
            <meshStandardMaterial color="#34D399" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function CampusScene({
  buildings,
  connections,
  statusOverrides = {},
  selectedBuildingId,
  onSelectBuilding,
  cameraMode = "perspective",
  resetSignal = 0,
  highlightDept = "ALL",
  heightClass = "h-[460px]",
}: {
  buildings: CampusBuilding[];
  connections: CampusConnection[];
  statusOverrides?: Record<string, OperationalStatus>;
  selectedBuildingId: string | null;
  onSelectBuilding: (b: CampusBuilding) => void;
  cameraMode?: "perspective" | "top";
  resetSignal?: number;
  highlightDept?: string;
  heightClass?: string;
}) {
  const webglOk = useMemo(() => isWebGLAvailable(), []);
  const [renderFallback, setRenderFallback] = useState(!webglOk);

  if (renderFallback) {
    return (
      <div className={`${heightClass} overflow-auto rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4`}>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            2D Architectural Campus Map (WebGL Fallback)
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {buildings.map((b) => {
            const st = statusOverrides[b.building_id] || b.status;
            return (
              <button
                key={b.building_id}
                onClick={() => onSelectBuilding(b)}
                className={`rounded-xl border p-3 text-left transition ${
                  selectedBuildingId === b.building_id
                    ? "border-[#2563EB] bg-blue-50"
                    : "border-slate-200 bg-white hover:border-blue-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">{b.building_id}</span>
                  <StatusBadge status={st} />
                </div>
                <p className="mt-1 text-xs text-slate-600">{b.name}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-gradient-to-b from-[#E0F2FE] to-[#F8FAFC] ${heightClass}`}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ position: [24, 22, 28], fov: 44 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", () => setRenderFallback(true));
        }}
      >
        <color attach="background" args={["#EEF6FF"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[22, 34, 18]} intensity={1.1} castShadow />
        <CampusLandscaping />
        <DependencyLines
          buildings={buildings}
          connections={connections}
          activeStatusMap={statusOverrides}
        />
        {buildings.map((b) => (
          <CampusBuildingMesh
            key={b.building_id}
            building={b}
            status={statusOverrides[b.building_id] || b.status}
            isSelected={selectedBuildingId === b.building_id}
            isHighlightedDept={highlightDept !== "ALL" && b.department === highlightDept}
            onSelect={onSelectBuilding}
          />
        ))}
        <CameraRig cameraMode={cameraMode} resetSignal={resetSignal} />
      </Canvas>

      {/* Legend overlay */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />Operational</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#F59E0B]" />Warning</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#EF4444]" />Critical/Disrupted</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#7C3AED]" />Recovering</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#06B6D4]" />Dependency</span>
      </div>
    </div>
  );
}
