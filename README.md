# ♔ Ajedrez con IA ♚

Una aplicación web interactiva para jugar al ajedrez contra el motor Stockfish.

## 🎮 Características

### Funcionalidades Principales
- **Interfaz gráfica moderna**: Tablero de ajedrez visual con diseño responsivo
- **IA avanzada**: Juega contra Stockfish, el motor de ajedrez más potente del mundo, ejecutándose directamente en tu navegador
- **Piezas clásicas**: Símbolos Unicode estándar (♔♚) - el formato más usado mundialmente
- **Doble sistema de coordenadas**: 
  - Coordenadas en cada casilla (esquina superior derecha)
  - Coordenadas en los bordes del tablero (letras abajo, números a la izquierda)
- **Reglas completas**: Implementación completa de las reglas del ajedrez, incluyendo:
  - Movimientos estándar de todas las piezas
  - Enroque (kingside y queenside)
  - Captura al paso (en passant)
  - Promoción de peones
  - Detección de jaque, jaque mate y ahogado

### Modos de Juego
- **vs IA (Stockfish)**: Juega contra el motor de ajedrez con múltiples niveles de dificultad (1-20)
- **Humano vs Humano**: Modo local para jugar contra otra persona
- **Modo Entrenamiento**: Resuelve puzzles de ajedrez para mejorar tus habilidades

### Características Avanzadas
- **⬅ Deshacer Movimiento**: Retrocede uno o más movimientos
- **💡 Sugerencias de IA**: El motor te ayuda sugiriendo el mejor movimiento
- **💾 Guardar/Cargar Partidas**: Guarda tus partidas en el navegador y retómalas después
- **📄 Exportar PGN**: Exporta tus partidas en formato PGN estándar
- **🎨 Temas de Tablero**: 5 temas de colores diferentes (Clásico, Madera, Azul, Verde, Gris)
- **⏱ Reloj de Ajedrez**: Modo con tiempo límite configurable
- **📖 Historial de movimientos**: Visualización de todos los movimientos realizados
- **♟ Piezas capturadas**: Seguimiento de las piezas eliminadas
- **🎯 Selector de nivel**: 4 niveles de dificultad (Principiante, Intermedio, Avanzado, Experto)

## 📋 Requisitos

- Un navegador web moderno (Chrome, Firefox, Edge, Safari)
- No requiere instalación adicional ni conexión a internet (Stockfish se ejecuta en el navegador)

## 🚀 Instalación

1. Clona o descarga este repositorio
2. **IMPORTANTE:** No abres `index.html` directamente, usa un servidor local (ver abajo)

### ⚡ Inicio Rápido

**Opción A - Script Automático (Recomendado):**
- **Windows:** Haz doble clic en `servidor.bat`
- **Mac/Linux:** Ejecuta `./servidor.sh` en terminal
- Abre tu navegador en: `http://localhost:8000`

**Opción B - Comando Manual:**
```bash
# Con Python
python -m http.server 8000

# Con Node.js  
npx http-server -p 8000
```

**¿Por qué un servidor?** Por seguridad, los navegadores tienen restricciones al abrir archivos HTML directamente. El servidor local resuelve este problema y garantiza el funcionamiento correcto.

📖 **Si tienes problemas:** Abre `LEEME_PRIMERO.html` para instrucciones visuales paso a paso.

## 🎯 Cómo Jugar

1. **Configuración inicial**:
   - Selecciona el modo de juego (vs IA, vs Humano, o Entrenamiento)
   - Si juegas contra la IA, elige el nivel de dificultad (1-20)
   - Selecciona tu color (Blancas o Negras)
   - Configura el control de tiempo del reloj de ajedrez
   - Opcional: Cambia el tema del tablero a tu preferencia
   - Haz clic en "Nueva Partida"

2. **Realizar movimientos**:
   - Haz clic en una de tus piezas para seleccionarla
   - Los movimientos válidos se resaltarán en el tablero
   - Las coordenadas del tablero (a-h y 1-8) te ayudan a identificar cada casilla
   - Haz clic en una casilla resaltada para mover la pieza

3. **Turno de la IA** (modo vs IA):
   - La IA pensará automáticamente su movimiento usando el motor Stockfish
   - Verás un indicador mientras la IA está calculando
   - El movimiento se ejecutará automáticamente

4. **Usar características avanzadas**:
   - **Deshacer**: Haz clic en "⬅ Deshacer Movimiento" para retroceder
   - **Sugerencia**: Haz clic en "💡 Sugerencia de IA" para obtener el mejor movimiento
   - **Guardar**: Haz clic en "💾 Guardar Partida" para guardar tu progreso
   - **Cargar**: Haz clic en "📂 Cargar Partida" para continuar una partida guardada
   - **Exportar**: Haz clic en "📄 Exportar PGN" para descargar la partida

5. **Fin del juego**:
   - El juego detecta automáticamente jaque mate, ahogado y empate
   - Si el reloj está activado, se acaba el tiempo también termina el juego
   - Puedes iniciar una nueva partida en cualquier momento

## 📁 Estructura del Proyecto

```
Chess-claude/
├── index.html                  # Aplicación principal de ajedrez
├── style.css                   # Estilos y diseño visual
├── chess-logic.js              # Motor de ajedrez (reglas y lógica)
├── app.js                      # Integración con Claude API
├── servidor.bat                # Script para Windows (servidor local)
├── servidor.sh                 # Script para Mac/Linux (servidor local)
├── LEEME_PRIMERO.html         # Guía visual de instalación
├── INSTRUCCIONES_RAPIDAS.md   # Solución rápida para "Failed to Fetch"
├── SOLUCION_PROBLEMAS.md      # Guía completa de troubleshooting
├── NUEVAS_CARACTERISTICAS.md  # Documentación de nuevas funciones
└── README.md                   # Este archivo
```

## 🧩 Tecnologías Utilizadas

- **HTML5**: Estructura de la aplicación
- **CSS3**: Diseño moderno con gradientes y animaciones
- **JavaScript (Vanilla)**: Lógica del juego y comunicación con el motor
- **Stockfish.js**: Motor de ajedrez Stockfish compilado a JavaScript/WebAssembly para ejecución en el navegador

## 🎨 Características Técnicas

### Lógica del Ajedrez
- Implementación orientada a objetos con la clase `ChessGame`
- Validación completa de movimientos legales
- Detección de jaque mediante análisis de ataques
- Prevención de movimientos que dejarían al rey en jaque
- Soporte para movimientos especiales (enroque, en passant, promoción)
- Sistema de historial de estados para deshacer movimientos
- Exportación a formato FEN para representación de posiciones

### Integración con Stockfish
- Comunicación directa con el motor Stockfish usando protocolo UCI
- Conversión de posiciones a formato FEN completo
- Obtención de mejores movimientos en tiempo real
- Sistema de fallback local para análisis rápido si es necesario
- Manejo de errores y validación de movimientos
- Sistema de dificultad ajustable (niveles 1-20) con configuración de Skill Level
- Modo de sugerencias usando el motor Stockfish

### Interfaz de Usuario
- Diseño responsivo que se adapta a diferentes tamaños de pantalla
- Resaltado visual de piezas seleccionadas y movimientos válidos
- Indicadores de estado del juego en tiempo real
- Animaciones y transiciones suaves
- 5 temas de colores para el tablero con cambio dinámico
- Reloj de ajedrez visual con advertencias de tiempo
- Panel de acciones con todas las funcionalidades avanzadas

### Persistencia de Datos
- LocalStorage para guardar API Key
- Sistema de guardado/carga de partidas múltiples
- Almacenamiento de preferencias de usuario (tema del tablero)
- Exportación de partidas en formato PGN estándar

## 🔍 Detalles de Implementación

### Sistema de Notación

El juego utiliza un sistema de coordenadas interno (0-7 para filas y columnas) y lo convierte a:
- Notación FEN completa para representar posiciones (6 campos: piezas, turno, enroque, en passant, medios movimientos, movimiento)
- Notación UCI para comunicarse con Stockfish (protocolo estándar)
- Notación algebraica estándar (a1-h8) para visualización

### Generación de Movimientos

El motor Stockfish recibe:
- Posición actual en formato FEN completo
- Nivel de habilidad (Skill Level 0-20)
- Tiempo de análisis (movetime en milisegundos)

Y responde con:
- Mejor movimiento en notación UCI (ej: "e2e4")
- Información de análisis (profundidad, score, nodos evaluados)
- Variantes principales durante el cálculo

## 🐛 Solución de Problemas

### Error: "Motor Stockfish no se carga"

**Problemas comunes:**

1. **Error al cargar Stockfish.js**
   - Asegúrate de tener conexión a internet para cargar la biblioteca desde CDN
   - Verifica que no haya bloqueadores de scripts activos
   - El juego usa automáticamente un motor local simple como fallback

2. **Stockfish tarda en inicializar**
   - Espera unos segundos, el motor necesita cargarse completamente
   - Verás "⏳ Cargando motor Stockfish..." mientras se inicializa
   - Una vez listo verás "✅ Motor Stockfish listo"

3. **Error de servidor local (CORS)**
   - Si abres el archivo con `file:///`, usa un servidor local
   - Python: `python -m http.server 8000`
   - Node.js: `npx http-server`
   - Luego abre `http://localhost:8000` o `http://localhost:8080`

4. **El juego no responde**
   - Recarga la página (F5)
   - Verifica que estés usando un navegador moderno
   - Revisa la consola del navegador (F12) para ver mensajes de error

---

**Otros problemas:**

**Los movimientos no se ejecutan**
- Asegúrate de hacer clic en una pieza de tu color y luego en una casilla resaltada

**El tablero no se muestra correctamente**
- Actualiza tu navegador o prueba con un navegador diferente
- Usa un navegador moderno (Chrome, Firefox, Edge, Safari)

## 📝 Notas

- El juego utiliza Stockfish.js, una versión del motor Stockfish compilada a JavaScript/WebAssembly
- Stockfish se ejecuta completamente en tu navegador, sin necesidad de servidor
- Los movimientos pueden tardar de 0.1 a 3 segundos según el nivel de dificultad
- Si Stockfish no se carga, el juego usa un motor local simple como fallback
- La aplicación no tiene backend; todo se ejecuta en el navegador
- No se requiere API Key ni autenticación
- Funciona sin conexión a internet una vez cargado (excepto la descarga inicial del script)

## ✨ Últimas Actualizaciones

### Versión 4.0 - Octubre 2025 🎉
**¡MOTOR STOCKFISH NATIVO!**

- ✅ **Stockfish Directo**: Ahora usa el motor Stockfish.js ejecutándose en el navegador
- ✅ **Sin API**: No depende de servicios externos, todo funciona localmente
- ✅ **Más Rápido**: Respuesta inmediata sin latencia de red
- ✅ **Más Potente**: Acceso completo al motor Stockfish con todas sus capacidades
- ✅ **20 Niveles de Dificultad**: Control fino con Skill Level (0-20)
- ✅ **Configuración FEN Completa**: Soporte completo para todas las reglas (enroque, en passant, etc.)
- ✅ **Fallback Inteligente**: Motor local simple si Stockfish no se carga
- ✅ **Reloj de Ajedrez**: Controles de tiempo estándar (Bullet, Blitz, Rápidas, Clásicas)
- ✅ **Todas las características anteriores**: Deshacer, guardar/cargar, PGN, puzzles, temas

### Versión 3.1 - Octubre 2025
**Migración a Lichess API**
- ✅ Uso de API externa de Lichess
- ✅ Sin API Key requerida

### Versión 2.2 - Octubre 2025
- ✅ **Diseño simplificado**: Solo piezas clásicas (las más usadas mundialmente)
- ✅ **Doble sistema de coordenadas**: En cada casilla Y en los bordes del tablero
- ✅ **Interfaz optimizada**: Máxima claridad para identificar posiciones

## 🎓 Características Implementadas

Todas las características principales han sido completadas:
- ✅ Selector de nivel de dificultad
- ✅ Análisis de partidas
- ✅ Guardado y carga de partidas
- ✅ Modo de juego contra otro humano (local)
- ✅ Sugerencias de movimientos
- ✅ Diferentes temas de colores para el tablero
- ✅ Notación PGN para exportar partidas
- ✅ Modo de entrenamiento con puzzles
- ✅ Reloj de ajedrez
- ✅ Deshacer movimiento

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

## 👨‍💻 Autor

Creado con ❤️ para disfrutar del ajedrez con inteligencia artificial.

## 🙏 Agradecimientos

- El proyecto Stockfish por el motor de ajedrez más potente del mundo
- Stockfish.js por la compilación a JavaScript/WebAssembly
- La comunidad de ajedrez por las reglas y convenciones estándar
- Los símbolos Unicode de ajedrez que hacen posible una interfaz visual sin imágenes

---

¡Disfruta jugando contra el mejor motor de ajedrez! ♟️

