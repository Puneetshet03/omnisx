"""OMNIS-X FastAPI REST API Router."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from fastapi import APIRouter, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
import numpy as np

from app.engines.assistant_engine import answer_institutional_query
from app.engines.cascade_engine import (
    INCIDENT_COMPATIBLE_TYPES,
    ResourceCompatibilityError,
    ResourceNotFoundError,
    run_cascading_simulation,
)
from app.engines.conflict_engine import detect_all_conflicts
from app.engines.dependency_engine import (
    build_dependency_graph,
    export_graph_payload,
    get_student_dependency_network,
)
from app.engines.health_engine import compute_institutional_health
from app.engines.optimization_engine import generate_recovery_plans
from app.engines.risk_engine import analyze_institutional_risk
from app.realtime import ws_manager
from app.repositories.twin_repository import repo
from app.schemas.models import (
    AssistantQueryRequest,
    AuthDemoRequest,
    AuthFirebaseRequest,
    AuthLoginRequest,
    AuthRegisterRequest,
    HealthWeightsUpdate,
    IncidentCreateRequest,
    RecoveryApplyRequest,
    RecoveryCompareRequest,
    RecoveryOptimizeRequest,
    SimulationCompareRequest,
    SimulationRequest,
)

router = APIRouter(prefix="/api", tags=["OMNIS-X API"])


def _can_view_pii(role: str) -> bool:
    return role in ("admin", "faculty", "coordinator")


def _require_privileged(role: str) -> None:
    if role not in ("admin", "coordinator"):
        raise HTTPException(
            status_code=403,
            detail=f"Role '{role}' is read-only and cannot modify baseline institutional data or apply recovery actions.",
        )


# ============================================================
# DASHBOARD, HEALTH & ANALYTICS
# ============================================================


@router.get("/dashboard")
def get_dashboard(x_user_role: str = Header(default="admin")):
    snapshot = repo.get_baseline_snapshot()
    students = snapshot["students"]
    conflicts = detect_all_conflicts(snapshot)
    repo.set_conflicts(conflicts)
    health = compute_institutional_health(snapshot, conflicts, weights=repo.get_health_weights())
    repo.record_health(health)

    g = build_dependency_graph(snapshot)
    risk = analyze_institutional_risk(snapshot, g, conflicts)

    valid_cgpas = [s["cgpa"] for s in students if s["cgpa"] is not None]
    avg_attendance = round(float(np.mean([s["attendance_percent"] for s in students])), 2) if students else 0.0
    avg_cgpa = round(float(np.mean(valid_cgpas)), 2) if valid_cgpas else None

    latest_sim = repo.get_active_simulation()
    historical_summary = repo.get_historical_affected_summary()

    return {
        "db_status": repo.get_db_status(),
        "kpis": {
            "total_students": len(students),
            "total_departments": len(snapshot["departments"]),
            "total_faculty": len(snapshot["faculty"]),
            "total_classrooms": len(snapshot["classrooms"]),
            "total_laboratories": len(snapshot["laboratories"]),
            "total_hostel_rooms": len(snapshot["hostel_rooms"]),
            "total_bus_routes": len([r for r in snapshot["bus_routes"] if r.get("is_college_bus")]),
            "active_conflicts": len(conflicts),
            "critical_incidents": len([i for i in repo.get_incidents() if i["severity"] == "Critical" and i["status"] == "Active"]),
            "affected_students": latest_sim["currently_affected_student_count"] if latest_sim else 0,
            "historical_affected_students": historical_summary["historical_affected_count"],
            "available_backups": len([b for b in snapshot["backup_resources"] if b["availability_status"] == "Available"]),
            "institutional_health_index": health["overall_score"],
            "academic_continuity": health["academic_continuity"],
            "recovery_readiness": health["recovery_readiness"],
            "average_attendance": avg_attendance,
            "average_cgpa": avg_cgpa,
            "cgpa_valid_observations": len(valid_cgpas),
        },
        "health": health,
        "recent_conflicts": conflicts[:6],
        "incidents": repo.get_incidents()[:6],
        "department_risk": risk["department_risk_heatmap"],
        "spof_count": len(risk["single_points_of_failure"]),
        "dataset_metadata": {
            "student_source": "imported_csv (omnis_x_200_students(1).csv)",
            "supporting_resources_source": "synthetic_supporting + derived_from_csv",
        },
    }


@router.get("/health-index")
def get_health_index():
    snapshot = repo.get_baseline_snapshot()
    conflicts = detect_all_conflicts(snapshot)
    current = compute_institutional_health(snapshot, conflicts, weights=repo.get_health_weights())
    return {
        "current": current,
        "history": repo.get_health_history(),
        "weights": repo.get_health_weights(),
    }


@router.post("/health-index/weights")
def update_health_weights(payload: HealthWeightsUpdate, x_user_role: str = Header(default="admin")):
    _require_privileged(x_user_role)
    total = (
        payload.academic_continuity
        + payload.resource_availability
        + payload.exam_readiness
        + payload.transport_reliability
        + payload.hostel_stability
        + payload.infrastructure_stability
        + payload.conflict_penalty
    )
    if abs(total - 1.0) > 0.05:
        raise HTTPException(status_code=422, detail=f"Health weights must sum to ~1.0 (got {total:.3f}).")
    updated = repo.update_health_weights(payload.model_dump())
    ws_manager.broadcast_sync("health_weights", "updated")
    return {"weights": updated}


@router.get("/analytics")
def get_analytics():
    snapshot = repo.get_baseline_snapshot()
    students = snapshot["students"]
    conflicts = detect_all_conflicts(snapshot)
    g = build_dependency_graph(snapshot)
    risk = analyze_institutional_risk(snapshot, g, conflicts)

    dept_counts = Counter(s["department"] for s in students)
    sem_counts = Counter(s["semester"] for s in students)
    res_counts = Counter(s["residence_type"] for s in students)
    exam_counts = Counter(s["exam_status"] for s in students)
    place_counts = Counter(s["placement_status"] for s in students)

    # Attendance buckets
    att_buckets = {"<75%": 0, "75-84%": 0, "85-94%": 0, "95-100%": 0}
    for s in students:
        a = s["attendance_percent"]
        if a < 75:
            att_buckets["<75%"] += 1
        elif a < 85:
            att_buckets["75-84%"] += 1
        elif a < 95:
            att_buckets["85-94%"] += 1
        else:
            att_buckets["95-100%"] += 1

    # CGPA buckets (excluding NULLs honestly)
    valid_cgpas = [s["cgpa"] for s in students if s["cgpa"] is not None]
    cgpa_buckets = {"<6.5": 0, "6.5-7.4": 0, "7.5-8.4": 0, "8.5-10.0": 0}
    for c in valid_cgpas:
        if c < 6.5:
            cgpa_buckets["<6.5"] += 1
        elif c < 7.5:
            cgpa_buckets["6.5-7.4"] += 1
        elif c < 8.5:
            cgpa_buckets["7.5-8.4"] += 1
        else:
            cgpa_buckets["8.5-10.0"] += 1

    sev_counts = Counter(c["severity"] for c in conflicts)

    return {
        "department_distribution": [{"department": k, "count": v} for k, v in sorted(dept_counts.items())],
        "semester_distribution": [{"semester": f"Sem {k}", "count": v} for k, v in sorted(sem_counts.items())],
        "residence_distribution": [{"type": k, "count": v} for k, v in res_counts.items()],
        "exam_status_distribution": [{"status": k, "count": v} for k, v in exam_counts.items()],
        "placement_status_distribution": [{"status": k, "count": v} for k, v in place_counts.items()],
        "attendance_distribution": [{"range": k, "count": v} for k, v in att_buckets.items()],
        "cgpa_distribution": [{"range": k, "count": v} for k, v in cgpa_buckets.items()],
        "cgpa_stats": {
            "valid_observations": len(valid_cgpas),
            "missing_observations": len(students) - len(valid_cgpas),
            "average": round(float(np.mean(valid_cgpas)), 3) if valid_cgpas else None,
        },
        "conflict_severity_distribution": [{"severity": k, "count": v} for k, v in sev_counts.items()],
        "department_risk": risk["department_risk_heatmap"],
        "health_history": repo.get_health_history(),
    }


# ============================================================
# STUDENTS MODULE
# ============================================================


@router.get("/students")
def list_students(
    search: Optional[str] = None,
    department: Optional[str] = None,
    semester: Optional[int] = None,
    section: Optional[str] = None,
    residence_type: Optional[str] = None,
    exam_status: Optional[str] = None,
    placement_status: Optional[str] = None,
    cgpa_available: Optional[bool] = None,
    min_attendance: Optional[float] = None,
    sort_by: str = "student_id",
    sort_dir: str = "asc",
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    x_user_role: str = Header(default="admin"),
):
    students = repo.get_students(include_pii=_can_view_pii(x_user_role))
    filtered = students

    if search:
        q = search.strip().lower()
        filtered = [
            s
            for s in filtered
            if q in s["student_name"].lower()
            or q in s["student_id"].lower()
            or q in s["usn"].lower()
        ]
    if department:
        filtered = [s for s in filtered if s["department"] == department]
    if semester is not None:
        filtered = [s for s in filtered if s["semester"] == semester]
    if section:
        filtered = [s for s in filtered if s["section"] == section]
    if residence_type:
        filtered = [s for s in filtered if s["residence_type"] == residence_type]
    if exam_status:
        filtered = [s for s in filtered if s["exam_status"] == exam_status]
    if placement_status:
        filtered = [s for s in filtered if s["placement_status"] == placement_status]
    if cgpa_available is not None:
        filtered = [s for s in filtered if (s["cgpa"] is not None) == cgpa_available]
    if min_attendance is not None:
        filtered = [s for s in filtered if s["attendance_percent"] >= min_attendance]

    reverse = sort_dir.lower() == "desc"
    filtered.sort(key=lambda s: (s.get(sort_by) is None, s.get(sort_by) or ""), reverse=reverse)

    total = len(filtered)
    start = (page - 1) * page_size
    items = filtered[start : start + page_size]

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
        "pii_redacted": not _can_view_pii(x_user_role),
        "items": items,
    }


@router.get("/students/{student_id}")
def get_student_detail(student_id: str, x_user_role: str = Header(default="admin")):
    student = repo.get_student(student_id, include_pii=_can_view_pii(x_user_role))
    if not student:
        raise HTTPException(status_code=404, detail=f"Student {student_id} not found")
    return student


@router.get("/students/{student_id}/dependencies")
def get_student_dependencies(student_id: str, x_user_role: str = Header(default="admin")):
    student = repo.get_student(student_id, include_pii=False)
    if not student:
        raise HTTPException(status_code=404, detail=f"Student {student_id} not found")
    snapshot = repo.get_baseline_snapshot()
    g = build_dependency_graph(snapshot)
    return get_student_dependency_network(student, snapshot, g)


@router.get("/students/{student_id}/incidents")
def get_student_incidents(student_id: str):
    student = repo.get_student(student_id, include_pii=False)
    if not student:
        raise HTTPException(status_code=404, detail=f"Student {student_id} not found")
    impacts = []
    for sim in repo.get_simulations():
        match = next((s for s in sim["affected_students"] if s["student_id"] == student_id), None)
        if match:
            impacts.append(
                {
                    "simulation_id": sim["simulation_id"],
                    "scenario_name": sim["scenario_name"],
                    "root_resource_id": sim["root_resource_id"],
                    "severity": sim["severity"],
                    "impact_reasons": match["impact_reasons"],
                    "created_at": sim["created_at"],
                }
            )
    return {"student_id": student_id, "simulation_impacts": impacts}


# ============================================================
# INSTITUTIONAL RESOURCES
# ============================================================


@router.get("/departments")
def get_departments():
    snapshot = repo.get_baseline_snapshot()
    students = snapshot["students"]
    depts = snapshot["departments"]
    for d in depts:
        ds = [s for s in students if s["department"] == d["department_code"]]
        d["student_count"] = len(ds)
        d["groups"] = [g for g in snapshot["academic_groups"] if g["department"] == d["department_code"]]
    return {"items": depts}


@router.get("/faculty")
def get_faculty():
    snapshot = repo.get_baseline_snapshot()
    students = snapshot["students"]
    mentor_counts = Counter(s["mentor_id"] for s in students)
    items = snapshot["faculty"]
    for f in items:
        f["mentee_count"] = mentor_counts.get(f["faculty_id"], 0)
    return {"items": items}


@router.get("/classrooms")
def get_classrooms():
    snapshot = repo.get_baseline_snapshot()
    stu_counts = Counter(s["classroom_id"] for s in snapshot["students"])
    items = snapshot["classrooms"]
    for c in items:
        c["assigned_students"] = stu_counts.get(c["classroom_id"], 0)
    return {"items": items}


@router.get("/laboratories")
def get_laboratories():
    snapshot = repo.get_baseline_snapshot()
    stu_counts = Counter(s["lab_id"] for s in snapshot["students"])
    equip_by_lab: Dict[str, List[Dict[str, Any]]] = {}
    for eq in snapshot["laboratory_equipment"]:
        equip_by_lab.setdefault(eq["lab_id"], []).append(eq)
    items = snapshot["laboratories"]
    for l in items:
        l["assigned_students"] = stu_counts.get(l["lab_id"], 0)
        l["equipment"] = equip_by_lab.get(l["lab_id"], [])
    return {"items": items}


@router.get("/timetable")
def get_timetable(department: Optional[str] = None):
    items = repo.get_table("timetable")
    if department:
        items = [t for t in items if t["academic_group_id"].startswith(f"GRP-{department}-")]
    return {"items": items}


@router.get("/examinations")
def get_examinations():
    snapshot = repo.get_baseline_snapshot()
    return {
        "halls": snapshot["exam_halls"],
        "examinations": snapshot["examinations"],
    }


@router.get("/transportation")
def get_transportation():
    snapshot = repo.get_baseline_snapshot()
    route_counts = Counter(s["bus_route"] for s in snapshot["students"] if s.get("bus_route"))
    routes = snapshot["bus_routes"]
    for r in routes:
        r["assigned_students"] = route_counts.get(r["route_id"], 0)
    return {
        "routes": routes,
        "buses": snapshot["buses"],
        "drivers": snapshot["drivers"],
    }


@router.get("/hostels")
def get_hostels():
    snapshot = repo.get_baseline_snapshot()
    return {
        "blocks": snapshot["hostel_blocks"],
        "rooms": snapshot["hostel_rooms"],
        "services": snapshot["hostel_services"],
        "total_hostel_residents": sum(1 for s in snapshot["students"] if s["residence_type"] == "Hostel"),
    }


@router.get("/placements")
def get_placements():
    snapshot = repo.get_baseline_snapshot()
    status_counts = Counter(s["placement_status"] for s in snapshot["students"])
    return {
        "drives": snapshot["placement_drives"],
        "status_summary": dict(status_counts),
    }


@router.get("/events")
def get_events():
    snapshot = repo.get_baseline_snapshot()
    return {
        "venues": snapshot["event_venues"],
        "events": snapshot["events"],
    }


@router.get("/infrastructure")
def get_infrastructure():
    snapshot = repo.get_baseline_snapshot()
    return {
        "infrastructure": snapshot["infrastructure"],
        "power_supply": snapshot["power_supply"],
        "backup_generators": snapshot["backup_generators"],
        "network_resources": snapshot["network_resources"],
        "water_supply": snapshot["water_supply"],
        "backup_resources": snapshot["backup_resources"],
        "maintenance_records": snapshot["maintenance_records"],
    }


@router.get("/campus")
def get_campus_3d_state():
    """Return 3D campus building mappings tied directly to live institutional resource IDs."""
    snapshot = repo.get_baseline_snapshot()
    students = snapshot["students"]
    active_sim = repo.get_active_simulation()
    sim_bldg = active_sim["building_statuses"] if active_sim else {}

    dept_stu = Counter(s["department"] for s in students)
    buildings = [
        {"building_id": "BLDG-CSE", "name": "CSE Academic & Lab Block", "category": "Department", "department": "CSE", "resource_ids": ["PWR-ACAD-A", "LAB-CSE-1", "LAB-CSE-2"], "position": [-12, 0, -6], "size": [7, 5, 5], "student_count": dept_stu["CSE"], "status": sim_bldg.get("BLDG-CSE", "Operational")},
        {"building_id": "BLDG-ISE", "name": "ISE Innovation & Data Wing", "category": "Department", "department": "ISE", "resource_ids": ["PWR-ACAD-A", "LAB-ISE-1", "LAB-ISE-2"], "position": [-2, 0, -8], "size": [6.5, 4.5, 5], "student_count": dept_stu["ISE"], "status": sim_bldg.get("BLDG-ISE", "Operational")},
        {"building_id": "BLDG-ECE", "name": "ECE VLSI & IoT Block", "category": "Department", "department": "ECE", "resource_ids": ["PWR-ACAD-B", "LAB-ECE-1", "LAB-ECE-2"], "position": [8, 0, -6], "size": [7, 4.5, 5], "student_count": dept_stu["ECE"], "status": sim_bldg.get("BLDG-ECE", "Operational")},
        {"building_id": "BLDG-ME", "name": "Mechanical & Robotics Complex", "category": "Department", "department": "ME", "resource_ids": ["PWR-ACAD-B", "LAB-ME-1", "LAB-ME-2"], "position": [15, 0, 2], "size": [7, 4, 6], "student_count": dept_stu["ME"], "status": sim_bldg.get("BLDG-ME", "Operational")},
        {"building_id": "BLDG-CV", "name": "Civil & Geomatics Block", "category": "Department", "department": "CV", "resource_ids": ["PWR-ACAD-B", "LAB-CV-1", "LAB-CV-2"], "position": [12, 0, 11], "size": [6.5, 4, 5], "student_count": dept_stu["CV"], "status": sim_bldg.get("BLDG-CV", "Operational")},
        {"building_id": "BLDG-ADMIN", "name": "Central Administration & Command", "category": "Administration", "department": "ADMIN", "resource_ids": ["NET-CORE"], "position": [0, 0, 0], "size": [7, 6, 6], "student_count": len(students), "status": sim_bldg.get("BLDG-ADMIN", "Operational")},
        {"building_id": "BLDG-EXAM", "name": "Digital Examination Centre", "category": "Examination", "department": "EXAM", "resource_ids": ["HALL-EXAM-1", "HALL-EXAM-2", "NET-EXAM"], "position": [-10, 0, 3], "size": [6, 4.2, 5], "student_count": 100, "status": sim_bldg.get("BLDG-EXAM", "Operational")},
        {"building_id": "BLDG-SEMINAR", "name": "Seminar Hall & Auditorium", "category": "Events", "department": "ADMIN", "resource_ids": ["HALL-SEMINAR", "VENUE-SEMINAR-1"], "position": [-3, 0, 9], "size": [7, 4.8, 5.5], "student_count": 150, "status": sim_bldg.get("BLDG-SEMINAR", "Operational")},
        {"building_id": "BLDG-PLACE", "name": "Career & Placement Centre", "category": "Placement", "department": "PLACEMENT", "resource_ids": ["VENUE-PLACE-1", "PLC-01", "PLC-02"], "position": [5, 0, 8], "size": [5.5, 3.8, 4.5], "student_count": 50, "status": sim_bldg.get("BLDG-PLACE", "Operational")},
        {"building_id": "BLDG-HOSTEL-N", "name": "North Scholars Hostel", "category": "Hostel", "department": "HOSTEL", "resource_ids": ["HB-NORTH", "WTR-HOSTEL", "PWR-HOSTEL"], "position": [-18, 0, 11], "size": [6, 6.5, 5], "student_count": 40, "status": sim_bldg.get("BLDG-HOSTEL-N", "Operational")},
        {"building_id": "BLDG-HOSTEL-S", "name": "South Engineering Hostel", "category": "Hostel", "department": "HOSTEL", "resource_ids": ["HB-SOUTH", "WTR-HOSTEL", "PWR-HOSTEL"], "position": [-10, 0, 14], "size": [6, 6, 5], "student_count": 25, "status": sim_bldg.get("BLDG-HOSTEL-S", "Operational")},
        {"building_id": "BLDG-TRANS", "name": "Campus Transport Bay", "category": "Transport", "department": "TRANSPORT", "resource_ids": ["BUS-01", "BUS-02", "BUS-03", "BUS-04"], "position": [16, 0, -13], "size": [8, 2.2, 5], "student_count": 135, "status": sim_bldg.get("BLDG-TRANS", "Operational")},
        {"building_id": "BLDG-POWER", "name": "Main Electrical Substation", "category": "Infrastructure", "department": "INFRA", "resource_ids": ["PWR-ACAD-A", "PWR-ACAD-B", "PWR-HOSTEL"], "position": [-18, 0, -13], "size": [5, 3.2, 4.5], "student_count": 0, "status": sim_bldg.get("BLDG-POWER", "Operational")},
        {"building_id": "BLDG-GEN", "name": "Backup Diesel Generator Yard", "category": "Infrastructure", "department": "INFRA", "resource_ids": ["GEN-01", "GEN-02"], "position": [-12, 0, -14], "size": [4.5, 2.8, 4], "student_count": 0, "status": sim_bldg.get("BLDG-GEN", "Operational")},
        {"building_id": "BLDG-NET", "name": "Campus Fiber NOC & Data Core", "category": "Infrastructure", "department": "INFRA", "resource_ids": ["NET-CORE", "NET-EXAM"], "position": [-5, 0, -14], "size": [4.5, 3.5, 4], "student_count": 0, "status": sim_bldg.get("BLDG-NET", "Operational")},
        {"building_id": "BLDG-WATER", "name": "Water Overhead & Sump Plant", "category": "Infrastructure", "department": "INFRA", "resource_ids": ["WTR-HOSTEL"], "position": [-18, 0, 3], "size": [4, 4.5, 4], "student_count": 0, "status": sim_bldg.get("BLDG-WATER", "Operational")},
    ]

    connections = [
        {"from": "BLDG-POWER", "to": "BLDG-CSE", "type": "Power"},
        {"from": "BLDG-POWER", "to": "BLDG-ISE", "type": "Power"},
        {"from": "BLDG-POWER", "to": "BLDG-NET", "type": "Power"},
        {"from": "BLDG-POWER", "to": "BLDG-ECE", "type": "Power"},
        {"from": "BLDG-POWER", "to": "BLDG-ME", "type": "Power"},
        {"from": "BLDG-POWER", "to": "BLDG-CV", "type": "Power"},
        {"from": "BLDG-POWER", "to": "BLDG-WATER", "type": "Power"},
        {"from": "BLDG-GEN", "to": "BLDG-POWER", "type": "Backup"},
        {"from": "BLDG-NET", "to": "BLDG-EXAM", "type": "Network"},
        {"from": "BLDG-NET", "to": "BLDG-PLACE", "type": "Network"},
        {"from": "BLDG-NET", "to": "BLDG-ADMIN", "type": "Network"},
        {"from": "BLDG-WATER", "to": "BLDG-HOSTEL-N", "type": "Water"},
        {"from": "BLDG-WATER", "to": "BLDG-HOSTEL-S", "type": "Water"},
    ]

    return {"buildings": buildings, "connections": connections}


# ============================================================
# INTELLIGENCE ENGINES
# ============================================================


@router.get("/dependencies")
def get_dependencies(department: Optional[str] = None, resource_type: Optional[str] = None):
    snapshot = repo.get_baseline_snapshot()
    g = build_dependency_graph(snapshot)
    return export_graph_payload(g, department=department, resource_type=resource_type)


@router.get("/conflicts")
def get_conflicts():
    snapshot = repo.get_baseline_snapshot()
    conflicts = detect_all_conflicts(snapshot)
    repo.set_conflicts(conflicts)
    return {"total": len(conflicts), "items": conflicts}


@router.post("/conflicts/detect")
def run_conflict_detection():
    snapshot = repo.get_baseline_snapshot()
    conflicts = detect_all_conflicts(snapshot)
    repo.set_conflicts(conflicts)
    return {"detected_at": datetime.now(timezone.utc).isoformat(), "total": len(conflicts), "items": conflicts}


@router.get("/risk-analysis")
def get_risk_analysis():
    snapshot = repo.get_baseline_snapshot()
    g = build_dependency_graph(snapshot)
    conflicts = detect_all_conflicts(snapshot)
    return analyze_institutional_risk(snapshot, g, conflicts)


@router.get("/critical-resources")
def get_critical_resources():
    snapshot = repo.get_baseline_snapshot()
    g = build_dependency_graph(snapshot)
    conflicts = detect_all_conflicts(snapshot)
    risk = analyze_institutional_risk(snapshot, g, conflicts)
    return {
        "critical_resources": risk["top_critical_resources"],
        "spof": risk["single_points_of_failure"],
    }


# ============================================================
# CASCADING FAILURE SIMULATION
# ============================================================


@router.get("/simulations/compatibility")
def get_simulation_compatibility():
    """Return compatible target resource IDs for each supported incident type."""
    snapshot = repo.get_baseline_snapshot()
    g = build_dependency_graph(snapshot)
    compatible_resources: Dict[str, List[Dict[str, str]]] = {}
    for inc_type, allowed_types in INCIDENT_COMPATIBLE_TYPES.items():
        items = [
            {
                "resource_id": nid,
                "resource_name": data.get("resource_name", nid),
                "resource_type": data.get("resource_type", "Resource"),
                "department": data.get("department", "INST"),
            }
            for nid, data in sorted(g.nodes(data=True))
            if data.get("resource_type") in allowed_types
        ]
        compatible_resources[inc_type] = items
    return {
        "incident_compatible_types": {k: sorted(v) for k, v in INCIDENT_COMPATIBLE_TYPES.items()},
        "compatible_resources": compatible_resources,
    }


@router.post("/simulations")
def create_simulation(payload: SimulationRequest):
    snapshot = repo.get_baseline_snapshot()
    try:
        sim = run_cascading_simulation(
            snapshot=snapshot,
            incident_type=payload.incident_type,
            root_resource_id=payload.affected_resource_id,
            severity=payload.severity,
            duration_minutes=payload.duration_minutes,
            horizon_minutes=payload.horizon_minutes,
            use_backups=payload.use_backups,
            scenario_name=payload.scenario_name,
            health_weights=repo.get_health_weights(),
            recovery_priority=payload.recovery_priority,
        )
    except ResourceCompatibilityError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except (ResourceNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    repo.save_simulation(sim)
    ws_manager.broadcast_sync("simulations", "created", simulation_id=sim["simulation_id"])
    return sim


@router.get("/simulations")
def list_simulations():
    active_sim = repo.get_active_simulation()
    historical = repo.get_historical_affected_summary()
    return {
        "items": repo.get_simulations(),
        "active_simulation_id": active_sim["simulation_id"] if active_sim else None,
        "historical_affected_count": historical["historical_affected_count"],
        "historical_affected_students": historical["historical_affected_students"],
        "historical_simulations_count": historical["historical_simulations_count"],
    }


@router.get("/simulations/{sim_id}")
def get_simulation(sim_id: str):
    sim = repo.get_simulation(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail=f"Simulation {sim_id} not found")
    return sim


@router.get("/simulations/{sim_id}/events")
def get_simulation_events(sim_id: str):
    sim = repo.get_simulation(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail=f"Simulation {sim_id} not found")
    return {"simulation_id": sim_id, "events": sim["timeline_events"]}


@router.get("/simulations/{sim_id}/affected-students")
def get_simulation_affected_students(sim_id: str):
    sim = repo.get_simulation(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail=f"Simulation {sim_id} not found")
    return {
        "simulation_id": sim_id,
        "count": sim["affected_student_count"],
        "students": sim["affected_students"],
    }


@router.post("/simulations/{sim_id}/reset")
def reset_simulation(sim_id: str):
    sim = repo.reset_simulation(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail=f"Simulation {sim_id} not found")
    ws_manager.broadcast_sync("simulations", "reset", simulation_id=sim_id)
    return {"status": "reset", "message": "Simulation reset; baseline institutional data preserved.", "simulation": sim}


@router.post("/simulations/compare")
def compare_simulations(payload: SimulationCompareRequest):
    snapshot = repo.get_baseline_snapshot()
    results = []
    for req in payload.scenarios:
        try:
            sim = run_cascading_simulation(
                snapshot=snapshot,
                incident_type=req.incident_type,
                root_resource_id=req.affected_resource_id,
                severity=req.severity,
                duration_minutes=req.duration_minutes,
                horizon_minutes=req.horizon_minutes,
                use_backups=req.use_backups,
                scenario_name=req.scenario_name,
                health_weights=repo.get_health_weights(),
                recovery_priority=req.recovery_priority,
            )
            results.append(
                {
                    "scenario_name": sim["scenario_name"],
                    "root_resource_id": sim["root_resource_id"],
                    "severity": sim["severity"],
                    "use_backups": sim["use_backups"],
                    "affected_resources": len(sim["affected_resources"]),
                    "affected_students": sim["affected_student_count"],
                    "baseline_health": sim["baseline_health"]["overall_score"],
                    "post_failure_health": sim["post_failure_health"]["overall_score"],
                    "health_drop": sim["health_drop"],
                    "simulation_id": sim["simulation_id"],
                }
            )
        except ResourceCompatibilityError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        except (ResourceNotFoundError, ValueError) as exc:
            raise HTTPException(status_code=404, detail=str(exc))
    return {"comparisons": results}


# ============================================================
# RECOVERY OPTIMIZER (OR-TOOLS CP-SAT)
# ============================================================


@router.post("/recovery/optimize")
def optimize_recovery(payload: RecoveryOptimizeRequest):
    sim = repo.get_simulation(payload.simulation_id)
    if not sim:
        raise HTTPException(status_code=404, detail=f"Simulation {payload.simulation_id} not found")

    snapshot = repo.get_baseline_snapshot()
    plans = generate_recovery_plans(
        snapshot=snapshot,
        simulation=sim,
        max_budget=payload.max_budget,
        max_duration_minutes=payload.max_duration_minutes,
        solver_time_limit_seconds=payload.solver_time_limit_seconds,
    )
    repo.save_recovery_plans(plans)
    ws_manager.broadcast_sync("recovery_plans", "optimized", simulation_id=payload.simulation_id)
    return {"simulation_id": payload.simulation_id, "plans": plans}


@router.get("/recovery/plans/{plan_id}")
def get_recovery_plan(plan_id: str):
    plan = repo.get_recovery_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail=f"Recovery plan {plan_id} not found")
    return plan


@router.post("/recovery/apply")
def apply_recovery(payload: RecoveryApplyRequest, x_user_role: str = Header(default="admin")):
    _require_privileged(x_user_role)
    try:
        plan = repo.apply_recovery_plan(
            plan_id=payload.plan_id,
            actor=payload.approver_name,
            role=x_user_role,
            notes=payload.notes,
            simulation_id=payload.simulation_id,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    updated_sim = repo.get_simulation(plan.get("simulation_id", ""))
    ws_manager.broadcast_sync("recovery_plans", "applied", simulation_id=plan.get("simulation_id"))
    return {
        "status": "applied",
        "plan": plan,
        "simulation": updated_sim,
        "message": f"{plan['plan_label']} ({plan['strategy_name']}) applied successfully.",
    }


@router.post("/recovery/compare")
def compare_recovery(payload: RecoveryCompareRequest):
    plans = []
    for pid in payload.plan_ids:
        p = repo.get_recovery_plan(pid)
        if p:
            plans.append(p)
    if not plans:
        raise HTTPException(status_code=404, detail="No matching recovery plans found")
    return {"plans": plans}


@router.post("/operation-zero-failure")
def run_operation_zero_failure():
    """One-click demonstration: triggers North Grid electrical substation failure, propagates cascades, and solves CP-SAT recovery."""
    snapshot = repo.get_baseline_snapshot()
    sim = run_cascading_simulation(
        snapshot=snapshot,
        incident_type="electricity_failure",
        root_resource_id="PWR-ACAD-A",
        severity="Critical",
        duration_minutes=120,
        horizon_minutes=180,
        use_backups=False,  # Show full unbuffered cascade first so recovery optimizer demonstrates backup activation
        scenario_name="Operation Zero Failure — North Grid Substation Outage",
        health_weights=repo.get_health_weights(),
    )
    repo.save_simulation(sim)
    plans = generate_recovery_plans(snapshot=snapshot, simulation=sim)
    repo.save_recovery_plans(plans)
    ws_manager.broadcast_sync("operation_zero_failure", "completed", simulation_id=sim["simulation_id"])
    return {
        "simulation": sim,
        "recovery_plans": plans,
    }


# ============================================================
# ADMINISTRATION, INCIDENTS, NOTIFICATIONS & ASSISTANT
# ============================================================


@router.get("/incidents")
def list_incidents():
    return {"items": repo.get_incidents()}


@router.post("/incidents")
def create_incident(payload: IncidentCreateRequest, x_user_role: str = Header(default="admin")):
    _require_privileged(x_user_role)
    incident = {
        "incident_id": f"INC-{str(uuid.uuid4())[:8].upper()}",
        "incident_type": payload.incident_type,
        "affected_resource_id": payload.affected_resource_id,
        "severity": payload.severity,
        "title": payload.title,
        "description": payload.description,
        "status": "Active",
        "reported_by": "Command Centre Admin",
        "reported_at": datetime.now(timezone.utc).isoformat(),
        "resolved_at": None,
    }
    created = repo.add_incident(incident)
    ws_manager.broadcast_sync("incidents", "created")
    return created


@router.get("/notifications")
def list_notifications():
    return {"items": repo.get_notifications()}


@router.get("/audit-logs")
def list_audit_logs(x_user_role: str = Header(default="admin")):
    _require_privileged(x_user_role)
    return {"items": repo.get_audit_logs()}


@router.get("/system/status")
def get_system_status():
    return {
        "service": "OMNIS-X Institutional Digital Twin API",
        "version": "1.0.0",
        "status": "online",
        "database": repo.get_db_status(),
        "realtime_transport": "FastAPI WebSocket (/api/ws)",
        "engines": {
            "dependency_graph": "NetworkX DiGraph",
            "conflict_detector": "Rule-Based Constraint Validator",
            "cascade_simulator": "Deterministic Event-Driven Queue",
            "recovery_optimizer": "Google OR-Tools CP-SAT",
            "health_scorer": "Weighted Normalized Index",
        },
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/auth/login")
def login(payload: AuthLoginRequest):
    session = repo.authenticate_user(payload.identifier, payload.password)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid username/email or password.")
    return session


@router.post("/auth/demo")
def demo_login(payload: AuthDemoRequest):
    return repo.demo_login(payload.demo_role)


@router.post("/auth/firebase")
def firebase_login(payload: AuthFirebaseRequest):
    return repo.firebase_login(
        uid=payload.uid,
        email=payload.email,
        display_name=payload.display_name,
        role=payload.role,
        provider=payload.provider,
    )


@router.post("/auth/register")
def register(payload: AuthRegisterRequest):
    try:
        return repo.register_user(
            username=payload.username,
            email=payload.email,
            password=payload.password,
            role=payload.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


@router.get("/auth/me")
def get_current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    token = authorization.split(" ", 1)[1].strip()
    user = repo.get_session(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")
    return {"user": user}


@router.websocket("/ws")
async def websocket_sync(websocket: WebSocket):
    """Real-time FastAPI WebSocket stream for live frontend synchronization."""
    await ws_manager.connect(websocket)
    try:
        await websocket.send_json(
            {
                "event": "connected",
                "transport": "fastapi_websocket",
                "timestamp_utc": datetime.now(timezone.utc).isoformat(),
            }
        )
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_json(
                    {
                        "event": "pong",
                        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
                    }
                )
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


@router.post("/assistant/query")
def query_assistant(payload: AssistantQueryRequest):
    snapshot = repo.get_baseline_snapshot()
    sim = repo.get_simulation(payload.simulation_id) if payload.simulation_id else None
    if sim is None and repo.get_simulations():
        sim = repo.get_simulations()[0]
    plans = repo.get_plans_for_simulation(sim["simulation_id"]) if sim else []
    return answer_institutional_query(
        question=payload.question,
        snapshot=snapshot,
        latest_simulation=sim,
        latest_plans=plans,
    )
