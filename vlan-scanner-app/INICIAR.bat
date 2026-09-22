@echo off
cd /d "%~dp0vlan-scanner"
echo.
echo === VLAN Network Scanner ===
echo.

REM Check if node_modules exists, if not run npm install first
if not exist "node_modules\" (
    echo Instalando dependencias por primera vez...
    npm install
    echo.
)

echo Iniciando aplicacion...
npm start
