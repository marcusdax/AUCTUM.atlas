@echo off
chcp 65001 >nul
echo.
echo =============================================================
echo   🌩️  Atlas Helios - Storm Intelligence Platform
echo =============================================================
echo.
echo Starting Atlas Helios Platform...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0launch-app.ps1"

pause
