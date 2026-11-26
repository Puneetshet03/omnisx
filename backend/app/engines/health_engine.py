"""Explainable Institutional Health Index Engine (0-100).

Computes weighted operational estimates from normalized institutional metrics,
explicitly distinguishing baseline, post-failure, and post-recovery health.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def compute_institutional_health(
    snapshot: Dict[str, Any],
    conflicts: List[Dict[str, Any]],
    weights: Optional[Dict[str, float]] = None,
    disrupted_resource_ids: Optional[set] = None,
    affected_student_count: int = 0,
    context_label: str = "baseline",
) -> Dict[str, Any]:
    """Compute explainable, model-based Institutional Health Index (0-100)."""
    w = weights or {
        "academic_continuity": 0.25,
        "resource_availability": 0.20,
        "exam_readiness": 0.15,
        "transport_reliability": 0.10,
        "hostel_stability": 0.10,
        "infrastructure_stability": 0.12,
        "conflict_penalty": 0.08,
    }
    disrupted = disrupted_resource_ids or set()
    students = snapshot.get("students", [])
    total_students = max(len(students), 1)

    # 1. Academic continuity (based on undisrupted students & operational classrooms/labs/faculty)
    academic_continuity = max(0.0, round(100.0 * (1.0 - (affected_student_count / total_students)), 2))

    # 2. Resource availability (classrooms + labs + faculty operational ratio)
    classrooms = snapshot.get("classrooms", [])
    labs = snapshot.get("laboratories", [])
    faculty = snapshot.get("faculty", [])
    total_res = max(len(classrooms) + len(labs) + len(faculty), 1)
    down_res = sum(1 for r in classrooms if r["classroom_id"] in disrupted or r["operational_status"] != "Operational")
    down_res += sum(1 for l in labs if l["lab_id"] in disrupted or l["operational_status"] != "Operational")
    down_res += sum(1 for f in faculty if f["faculty_id"] in disrupted or f["availability_status"] != "Available")
    resource_availability = max(0.0, round(100.0 * (1.0 - down_res / total_res), 2))

    # 3. Examination readiness
    exams = snapshot.get("examinations", [])
    halls = snapshot.get("exam_halls", [])
    total_exam_units = max(len(exams) + len(halls), 1)
    down_exams = sum(1 for e in exams if e["exam_id"] in disrupted or e["hall_id"] in disrupted)
    down_exams += sum(1 for h in halls if h["hall_id"] in disrupted or h["operational_status"] != "Operational")
    exam_readiness = max(0.0, round(100.0 * (1.0 - down_exams / total_exam_units), 2))

    # 4. Transportation reliability (college bus routes BUS-01..BUS-04)
    routes = [r for r in snapshot.get("bus_routes", []) if r.get("is_college_bus")]
    total_routes = max(len(routes), 1)
    down_routes = sum(1 for r in routes if r["route_id"] in disrupted or r["operational_status"] != "Operational")
    transport_reliability = max(0.0, round(100.0 * (1.0 - down_routes / total_routes), 2))

    # 5. Hostel stability
    blocks = snapshot.get("hostel_blocks", [])
    total_blocks = max(len(blocks), 1)
    down_blocks = sum(
        1 for b in blocks
        if b["block_id"] in disrupted or b.get("water_dependency_id") in disrupted or b.get("power_dependency_id") in disrupted
    )
    hostel_stability = max(0.0, round(100.0 * (1.0 - down_blocks / total_blocks), 2))

    # 6. Infrastructure stability
    infra = snapshot.get("infrastructure", [])
    total_infra = max(len(infra), 1)
    down_infra = sum(1 for i in infra if i["infra_id"] in disrupted or i["operational_status"] != "Operational")
    infrastructure_stability = max(0.0, round(100.0 * (1.0 - down_infra / total_infra), 2))

    # 7. Active conflict score (100 minus severity-weighted penalty)
    sev_weights = {"Critical": 12.0, "High": 7.0, "Medium": 4.0, "Low": 1.5}
    open_conflicts = [c for c in conflicts if c.get("resolution_status", "Open") == "Open"]
    raw_penalty = sum(sev_weights.get(c.get("severity", "Medium"), 4.0) for c in open_conflicts)
    conflict_score = max(0.0, round(100.0 - min(raw_penalty, 100.0), 2))

    # 8. Recovery readiness (available backups vs total backups)
    backups = snapshot.get("backup_resources", [])
    avail_backups = sum(1 for b in backups if b.get("availability_status") == "Available")
    recovery_readiness = round(100.0 * (avail_backups / max(len(backups), 1)), 2)

    overall = (
        w["academic_continuity"] * academic_continuity
        + w["resource_availability"] * resource_availability
        + w["exam_readiness"] * exam_readiness
        + w["transport_reliability"] * transport_reliability
        + w["hostel_stability"] * hostel_stability
        + w["infrastructure_stability"] * infrastructure_stability
        + w["conflict_penalty"] * conflict_score
    )
    overall = round(max(0.0, min(100.0, overall)), 2)

    return {
        "overall_score": overall,
        "operational_stability": round((infrastructure_stability + resource_availability) / 2.0, 2),
        "academic_continuity": academic_continuity,
        "resource_availability": resource_availability,
        "exam_readiness": exam_readiness,
        "transport_reliability": transport_reliability,
        "hostel_stability": hostel_stability,
        "infrastructure_stability": infrastructure_stability,
        "conflict_health": conflict_score,
        "recovery_readiness": recovery_readiness,
        "open_conflict_count": len(open_conflicts),
        "weights_used": w,
        "context_label": context_label,
        "is_model_estimate": True,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
    }
