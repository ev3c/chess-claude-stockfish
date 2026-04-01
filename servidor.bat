@echo off
chcp 65001 >nul
cls
echo ╔════════════════════════════════════════════════╗
echo ║   ♔ AJEDREZIA - SERVIDOR LOCAL ♚              ║
echo ╚════════════════════════════════════════════════╝
echo.
echo Iniciando servidor local...
echo.

REM Intentar con Python 3
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Python detectado
    echo ✓ Servidor iniciado en: http://localhost:8000
    echo.
    echo ┌────────────────────────────────────────────────┐
    echo │  ABRE TU NAVEGADOR Y VE A:                    │
    echo │  http://localhost:8000                        │
    echo └────────────────────────────────────────────────┘
    echo.
    echo 🎯 Presiona Ctrl+C para detener el servidor
    echo.
    start http://localhost:8000
    python -m http.server 8000
    goto :end
)

REM Intentar con Node.js
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo ✓ Node.js detectado
    echo ✓ Instalando http-server...
    call npx -y http-server -p 8000 -o
    goto :end
)

REM Si no hay Python ni Node.js
echo ❌ ERROR: No se encontró Python ni Node.js
echo.
echo Para usar este juego necesitas instalar uno de estos:
echo.
echo 📦 OPCIÓN 1 - Python (Recomendado):
echo    Descarga desde: https://www.python.org/downloads/
echo    Durante la instalación, marca "Add Python to PATH"
echo.
echo 📦 OPCIÓN 2 - Node.js:
echo    Descarga desde: https://nodejs.org/
echo.
echo Después de instalar, ejecuta este archivo nuevamente.
echo.
pause
goto :end

:end

