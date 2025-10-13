#!/bin/bash

clear
echo "╔════════════════════════════════════════════════╗"
echo "║   🎮 AJEDREZ VS CLAUDE - SERVIDOR LOCAL 🎮    ║"
echo "╚════════════════════════════════════════════════╝"
echo ""
echo "Iniciando servidor local..."
echo ""

# Intentar con Python 3
if command -v python3 &> /dev/null; then
    echo "✓ Python detectado"
    echo "✓ Servidor iniciado en: http://localhost:8000"
    echo ""
    echo "┌────────────────────────────────────────────────┐"
    echo "│  ABRE TU NAVEGADOR Y VE A:                    │"
    echo "│  http://localhost:8000                        │"
    echo "└────────────────────────────────────────────────┘"
    echo ""
    echo "🎯 Presiona Ctrl+C para detener el servidor"
    echo ""
    
    # Intentar abrir el navegador automáticamente
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        open http://localhost:8000
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        xdg-open http://localhost:8000 2>/dev/null || echo "Abre manualmente: http://localhost:8000"
    fi
    
    python3 -m http.server 8000
    exit 0
fi

# Intentar con Python 2 (legacy)
if command -v python &> /dev/null; then
    echo "✓ Python detectado"
    echo "✓ Servidor iniciado en: http://localhost:8000"
    echo ""
    echo "┌────────────────────────────────────────────────┐"
    echo "│  ABRE TU NAVEGADOR Y VE A:                    │"
    echo "│  http://localhost:8000                        │"
    echo "└────────────────────────────────────────────────┘"
    echo ""
    echo "🎯 Presiona Ctrl+C para detener el servidor"
    echo ""
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open http://localhost:8000
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open http://localhost:8000 2>/dev/null
    fi
    
    python -m SimpleHTTPServer 8000
    exit 0
fi

# Intentar con Node.js
if command -v node &> /dev/null; then
    echo "✓ Node.js detectado"
    echo "✓ Instalando http-server..."
    npx -y http-server -p 8000 -o
    exit 0
fi

# Si no hay Python ni Node.js
echo "❌ ERROR: No se encontró Python ni Node.js"
echo ""
echo "Para usar este juego necesitas instalar uno de estos:"
echo ""
echo "📦 OPCIÓN 1 - Python (Recomendado):"
echo "   macOS: brew install python3"
echo "   Linux: sudo apt install python3"
echo ""
echo "📦 OPCIÓN 2 - Node.js:"
echo "   Descarga desde: https://nodejs.org/"
echo ""
echo "Después de instalar, ejecuta este archivo nuevamente."
echo ""
read -p "Presiona Enter para salir..."

