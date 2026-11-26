"""Institutional Data Repository (FastAPI Authoritative CSV Digital Twin Mode).

Serves authoritative 200-student CSV records and derived/synthetic supporting
institutional resources in memory with isolated simulation snapshots.
"""

from __future__ import annotations

import copy
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from app.config import settings
from app.engines.conflict_engine import detect_all_conflicts
from app.engines.health_engine import compute_institutional_health
from seed_resources import build_institutional_dataset


class InstitutionalRepository:
    """Centralized data access layer for OMNIS-X."""

    def __init__(self) -> None:
        self._baseline: Dict[str, Any] = build_institutional_dataset()
        self._simulations: Dict[str, Dict[str, Any]] = {}
        self._recovery_plans: Dict[str, Dict[str, Any]] = {}
        self._incidents: List[Dict[str, Any]] = []
        self._conflicts: List[Dict[str, Any]] = []
        self._notifications: List[Dict[str, Any]] = [
            {
                "notification_id": str(uuid.uuid4()),
                "title": "OMNIS-X Digital Twin Initialized",
                "message": f"Loaded {len(self._baseline['students'])} authoritative student records across {len(self._baseline['departments'])} departments.",
                "severity": "Info",
                "category": "System",
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        ]
        self._audit_logs: List[Dict[str, Any]] = []
        self._health_history: List[Dict[str, Any]] = []
        self._health_weights: Dict[str, float] = {
            "academic_continuity": 0.25,
            "resource_availability": 0.20,
            "exam_readiness": 0.15,
            "transport_reliability": 0.10,
            "hostel_stability": 0.10,
            "infrastructure_stability": 0.12,
            "conflict_penalty": 0.08,
        }
        self._live_resource_overrides: Dict[str, str] = {}
        self._users: Dict[str, Dict[str, Any]] = {
            "admin": {
                "username": "admin",
                "email": "admin@omnis-x.edu",
                "password": "Admin@123",
                "display_name": "Campus Command Admin",
                "role": "admin",
                "role_label": "Admin",
            },
            "operator": {
                "username": "operator",
                "email": "operator@omnis-x.edu",
                "password": "Operator@123",
                "display_name": "Operations Coordinator",
                "role": "coordinator",
                "role_label": "Operator",
            },
            "viewer": {
                "username": "viewer",
                "email": "viewer@omnis-x.edu",
                "password": "Viewer@123",
                "display_name": "Institutional Viewer",
                "role": "evaluator",
                "role_label": "Viewer",
            },
        }
        self._sessions: Dict[str, Dict[str, Any]] = {}

    def get_db_status(self) -> Dict[str, Any]:
        student_count = len(self.get_students(include_pii=True))
        return {
            "connected": True,
            "mode": "fastapi_local_digital_twin",
            "backend_framework": "FastAPI",
            "message": f"Connected to FastAPI Digital Twin backend ({student_count} authoritative CSV student records loaded).",
            "student_records_loaded": student_count,
            "environment": settings.app_env,
        }

    def get_table(self, key: str) -> List[Dict[str, Any]]:
        """Retrieve baseline table from the authoritative local dataset."""
        rows = copy.deepcopy(self._baseline.get(key, []))

        # Apply transient live status overrides if any recovery/incident updated state
        if self._live_resource_overrides:
            for row in rows:
                for id_col in ("infra_id", "lab_id", "classroom_id", "hall_id", "route_id", "faculty_id", "block_id"):
                    rid = row.get(id_col)
                    if rid and rid in self._live_resource_overrides:
                        row["operational_status"] = self._live_resource_overrides[rid]
        return rows

    def get_students(self, include_pii: bool = False) -> List[Dict[str, Any]]:
        students = self.get_table("students")
        if include_pii:
            return students
        sanitized = []
        for s in students:
            item = dict(s)
            item.pop("email", None)
            sanitized.append(item)
        return sanitized

    def get_student(self, student_id: str, include_pii: bool = False) -> Optional[Dict[str, Any]]:
        for s in self.get_students(include_pii=include_pii):
            if s["student_id"] == student_id:
                return s
        return None

    def get_baseline_snapshot(self) -> Dict[str, Any]:
        """Return an isolated deep copy of all baseline institutional data."""
        snapshot: Dict[str, Any] = {}
        for k in (
            "students", "departments", "academic_groups", "faculty", "subjects",
            "infrastructure", "power_supply", "backup_generators", "network_resources",
            "water_supply", "classrooms", "laboratories", "laboratory_equipment",
            "timetable", "hostel_blocks", "hostel_rooms", "hostel_services",
            "bus_routes", "drivers", "buses", "exam_halls", "examinations",
            "placement_drives", "event_venues", "events", "backup_resources",
            "maintenance_records",
        ):
            snapshot[k] = self.get_table(k)
        return snapshot

    def save_simulation(self, sim: Dict[str, Any]) -> None:
        self._simulations[sim["simulation_id"]] = copy.deepcopy(sim)

    def get_simulations(self) -> List[Dict[str, Any]]:
        return sorted(self._simulations.values(), key=lambda x: x["created_at"], reverse=True)

    def get_active_simulation(self) -> Optional[Dict[str, Any]]:
        for sim in self.get_simulations():
            if sim.get("status") != "Reset (Baseline Preserved)":
                return sim
        return None

    def get_historical_affected_summary(self) -> Dict[str, Any]:
        """Collect deduplicated historical affected students separately from currently active disruptions."""
        active_sim = self.get_active_simulation()
        active_id = active_sim["simulation_id"] if active_sim else None

        historical_by_id: Dict[str, Dict[str, Any]] = {}
        historical_sim_count = 0

        for sim in self.get_simulations():
            sid = sim["simulation_id"]
            if sid == active_id:
                # If active simulation has already recovered some students, those restored students
                # are historical (previously impacted, no longer currently disrupted).
                current_ids = {
                    s["student_id"] for s in sim.get("currently_affected_students", [])
                }
                restored_students = [
                    s for s in sim.get("affected_students", []) if s["student_id"] not in current_ids
                ]
                if restored_students:
                    historical_sim_count += 1
                    for st in restored_students:
                        entry = historical_by_id.setdefault(
                            st["student_id"],
                            {
                                **st,
                                "historical_scenarios": [],
                            },
                        )
                        label = f"{sim['incident_type']} @ {sim['root_resource_id']} (Recovered)"
                        if label not in entry["historical_scenarios"]:
                            entry["historical_scenarios"].append(label)
                continue

            if sim.get("affected_students"):
                historical_sim_count += 1
                for st in sim.get("affected_students", []):
                    entry = historical_by_id.setdefault(
                        st["student_id"],
                        {
                            **st,
                            "historical_scenarios": [],
                        },
                    )
                    label = f"{sim['incident_type']} @ {sim['root_resource_id']}"
                    if label not in entry["historical_scenarios"]:
                        entry["historical_scenarios"].append(label)

        historical_list = [historical_by_id[k] for k in sorted(historical_by_id.keys())]
        return {
            "historical_affected_count": len(historical_list),
            "historical_affected_students": historical_list,
            "historical_simulations_count": historical_sim_count,
        }

    def get_simulation(self, sim_id: str) -> Optional[Dict[str, Any]]:
        return self._simulations.get(sim_id)

    def reset_simulation(self, sim_id: str) -> Optional[Dict[str, Any]]:
        sim = self._simulations.get(sim_id)
        if not sim:
            return None
        self._live_resource_overrides.clear()
        sim["status"] = "Reset (Baseline Preserved)"
        sim["currently_affected_student_count"] = 0
        sim["currently_affected_students"] = []
        sim["applied_plan_id"] = None
        sim["post_recovery_health"] = None
        sim["restored_resource_ids"] = []
        sim["students_restored_count"] = 0
        sim["building_statuses"] = {}
        for plan in self._recovery_plans.values():
            if plan.get("simulation_id") == sim_id:
                plan["approval_status"] = "Reset"
        return sim

    def save_recovery_plans(self, plans: List[Dict[str, Any]]) -> None:
        for p in plans:
            self._recovery_plans[p["plan_id"]] = copy.deepcopy(p)

    def get_recovery_plan(self, plan_id: str) -> Optional[Dict[str, Any]]:
        return self._recovery_plans.get(plan_id)

    def get_plans_for_simulation(self, sim_id: str) -> List[Dict[str, Any]]:
        return [p for p in self._recovery_plans.values() if p.get("simulation_id") == sim_id]

    def apply_recovery_plan(
        self,
        plan_id: str,
        actor: str,
        role: str,
        notes: str = "",
        simulation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        plan = self._recovery_plans.get(plan_id)
        if not plan:
            raise KeyError(f"Recovery plan {plan_id} not found")
        if simulation_id and plan.get("simulation_id") != simulation_id:
            raise ValueError(
                f"Recovery plan {plan_id} belongs to simulation {plan.get('simulation_id')}, not {simulation_id}"
            )
        plan["approval_status"] = "Applied"
        restored_targets = set()
        for action in plan.get("actions", []):
            target = action.get("target_resource_id")
            if target:
                restored_targets.add(target)
                self._live_resource_overrides[target] = "Recovering"

        sim = self._simulations.get(plan.get("simulation_id", ""))
        if sim:
            sim["applied_plan_id"] = plan_id
            sim["status"] = "Recovered"
            sim["restored_resource_ids"] = sorted(restored_targets)
            sim["students_restored_count"] = plan["students_restored"]

            remaining_count = int(plan.get("remaining_disruptions", 0))
            if remaining_count <= 0:
                sim["currently_affected_students"] = []
                sim["currently_affected_student_count"] = 0
            else:
                # Keep remaining disrupted students deterministically up to remaining_count
                sim["currently_affected_students"] = list(sim.get("affected_students", []))[:remaining_count]
                sim["currently_affected_student_count"] = len(sim["currently_affected_students"])

            still_disrupted = {
                r["resource_id"]
                for r in sim.get("affected_resources", [])
                if r["state"] in ("Critical", "Disrupted") and r["resource_id"] not in restored_targets
            }
            snapshot = self.get_baseline_snapshot()
            sim["post_recovery_health"] = compute_institutional_health(
                snapshot,
                detect_all_conflicts(snapshot),
                weights=self.get_health_weights(),
                disrupted_resource_ids=still_disrupted,
                affected_student_count=sim["currently_affected_student_count"],
                context_label="post_recovery",
            )
            # Update building statuses to reflect recovery state
            updated_bldg: Dict[str, str] = {}
            for res in sim.get("affected_resources", []):
                bid = res.get("building_id")
                if not bid:
                    continue
                if res["resource_id"] in restored_targets or sim["currently_affected_student_count"] == 0:
                    updated_bldg.setdefault(bid, "Recovering")
                else:
                    updated_bldg[bid] = res["state"]
            sim["building_statuses"] = updated_bldg

        self.add_notification(
            title=f"Recovery Plan Applied ({plan['plan_label']})",
            message=f"{plan['strategy_name']} approved by {actor}. {plan['students_restored']} students restored.",
            severity="Info",
            category="Recovery",
        )
        self.add_audit_log(
            actor_id=actor,
            actor_role=role,
            action="APPLY_RECOVERY_PLAN",
            entity_type="recovery_plans",
            entity_id=plan_id,
            details={"strategy": plan["strategy_name"], "notes": notes, "students_restored": plan["students_restored"]},
        )
        return plan

    def set_conflicts(self, conflicts: List[Dict[str, Any]]) -> None:
        self._conflicts = conflicts

    def get_conflicts(self) -> List[Dict[str, Any]]:
        return self._conflicts

    def add_incident(self, incident: Dict[str, Any]) -> Dict[str, Any]:
        self._incidents.insert(0, incident)
        self._live_resource_overrides[incident["affected_resource_id"]] = (
            "Critical" if incident["severity"] == "Critical" else "Disrupted"
        )
        self.add_notification(
            title=incident["title"],
            message=f"{incident['affected_resource_id']} reported {incident['severity']} incident.",
            severity=incident["severity"],
            category="Incident",
        )
        self.add_audit_log(
            actor_id=incident.get("reported_by", "Command Centre"),
            actor_role="admin",
            action="CREATE_INCIDENT",
            entity_type="incidents",
            entity_id=incident["incident_id"],
            details={"resource": incident["affected_resource_id"], "severity": incident["severity"]},
        )
        return incident

    def get_incidents(self) -> List[Dict[str, Any]]:
        return self._incidents

    def add_notification(self, title: str, message: str, severity: str = "Info", category: str = "System") -> None:
        self._notifications.insert(
            0,
            {
                "notification_id": str(uuid.uuid4()),
                "title": title,
                "message": message,
                "severity": severity,
                "category": category,
                "is_read": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        self._notifications = self._notifications[:50]

    def get_notifications(self) -> List[Dict[str, Any]]:
        return self._notifications

    def add_audit_log(
        self, actor_id: str, actor_role: str, action: str, entity_type: str, entity_id: str, details: Dict[str, Any]
    ) -> None:
        self._audit_logs.insert(
            0,
            {
                "log_id": str(uuid.uuid4()),
                "actor_id": actor_id,
                "actor_role": actor_role,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "details": details,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    def get_audit_logs(self) -> List[Dict[str, Any]]:
        return self._audit_logs

    def get_health_weights(self) -> Dict[str, float]:
        return dict(self._health_weights)

    def update_health_weights(self, weights: Dict[str, float]) -> Dict[str, float]:
        self._health_weights = dict(weights)
        return self.get_health_weights()

    def record_health(self, health_snapshot: Dict[str, Any]) -> None:
        self._health_history.append(health_snapshot)
        self._health_history = self._health_history[-30:]

    def get_health_history(self) -> List[Dict[str, Any]]:
        return self._health_history

    def authenticate_user(self, identifier: str, password: str) -> Optional[Dict[str, Any]]:
        ident = identifier.strip().lower()
        for user in self._users.values():
            if user["username"].lower() == ident or user["email"].lower() == ident:
                if user["password"] == password:
                    return self._issue_session(user)
                return None
        return None

    def demo_login(self, demo_role: str) -> Dict[str, Any]:
        user = self._users[demo_role]
        return self._issue_session(user)

    def register_user(self, username: str, email: str, password: str, role: str) -> Dict[str, Any]:
        uname = username.strip()
        uemail = email.strip().lower()
        for existing in self._users.values():
            if existing["username"].lower() == uname.lower() or existing["email"].lower() == uemail:
                raise ValueError("An account with that username or email already exists.")
        role_labels = {
            "admin": "Admin",
            "coordinator": "Operator",
            "faculty": "Faculty",
            "evaluator": "Viewer",
        }
        user = {
            "username": uname,
            "email": uemail,
            "password": password,
            "display_name": uname,
            "role": role,
            "role_label": role_labels.get(role, "Operator"),
        }
        self._users[uname.lower()] = user
        return self._issue_session(user)

    def _issue_session(self, user: Dict[str, Any]) -> Dict[str, Any]:
        token = f"omnisx-{uuid.uuid4().hex}"
        profile = {
            "username": user["username"],
            "email": user["email"],
            "display_name": user["display_name"],
            "role": user["role"],
            "role_label": user["role_label"],
        }
        self._sessions[token] = profile
        self.add_audit_log(
            actor_id=user["username"],
            actor_role=user["role"],
            action="USER_LOGIN",
            entity_type="auth_sessions",
            entity_id=user["username"],
            details={"role_label": user["role_label"]},
        )
        return {"access_token": token, "token_type": "bearer", "user": profile}

    def get_session(self, token: str) -> Optional[Dict[str, Any]]:
        return self._sessions.get(token)

    def firebase_login(
        self,
        uid: str,
        email: str,
        display_name: Optional[str],
        role: str,
        provider: str = "firebase",
    ) -> Dict[str, Any]:
        uemail = email.strip().lower()
        uname = (display_name or uemail.split("@")[0]).strip()
        role_labels = {
            "admin": "Admin",
            "coordinator": "Operator",
            "faculty": "Faculty",
            "evaluator": "Viewer",
        }
        existing = next(
            (u for u in self._users.values() if u["email"].lower() == uemail),
            None,
        )
        if existing:
            user = existing
        else:
            user = {
                "username": uname,
                "email": uemail,
                "password": f"firebase:{uid}",
                "display_name": uname,
                "role": role,
                "role_label": role_labels.get(role, "Operator"),
                "provider": provider,
            }
            self._users[uemail] = user
        return self._issue_session(user)


repo = InstitutionalRepository()
