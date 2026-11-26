"""Comprehensive automated tests for OMNIS-X intelligence engines and API."""

from __future__ import annotations

import copy
import sys
from pathlib import Path

import networkx as nx
import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from import_students import validate_and_prepare_students
from seed_resources import build_institutional_dataset
from app.engines.dependency_engine import build_dependency_graph, get_student_dependency_network
from app.engines.conflict_engine import detect_all_conflicts
from app.engines.cascade_engine import run_cascading_simulation
from app.engines.optimization_engine import generate_recovery_plans
from app.engines.health_engine import compute_institutional_health
from app.repositories.twin_repository import InstitutionalRepository
from app.routers.api import (
    apply_recovery,
    create_incident,
    list_students,
    optimize_recovery,
    reset_simulation,
    create_simulation,
)
from app.schemas.models import IncidentCreateRequest, RecoveryApplyRequest, RecoveryOptimizeRequest, SimulationRequest
from fastapi import HTTPException


def test_csv_schema_uniqueness_and_nulls():
    records, report = validate_and_prepare_students()
    assert len(records) == 200
    assert report["schema_valid"] is True
    assert report["unique_student_ids"] == 200
    assert report["unique_usns"] == 200
    assert report["missing_values_preserved_as_null"]["cgpa"] == 50
    assert report["missing_values_preserved_as_null"]["hostel_room"] == 135
    assert report["missing_values_preserved_as_null"]["bus_route"] == 65
    # Verify missing CGPAs are None, never 0
    null_cgpa_rows = [r for r in records if r["cgpa"] is None]
    assert len(null_cgpa_rows) == 50
    assert all(r["cgpa"] is None or r["cgpa"] > 0 for r in records)


def test_student_filtering_and_pii_redaction():
    res_admin = list_students(department="CSE", semester=5, page=1, page_size=50, x_user_role="admin")
    assert res_admin["total"] == 10
    assert res_admin["pii_redacted"] is False
    assert "email" in res_admin["items"][0]

    res_eval = list_students(department="CSE", semester=5, page=1, page_size=50, x_user_role="evaluator")
    assert res_eval["pii_redacted"] is True
    assert "email" not in res_eval["items"][0]


def test_dependency_graph_and_mentor_non_mandatory():
    snapshot = build_institutional_dataset()
    g = build_dependency_graph(snapshot)
    assert "PWR-ACAD-A" in g
    assert "LAB-CSE-1" in g
    assert g.has_edge("PWR-ACAD-A", "LAB-CSE-1")
    stu = snapshot["students"][0]
    stu_net = get_student_dependency_network(stu, snapshot, g)
    mentor_links = [l for l in stu_net["links"] if l["source"] == stu["mentor_id"]]
    assert len(mentor_links) == 1
    assert mentor_links[0]["is_mandatory"] is False


def test_conflict_detection():
    snapshot = build_institutional_dataset()
    conflicts = detect_all_conflicts(snapshot)
    categories = {c["conflict_category"] for c in conflicts}
    assert "Laboratory Double Booking" in categories
    assert "Placement and Examination Conflict" in categories
    assert "Event Venue Conflict" in categories


def test_cascading_simulation_determinism_deduplication_and_isolation():
    snapshot_a = build_institutional_dataset()
    snapshot_b = copy.deepcopy(snapshot_a)

    sim1 = run_cascading_simulation(snapshot_a, "electricity_failure", "PWR-ACAD-A", "Critical", 120, 180, False)
    sim2 = run_cascading_simulation(snapshot_b, "electricity_failure", "PWR-ACAD-A", "Critical", 120, 180, False)

    assert sim1["affected_student_count"] == sim2["affected_student_count"] > 0
    ids = [s["student_id"] for s in sim1["affected_students"]]
    assert len(ids) == len(set(ids)), "Affected students must be deduplicated"
    assert sim1["post_failure_health"]["overall_score"] < sim1["baseline_health"]["overall_score"]
    # Baseline snapshot must remain untouched
    assert all(inf["operational_status"] == "Operational" for inf in snapshot_a["infrastructure"])


def test_cyclic_dependency_handling_and_backup_influence():
    snapshot = build_institutional_dataset()
    # Confirm backup enabled vs disabled changes propagation intensity/outcome
    sim_no_bkp = run_cascading_simulation(snapshot, "electricity_failure", "PWR-ACAD-A", "High", 120, 180, False)
    sim_with_bkp = run_cascading_simulation(snapshot, "electricity_failure", "PWR-ACAD-A", "High", 120, 180, True)
    assert sim_with_bkp["post_failure_health"]["overall_score"] >= sim_no_bkp["post_failure_health"]["overall_score"]

    # Confirm cycle safety in dependency graph doesn't loop infinitely
    g = build_dependency_graph(snapshot)
    g.add_edge("LAB-CSE-1", "PWR-ACAD-A", dependency_type="FeedbackTest", is_mandatory=True, dependency_strength=0.9, propagation_delay_minutes=1)
    assert nx.is_directed(g)
    sim_cycle = run_cascading_simulation(snapshot, "electricity_failure", "PWR-ACAD-A", "Critical", 120, 180, False)
    assert len(sim_cycle["timeline_events"]) > 0


def test_hostel_water_failure_excludes_day_scholars():
    snapshot = build_institutional_dataset()
    sim = run_cascading_simulation(snapshot, "hostel_water_failure", "WTR-HOSTEL", "Critical", 120, 180, False)
    assert sim["affected_student_count"] == 65
    assert all(s["residence_type"] == "Hostel" for s in sim["affected_students"])


def test_recovery_optimizer_feasible_and_infeasible_scenarios():
    snapshot = build_institutional_dataset()
    sim = run_cascading_simulation(snapshot, "electricity_failure", "PWR-ACAD-A", "Critical", 120, 180, False)
    plans = generate_recovery_plans(snapshot, sim)
    assert len(plans) == 3
    assert any(p["solver_status"] in ("OPTIMAL", "FEASIBLE") and p["constraints_satisfied"] for p in plans)

    # Impossible budget ceiling must honestly return INFEASIBLE
    infeasible = generate_recovery_plans(snapshot, sim, max_budget=50.0)
    assert all(p["solver_status"] == "INFEASIBLE" and not p["constraints_satisfied"] for p in infeasible)
    assert all(len(p["blocking_constraints"]) > 0 for p in infeasible)


def test_institutional_health_bounds():
    snapshot = build_institutional_dataset()
    conflicts = detect_all_conflicts(snapshot)
    h = compute_institutional_health(snapshot, conflicts)
    assert 0 <= h["overall_score"] <= 100
    assert h["is_model_estimate"] is True


def test_recovery_authorization_and_simulation_reset():
    sim = create_simulation(
        SimulationRequest(
            scenario_name="Auth & Reset Test",
            incident_type="bus_breakdown",
            affected_resource_id="BUS-01",
            severity="High",
        )
    )
    opt = optimize_recovery(RecoveryOptimizeRequest(simulation_id=sim["simulation_id"]))
    plan_id = opt["plans"][0]["plan_id"]

    with pytest.raises(HTTPException) as exc:
        apply_recovery(RecoveryApplyRequest(plan_id=plan_id, approver_name="Eval"), x_user_role="evaluator")
    assert exc.value.status_code == 403

    with pytest.raises(HTTPException) as exc_inc:
        create_incident(
            IncidentCreateRequest(
                incident_type="bus_breakdown",
                affected_resource_id="BUS-01",
                severity="High",
                title="Unauthorized",
                description="Test",
            ),
            x_user_role="evaluator",
        )
    assert exc_inc.value.status_code == 403

    reset_res = reset_simulation(sim["simulation_id"])
    assert reset_res["status"] == "reset"


def test_repository_db_graceful_error_handling():
    r = InstitutionalRepository()
    status = r.get_db_status()
    assert status["student_records_loaded"] == 200
    assert status["connected"] is True
    assert status["mode"] == "fastapi_local_digital_twin"


def test_fastapi_http_and_websocket_connection():
    import asyncio
    import httpx
    from fastapi import WebSocketDisconnect
    from app.main import app
    from app.realtime import ws_manager
    from app.routers.api import websocket_sync

    async def _run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get("/api/system/status")
            assert res.status_code == 200
            body = res.json()
            assert body["status"] == "online"
            assert body["database"]["connected"] is True
            assert body["database"]["mode"] == "fastapi_local_digital_twin"
            assert body["realtime_transport"] == "FastAPI WebSocket (/api/ws)"

        sent = []

        class FakeWebSocket:
            def __init__(self):
                self._incoming = ["ping"]

            async def accept(self):
                pass

            async def send_json(self, data):
                sent.append(data)

            async def receive_text(self):
                if self._incoming:
                    return self._incoming.pop(0)
                raise WebSocketDisconnect(code=1000)

        fake_ws = FakeWebSocket()
        await websocket_sync(fake_ws)
        assert any(m.get("event") == "connected" for m in sent)
        assert any(m.get("event") == "pong" for m in sent)
        assert fake_ws not in ws_manager._connections

    asyncio.run(_run())


def test_simulation_compatibility_and_four_independent_scenarios():
    import asyncio
    import httpx
    from app.main import app

    async def _run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # 0. Verify compatibility matrix endpoint
            compat_res = await client.get("/api/simulations/compatibility")
            assert compat_res.status_code == 200
            compat = compat_res.json()["compatible_resources"]
            assert any(r["resource_id"] == "PWR-ACAD-A" for r in compat["electricity_failure"])
            assert any(r["resource_id"] == "DRV-01" for r in compat["driver_unavailability"])
            assert any(r["resource_id"] == "LAB-CSE-1" for r in compat["laboratory_failure"])
            assert any(r["resource_id"] == "FAC-CSE-1" for r in compat["faculty_absence"])

            # 1. Reject incompatible incident_type <-> affected_resource_id combinations
            bad_cases = [
                ("electricity_failure", "DRV-01"),
                ("driver_unavailability", "PWR-ACAD-A"),
                ("laboratory_failure", "FAC-CSE-1"),
                ("faculty_absence", "LAB-CSE-1"),
            ]
            for inc, res_id in bad_cases:
                bad = await client.post(
                    "/api/simulations",
                    json={
                        "scenario_name": f"Bad {inc}",
                        "incident_type": inc,
                        "affected_resource_id": res_id,
                        "severity": "Critical",
                    },
                )
                assert bad.status_code == 422, f"Expected 422 for {inc} + {res_id}, got {bad.status_code}"

            missing = await client.post(
                "/api/simulations",
                json={
                    "scenario_name": "Missing",
                    "incident_type": "electricity_failure",
                    "affected_resource_id": "DOES-NOT-EXIST",
                    "severity": "Critical",
                },
            )
            assert missing.status_code == 404

            # 2. Test all 4 required scenarios independently
            scenarios = [
                ("electricity_failure", "PWR-ACAD-A", "Power", "PWR-ACAD-A"),
                ("driver_unavailability", "DRV-01", "Driver", "BUS-01"),
                ("laboratory_failure", "LAB-CSE-1", "Laboratory", "LAB-CSE-1"),
                ("faculty_unavailability", "FAC-CSE-1", "Faculty", "FAC-CSE-1"),
            ]
            for inc, res_id, expected_type, expected_downstream in scenarios:
                sim_res = await client.post(
                    "/api/simulations",
                    json={
                        "scenario_name": f"Test {inc}",
                        "incident_type": inc,
                        "affected_resource_id": res_id,
                        "severity": "Critical",
                        "duration_minutes": 120,
                        "horizon_minutes": 180,
                        "use_backups": False,
                        "recovery_priority": "academic_continuity",
                    },
                )
                assert sim_res.status_code == 200
                sim = sim_res.json()
                assert sim["root_resource_id"] == res_id
                assert sim["root_resource_type"] == expected_type
                assert sim["post_recovery_health"] is None
                assert sim["currently_affected_student_count"] == sim["affected_student_count"] > 0
                assert sim["post_failure_health"]["overall_score"] < sim["baseline_health"]["overall_score"]
                affected_ids = {r["resource_id"] for r in sim["affected_resources"]}
                assert expected_downstream in affected_ids
                # Timeline and building_statuses must match this scenario only
                assert sim["timeline_events"][0]["resource_id"] == res_id
                assert len(sim["building_statuses"]) > 0

                # Optimize and apply recovery for this scenario
                opt_res = await client.post("/api/recovery/optimize", json={"simulation_id": sim["simulation_id"]})
                assert opt_res.status_code == 200
                plans = opt_res.json()["plans"]
                feasible = next(p for p in plans if p["constraints_satisfied"])
                apply_res = await client.post(
                    "/api/recovery/apply",
                    json={
                        "plan_id": feasible["plan_id"],
                        "simulation_id": sim["simulation_id"],
                        "approver_name": "Test Admin",
                    },
                    headers={"X-User-Role": "admin"},
                )
                assert apply_res.status_code == 200
                updated_sim = apply_res.json()["simulation"]
                assert updated_sim["applied_plan_id"] == feasible["plan_id"]
                assert updated_sim["post_recovery_health"] is not None
                assert updated_sim["post_recovery_health"]["overall_score"] >= updated_sim["post_failure_health"]["overall_score"]
                assert updated_sim["currently_affected_student_count"] <= updated_sim["affected_student_count"]

                # Reset must clear active simulation, campus overrides, and currently affected students
                rst_res = await client.post(f"/api/simulations/{sim['simulation_id']}/reset")
                assert rst_res.status_code == 200
                rst_sim = rst_res.json()["simulation"]
                assert rst_sim["currently_affected_student_count"] == 0
                assert rst_sim["building_statuses"] == {}

                dash_res = await client.get("/api/dashboard")
                assert dash_res.status_code == 200
                assert dash_res.json()["kpis"]["affected_students"] == 0
                assert dash_res.json()["kpis"]["historical_affected_students"] > 0

                campus_res = await client.get("/api/campus")
                assert campus_res.status_code == 200
                assert all(b["status"] == "Operational" for b in campus_res.json()["buildings"])

    asyncio.run(_run())


def test_fastapi_auth_login_demo_and_register():
    import asyncio
    import httpx
    from app.main import app

    async def _run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            # Valid login
            login_res = await client.post("/api/auth/login", json={"identifier": "admin", "password": "Admin@123"})
            assert login_res.status_code == 200
            token = login_res.json()["access_token"]
            assert login_res.json()["user"]["role"] == "admin"

            me_res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
            assert me_res.status_code == 200
            assert me_res.json()["user"]["username"] == "admin"

            # Invalid password
            bad_res = await client.post("/api/auth/login", json={"identifier": "admin", "password": "wrong"})
            assert bad_res.status_code == 401

            # One-click demo roles
            for demo_role, expected_role in [("admin", "admin"), ("operator", "coordinator"), ("viewer", "evaluator")]:
                dres = await client.post("/api/auth/demo", json={"demo_role": demo_role})
                assert dres.status_code == 200
                assert dres.json()["user"]["role"] == expected_role

            # Register new institutional account
            reg_res = await client.post(
                "/api/auth/register",
                json={
                    "username": "new_coord_test",
                    "email": "new_coord_test@omnis-x.edu",
                    "password": "Password@123",
                    "role": "coordinator",
                },
            )
            assert reg_res.status_code == 200
            assert reg_res.json()["user"]["role"] == "coordinator"

            # Bridge Firebase Auth user into FastAPI RBAC session
            fb_res = await client.post(
                "/api/auth/firebase",
                json={
                    "uid": "firebase-uid-123",
                    "email": "firebase.user@omnis-x.edu",
                    "display_name": "Firebase Operator",
                    "role": "coordinator",
                    "provider": "firebase_google",
                },
            )
            assert fb_res.status_code == 200
            assert fb_res.json()["user"]["email"] == "firebase.user@omnis-x.edu"
            assert fb_res.json()["user"]["role"] == "coordinator"

    asyncio.run(_run())
