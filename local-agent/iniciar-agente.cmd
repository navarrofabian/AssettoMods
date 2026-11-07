@echo off
cd /d "%~dp0.."
node local-agent\agent.mjs
echo.
echo El agente se detuvo. Si hubo un error, revisa el mensaje de arriba.
pause
