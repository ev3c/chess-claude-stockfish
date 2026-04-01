# 🎉 Nuevas Características - Versión 3.0

Este documento describe en detalle todas las nuevas características agregadas al juego de ajedrez.

## 📋 Índice de Contenidos

1. [Deshacer Movimiento](#deshacer-movimiento)
2. [Niveles de Dificultad](#niveles-de-dificultad)
3. [Modos de Juego](#modos-de-juego)
4. [Sugerencias de Movimientos](#sugerencias-de-movimientos)
5. [Análisis de Partidas](#análisis-de-partidas)
6. [Guardar y Cargar Partidas](#guardar-y-cargar-partidas)
7. [Exportación PGN](#exportación-pgn)
8. [Temas del Tablero](#temas-del-tablero)
9. [Reloj de Ajedrez](#reloj-de-ajedrez)
10. [Modo Entrenamiento](#modo-entrenamiento)

---

## ⬅ Deshacer Movimiento

### Descripción
Permite retroceder movimientos realizados durante la partida.

### Cómo usar
1. Haz clic en el botón "⬅ Deshacer Movimiento"
2. En modo vs IA: Se deshacen 2 movimientos (el tuyo y el de Claude)
3. En modo vs Humano: Se deshace 1 movimiento a la vez

### Detalles técnicos
- Guarda el estado completo del tablero antes de cada movimiento
- Restaura: posición de piezas, turno, piezas capturadas, derechos de enroque, en passant
- El botón se desactiva cuando no hay movimientos que deshacer

---

## 🎯 Niveles de Dificultad

### Niveles disponibles

#### 1. Principiante
- Claude juega de forma simple
- Comete pequeños errores ocasionales
- Ideal para jugadores nuevos

#### 2. Intermedio
- Usa tácticas básicas
- Estrategia moderada
- Bueno para jugadores con algo de experiencia

#### 3. Avanzado (por defecto)
- Tácticas y estrategias sólidas
- Juego equilibrado y competitivo
- Para jugadores experimentados

#### 4. Experto
- Nivel de gran maestro
- Análisis profundo de posiciones
- Máximo desafío

### Cómo cambiar el nivel
1. Selecciona el nivel en "Nivel de Dificultad IA"
2. El nivel se aplica automáticamente en la próxima jugada de Claude
3. Puedes cambiarlo durante la partida

---

## 🎮 Modos de Juego

### 1. vs Claude (IA)
- Juega contra la inteligencia artificial
- Elige tu color y nivel de dificultad
- Claude piensa y mueve automáticamente

### 2. Humano vs Humano
- Modo local para dos jugadores
- Turnan para mover
- No requiere API Key
- Perfecto para jugar con amigos

### 3. Modo Entrenamiento
- Resuelve puzzles de ajedrez
- Aprende tácticas y estrategias
- Incluye puzzles de mate en 1 y más

---

## 💡 Sugerencias de Movimientos

### Descripción
Claude analiza la posición actual y sugiere el mejor movimiento.

### Cómo usar
1. En tu turno, haz clic en "💡 Sugerencia"
2. Claude analizará la posición
3. Recibirás una sugerencia del mejor movimiento (ej: "Mueve de e2 a e4")
4. El movimiento se resaltará automáticamente en el tablero

### Consejos
- Úsalo para aprender nuevas tácticas
- Ideal cuando estás bloqueado
- Requiere API Key configurada

---

## 📊 Análisis de Partidas

### Descripción
Claude proporciona un análisis detallado de tu partida.

### Qué incluye el análisis
1. Resumen general de la partida
2. Movimientos clave y momentos decisivos
3. Errores cometidos por ambos jugadores
4. Sugerencias de mejora
5. Evaluación de la posición actual

### Cómo usar
1. Haz clic en "📊 Analizar Partida"
2. Espera mientras Claude analiza (puede tardar unos segundos)
3. El análisis se abrirá en una nueva ventana
4. Puedes guardar o imprimir el análisis

### Cuándo usar
- Al finalizar una partida
- Para entender qué salió bien o mal
- Para mejorar tu juego

---

## 💾 Guardar y Cargar Partidas

### Guardar Partida

#### Cómo guardar
1. Haz clic en "💾 Guardar Partida"
2. Ingresa un nombre para la partida
3. La partida se guarda en tu navegador

#### Qué se guarda
- Posición completa del tablero
- Historial de movimientos
- Piezas capturadas
- Color del jugador
- Fecha y hora

### Cargar Partida

#### Cómo cargar
1. Haz clic en "📂 Cargar Partida"
2. Se muestra una lista de partidas guardadas
3. Selecciona el número de la partida
4. La partida se restaura completamente

### Notas importantes
- Las partidas se guardan en localStorage (en tu navegador)
- No se pierden al cerrar el navegador
- Se pierden si borras los datos del navegador
- Puedes tener múltiples partidas guardadas

---

## 📄 Exportación PGN

### ¿Qué es PGN?
PGN (Portable Game Notation) es el formato estándar para compartir partidas de ajedrez.

### Cómo exportar
1. Haz clic en "📄 Exportar PGN"
2. Se descarga automáticamente un archivo .pgn
3. El archivo contiene toda la partida en formato estándar

### Qué puedes hacer con el archivo PGN
- Importarlo en otros programas de ajedrez (ChessBase, Lichess, Chess.com)
- Compartirlo con amigos
- Archivarlo para referencia futura
- Analizarlo en otras aplicaciones

### Formato del archivo
```
[Event "Partida vs Claude"]
[Date "2025-10-13"]
[White "Jugador"]
[Black "Claude AI"]

1. e2-e4 e7-e5 2. Nf3 Nc6 ...
```

---

## 🎨 Temas del Tablero

### Temas disponibles

#### 1. Clásico (por defecto)
- Casillas claras: Beige claro
- Casillas oscuras: Marrón
- El tema tradicional de ajedrez

#### 2. Madera
- Casillas claras: Madera clara
- Casillas oscuras: Madera oscura
- Aspecto natural y elegante

#### 3. Azul
- Casillas claras: Gris azulado claro
- Casillas oscuras: Azul grisáceo
- Moderno y profesional

#### 4. Verde
- Casillas claras: Amarillo pálido
- Casillas oscuras: Verde oliva
- Suave para la vista

#### 5. Gris
- Casillas claras: Gris claro
- Casillas oscuras: Gris medio
- Minimalista y moderno

### Cómo cambiar el tema
1. Selecciona un tema en "Tema del Tablero"
2. El cambio se aplica inmediatamente
3. Tu preferencia se guarda automáticamente
4. Se mantiene entre sesiones

---

## ⏱ Reloj de Ajedrez

### Descripción
Sistema de tiempo límite para partidas competitivas.

### Cómo activar
1. Marca la casilla "Reloj de Ajedrez"
2. Configura los minutos por jugador (1-60 minutos)
3. Inicia una nueva partida
4. El reloj se activa automáticamente

### Funcionamiento
- El reloj corre durante el turno de cada jugador
- Se pausa cuando cambias de turno
- Advertencias visuales cuando queda poco tiempo:
  - **Amarillo**: Menos de 1 minuto
  - **Rojo parpadeante**: Menos de 30 segundos

### Fin del tiempo
- Si se agota el tiempo, pierdes automáticamente
- Se muestra un mensaje indicando quién ganó
- La partida termina inmediatamente

### Visualización
- El reloj del jugador activo se resalta en azul
- Formato: MM:SS (minutos:segundos)
- Dos relojes visibles: uno para blancas, uno para negras

---

## 🧩 Modo Entrenamiento

### Descripción
Resuelve puzzles de ajedrez para mejorar tus habilidades.

### Puzzles incluidos
Actualmente incluye puzzles de mate en 1:
1. Mate del Pastor (Scholar's Mate)
2. Mate del Loco (Fool's Mate)
3. Más puzzles en desarrollo

### Cómo usar
1. Selecciona "Modo Entrenamiento" en Modo de Juego
2. Haz clic en "Nueva Partida"
3. Lee la descripción del puzzle
4. Encuentra la solución
5. Realiza el movimiento correcto
6. Pasa automáticamente al siguiente puzzle

### Beneficios
- Aprende patrones de mate
- Mejora tu visión táctica
- Práctica sin presión
- Progreso paso a paso

---

## 🔧 Solución de Problemas

### La sugerencia no funciona
- Verifica que tu API Key esté configurada
- Asegúrate de que es tu turno
- Comprueba tu conexión a internet

### No puedo cargar una partida guardada
- Verifica que hay partidas guardadas
- Asegúrate de no haber borrado los datos del navegador
- Intenta guardar una nueva partida de prueba

### El reloj no aparece
- Activa la casilla "Reloj de Ajedrez"
- Inicia una nueva partida
- El reloj solo funciona en partidas nuevas

### El análisis tarda mucho
- El análisis puede tardar 10-30 segundos
- Depende de la longitud de la partida
- Requiere conexión estable a internet

---

## 💡 Consejos y Trucos

### Para mejorar tu juego
1. Usa el modo Entrenamiento regularmente
2. Analiza tus partidas después de jugar
3. Pide sugerencias en posiciones complejas
4. Practica contra diferentes niveles de dificultad

### Para una mejor experiencia
1. Guarda tus partidas interesantes
2. Exporta partidas importantes a PGN
3. Experimenta con diferentes temas de tablero
4. Usa el reloj para partidas más emocionantes

### Para aprender
1. Juega contra nivel Principiante primero
2. Analiza cada partida que pierdas
3. Practica los puzzles varias veces
4. Compara tus movimientos con las sugerencias de Claude

---

## 📞 Soporte

Si encuentras problemas o tienes sugerencias:
1. Revisa este documento
2. Consulta el README.md principal
3. Verifica tu API Key y conexión
4. Comprueba la consola del navegador para errores

---

¡Disfruta de todas las nuevas características! ♟️

