import { Compass, Expand, Layers, RotateCcw } from "lucide-react";

export function CampusControls({
  viewMode,
  onToggleView,
  cameraMode,
  onToggleCamera,
  onResetCamera,
  onFullscreen,
  highlightDept,
  onHighlightDept,
}: {
  viewMode: "3d" | "2d";
  onToggleView: () => void;
  cameraMode: "perspective" | "top";
  onToggleCamera: () => void;
  onResetCamera: () => void;
  onFullscreen: () => void;
  highlightDept: string;
  onHighlightDept: (d: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white/95 px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onToggleView}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
        >
          <Layers className="h-3.5 w-3.5" />
          {viewMode === "3d" ? "Switch to 2D Graph" : "Switch to 3D Campus"}
        </button>
        {viewMode === "3d" && (
          <>
            <button
              onClick={onToggleCamera}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <Compass className="h-3.5 w-3.5" />
              {cameraMode === "perspective" ? "Top View" : "Perspective View"}
            </button>
            <button
              onClick={onResetCamera}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Camera
            </button>
          </>
        )}
        <button
          onClick={onFullscreen}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
        >
          <Expand className="h-3.5 w-3.5" />
          Fullscreen
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[#64748B]">Highlight Dept:</span>
        <select
          value={highlightDept}
          onChange={(e) => onHighlightDept(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 focus:border-[#2563EB] focus:outline-none"
        >
          <option value="ALL">All Departments</option>
          <option value="CSE">CSE</option>
          <option value="ISE">ISE</option>
          <option value="ECE">ECE</option>
          <option value="ME">ME</option>
          <option value="CV">CV</option>
        </select>
      </div>
    </div>
  );
}
