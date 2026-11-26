import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CampusScene } from "../campus3d/CampusScene";
import { CampusControls } from "../campus3d/CampusControls";
import { DependencyGraphFlow } from "../digital-twin/DependencyGraphFlow";
import { ErrorBoundary, SectionHeader, StatusBadge } from "../components/ui/Primitives";
import { api } from "../services/api";
import { useTwin } from "../context/TwinContext";
import type { CampusBuilding } from "../types";

export function Campus3DPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [cameraMode, setCameraMode] = useState<"perspective" | "top">("perspective");
  const [resetSignal, setResetSignal] = useState(0);
  const [highlightDept, setHighlightDept] = useState("ALL");
  const [selected, setSelected] = useState<CampusBuilding | null>(null);

  const { activeSimulation } = useTwin();
  const { data: campus } = useQuery({ queryKey: ["campus"], queryFn: api.getCampus });
  const { data: graphData } = useQuery({
    queryKey: ["dependencies", highlightDept],
    queryFn: () => api.getDependencies(highlightDept),
    enabled: viewMode === "2d",
  });

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  const restoredSet = new Set(activeSimulation?.restored_resource_ids || []);
  const disruptedSet = new Set(
    (activeSimulation?.affected_resources || [])
      .filter((r: any) => (r.state === "Critical" || r.state === "Disrupted") && !restoredSet.has(r.resource_id))
      .map((r: any) => r.resource_id)
  );

  return (
    <div ref={containerRef} className="space-y-4">
      <SectionHeader
        title="Interactive 3D Campus Digital Twin"
        subtitle="Real-time procedural campus topology synchronized with institutional resources and failure simulations"
      />

      <CampusControls
        viewMode={viewMode}
        onToggleView={() => setViewMode(viewMode === "3d" ? "2d" : "3d")}
        cameraMode={cameraMode}
        onToggleCamera={() => setCameraMode(cameraMode === "perspective" ? "top" : "perspective")}
        onResetCamera={() => setResetSignal((n) => n + 1)}
        onFullscreen={handleFullscreen}
        highlightDept={highlightDept}
        onHighlightDept={setHighlightDept}
      />

      {viewMode === "3d" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <ErrorBoundary>
              <CampusScene
                buildings={campus?.buildings || []}
                connections={campus?.connections || []}
                statusOverrides={activeSimulation?.building_statuses || {}}
                selectedBuildingId={selected?.building_id || null}
                onSelectBuilding={(b) => setSelected(b)}
                cameraMode={cameraMode}
                resetSignal={resetSignal}
                highlightDept={highlightDept}
                heightClass="h-[580px]"
              />
            </ErrorBoundary>
          </div>
          <div className="glass-card p-4">
            <h3 className="font-display text-sm font-bold text-[#0F172A]">Floating Resource Panel</h3>
            {selected ? (
              <div className="mt-3 space-y-3 text-xs">
                <div>
                  <p className="text-base font-bold text-slate-900">{selected.name}</p>
                  <p className="text-slate-500">{selected.building_id} • {selected.category}</p>
                </div>
                <StatusBadge status={activeSimulation?.building_statuses?.[selected.building_id] || selected.status} />
                <div>
                  <p className="font-semibold text-slate-700">Mapped Resource IDs</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {selected.resource_ids.map((id) => (
                      <span key={id} className="rounded-lg bg-blue-50 px-2 py-1 font-mono text-[11px] font-semibold text-blue-700">
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-slate-500">Assigned Student Footprint</p>
                  <p className="font-display text-2xl font-bold text-slate-900">{selected.student_count}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[#64748B]">
                Rotate, zoom, or click any building in the 3D scene to inspect mapped Power, Network, Lab, Hostel, and Exam resources.
              </p>
            )}
          </div>
        </div>
      ) : (
        <DependencyGraphFlow graphData={graphData} disruptedIds={disruptedSet} heightClass="h-[580px]" />
      )}
    </div>
  );
}
