import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import type { CampusBuilding, CampusConnection } from "../types";

export function DependencyLines({
  buildings,
  connections,
  activeStatusMap,
}: {
  buildings: CampusBuilding[];
  connections: CampusConnection[];
  activeStatusMap: Record<string, string>;
}) {
  const bMap = new Map(buildings.map((b) => [b.building_id, b]));
  const pulseGroup = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (pulseGroup.current) {
      const t = (clock.getElapsedTime() * 0.55) % 1;
      pulseGroup.current.children.forEach((child, idx) => {
        const line = connections[idx];
        if (!line) return;
        const src = bMap.get(line.from);
        const dst = bMap.get(line.to);
        if (!src || !dst) return;
        const p = (t + idx * 0.13) % 1;
        child.position.set(
          THREE.MathUtils.lerp(src.position[0], dst.position[0], p),
          1.4 + Math.sin(p * Math.PI) * 1.4,
          THREE.MathUtils.lerp(src.position[2], dst.position[2], p)
        );
      });
    }
  });

  return (
    <group>
      {connections.map((conn, idx) => {
        const src = bMap.get(conn.from);
        const dst = bMap.get(conn.to);
        if (!src || !dst) return null;

        const srcStat = activeStatusMap[conn.from] || src.status;
        const dstStat = activeStatusMap[conn.to] || dst.status;
        const disrupted =
          srcStat === "Critical" ||
          srcStat === "Disrupted" ||
          dstStat === "Critical" ||
          dstStat === "Disrupted";

        const color = disrupted ? "#EF4444" : "#06B6D4";
        const midX = (src.position[0] + dst.position[0]) / 2;
        const midZ = (src.position[2] + dst.position[2]) / 2;
        const pts: [number, number, number][] = [
          [src.position[0], 1.4, src.position[2]],
          [midX, 2.8, midZ],
          [dst.position[0], 1.4, dst.position[2]],
        ];

        return (
          <Line
            key={`${conn.from}-${conn.to}-${idx}`}
            points={pts}
            color={color}
            lineWidth={disrupted ? 2.8 : 1.5}
            transparent
            opacity={disrupted ? 0.92 : 0.55}
            dashed={!disrupted}
            dashScale={2}
          />
        );
      })}

      {/* Animated pulse spheres along dependency corridors */}
      <group ref={pulseGroup}>
        {connections.map((conn, idx) => {
          const srcStat = activeStatusMap[conn.from] || "Operational";
          const isHot = srcStat === "Critical" || srcStat === "Disrupted";
          return (
            <mesh key={`pulse-${idx}`}>
              <sphereGeometry args={[isHot ? 0.28 : 0.18, 10, 10]} />
              <meshBasicMaterial color={isHot ? "#EF4444" : "#06B6D4"} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}
