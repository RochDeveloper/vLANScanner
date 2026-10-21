@echo off
setlocal
cd /d "%~dp0vlan-scanner"

if not exist "package.json" (
    echo [ERROR] No se encontro el proyecto en "%~dp0vlan-scanner".
    echo Ejecuta INICIAR.bat desde la raiz del repositorio.
    pause
    exit /b 1
)

echo.
echo === VLAN Network Scanner ===
echo.

REM Instala dependencias la primera vez
if not exist "node_modules\" (
    echo Instalando dependencias por primera vez...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Fallo la instalacion de dependencias.
        pause
        exit /b 1
    )
    echo.
)

echo Iniciando aplicacion...
call npm start
