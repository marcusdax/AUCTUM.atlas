@echo off
chcp 65001 >nul
setlocal
title RoofPro CRM - launcher

echo.
echo =============================================================
echo   RoofPro CRM  -  Storm Intelligence Platform
echo   AccuLynx alternative  ^|  AI-powered storm + map intelligence
echo =============================================================
echo.

where pwsh >nul 2>nul
if errorlevel 1 (
  echo [!] PowerShell 7 ^(pwsh^) was not found.
  echo     Install it from https://aka.ms/powershell and re-run START.bat
  echo.
  pause
  exit /b 1
)

pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch.ps1" %*
set EXITCODE=%ERRORLEVEL%

if not "%EXITCODE%"=="0" (
  echo.
  echo [!] Launch failed with exit code %EXITCODE%.
  echo     Review the output above, then try:  pwsh -File scripts\launch.ps1 -Rebuild
  echo.
  pause
  exit /b %EXITCODE%
)

echo.
echo Press any key to close this window. The stack keeps running in Docker.
pause >nul
endlocal
