import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { useTwin } from "../context/TwinContext";
import { DependencyGraphFlow } from "../digital-twin/DependencyGraphFlow";
import { SectionHeader } from "../components/ui/Primitives";

export function DigitalTwinPage() {
  const { activeSimulation } = useTwin();
  const { data: graphData, isLoading } = useQuery({
    queryKey: ["dependencies"],
    queryFn: () => api.getDependencies(),
  });

  const restoredSet = new Set(activeSimulation?.restored_resource_ids || []);
  const disruptedSet = new Set(
    (activeSimulation?.affected_resources || [])
      .filter((r: any) => (r.state === "Critical" || r.state === "Disrupted") && !restoredSet.has(r.resource_id))
      .map((r: any) => r.resource_id)
  );

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Institutional Dependency Graph (Digital Twin)"
        subtitle="NetworkX directed topology rendered via React Flow — mandatory operational dependencies vs optional/buffered edges"
      />
      {isLoading ? (
        <div className="glass-card p-8 text-xs text-slate-500">Building NetworkX dependency graph...</div>
      ) : (
        <DependencyGraphFlow graphData={graphData} disruptedIds={disruptedSet} heightClass="h-[600px]" />
      )}
    </div>
  );
}
