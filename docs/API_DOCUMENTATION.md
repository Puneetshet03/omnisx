# OMNIS-X REST API Documentation

Interactive Swagger UI is automatically served at `http://127.0.0.1:8000/docs`.

## Endpoint Groups

- **Dashboard & Analytics**: `GET /api/dashboard`, `GET /api/health-index`, `POST /api/health-index/weights`, `GET /api/analytics`
- **Students**: `GET /api/students`, `GET /api/students/{student_id}`, `GET /api/students/{student_id}/dependencies`, `GET /api/students/{student_id}/incidents`
- **Resources**: `GET /api/departments`, `GET /api/faculty`, `GET /api/classrooms`, `GET /api/laboratories`, `GET /api/timetable`, `GET /api/examinations`, `GET /api/transportation`, `GET /api/hostels`, `GET /api/placements`, `GET /api/events`, `GET /api/infrastructure`, `GET /api/campus`
- **Intelligence Engines**: `GET /api/dependencies`, `GET /api/conflicts`, `POST /api/conflicts/detect`, `GET /api/risk-analysis`, `GET /api/critical-resources`, `POST /api/assistant/query`
- **Simulations**: `POST /api/simulations`, `GET /api/simulations`, `GET /api/simulations/{id}`, `GET /api/simulations/{id}/events`, `GET /api/simulations/{id}/affected-students`, `POST /api/simulations/{id}/reset`, `POST /api/simulations/compare`, `POST /api/operation-zero-failure`
- **Recovery Optimizer**: `POST /api/recovery/optimize`, `GET /api/recovery/plans/{id}`, `POST /api/recovery/apply`, `POST /api/recovery/compare`
- **Governance**: `GET /api/incidents`, `POST /api/incidents`, `GET /api/notifications`, `GET /api/audit-logs`, `GET /api/system/status`

## Role Header (`X-User-Role`)

Supports `admin`, `coordinator`, `faculty`, and `evaluator`. Evaluators receive PII-redacted student records (`email` removed) and receive HTTP `403` on privileged mutation endpoints.
