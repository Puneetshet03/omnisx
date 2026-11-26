@echo off
echo === Running OMNIS-X Automated Tests ===
cd /d "%~dp0..\backend"
.\.venv\Scripts\python.exe -m pytest app\tests\test_omnis_x.py -v
cd /d "%~dp0..\frontend"
call npm run build
