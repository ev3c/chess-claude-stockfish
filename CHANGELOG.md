# 📝 Changelog - Ajedrez vs Claude

Todos los cambios notables en este proyecto serán documentados en este archivo.

---

## [3.0.0] - 2025-10-13

### 🎉 GRAN ACTUALIZACIÓN - ¡10 Nuevas Características!

#### ✨ Agregado
- **Deshacer Movimiento**: Sistema completo para retroceder movimientos
  - Guarda estado completo del juego
  - En modo IA deshace 2 movimientos (jugador + IA)
  - Botón deshabilitado cuando no hay movimientos

- **Selector de Nivel de Dificultad**: 4 niveles para Claude
  - Principiante: Movimientos simples
  - Intermedio: Tácticas básicas
  - Avanzado: Estrategia sólida
  - Experto: Nivel gran maestro

- **Modos de Juego Múltiples**
  - vs Claude (IA): Modo original mejorado
  - Humano vs Humano: Juego local entre dos personas
  - Modo Entrenamiento: Resuelve puzzles de ajedrez

- **Sugerencias de Movimientos**
  - Claude sugiere el mejor movimiento
  - Resalta visualmente la sugerencia
  - Funciona en cualquier momento

- **Análisis de Partidas**
  - Análisis completo con Claude AI
  - Evaluación de movimientos clave
  - Sugerencias de mejora
  - Se abre en ventana nueva

- **Guardado y Carga de Partidas**
  - Guarda múltiples partidas en localStorage
  - Nombres personalizados para partidas
  - Restauración completa del estado
  - Persiste entre sesiones

- **Exportación PGN**
  - Exporta partidas en formato estándar
  - Descarga automática de archivo
  - Compatible con otros programas
  - Incluye metadatos (fecha, jugadores)

- **Temas de Tablero**: 5 temas visuales
  - Clásico (beige/marrón)
  - Madera
  - Azul
  - Verde
  - Gris
  - Guardado automático de preferencia

- **Reloj de Ajedrez**
  - Tiempo configurable (1-60 minutos)
  - Cuenta regresiva automática
  - Advertencias visuales (amarillo/rojo)
  - Detección de tiempo agotado

- **Modo Entrenamiento con Puzzles**
  - Puzzles de mate en 1
  - Sistema extensible
  - Progreso automático entre puzzles

#### 🔧 Mejorado
- Interfaz de usuario completamente rediseñada
- Panel de acciones con todos los controles
- Mejor organización de controles
- Prompts de Claude optimizados por nivel
- Sistema de estado del juego mejorado

#### 📚 Documentación
- Agregado `NUEVAS_CARACTERISTICAS.md` con guía detallada
- Agregado `RESUMEN_IMPLEMENTACION.md` con detalles técnicos
- Actualizado `README.md` con todas las características
- Agregado `CHANGELOG.md` (este archivo)

#### 🎨 Interfaz
- Nuevos controles en panel de configuración
- Panel de acciones con 6 botones
- Reloj visual de ajedrez
- Selectores para modo y dificultad
- Checkbox para reloj

#### 💻 Técnico
- ~850 líneas de código nuevo
- 16 nuevas funciones en `app.js`
- 3 nuevos métodos en `chess-logic.js`
- Sistema de historial de estados
- Integración mejorada con Claude API

---

## [2.2.0] - 2025-10-XX

### ✨ Agregado
- Diseño simplificado con piezas clásicas
- Doble sistema de coordenadas (en casillas y bordes)
- Interfaz optimizada para identificación de posiciones

### 🔧 Mejorado
- Mejor visualización de coordenadas
- Símbolos Unicode estándar
- Diseño responsivo mejorado

---

## [2.1.0] - 2025-10-XX

### ✨ Agregado
- Botón "Probar Conexión" para API Key
- Mejor manejo de errores de API
- Mensajes de error detallados

### 🔧 Mejorado
- Validación de API Key
- Mensajes de error más claros
- Diagnóstico de problemas

---

## [2.0.0] - 2025-10-XX

### ✨ Agregado
- Integración con Claude API
- Sistema de turnos automático
- Indicador visual "Claude está pensando"

### 🔧 Mejorado
- Lógica de comunicación con IA
- Parsing de movimientos
- Validación de respuestas

---

## [1.5.0] - 2025-10-XX

### ✨ Agregado
- Historial de movimientos
- Piezas capturadas
- Notación de movimientos

### 🔧 Mejorado
- Interfaz de usuario
- Panel lateral
- Visualización de estado

---

## [1.0.0] - 2025-10-XX

### 🎉 Lanzamiento Inicial

#### ✨ Agregado
- Tablero de ajedrez visual
- Todas las reglas del ajedrez
- Enroque (kingside y queenside)
- Captura al paso (en passant)
- Promoción de peones
- Detección de jaque, jaque mate y ahogado
- Validación completa de movimientos
- Interfaz gráfica moderna
- Diseño responsivo
- Coordenadas del tablero
- Selección de color (blancas/negras)

---

## Leyenda

- 🎉 Lanzamiento importante
- ✨ Nueva característica
- 🔧 Mejora
- 🐛 Corrección de bug
- 📚 Documentación
- 🎨 Cambios visuales
- 💻 Cambios técnicos
- ⚠️ Deprecado
- 🗑️ Eliminado

---

## Versionado

Este proyecto sigue [Semantic Versioning](https://semver.org/):
- **MAJOR**: Cambios incompatibles en la API
- **MINOR**: Nueva funcionalidad compatible
- **PATCH**: Correcciones de bugs compatibles

---

## Enlaces

- [README](README.md)
- [Documentación de Características](NUEVAS_CARACTERISTICAS.md)
- [Resumen de Implementación](RESUMEN_IMPLEMENTACION.md)
- [Guía de Instalación](LEEME_PRIMERO.html)
- [Solución de Problemas](INSTRUCCIONES_RAPIDAS.md)

