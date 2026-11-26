# OMNIS-X — Intelligent 3D Institutional Digital Twin (Project A01)

**Tagline:** *Predict. Prevent. Recover.*

OMNIS-X is a constraint-based institutional digital twin for engineering campuses. Instead of acting as a traditional ERP, it models interconnected academic, infrastructure, examination, hostel, transportation, placement, and event dependencies using **NetworkX**, detects operational conflicts, simulates deterministic cascading failures, and generates mathematically feasible recovery plans via **Google OR-Tools CP-SAT**, rendered in a **Premium Modern Light-Theme 3D Command Centre**.

## Key Capabilities

- **Authoritative 200-Student CSV Integration**: Validates and preserves all 200 records, 18 columns, unique IDs/USNs, and exact SQL `NULL` semantics (`50` missing CGPAs, `135` missing hostel rooms, `65` missing bus routes).
- **Supabase PostgreSQL Architecture**: Complete 5-file SQL migration suite (`supabase/migrations/`) with constraints, indexes, least-privilege Row Level Security, Realtime broadcasts, and atomic recovery RPCs.
- **Interactive 3D Campus (React Three Fiber + Three.js)**: Bright architectural 3D campus synchronized with institutional resource IDs, operational status colors, animated dependency corridors, and automatic 2D WebGL fallback.
- **NetworkX Dependency Graph & Risk Radar**: Models mandatory operational dependencies vs. advisory mentor links, computes betweenness centrality, and detects Single Points of Failure (SPOFs).
- **Deterministic Cascading Failure Simulation Lab**: Event-driven time-ordered propagation across 12 incident types with playback controls, failure replay timeline, and deduplicated student impact analysis.
- **Google OR-Tools CP-SAT Recovery Optimizer**: Solves Plan A (Min Academic Disruption), Plan B (Min Cost), and Plan C (Fastest Recovery) under hard constraints, reporting `OPTIMAL`, `FEASIBLE`, or `INFEASIBLE` honestly.
- **Operation Zero Failure**: One-click demonstration simulating a North Grid electrical substation failure, cascading across labs/networks/exams, and synthesizing recovery plans.

## Quick Start (Windows)

```bat
scripts\setup.bat
scripts\start.bat
```

- Frontend: `http://127.0.0.1:5173`
- FastAPI Swagger Docs: `http://127.0.0.1:8000/docs`

See `docs/DATABASE_SETUP.md` to connect your Supabase PostgreSQL project and import the 200 students.
