@echo off
REM Ativa o virtual environment e roda npm dev
call .venv\Scripts\activate.bat
npm run dev:frontend-only
