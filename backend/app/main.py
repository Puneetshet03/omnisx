"""OMNIS-X FastAPI Application Entry Point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.api import router

app = FastAPI(
    title="OMNIS-X — Intelligent 3D Institutional Digital Twin API",
    version="1.0.0",
    description=(
        "Constraint-based institutional digital twin featuring NetworkX dependency modeling, "
        "rule-based conflict detection, deterministic cascading failure simulation, and "
        "Google OR-Tools CP-SAT recovery optimization."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
def root():
    return {
        "name": "OMNIS-X",
        "tagline": "Predict. Prevent. Recover.",
        "docs_url": "/docs",
        "health_url": "/api/system/status",
    }
