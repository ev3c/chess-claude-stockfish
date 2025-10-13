# ♔ Ajedrez vs Claude ♚

Una aplicación web interactiva para jugar al ajedrez contra la inteligencia artificial de Claude (Anthropic).

## 🎮 Características

### Funcionalidades Principales
- **Interfaz gráfica moderna**: Tablero de ajedrez visual con diseño responsivo
- **IA avanzada**: Juega contra Claude 3.5 Sonnet, uno de los modelos más avanzados de Anthropic
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
- **vs Claude (IA)**: Juega contra la inteligencia artificial con 4 niveles de dificultad
- **Humano vs Humano**: Modo local para jugar contra otra persona
- **Modo Entrenamiento**: Resuelve puzzles de ajedrez para mejorar tus habilidades

### Características Avanzadas
- **⬅ Deshacer Movimiento**: Retrocede uno o más movimientos
- **💡 Sugerencias**: Claude te ayuda sugiriendo el mejor movimiento
- **📊 Análisis de Partidas**: Análisis detallado de tus partidas con Claude
- **💾 Guardar/Cargar Partidas**: Guarda tus partidas en el navegador y retómalas después
- **📄 Exportar PGN**: Exporta tus partidas en formato PGN estándar
- **🎨 Temas de Tablero**: 5 temas de colores diferentes (Clásico, Madera, Azul, Verde, Gris)
- **⏱ Reloj de Ajedrez**: Modo con tiempo límite configurable
- **📖 Historial de movimientos**: Visualización de todos los movimientos realizados
- **♟ Piezas capturadas**: Seguimiento de las piezas eliminadas
- **🎯 Selector de nivel**: 4 niveles de dificultad (Principiante, Intermedio, Avanzado, Experto)

## 📋 Requisitos

- Un navegador web moderno (Chrome, Firefox, Edge, Safari)
- Una API Key de Anthropic (Claude)

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

**¿Por qué un servidor?** Por seguridad, los navegadores bloquean las peticiones API cuando abres archivos HTML directamente. El servidor local resuelve este problema.

📖 **Si tienes problemas:** Abre `LEEME_PRIMERO.html` para instrucciones visuales paso a paso.

## 🔑 Configuración de la API Key

1. Visita [console.anthropic.com](https://console.anthropic.com/) para obtener tu API Key
2. En la aplicación, ingresa tu API Key en el campo de configuración
3. **Haz clic en "Probar Conexión"** para verificar que funciona correctamente
4. Si la prueba es exitosa, haz clic en "Guardar API Key"
5. Tu API Key se guardará localmente en tu navegador (no se comparte con nadie)

⚠️ **Importante**: Tu API Key se almacena en el localStorage de tu navegador. Nunca la compartas con nadie.

💡 **Consejo**: Siempre prueba la conexión antes de guardar para asegurarte de que la API Key es válida.

## 🎯 Cómo Jugar

1. **Configuración inicial**:
   - Ingresa tu API Key de Anthropic
   - Selecciona el modo de juego (vs IA, vs Humano, o Entrenamiento)
   - Si juegas contra la IA, elige el nivel de dificultad
   - Selecciona tu color (Blancas o Negras)
   - Opcional: Activa el reloj de ajedrez y configura el tiempo
   - Opcional: Cambia el tema del tablero a tu preferencia
   - Haz clic en "Nueva Partida"

2. **Realizar movimientos**:
   - Haz clic en una de tus piezas para seleccionarla
   - Los movimientos válidos se resaltarán en el tablero
   - Las coordenadas del tablero (a-h y 1-8) te ayudan a identificar cada casilla
   - Haz clic en una casilla resaltada para mover la pieza

3. **Turno de Claude** (modo vs IA):
   - Claude pensará automáticamente su movimiento
   - Verás un indicador de "Claude está pensando..."
   - El movimiento se ejecutará automáticamente

4. **Usar características avanzadas**:
   - **Deshacer**: Haz clic en "⬅ Deshacer Movimiento" para retroceder
   - **Sugerencia**: Haz clic en "💡 Sugerencia" para que Claude te aconseje
   - **Analizar**: Haz clic en "📊 Analizar Partida" para un análisis detallado
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
- **JavaScript (Vanilla)**: Lógica del juego y comunicación con la API
- **Anthropic Claude API**: Inteligencia artificial para los movimientos

## 🎨 Características Técnicas

### Lógica del Ajedrez
- Implementación orientada a objetos con la clase `ChessGame`
- Validación completa de movimientos legales
- Detección de jaque mediante análisis de ataques
- Prevención de movimientos que dejarían al rey en jaque
- Soporte para movimientos especiales (enroque, en passant, promoción)
- Sistema de historial de estados para deshacer movimientos
- Exportación a formato FEN para representación de posiciones

### Integración con Claude
- Comunicación con la API de Anthropic usando `fetch`
- Descripción detallada del tablero en formato legible
- Análisis de movimientos válidos
- Parsing de respuestas JSON de Claude
- Manejo de errores y validación de movimientos
- Sistema de dificultad ajustable mediante prompts personalizados
- Modo de sugerencias para ayudar al jugador
- Análisis de partidas con evaluación detallada

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

El juego utiliza un sistema de coordenadas interno (0-7 para filas y columnas) y lo convierte a notación algebraica estándar (a1-h8) para la comunicación con Claude.

### Generación de Movimientos

Claude recibe:
- Posición actual en formato FEN
- Descripción textual del tablero
- Lista de todos los movimientos válidos disponibles

Y responde con un movimiento en formato JSON: `{"from": "e2", "to": "e4"}`

## 🐛 Solución de Problemas

### Error: "Error al comunicarse con Claude"

**Primero:** Usa el botón **"Probar Conexión"** para diagnosticar el problema exacto.

**Problemas comunes:**

1. **API Key inválida (Error 401)**
   - Verifica que copiaste la API Key correctamente
   - Genera una nueva en [console.anthropic.com](https://console.anthropic.com/)
   - Asegúrate de que no tenga espacios al inicio o final

2. **Límite de uso excedido (Error 429)**
   - Revisa tus créditos en console.anthropic.com
   - Agrega un método de pago si es necesario

3. **Error de red (CORS)**
   - Si abres el archivo con `file:///`, usa un servidor local
   - Python: `python -m http.server 8000`
   - Node.js: `npx http-server`
   - Luego abre `http://localhost:8000` o `http://localhost:8080`

4. **Sin conexión a internet**
   - Verifica tu conexión
   - Intenta abrir anthropic.com en otra pestaña

**Guía completa:** Ver archivo `SOLUCION_PROBLEMAS.md` para instrucciones detalladas.

---

**Otros problemas:**

**Los movimientos no se ejecutan**
- Asegúrate de hacer clic en una pieza de tu color y luego en una casilla resaltada

**El tablero no se muestra correctamente**
- Actualiza tu navegador o prueba con un navegador diferente
- Usa un navegador moderno (Chrome, Firefox, Edge, Safari)

## 📝 Notas

- El juego utiliza la API de Claude 3.5 Sonnet, que ofrece un rendimiento excelente en ajedrez
- Los movimientos de Claude pueden tardar unos segundos dependiendo de la carga de la API
- La aplicación no tiene backend; todo se ejecuta en el navegador

## ✨ Últimas Actualizaciones

### Versión 3.0 - Octubre 2025 🎉
**¡GRAN ACTUALIZACIÓN!** Todas las características solicitadas han sido implementadas:

- ✅ **Deshacer Movimiento**: Sistema completo para retroceder movimientos
- ✅ **Selector de Nivel de Dificultad**: 4 niveles (Principiante a Experto)
- ✅ **Análisis de Partidas**: Análisis detallado con Claude AI
- ✅ **Guardado y Carga**: Guarda y recupera partidas desde localStorage
- ✅ **Modo Humano vs Humano**: Juega localmente contra otra persona
- ✅ **Sugerencias de Movimientos**: Claude te ayuda cuando lo necesites
- ✅ **Temas de Tablero**: 5 hermosos temas de colores
- ✅ **Exportación PGN**: Exporta partidas en formato estándar
- ✅ **Modo Entrenamiento**: Resuelve puzzles de ajedrez
- ✅ **Reloj de Ajedrez**: Sistema de tiempo configurable

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

- Anthropic por proporcionar la API de Claude
- La comunidad de ajedrez por las reglas y convenciones estándar
- Los símbolos Unicode de ajedrez que hacen posible una interfaz visual sin imágenes

---

¡Disfruta jugando contra Claude! ♟️

