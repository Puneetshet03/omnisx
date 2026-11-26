"""Pydantic schemas for OMNIS-X REST API."""

from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field


class SimulationRequest(BaseModel):
    scenario_name: str = Field(default="Custom Institutional Disruption", max_length=160)
    incident_type: str = Field(..., description="e.g., electricity_failure, internet_outage, lab_failure, bus_breakdown, hostel_water_failure, faculty_absence, classroom_unavailability, exam_hall_failure")
    affected_resource_id: str = Field(..., description="Target resource or node ID (e.g., PWR-ACAD-A, LAB-CSE-1, BUS-01)")
    severity: Literal["Critical", "High", "Medium", "Low"] = "Critical"
    duration_minutes: int = Field(default=120, ge=15, le=1440)
    horizon_minutes: int = Field(default=180, ge=30, le=1440)
    use_backups: bool = True
    recovery_priority: Literal["academic_continuity", "cost", "speed"] = "academic_continuity"


class SimulationCompareRequest(BaseModel):
    scenarios: List[SimulationRequest] = Field(..., min_length=2, max_length=4)


class OptimizationWeights(BaseModel):
    student_continuity_weight: int = Field(default=60, ge=1, le=100)
    cost_weight: int = Field(default=20, ge=1, le=100)
    duration_weight: int = Field(default=20, ge=1, le=100)


class RecoveryOptimizeRequest(BaseModel):
    simulation_id: str
    max_budget: Optional[float] = Field(default=None, ge=0)
    max_duration_minutes: Optional[int] = Field(default=None, ge=5)
    weights: OptimizationWeights = Field(default_factory=OptimizationWeights)
    solver_time_limit_seconds: float = Field(default=5.0, ge=0.5, le=30.0)


class RecoveryApplyRequest(BaseModel):
    plan_id: str
    simulation_id: Optional[str] = None
    approver_name: str = Field(default="System Administrator", max_length=100)
    notes: str = Field(default="", max_length=500)


class RecoveryCompareRequest(BaseModel):
    plan_ids: List[str] = Field(..., min_length=1, max_length=3)


class IncidentCreateRequest(BaseModel):
    incident_type: str
    affected_resource_id: str
    severity: Literal["Critical", "High", "Medium", "Low"] = "High"
    title: str = Field(..., min_length=3, max_length=180)
    description: str = Field(..., min_length=3, max_length=1000)


class HealthWeightsUpdate(BaseModel):
    academic_continuity: float = 0.25
    resource_availability: float = 0.20
    exam_readiness: float = 0.15
    transport_reliability: float = 0.10
    hostel_stability: float = 0.10
    infrastructure_stability: float = 0.12
    conflict_penalty: float = 0.08


class AssistantQueryRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=500)
    simulation_id: Optional[str] = None


class AuthLoginRequest(BaseModel):
    identifier: str = Field(..., min_length=1, max_length=160)
    password: str = Field(..., min_length=1, max_length=160)


class AuthRegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=80)
    email: str = Field(..., min_length=3, max_length=160)
    password: str = Field(..., min_length=6, max_length=160)
    role: Literal["admin", "coordinator", "faculty", "evaluator"] = "coordinator"


class AuthDemoRequest(BaseModel):
    demo_role: Literal["admin", "operator", "viewer"]


class AuthFirebaseRequest(BaseModel):
    uid: str = Field(..., min_length=1, max_length=160)
    email: str = Field(..., min_length=3, max_length=160)
    display_name: Optional[str] = Field(default=None, max_length=160)
    role: Literal["admin", "coordinator", "faculty", "evaluator"] = "coordinator"
    provider: str = Field(default="firebase", max_length=60)
