@echo off
echo === Starting OMNIS-X Backend & Frontend ===
start "OMNIS-X Backend" cmd /k "cd /d %~dp0..\backend && .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
start "OMNIS-X Frontend" cmd /k "cd /d %~dp0..\frontend && npm run dev"
echo Backend Swagger: http://127.0.0.1:8000/docs
echo Frontend App:    http://127.0.0.1:5173
