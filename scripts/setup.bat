@echo off
echo === OMNIS-X Setup Script ===
cd /d "%~dp0..\backend"
if not exist ".venv" (
    where python3.12 >nul 2>nul && (
        python3.12 -m venv .venv
    ) || (
        if exist "%LOCALAPPDATA%\Python\bin\python3.12.exe" (
            "%LOCALAPPDATA%\Python\bin\python3.12.exe" -m venv .venv
        ) else (
            py -3.12 -m venv .venv
        )
    )
)
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

cd /d "%~dp0..\frontend"
call npm install
echo === Setup Complete ===
