const APP_VERSION = '2.4.6';

let game = null;
let playerColor = 'white';
let selectedSquare = null;
let gameMode = 'vs-ai'; // vs-ai, vs-human, puzzle
let aiDifficulty = 1; // Nivel Stockfish (0-20)
let boardTheme = 'classic';
let pieceStyle = 'cburnett';
let showCoordinates = false;
let showMoveInsights = false;
let clockEnabled = true; // Reloj siempre activado
let timePerPlayer = 60; // minutos (base)
let incrementPerMove = 0; // segundos de incremento
let whiteTime = 3600; // segundos
let blackTime = 3600; // segundos
let clockInterval = null;
let lastMoveSquares = { from: null, to: null }; // Guardar último movimiento para resaltar
let bestMoveSquares = { from: null, to: null }; // Movimiento recomendado por el análisis (verde)
let currentMoveIndex = -1; // Índice del movimiento actual en visualización (-1 = posición actual)
let gameStateSnapshots = []; // Estados del juego en cada movimiento
let analysisErrorsList = []; // Errores e imprecisiones del análisis post-partida
let analysisErrorsCurrentIndex = 0;
let analysisActive = false;
let dragState = null;

const ANALYSIS_DISABLED_IDS = ['new-game', 'start-opening-training', 'start-opening-quiz', 'load-famous-game',
    'resign-game', 'offer-draw', 'resume-game', 'undo-move', 'hint-move', 'analyze-game',
    'resign-game-sidebar', 'offer-draw-sidebar', 'view-analysis', 'resume-game-sidebar', 'undo-move-sidebar', 'hint-move-sidebar', 'analyze-game-sidebar',
    'copy-pgn', 'copy-pgn-board', 'export-pgn', 'import-pgn', 'reset-stats',
    'nav-first', 'nav-prev', 'nav-next', 'nav-last',
    'start-puzzle', 'puzzle-hint', 'puzzle-solution', 'puzzle-skip',
    'show-known-variants', 'view-opening',
    'player-color-btn-white', 'player-color-btn-black',
    'ai-difficulty', 'opening-select', 'famous-game-select', 'time-control',
    'piece-style', 'puzzle-theme-select', 'puzzle-difficulty-select'];

// Estadísticas del jugador
let stats = {
    wins: 0,
    draws: 0,
    losses: 0
};

// Motor Stockfish
let stockfish = null;
let stockfishReady = false;
let pendingMove = null;
let pendingPromotionMove = null;

// Estilos de piezas disponibles (solo para el set clásico Unicode)
const PIECE_SETS = {
    classic: {
        WHITE_KING: '♔', WHITE_QUEEN: '♕', WHITE_ROOK: '♖',
        WHITE_BISHOP: '♗', WHITE_KNIGHT: '♘', WHITE_PAWN: '♙',
        BLACK_KING: '♚', BLACK_QUEEN: '♛', BLACK_ROOK: '♜',
        BLACK_BISHOP: '♝', BLACK_KNIGHT: '♞', BLACK_PAWN: '♟'
    }
};

// Sets de piezas SVG disponibles (desde carpeta pieces/)
const SVG_PIECE_SETS = ['cburnett', 'merida', 'pixel', 'fantasy', 'letter', 'alpha', 'california', 'staunty', 'horsey', 'maestro', 'tatiana', 'companion', 'leipzig'];

// Inicializar motor de ajedrez (Stockfish 17 vía API)
async function initStockfish() {
    try {
        console.log('Inicializando Stockfish 17 (Chess-API.com)...');
        
        // Verificar disponibilidad de la API
        const testResponse = await fetch('https://chess-api.com/v1');
        if (!testResponse.ok) {
            throw new Error('API no disponible');
        }
        
        stockfishReady = true;
        console.log('✅ Motor Stockfish 17 NNUE disponible - 20 niveles de dificultad');
        
    } catch (error) {
        console.error('Error al conectar con API de Stockfish, usando motor local:', error);
        stockfishReady = true;
    }
}

// Libro de aperturas para variedad en las partidas
const OPENING_BOOK = {
    // Respuestas a 1.e4
    'e2e4': ['e7e5', 'c7c5', 'd7d5', 'e7e6', 'c7c6', 'g7g6', 'd7d6', 'b7b6'],
    // Respuestas a 1.d4
    'd2d4': ['d7d5', 'g8f6', 'e7e6', 'f7f5', 'c7c5', 'g7g6', 'd7d6'],
    // Respuestas a 1.c4 (Inglesa)
    'c2c4': ['e7e5', 'c7c5', 'g8f6', 'e7e6', 'g7g6'],
    // Respuestas a 1.Nf3 (Reti)
    'g1f3': ['d7d5', 'g8f6', 'c7c5', 'f7f5', 'g7g6'],

    // Aperturas como blancas (primer movimiento)
    'start_white': ['e2e4', 'd2d4', 'c2c4', 'g1f3', 'b2b3', 'g2g3'],

    // Siciliana: 1.e4 c5
    'e2e4 c7c5': ['g1f3', 'b1c3', 'c2c3', 'd2d4', 'f2f4'],
    // Española: 1.e4 e5 2.Nf3
    'e2e4 e7e5': ['g1f3', 'f1c4', 'b1c3', 'f2f4', 'd2d4'],
    // Francesa: 1.e4 e6
    'e2e4 e7e6': ['d2d4', 'd2d3', 'g1f3', 'b1c3'],
    // Caro-Kann: 1.e4 c6
    'e2e4 c7c6': ['d2d4', 'b1c3', 'g1f3', 'd2d3'],
    // Escandinava: 1.e4 d5
    'e2e4 d7d5': ['e4d5', 'b1c3', 'e4e5'],
    // Pirc: 1.e4 d6
    'e2e4 d7d6': ['d2d4', 'g1f3', 'b1c3', 'f2f4'],

    // 1.e4 e5 2.Nf3 Nc6
    'e2e4 e7e5 g1f3': ['b8c6', 'g8f6', 'd7d6'],
    'e2e4 e7e5 g1f3 b8c6': ['f1b5', 'f1c4', 'd2d4', 'b1c3'],
    'e2e4 e7e5 g1f3 g8f6': ['g1e5', 'd2d4', 'b1c3', 'f1c4'],

    // Gambito de Dama: 1.d4 d5
    'd2d4 d7d5': ['c2c4', 'g1f3', 'c1f4', 'e2e3', 'b1c3'],
    // India de Rey: 1.d4 Nf6
    'd2d4 g8f6': ['c2c4', 'g1f3', 'c1f4', 'e2e3', 'b1c3'],
    // Holandesa: 1.d4 f5
    'd2d4 f7f5': ['c2c4', 'g1f3', 'g2g3', 'e2e3'],
    // Benoni: 1.d4 c5
    'd2d4 c7c5': ['d4d5', 'e2e3', 'g1f3'],

    // Gambito de Dama aceptado/rehusado
    'd2d4 d7d5 c2c4': ['d5c4', 'e7e6', 'c7c6', 'g8f6'],
    'd2d4 d7d5 c2c4 e7e6': ['b1c3', 'g1f3', 'c1g5'],
    'd2d4 d7d5 c2c4 c7c6': ['g1f3', 'b1c3', 'e2e3'],

    // India de Rey continuaciones
    'd2d4 g8f6 c2c4': ['g7g6', 'e7e6', 'c7c5', 'e7e5', 'b7b6'],
    'd2d4 g8f6 c2c4 g7g6': ['b1c3', 'g1f3', 'g2g3'],
    'd2d4 g8f6 c2c4 e7e6': ['b1c3', 'g1f3', 'g2g3'],

    // Siciliana continuaciones
    'e2e4 c7c5 g1f3': ['d7d6', 'b8c6', 'e7e6', 'g7g6'],
    'e2e4 c7c5 g1f3 d7d6': ['d2d4', 'f1b5', 'b1c3'],
    'e2e4 c7c5 g1f3 b8c6': ['d2d4', 'f1b5', 'b1c3'],
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6': ['c1g5', 'c1e3', 'f2f3', 'f1e2'],
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6': ['c1e3', 'f1e2', 'f2f3'],
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5': ['e7e6'],
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3': ['f8g7'],
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7': ['f2f3'],
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3': ['e8g8'],
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8': ['d1d2'],

    // Española profunda
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7': ['f1e1'],
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1': ['b7b5'],
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3': ['d7d6'],
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3': ['e8g8'],
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8': ['h2h3'],
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3': ['c6b8', 'c8b7', 'c6a5'],

    // India de Rey profunda
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3': ['e8g8'],
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8': ['f1e2'],
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2': ['e7e5'],
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1': ['b8c6', 'b8a6', 'f6d7'],
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6': ['d4d5'],

    // GDR profunda
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5': ['f8e7'],
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7': ['e2e3'],
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3': ['e8g8'],
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8': ['g1f3'],
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3': ['b8d7'],
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7': ['a1c1'],

    // Semi-Eslava profunda
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6': ['e2e3', 'c1g5'],
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3': ['b8d7'],
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3': ['d5c4'],

    // Londres profundo
    'd2d4 d7d5 c1f4 g8f6 e2e3': ['c7c5', 'e7e6'],
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5': ['c2c3'],
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3': ['b8c6'],
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3 b8c6': ['g1f3'],
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6': ['g1f3'],
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3': ['f8d6'],
};
 
const OPENING_NAMES = {
    // Primer movimiento blancas
    'e2e4': '1.e4 — Apertura de Peón de Rey',
    'd2d4': '1.d4 — Apertura de Peón de Dama',
    'c2c4': '1.c4 — Apertura Inglesa',
    'g1f3': '1.Nf3 — Apertura Réti',
    'b2b3': '1.b3 — Apertura Larsen',
    'g2g3': '1.g3 — Apertura Húngara',

    // 1.e4 respuestas
    'e2e4 e7e5': '1...e5 — Juego Abierto',
    'e2e4 c7c5': '1...c5 — Defensa Siciliana',
    'e2e4 e7e6': '1...e6 — Defensa Francesa',
    'e2e4 c7c6': '1...c6 — Defensa Caro-Kann',
    'e2e4 d7d5': '1...d5 — Defensa Escandinava',
    'e2e4 d7d6': '1...d6 — Defensa Pirc',
    'e2e4 g7g6': '1...g6 — Defensa Moderna',
    'e2e4 b7b6': '1...b6 — Defensa Owen',

    // Italiana / Española / Escocesa
    'e2e4 e7e5 g1f3': '2.Nf3 — Apertura del Caballo de Rey',
    'e2e4 e7e5 g1f3 b8c6': '2...Nc6 — Defensa de los Dos Caballos',
    'e2e4 e7e5 g1f3 b8c6 f1b5': '3.Bb5 — Apertura Española (Ruy López)',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6': '3...a6 — Española: Variante Morphy',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4': '4.Ba4 — Española: Morphy Clásica',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6': '4...Nf6 — Española: Abierta',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1': '5.O-O — Española: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7': '5...Be7 — Española: Cerrada',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 b7b5': '5...b5 — Española: Arcángel',
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6': '3...Nf6 — Española: Defensa Berlinesa',
    'e2e4 e7e5 g1f3 b8c6 f1b5 f8c5': '3...Bc5 — Española: Defensa Clásica',
    'e2e4 e7e5 g1f3 b8c6 f1b5 d7d6': '3...d6 — Española: Defensa Steinitz',
    'e2e4 e7e5 g1f3 b8c6 f1b5 f7f5': '3...f5 — Española: Gambito Schliemann',
    'e2e4 e7e5 g1f3 b8c6 f1c4': '3.Bc4 — Apertura Italiana (Giuoco Piano)',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5': '3...Bc5 — Italiana: Giuoco Piano',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3': '4.c3 — Italiana: Giuoco Piano Lento',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4': '4.b4 — Gambito Evans',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3': '4.d3 — Italiana: Giuoco Pianissimo',
    'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6': '3...Nf6 — Italiana: Dos Caballos',
    'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d4': '4.d4 — Dos Caballos: Ataque Moderno',
    'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 g1g5': '4.Ng5 — Dos Caballos: Ataque Fried Liver',
    'e2e4 e7e5 g1f3 b8c6 d2d4': '3.d4 — Apertura Escocesa',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4': '3...exd4 — Escocesa: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4': '4.Nxd4 — Escocesa Clásica',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f1c4': '4.Bc4 — Gambito Escocés',
    'e2e4 e7e5 g1f3 b8c6 b1c3': '3.Nc3 — Apertura de los Cuatro Caballos',
    'e2e4 e7e5 g1f3 g8f6': '2...Nf6 — Defensa Petrov',
    'e2e4 e7e5 g1f3 g8f6 f3e5': '3.Nxe5 — Petrov: Línea Principal',
    'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6': '3...d6 — Petrov: Variante Clásica',
    'e2e4 e7e5 g1f3 g8f6 d2d4': '3.d4 — Petrov: Ataque Steinitz',
    'e2e4 e7e5 g1f3 g8f6 b1c3': '3.Nc3 — Petrov: Tres Caballos',
    'e2e4 e7e5 f1c4': '2.Bc4 — Apertura del Alfil',
    'e2e4 e7e5 f2f4': '2.f4 — Gambito de Rey',
    'e2e4 e7e5 f2f4 e5f4': '2...exf4 — Gambito de Rey Aceptado',
    'e2e4 e7e5 f2f4 f8c5': '2...Bc5 — Gambito de Rey Rehusado',
    'e2e4 e7e5 d2d4': '2.d4 — Gambito del Centro',
    'e2e4 e7e5 b1c3': '2.Nc3 — Apertura Vienesa',
    'e2e4 e7e5 b1c3 g8f6': '2...Nf6 — Vienesa: Variante Falkbeer',
    'e2e4 e7e5 b1c3 b8c6': '2...Nc6 — Vienesa: Línea Principal',

    // Siciliana variantes
    'e2e4 c7c5 g1f3': '2.Nf3 — Siciliana Abierta',
    'e2e4 c7c5 g1f3 d7d6': '2...d6 — Siciliana Najdorf / Dragón',
    'e2e4 c7c5 g1f3 d7d6 d2d4': '3.d4 — Siciliana Abierta: Variante Principal',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4': '3...cxd4 — Siciliana Abierta',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4': '4.Nxd4 — Siciliana: Línea Principal',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6': '4...Nf6 — Siciliana: Preparando Najdorf/Dragón',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3': '5.Nc3 — Siciliana: Línea Clásica',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6': '5...a6 — Siciliana Najdorf',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6': '5...g6 — Siciliana Dragón',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5': '5...e5 — Siciliana Sveshnikov',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 b8c6': '5...Nc6 — Siciliana Clásica',
    'e2e4 c7c5 g1f3 b8c6': '2...Nc6 — Siciliana Clásica',
    'e2e4 c7c5 g1f3 b8c6 d2d4': '3.d4 — Siciliana Clásica Abierta',
    'e2e4 c7c5 g1f3 e7e6': '2...e6 — Siciliana Paulsen / Taimanov',
    'e2e4 c7c5 g1f3 e7e6 d2d4': '3.d4 — Siciliana Paulsen: Línea Principal',
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6': '4...a6 — Siciliana Kan',
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6': '4...Nc6 — Siciliana Taimanov',
    'e2e4 c7c5 g1f3 g7g6': '2...g6 — Siciliana Acelerada del Dragón',
    'e2e4 c7c5 b1c3': '2.Nc3 — Siciliana Cerrada',
    'e2e4 c7c5 c2c3': '2.c3 — Siciliana Alapin',
    'e2e4 c7c5 c2c3 d7d5': '2...d5 — Alapin: Línea Principal',
    'e2e4 c7c5 c2c3 g8f6': '2...Nf6 — Alapin: Variante Moderna',
    'e2e4 c7c5 d2d4': '2.d4 — Gambito Smith-Morra',
    'e2e4 c7c5 d2d4 c5d4': '2...cxd4 — Smith-Morra Aceptado',
    'e2e4 c7c5 f2f4': '2.f4 — Gambito Grand Prix',

    // Francesa variantes
    'e2e4 e7e6 d2d4': '2.d4 — Francesa: Variante Principal',
    'e2e4 e7e6 d2d4 d7d5': '2...d5 — Francesa Clásica',
    'e2e4 e7e6 d2d4 d7d5 b1c3': '3.Nc3 — Francesa: Winawer / Clásica',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4': '3...Bb4 — Francesa: Variante Winawer',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5': '4.e5 — Winawer: Línea Principal',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5': '4...c5 — Winawer: Variante Clásica',
    'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6': '3...Nf6 — Francesa: Variante Clásica',
    'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5': '4.Bg5 — Francesa Clásica: Línea McCutcheon',
    'e2e4 e7e6 d2d4 d7d5 b1c3 d5e4': '3...dxe4 — Francesa: Variante Rubinstein',
    'e2e4 e7e6 d2d4 d7d5 e4e5': '3.e5 — Francesa: Variante del Avance',
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5': '3...c5 — Francesa Avance: Línea Principal',
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3': '4.c3 — Francesa Avance: Variante Nimzowitsch',
    'e2e4 e7e6 d2d4 d7d5 b1d2': '3.Nd2 — Francesa: Variante Tarrasch',
    'e2e4 e7e6 d2d4 d7d5 b1d2 g8f6': '3...Nf6 — Tarrasch: Línea Principal',
    'e2e4 e7e6 d2d4 d7d5 b1d2 c7c5': '3...c5 — Tarrasch: Variante Abierta',

    // Caro-Kann variantes
    'e2e4 c7c6 d2d4': '2.d4 — Caro-Kann: Variante Principal',
    'e2e4 c7c6 d2d4 d7d5': '2...d5 — Caro-Kann Clásica',
    'e2e4 c7c6 d2d4 d7d5 b1c3': '3.Nc3 — Caro-Kann: Variante Clásica',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4': '3...dxe4 — Caro-Kann Clásica: Línea Principal',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4': '4.Nxe4 — Caro-Kann: Variante Principal',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5': '4...Bf5 — Caro-Kann: Clásica con Bf5',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 b8d7': '4...Nd7 — Caro-Kann: Variante Smyslov',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 g8f6': '4...Nf6 — Caro-Kann: Bronstein-Larsen',
    'e2e4 c7c6 d2d4 d7d5 e4e5': '3.e5 — Caro-Kann: Variante del Avance',
    'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5': '3...Bf5 — Caro-Kann Avance: Línea Principal',
    'e2e4 c7c6 d2d4 d7d5 e4d5': '3.exd5 — Caro-Kann: Variante del Cambio',
    'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5': '3...cxd5 — Caro-Kann: Cambio Simétrico',

    // Escandinava
    'e2e4 d7d5 e4d5': '2.exd5 — Escandinava: Línea Principal',
    'e2e4 d7d5 e4d5 d8d5': '2...Qxd5 — Escandinava: Recuperación Inmediata',
    'e2e4 d7d5 e4d5 d8d5 b1c3': '3.Nc3 — Escandinava: Línea Principal',
    'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5': '3...Qa5 — Escandinava: Variante Clásica',
    'e2e4 d7d5 e4d5 d8d5 b1c3 d5d6': '3...Qd6 — Escandinava: Variante Moderna',
    'e2e4 d7d5 e4d5 g8f6': '2...Nf6 — Escandinava: Variante Moderna (Marshall)',

    // Pirc / Moderna
    'e2e4 d7d6 d2d4': '2.d4 — Pirc: Variante Principal',
    'e2e4 d7d6 d2d4 g8f6': '2...Nf6 — Pirc Clásica',
    'e2e4 d7d6 d2d4 g8f6 b1c3': '3.Nc3 — Pirc: Línea Principal',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6': '3...g6 — Pirc: Sistema Clásico',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 f2f4': '4.f4 — Pirc: Ataque Austriaco',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3': '4.Nf3 — Pirc: Línea Clásica',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 c1e3': '4.Be3 — Pirc: Sistema 150 Ataque',

    // 1.d4 respuestas
    'd2d4 d7d5': '1...d5 — Juego Cerrado',
    'd2d4 g8f6': '1...Nf6 — Defensa India',
    'd2d4 e7e6': '1...e6 — Defensa Francesa Invertida',
    'd2d4 f7f5': '1...f5 — Defensa Holandesa',
    'd2d4 c7c5': '1...c5 — Defensa Benoni',
    'd2d4 g7g6': '1...g6 — Defensa India de Rey Moderna',
    'd2d4 d7d6': '1...d6 — Defensa India Antigua',

    // Gambito de Dama
    'd2d4 d7d5 c2c4': '2.c4 — Gambito de Dama',
    'd2d4 d7d5 c2c4 d5c4': '2...dxc4 — Gambito de Dama Aceptado',
    'd2d4 d7d5 c2c4 d5c4 g1f3': '3.Nf3 — GDA: Línea Principal',
    'd2d4 d7d5 c2c4 d5c4 e2e3': '3.e3 — GDA: Variante Clásica',
    'd2d4 d7d5 c2c4 e7e6': '2...e6 — Gambito de Dama Rehusado',
    'd2d4 d7d5 c2c4 e7e6 b1c3': '3.Nc3 — GDR: Línea Principal',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6': '3...Nf6 — GDR Clásico',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5': '4.Bg5 — GDR: Variante Ortodoxa',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7': '4...Be7 — GDR Ortodoxa: Línea Principal',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3': '4.Nf3 — GDR: Variante del Cambio',
    'd2d4 d7d5 c2c4 e7e6 g1f3': '3.Nf3 — GDR: Sistema Nf3',
    'd2d4 d7d5 c2c4 e7e6 g1f3 g8f6': '3...Nf6 — GDR: Línea Clásica',
    'd2d4 d7d5 c2c4 c7c6': '2...c6 — Defensa Eslava',
    'd2d4 d7d5 c2c4 c7c6 g1f3': '3.Nf3 — Eslava: Línea Principal',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6': '3...Nf6 — Eslava Clásica',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3': '4.Nc3 — Eslava: Variante Principal',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4': '4...dxc4 — Eslava: Variante Checa',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6': '4...e6 — Semi-Eslava',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3': '5.e3 — Semi-Eslava: Meran',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 c1g5': '5.Bg5 — Semi-Eslava: Anti-Meran',
    'd2d4 d7d5 c2c4 g8f6': '2...Nf6 — Defensa Marshall',
    'd2d4 d7d5 g1f3': '2.Nf3 — Sistema Londres / Colle',
    'd2d4 d7d5 g1f3 g8f6': '2...Nf6 — Sistema Colle',
    'd2d4 d7d5 g1f3 g8f6 c1f4': '3.Bf4 — Sistema Londres',
    'd2d4 d7d5 g1f3 g8f6 e2e3': '3.e3 — Sistema Colle: Línea Principal',
    'd2d4 d7d5 c1f4': '2.Bf4 — Sistema Londres',
    'd2d4 d7d5 c1f4 g8f6': '2...Nf6 — Londres: Línea Principal',
    'd2d4 d7d5 c1f4 g8f6 e2e3': '3.e3 — Londres: Variante Clásica',
    'd2d4 d7d5 c1f4 g8f6 g1f3': '3.Nf3 — Londres: Línea Moderna',

    // India de Rey
    'd2d4 g8f6 c2c4': '2.c4 — Sistema Indio',
    'd2d4 g8f6 c2c4 g7g6': '2...g6 — India de Rey',
    'd2d4 g8f6 c2c4 g7g6 b1c3': '3.Nc3 — India de Rey: Línea Principal',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7': '3...Bg7 — India de Rey: Fianchetto',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4': '4.e4 — India de Rey: Línea Clásica',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6': '4...d6 — India de Rey: Variante Principal',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3': '5.Nf3 — India de Rey: Clásica',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3': '5.f3 — India de Rey: Sämisch',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1e2': '5.Ne2 — India de Rey: Averbakh',
    'd2d4 g8f6 c2c4 g7g6 g1f3': '3.Nf3 — India de Rey: Fianchetto',
    'd2d4 g8f6 c2c4 g7g6 g2g3': '3.g3 — India de Rey: Sistema Fianchetto',
    'd2d4 g8f6 c2c4 e7e6': '2...e6 — India de Dama / Nimzo-India',
    'd2d4 g8f6 c2c4 e7e6 b1c3': '3.Nc3 — Nimzo-India',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4': '3...Bb4 — Nimzo-India: Línea Principal',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2': '4.Qc2 — Nimzo-India: Variante Clásica',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3': '4.e3 — Nimzo-India: Variante Rubinstein',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 a2a3': '4.a3 — Nimzo-India: Variante Sämisch',
    'd2d4 g8f6 c2c4 e7e6 g1f3': '3.Nf3 — India de Dama',
    'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6': '3...b6 — India de Dama: Línea Principal',
    'd2d4 g8f6 c2c4 e7e6 g1f3 f8b4': '3...Bb4+ — Bogo-India',
    'd2d4 g8f6 c2c4 e7e6 g1f3 d7d5': '3...d5 — GDR: Transposición',
    'd2d4 g8f6 c2c4 e7e6 g2g3': '3.g3 — Catalana',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5': '3...d5 — Catalana: Línea Principal',
    'd2d4 g8f6 c2c4 c7c5': '2...c5 — Benoni Moderna',
    'd2d4 g8f6 c2c4 c7c5 d4d5': '3.d5 — Benoni: Línea Principal',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6': '3...e6 — Benoni Moderna: Clásica',
    'd2d4 g8f6 c2c4 e7e5': '2...e5 — Gambito Budapest',
    'd2d4 g8f6 c2c4 b7b6': '2...b6 — Defensa India de Dama',
    'd2d4 g8f6 g1f3': '2.Nf3 — Sistema Indio de Dama',
    'd2d4 g8f6 c1f4': '2.Bf4 — Sistema Londres vs India',
    'd2d4 g8f6 c1f4 d7d5': '2...d5 — Londres vs India: Línea Principal',
    'd2d4 g8f6 c1f4 g7g6': '2...g6 — Londres vs India de Rey',

    // Holandesa
    'd2d4 f7f5 c2c4': '2.c4 — Holandesa: Variante Principal',
    'd2d4 f7f5 g1f3': '2.Nf3 — Holandesa: Clásica',
    'd2d4 f7f5 g2g3': '2.g3 — Holandesa: Leningrado',
    'd2d4 f7f5 c2c4 g8f6': '2...Nf6 — Holandesa: Línea Principal',
    'd2d4 f7f5 c2c4 g8f6 g2g3': '3.g3 — Holandesa: Leningrado Moderna',
    'd2d4 f7f5 c2c4 e7e6': '2...e6 — Holandesa: Muro de Piedra',

    // Inglesa continuaciones
    'c2c4 e7e5': '1...e5 — Inglesa: Siciliana Invertida',
    'c2c4 e7e5 b1c3': '2.Nc3 — Inglesa: Línea Principal',
    'c2c4 e7e5 b1c3 g8f6': '2...Nf6 — Inglesa: Variante Principal',
    'c2c4 e7e5 b1c3 g8f6 g1f3': '3.Nf3 — Inglesa: Cuatro Caballos',
    'c2c4 e7e5 g2g3': '2.g3 — Inglesa: Fianchetto',
    'c2c4 c7c5': '1...c5 — Inglesa Simétrica',
    'c2c4 c7c5 g1f3': '2.Nf3 — Inglesa Simétrica: Línea Principal',
    'c2c4 c7c5 b1c3': '2.Nc3 — Inglesa Simétrica: Nc3',
    'c2c4 g8f6': '1...Nf6 — Inglesa: India',
    'c2c4 g8f6 b1c3': '2.Nc3 — Inglesa India: Línea Principal',
    'c2c4 g8f6 g1f3': '2.Nf3 — Inglesa India: Sistema Réti',
    'c2c4 e7e6': '1...e6 — Inglesa: Agincourt',
    'c2c4 g7g6': '1...g6 — Inglesa: Moderna',

    // Réti
    'g1f3 d7d5': '1...d5 — Réti: Clásica',
    'g1f3 d7d5 c2c4': '2.c4 — Réti: Gambito',
    'g1f3 d7d5 c2c4 d5c4': '2...dxc4 — Réti: Gambito Aceptado',
    'g1f3 d7d5 c2c4 e7e6': '2...e6 — Réti: Línea Principal',
    'g1f3 d7d5 c2c4 c7c6': '2...c6 — Réti: Eslava',
    'g1f3 d7d5 g2g3': '2.g3 — Réti: Sistema Catalán',
    'g1f3 d7d5 g2g3 g8f6': '2...Nf6 — Réti Catalán: Línea Principal',
    'g1f3 g8f6': '1...Nf6 — Réti: Simétrica',
    'g1f3 g8f6 c2c4': '2.c4 — Réti: Transposición India',
    'g1f3 g8f6 g2g3': '2.g3 — Réti: Doble Fianchetto',
    'g1f3 c7c5': '1...c5 — Réti: Siciliana Invertida',
    'g1f3 f7f5': '1...f5 — Réti: Holandesa',

    // Larsen
    'b2b3 e7e5': '1...e5 — Larsen: Línea Principal',
    'b2b3 d7d5': '1...d5 — Larsen: Clásica',
    'b2b3 g8f6': '1...Nf6 — Larsen: India',

    // Húngara
    'g2g3 d7d5': '1...d5 — Húngara: Clásica',
    'g2g3 e7e5': '1...e5 — Húngara: Línea Principal',
    'g2g3 g8f6': '1...Nf6 — Húngara: India',

    // ========== VARIANTES PROFUNDAS (movimientos 9-20) ==========

    // --- ESPAÑOLA (Ruy López) profunda ---
    // Cerrada: línea principal Breyer/Chigorin
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1': '6.Re1 — Española Cerrada: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5': '6...b5 — Española Cerrada: Variante Clásica',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3': '7.Bb3 — Española Cerrada: Bb3',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6': '7...d6 — Española Cerrada: Preparando O-O',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3': '8.c3 — Española Cerrada: Sistema Clásico',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8': '8...O-O — Española Cerrada: Posición Tabiya',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3': '9.h3 — Española Cerrada: Evitando Bg4',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6b8': '9...Nb8 — Española: Variante Breyer',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6b8 d2d4': '10.d4 — Breyer: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6b8 d2d4 b8d7': '10...Nbd7 — Breyer: Reagrupamiento',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c8b7': '9...Bb7 — Española: Variante Zaitsev',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6a5': '9...Na5 — Española: Variante Chigorin',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6a5 b3c2': '10.Bc2 — Chigorin: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6a5 b3c2 c7c5': '10...c5 — Chigorin: Contrajuego Central',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6a5 b3c2 c7c5 d2d4': '11.d4 — Chigorin: Ruptura Central',
    // Berlinesa profunda
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1': '4.O-O — Berlinesa: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4': '4...Nxe4 — Berlinesa: Muro de Berlín',
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4': '5.d4 — Berlinesa: Muro, Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6': '5...Nd6 — Berlinesa: Muro, Variante Moderna',
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6 b5c6 d7c6': '6.Bxc6 — Berlinesa: Final del Muro',
    // Española Abierta profunda
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4': '5...Nxe4 — Española: Variante Abierta',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4 d2d4': '6.d4 — Española Abierta: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4 d2d4 b7b5': '6...b5 — Española Abierta: Clásica',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4 d2d4 b7b5 a4b3': '7.Bb3 — Española Abierta: Bb3',
    // Marshall
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8': '7...O-O — Española: Preparando Marshall',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 c2c3 d7d5': '8...d5 — Española: Gambito Marshall',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 c2c3 d7d5 e4d5': '9.exd5 — Marshall: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 c2c3 d7d5 e4d5 f6d5': '9...Nxd5 — Marshall: Recuperación',

    // --- ITALIANA profunda ---
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6': '4...Nf6 — Italiana: Giuoco Piano, Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4': '5.d4 — Italiana: Ruptura Central',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4': '5...exd4 — Italiana: Cambio Central',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4 c3d4': '6.cxd4 — Italiana: Centro Abierto',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6': '4...Nf6 — Giuoco Pianissimo: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3': '5.c3 — Giuoco Pianissimo: Moderno',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6': '5...d6 — Giuoco Pianissimo: Clásica',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 e1g1': '6.O-O — Giuoco Pianissimo: Enroque',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 e1g1 e8g8': '6...O-O — Giuoco Pianissimo: Posición Tabiya',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 e1g1 e8g8 f1e1': '7.Re1 — Giuoco Pianissimo: Refuerzo Central',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 e1g1 e8g8 f1e1 a7a6': '7...a6 — Giuoco Pianissimo: Preparando b5',
    // Gambito Evans profundo
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4': '4...Bxb4 — Evans Aceptado',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3': '5.c3 — Evans: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5': '5...Ba5 — Evans: Retirada Clásica',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5 d2d4': '6.d4 — Evans: Ruptura Central',

    // --- SICILIANA NAJDORF profunda ---
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5': '6.Bg5 — Najdorf: Ataque Inglés',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6': '6...e6 — Najdorf: Variante Principal',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4': '7.f4 — Najdorf: Ataque Inglés con f4',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 f8e7': '7...Be7 — Najdorf: Línea Clásica',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 d8b6': '7...Qb6 — Najdorf: Envenenado',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3': '6.Be3 — Najdorf: Sistema Inglés Moderno',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5': '6...e5 — Najdorf: Be3 con e5',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3': '7.Nb3 — Najdorf: Be3 e5 Nb3',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e6': '6...e6 — Najdorf: Be3, Scheveningen',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f2f3': '6.f3 — Najdorf: Ataque Inglés f3',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f2f3 e7e5': '6...e5 — Najdorf: f3 con e5',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1e2': '6.Be2 — Najdorf: Variante Opočenský',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1e2 e7e5': '6...e5 — Najdorf: Be2 con e5',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1e2 e7e5 d4b3': '7.Nb3 — Najdorf: Be2 e5 Nb3',

    // --- SICILIANA DRAGÓN profunda ---
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3': '6.Be3 — Dragón: Ataque Yugoslavo',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7': '6...Bg7 — Dragón: Yugoslavo, Línea Principal',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3': '7.f3 — Dragón: Yugoslavo con f3',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8': '7...O-O — Dragón: Yugoslavo, Enroque',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8 d1d2': '8.Qd2 — Dragón: Yugoslavo Clásico',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8 d1d2 b8c6': '8...Nc6 — Dragón: Yugoslavo, Preparando Ataque',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8 d1d2 b8c6 e1c1': '9.O-O-O — Dragón: Enroques Opuestos',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 f1e2': '6.Be2 — Dragón: Variante Clásica',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 f1e2 f8g7': '6...Bg7 — Dragón Clásica: Fianchetto',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 f1e2 f8g7 e1g1': '7.O-O — Dragón Clásica: Enroque',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 f1e2 f8g7 e1g1 e8g8': '7...O-O — Dragón Clásica: Posición Tabiya',

    // --- SICILIANA SVESHNIKOV profunda ---
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5': '5...e5 — Sveshnikov: Línea Principal',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5': '6.Ndb5 — Sveshnikov: Variante Principal',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6': '6...d6 — Sveshnikov: Línea Clásica',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5': '7.Bg5 — Sveshnikov: Ataque con Bg5',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6': '7...a6 — Sveshnikov: Expulsando el Caballo',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6 b5a3': '8.Na3 — Sveshnikov: Retirada a a3',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6 b5a3 b7b5': '8...b5 — Sveshnikov: Expansión en el Flanco',

    // --- FRANCESA profunda ---
    // Winawer profunda
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3': '5.a3 — Winawer: Variante con a3',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3': '5...Bxc3+ — Winawer: Cambio de Alfil',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3': '6.bxc3 — Winawer: Estructura Doblada',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7': '6...Ne7 — Winawer: Línea Principal Moderna',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7 d1g4': '7.Qg4 — Winawer: Ataque con Qg4',
    // Clásica profunda
    'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7': '4...Be7 — Francesa Clásica: Línea McCutcheon',
    'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5': '5.e5 — Francesa Clásica: Avance',
    'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7': '5...Nd7 — Francesa Clásica: Retirada',
    'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7 g5e7 d8e7': '6.Bxe7 Qxe7 — Francesa Clásica: Cambio',
    // Avance profunda
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6': '4...Nc6 — Francesa Avance: Desarrollo',
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3': '5.Nf3 — Francesa Avance: Clásica',
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6': '5...Qb6 — Francesa Avance: Presión sobre d4',
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6 a2a3': '6.a3 — Francesa Avance: Línea Moderna',

    // --- CARO-KANN profunda ---
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3': '5.Ng3 — Caro-Kann Clásica: Ng3',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6': '5...Bg6 — Caro-Kann: Retirada del Alfil',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4': '6.h4 — Caro-Kann: Ataque con h4',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6': '6...h6 — Caro-Kann: Frenando h5',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6 g1f3': '7.Nf3 — Caro-Kann Clásica: Línea Principal',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6 g1f3 b8d7': '7...Nd7 — Caro-Kann: Desarrollo Flexible',
    'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 b1c3': '4.Nc3 — Caro-Kann Avance: Variante Tal',
    'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3': '4.Nf3 — Caro-Kann Avance: Línea Corta',
    'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6': '4...e6 — Caro-Kann Avance: Clásica',
    'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2': '5.Be2 — Caro-Kann Avance: Línea Principal',

    // --- GAMBITO DE DAMA REHUSADO profundo ---
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 c2c3 d7d5 e4d5 f6d5 f3e5': '10.Nxe5 — Marshall: Línea Principal',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3': '5.e3 — GDR Ortodoxa: Línea Principal',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8': '5...O-O — GDR Ortodoxa: Enroque',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3': '6.Nf3 — GDR Ortodoxa: Desarrollo',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7': '6...Nbd7 — GDR Ortodoxa: Clásica',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7 a1c1': '7.Rc1 — GDR Ortodoxa: Torre en c1',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7 a1c1 c7c6': '7...c6 — GDR Ortodoxa: Posición Tabiya',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7 a1c1 c7c6 f1d3': '8.Bd3 — GDR Ortodoxa: Sistema Clásico',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7 a1c1 c7c6 f1d3 d5c4': '8...dxc4 — GDR Ortodoxa: Captura Central',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7 a1c1 c7c6 f1d3 d5c4 d3c4': '9.Bxc4 — GDR Ortodoxa: Recuperación',

    // --- ESLAVA / SEMI-ESLAVA profunda ---
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7': '5...Nbd7 — Semi-Eslava: Meran, Desarrollo',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3': '6.Bd3 — Semi-Eslava: Meran, Bd3',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3 d5c4': '6...dxc4 — Semi-Eslava: Meran Aceptada',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3 d5c4 d3c4': '7.Bxc4 — Semi-Eslava: Meran, Línea Principal',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3 d5c4 d3c4 b7b5': '7...b5 — Semi-Eslava: Meran, Variante Principal',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 c1g5 b8d7': '5...Nbd7 — Semi-Eslava: Anti-Meran con Bg5',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 c1g5 h7h6': '5...h6 — Semi-Eslava: Anti-Moscú',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4': '5.a4 — Eslava: Variante Clásica con a4',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5': '5...Bf5 — Eslava Checa: Línea Principal',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5 e2e3': '6.e3 — Eslava Checa: Línea Clásica',

    // --- INDIA DE REY profunda ---
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8': '5...O-O — India de Rey Clásica: Enroque',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2': '6.Be2 — India de Rey: Variante Clásica',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5': '6...e5 — India de Rey: Variante Principal',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1': '7.O-O — India de Rey: Posición Tabiya',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6': '7...Nc6 — India de Rey: Sistema Clásico',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5': '8.d5 — India de Rey: Mar del Plata',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7': '8...Ne7 — India de Rey: Mar del Plata, Línea Principal',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 c3e1': '9.Ne1 — India de Rey: Petrosián',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 f3e1': '9.Nd2 — India de Rey: Bayoneta (preparación)',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8a6': '7...Na6 — India de Rey: Variante Moderna',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 f6d7': '7...Nd7 — India de Rey: Variante Gligoric',
    // Sämisch profunda
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8': '5...O-O — Sämisch: Enroque',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3': '6.Be3 — Sämisch: Línea Principal',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 e7e5': '6...e5 — Sämisch: Contraataque Central',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 b8c6': '6...Nc6 — Sämisch: Desarrollo Flexible',

    // --- NIMZO-INDIA profunda ---
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 e8g8': '4...O-O — Nimzo-India Clásica: Enroque',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 e8g8 a2a3': '5.a3 — Nimzo-India Clásica: Expulsando Alfil',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 e8g8 a2a3 b4c3': '5...Bxc3+ — Nimzo-India: Cambio en c3',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 e8g8 a2a3 b4c3 d1c3': '6.Qxc3 — Nimzo-India: Recuperación',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8': '4...O-O — Nimzo-India Rubinstein: Enroque',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3': '5.Bd3 — Rubinstein: Línea Principal',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5': '5...d5 — Rubinstein: Central',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3': '6.Nf3 — Rubinstein: Desarrollo',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3 c7c5': '6...c5 — Rubinstein: Contrajuego',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 c7c5': '4...c5 — Nimzo-India: Variante Hübner',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 b7b6': '4...b6 — Nimzo-India: Fischer',

    // --- CATALANA profunda ---
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2': '4.Bg2 — Catalana: Fianchetto',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7': '4...Be7 — Catalana: Cerrada',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4': '4...dxc4 — Catalana: Abierta',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3': '5.Nf3 — Catalana Abierta: Línea Principal',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3 f8e7': '5...Be7 — Catalana Abierta: Clásica',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3 a7a6': '5...a6 — Catalana Abierta: Variante Moderna',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3': '5.Nf3 — Catalana Cerrada: Desarrollo',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8': '5...O-O — Catalana Cerrada: Enroque',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1': '6.O-O — Catalana Cerrada: Posición Tabiya',

    // --- BENONI profunda ---
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3': '4.Nc3 — Benoni Moderna: Línea Principal',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5': '4...exd5 — Benoni: Captura Central',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5': '5.cxd5 — Benoni: Recuperación',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6': '5...d6 — Benoni Moderna: Posición Tabiya',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4': '6.e4 — Benoni: Cuatro Peones',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4 g7g6': '6...g6 — Benoni: Fianchetto de Rey',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 g1f3': '6.Nf3 — Benoni: Línea Clásica',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 g1f3 g7g6': '6...g6 — Benoni Clásica: Fianchetto',

    // --- PETROV profunda ---
    'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3': '4.Nf3 — Petrov: Retirada',
    'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4': '4...Nxe4 — Petrov: Recuperación Simétrica',
    'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4': '5.d4 — Petrov: Centro Fuerte',
    'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d7d5': '5...d5 — Petrov: Línea Simétrica',
    'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d7d5 f1d3': '6.Bd3 — Petrov: Desarrollo Clásico',
    'e2e4 e7e5 g1f3 g8f6 d2d4 f6e4': '3...Nxe4 — Petrov: Ataque Steinitz, Captura',
    'e2e4 e7e5 g1f3 g8f6 d2d4 f6e4 f1d3': '4.Bd3 — Petrov Steinitz: Desarrollo',
    'e2e4 e7e5 g1f3 g8f6 d2d4 f6e4 f1d3 d7d5': '4...d5 — Petrov Steinitz: Central',
    'e2e4 e7e5 g1f3 g8f6 d2d4 f6e4 f1d3 d7d5 f3e5': '5.Nxe5 — Petrov Steinitz: Línea Principal',

    // --- SISTEMA LONDRES profundo ---
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5': '3...c5 — Londres: Contrajuego Central',
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3': '4.c3 — Londres: Refuerzo Central',
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3 b8c6': '4...Nc6 — Londres: Desarrollo',
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3 b8c6 g1f3': '5.Nf3 — Londres: Línea Principal',
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3 b8c6 g1f3 d8b6': '5...Qb6 — Londres: Presión sobre b2',
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6': '3...e6 — Londres: Configuración Cerrada',
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3': '4.Nf3 — Londres: Sistema Clásico',
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3 f8d6': '4...Bd6 — Londres: Cambio de Alfil',
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3 f8d6 f4d6': '5.Bxd6 — Londres: Cambio Directo',
    'd2d4 d7d5 c1f4 g8f6 g1f3 c7c5': '3...c5 — Londres Moderna: Contrajuego',
    'd2d4 d7d5 c1f4 g8f6 g1f3 e7e6': '3...e6 — Londres Moderna: Clásica',
    'd2d4 d7d5 c1f4 g8f6 g1f3 e7e6 e2e3': '4.e3 — Londres Moderna: Sólida',

    // --- INGLESA profunda ---
    'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6': '3...Nc6 — Inglesa: Cuatro Caballos',
    'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3': '4.g3 — Inglesa: Cuatro Caballos con g3',
    'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5': '4...d5 — Inglesa: Cuatro Caballos Central',
    'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5': '5.cxd5 — Inglesa: Captura Central',
    'c2c4 e7e5 b1c3 b8c6': '2...Nc6 — Inglesa: Gran Prix Invertida',
    'c2c4 e7e5 g2g3 g8f6': '2...Nf6 — Inglesa Fianchetto: Desarrollo',
    'c2c4 e7e5 g2g3 g8f6 f1g2': '3.Bg2 — Inglesa: Fianchetto Completo',
    'c2c4 c7c5 b1c3 g8f6': '2...Nf6 — Inglesa Simétrica: Desarrollo',
    'c2c4 c7c5 b1c3 g8f6 g2g3': '3.g3 — Inglesa Simétrica: Fianchetto',
    'c2c4 c7c5 g1f3 g8f6': '2...Nf6 — Inglesa Simétrica: Dos Caballos',
    'c2c4 c7c5 g1f3 b8c6': '2...Nc6 — Inglesa Simétrica: Clásica',

    // ========== NUEVAS APERTURAS Y VARIANTES PROFUNDAS v2.4 ==========

    // --- DEFENSA ALEKHINE ---
    'e2e4 g8f6': '1...Nf6 — Defensa Alekhine',
    'e2e4 g8f6 e4e5': '2.e5 — Alekhine: Línea Principal',
    'e2e4 g8f6 e4e5 f6d5': '2...Nd5 — Alekhine: Retirada',
    'e2e4 g8f6 e4e5 f6d5 d2d4': '3.d4 — Alekhine: Centro Fuerte',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6': '3...d6 — Alekhine: Variante Moderna',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 g1f3': '4.Nf3 — Alekhine Moderna: Línea Principal',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 g1f3 c8g4': '4...Bg4 — Alekhine: Variante Alburt',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 g1f3 g7g6': '4...g6 — Alekhine: Fianchetto',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 c2c4': '4.c4 — Alekhine: Cuatro Peones',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 c2c4 d5b6': '4...Nb6 — Alekhine: Cuatro Peones, Línea Principal',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 c2c4 d5b6 e5d6': '5.exd6 — Alekhine: Cuatro Peones, Cambio',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 c2c4 d5b6 f2f4': '5.f4 — Alekhine: Cuatro Peones, Ataque',

    // --- DEFENSA GRÜNFELD ---
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5': '3...d5 — Defensa Grünfeld',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5': '4.cxd5 — Grünfeld: Variante del Cambio',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5': '4...Nxd5 — Grünfeld: Cambio, Línea Principal',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4': '5.e4 — Grünfeld: Cambio Clásica',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3': '5...Nxc3 — Grünfeld: Cambio, Captura',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3': '6.bxc3 — Grünfeld: Centro Fuerte',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7': '6...Bg7 — Grünfeld: Fianchetto vs Centro',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7 f1c4': '7.Bc4 — Grünfeld: Cambio, Variante Clásica',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7 g1f3': '7.Nf3 — Grünfeld: Cambio, Variante Moderna',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 g1f3': '4.Nf3 — Grünfeld: Línea Rusa',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 g1f3 f8g7': '4...Bg7 — Grünfeld: Rusa, Fianchetto',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 g1f3 f8g7 d1b3': '5.Qb3 — Grünfeld: Rusa, Línea Principal',

    // --- BOGO-INDIA ---
    'd2d4 g8f6 c2c4 e7e6 g1f3 f8b4 c1d2': '4.Bd2 — Bogo-India: Línea Principal',
    'd2d4 g8f6 c2c4 e7e6 g1f3 f8b4 c1d2 b4d2': '4...Bxd2+ — Bogo-India: Cambio',
    'd2d4 g8f6 c2c4 e7e6 g1f3 f8b4 c1d2 a7a5': '4...a5 — Bogo-India: Variante Moderna',
    'd2d4 g8f6 c2c4 e7e6 g1f3 f8b4 b1d2': '4.Nbd2 — Bogo-India: Variante Evitar Doblaje',

    // --- DEFENSA BIRD ---
    'f2f4': '1.f4 — Apertura Bird',
    'f2f4 d7d5': '1...d5 — Bird: Clásica',
    'f2f4 d7d5 g1f3': '2.Nf3 — Bird: Línea Principal',
    'f2f4 d7d5 g1f3 g8f6': '2...Nf6 — Bird: Desarrollo',
    'f2f4 d7d5 g1f3 g8f6 e2e3': '3.e3 — Bird: Sistema Clásico',
    'f2f4 e7e5': '1...e5 — Gambito From contra Bird',

    // --- DEFENSA PHILIDOR ---
    'e2e4 e7e5 g1f3 d7d6': '2...d6 — Defensa Philidor',
    'e2e4 e7e5 g1f3 d7d6 d2d4': '3.d4 — Philidor: Línea Principal',
    'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6': '3...Nf6 — Philidor: Defensa Clásica',
    'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6 b1c3': '4.Nc3 — Philidor: Desarrollo',
    'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6 b1c3 b8d7': '4...Nbd7 — Philidor: Hanham',
    'e2e4 e7e5 g1f3 d7d6 d2d4 e5d4': '3...exd4 — Philidor: Cambio',
    'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6 d4e5': '4.dxe5 — Philidor: Variante del Cambio',

    // --- SISTEMA COLLE-ZUKERTORT ---
    'd2d4 d7d5 g1f3 g8f6 e2e3 e7e6': '3...e6 — Colle: Clásica',
    'd2d4 d7d5 g1f3 g8f6 e2e3 e7e6 f1d3': '4.Bd3 — Colle: Desarrollo del Alfil',
    'd2d4 d7d5 g1f3 g8f6 e2e3 e7e6 f1d3 c7c5': '4...c5 — Colle: Contrajuego',
    'd2d4 d7d5 g1f3 g8f6 e2e3 e7e6 f1d3 c7c5 b2b3': '5.b3 — Colle-Zukertort',
    'd2d4 d7d5 g1f3 g8f6 e2e3 e7e6 f1d3 c7c5 c2c3': '5.c3 — Colle: Sistema Clásico',

    // --- APERTURA TROMPOWSKY ---
    'd2d4 g8f6 c1g5': '2.Bg5 — Apertura Trompowsky',
    'd2d4 g8f6 c1g5 f6e4': '2...Ne4 — Trompowsky: Captura',
    'd2d4 g8f6 c1g5 e7e6': '2...e6 — Trompowsky: Variante Sólida',
    'd2d4 g8f6 c1g5 d7d5': '2...d5 — Trompowsky: Clásica',
    'd2d4 g8f6 c1g5 c7c5': '2...c5 — Trompowsky: Gambito',

    // --- APERTURA TORRE ---
    'd2d4 g8f6 g1f3 e7e6 c1g5': '3.Bg5 — Ataque Torre',
    'd2d4 g8f6 g1f3 e7e6 c1g5 c7c5': '3...c5 — Torre: Contrajuego',
    'd2d4 g8f6 g1f3 e7e6 c1g5 f8e7': '3...Be7 — Torre: Clásica',

    // --- GAMBITO DE REY profundo ---
    'e2e4 e7e5 f2f4 e5f4 g1f3': '3.Nf3 — Gambito Rey Aceptado: Línea Principal',
    'e2e4 e7e5 f2f4 e5f4 g1f3 g7g5': '3...g5 — Gambito Rey: Defensa del Peón',
    'e2e4 e7e5 f2f4 e5f4 g1f3 g7g5 f1c4': '4.Bc4 — Gambito Rey: Ataque Muzio',
    'e2e4 e7e5 f2f4 e5f4 g1f3 d7d6': '3...d6 — Gambito Rey: Variante Fischer',
    'e2e4 e7e5 f2f4 e5f4 g1f3 f8e7': '3...Be7 — Gambito Rey: Variante Cunningham',
    'e2e4 e7e5 f2f4 e5f4 f1c4': '3.Bc4 — Gambito del Alfil de Rey',

    // --- ESCOCESA profunda ---
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6': '4...Nf6 — Escocesa: Desarrollo',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 f8c5': '4...Bc5 — Escocesa: Variante Clásica',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 d8h4': '4...Qh4 — Escocesa: Variante Steinitz',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 f8c5 c2c3': '5.c3 — Escocesa Clásica: Refuerzo',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 f8c5 d4b3': '5.Nb3 — Escocesa: Retirada',

    // --- SICILIANA SCHEVENINGEN ---
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6': '5...e6 — Siciliana Scheveningen',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6 f1e2': '6.Be2 — Scheveningen: Línea Clásica',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6 c1e3': '6.Be3 — Scheveningen: Ataque Inglés',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6 f2f4': '6.f4 — Scheveningen: Ataque Keres',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6 g2g4': '6.g4 — Scheveningen: Ataque Keres Moderno',

    // --- SICILIANA TAIMANOV profunda ---
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6 b1c3': '5.Nc3 — Taimanov: Línea Principal',
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6 b1c3 d8c7': '5...Qc7 — Taimanov: Variante Moderna',
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6 b1c3 a7a6': '5...a6 — Taimanov: Preparando b5',

    // --- SICILIANA KAN ---
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6 b1c3': '5.Nc3 — Kan: Línea Principal',
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6 f1d3': '5.Bd3 — Kan: Variante Moderna',

    // --- DEFENSA MODERNA profunda ---
    'e2e4 g7g6 d2d4': '2.d4 — Moderna: Línea Principal',
    'e2e4 g7g6 d2d4 f8g7': '2...Bg7 — Moderna: Fianchetto',
    'e2e4 g7g6 d2d4 f8g7 b1c3': '3.Nc3 — Moderna: Desarrollo',
    'e2e4 g7g6 d2d4 f8g7 b1c3 d7d6': '3...d6 — Moderna: Transposición Pirc',
    'e2e4 g7g6 d2d4 f8g7 b1c3 c7c6': '3...c6 — Moderna: Variante Pterodáctilo',

    // --- INDIA DE DAMA profunda ---
    'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3': '4.g3 — India de Dama: Fianchetto',
    'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7': '4...Bb7 — India de Dama: Fianchetto Doble',
    'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7 f1g2': '5.Bg2 — India de Dama: Posición Tabiya',
    'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7 f1g2 f8e7': '5...Be7 — India de Dama: Clásica',
    'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7 f1g2 f8e7 e1g1 e8g8': '6...O-O — India de Dama: Tabiya Completa',
    'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 a2a3': '4.a3 — India de Dama: Variante Petrosian',
    'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 c1f4': '4.Bf4 — India de Dama: Variante Miles',
    'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 e2e3': '4.e3 — India de Dama: Sistema Tranquilo',

    // --- BUDAPEST profunda ---
    'd2d4 g8f6 c2c4 e7e5 d4e5': '3.dxe5 — Budapest: Captura',
    'd2d4 g8f6 c2c4 e7e5 d4e5 f6g4': '3...Ng4 — Budapest: Línea Principal',
    'd2d4 g8f6 c2c4 e7e5 d4e5 f6g4 c1f4': '4.Bf4 — Budapest: Variante Rubinstein',
    'd2d4 g8f6 c2c4 e7e5 d4e5 f6g4 g1f3': '4.Nf3 — Budapest: Variante Adler',
    'd2d4 g8f6 c2c4 e7e5 d4e5 f6e4': '3...Ne4 — Budapest: Gambito Fajarowicz',

    // --- HOLANDESA profunda ---
    'd2d4 f7f5 c2c4 g8f6 g2g3 e7e6': '3...e6 — Holandesa: Muro de Piedra',
    'd2d4 f7f5 c2c4 g8f6 g2g3 e7e6 f1g2': '4.Bg2 — Holandesa: Muro de Piedra, Fianchetto',
    'd2d4 f7f5 c2c4 g8f6 g2g3 g7g6': '3...g6 — Holandesa: Leningrado',
    'd2d4 f7f5 c2c4 g8f6 g2g3 g7g6 f1g2': '4.Bg2 — Holandesa: Leningrado, Fianchetto',
    'd2d4 f7f5 c2c4 g8f6 g2g3 g7g6 f1g2 f8g7': '4...Bg7 — Holandesa: Leningrado, Doble Fianchetto',

    // --- CUATRO CABALLOS ---
    'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6': '3...Nf6 — Cuatro Caballos: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 f1b5': '4.Bb5 — Cuatro Caballos: Española',
    'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 d2d4': '4.d4 — Cuatro Caballos: Escocesa',
    'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 f1b5 f8b4': '4...Bb4 — Cuatro Caballos: Variante Simétrica',

    // --- DEFENSA OWEN ---
    'e2e4 b7b6 d2d4': '2.d4 — Owen: Línea Principal',
    'e2e4 b7b6 d2d4 c8b7': '2...Bb7 — Owen: Fianchetto',

    // --- GAMBITO DEL CENTRO profundo ---
    'e2e4 e7e5 d2d4 e5d4': '2...exd4 — Gambito del Centro: Aceptado',
    'e2e4 e7e5 d2d4 e5d4 d1d4': '3.Qxd4 — Gambito Centro: Recuperación',
    'e2e4 e7e5 d2d4 e5d4 g1f3': '3.Nf3 — Gambito Centro: Gambito Danés',

    // --- GDA profundo ---
    'd2d4 d7d5 c2c4 d5c4 g1f3 g8f6': '3...Nf6 — GDA: Desarrollo',
    'd2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3': '4.e3 — GDA: Línea Principal',
    'd2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3 e7e6': '4...e6 — GDA: Clásica',
    'd2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3 e7e6 f1c4': '5.Bxc4 — GDA: Recuperación',
    'd2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3 e7e6 f1c4 c7c5': '5...c5 — GDA: Contrajuego Central',
    'd2d4 d7d5 c2c4 d5c4 e2e4': '3.e4 — GDA: Gambito Central',

    // --- RÉTI profunda ---
    'g1f3 d7d5 c2c4 e7e6 g2g3': '3.g3 — Réti: Fianchetto',
    'g1f3 d7d5 c2c4 e7e6 g2g3 g8f6': '3...Nf6 — Réti: Desarrollo',
    'g1f3 d7d5 c2c4 e7e6 g2g3 g8f6 f1g2': '4.Bg2 — Réti: Fianchetto Completo',
    'g1f3 d7d5 c2c4 c7c6 g2g3 g8f6': '3...Nf6 — Réti Eslava: Desarrollo',
    'g1f3 d7d5 c2c4 c7c6 g2g3 g8f6 f1g2': '4.Bg2 — Réti Eslava: Fianchetto',
    'g1f3 d7d5 g2g3 g8f6 f1g2': '3.Bg2 — Réti: Sistema Catalán Lento',
    'g1f3 d7d5 g2g3 g8f6 f1g2 e7e6': '3...e6 — Réti Catalán: Cerrada',
    'g1f3 d7d5 g2g3 g8f6 f1g2 c7c6': '3...c6 — Réti Catalán: Eslava',

    // --- NIMZO-INDIA Sämisch profunda ---
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 a2a3 b4c3': '4...Bxc3+ — Nimzo Sämisch: Cambio',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 a2a3 b4c3 b2c3': '5.bxc3 — Nimzo Sämisch: Peones Doblados',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 a2a3 b4c3 b2c3 c7c5': '5...c5 — Nimzo Sämisch: Contrajuego',

    // --- ESLAVA profunda ---
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5 e2e3 e7e6': '6...e6 — Eslava Checa: Clásica Profunda',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5 e2e3 e7e6 f1c4': '7.Bxc4 — Eslava Checa: Desarrollo',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5 e2e3 e7e6 f1c4 f8b4': '7...Bb4 — Eslava Checa: Presión',

    // --- GAMBITO BUDAPEST profundo ---
    'd2d4 g8f6 c2c4 e7e5 d4e5 f6g4 c1f4 b8c6': '4...Nc6 — Budapest Rubinstein: Desarrollo',
    'd2d4 g8f6 c2c4 e7e5 d4e5 f6g4 c1f4 b8c6 g1f3': '5.Nf3 — Budapest: Línea Moderna',
    'd2d4 g8f6 c2c4 e7e5 d4e5 f6g4 c1f4 b8c6 g1f3 f8b4': '5...Bb4+ — Budapest: Jaque Intermedio',

    // --- INDIA DE REY: Bayoneta ---
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 b2b4': '9.b4 — India de Rey: Ataque Bayoneta',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 b2b4 f6h5': '9...Nh5 — Bayoneta: Preparando f5',

    // --- CATALANA profunda ---
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3 a7a6 e1g1': '6.O-O — Catalana Abierta: Enroque',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3 a7a6 e1g1 b8c6': '6...Nc6 — Catalana Abierta: Desarrollo',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1 d5c4': '6...dxc4 — Catalana: Abierta Diferida',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1 c7c6': '6...c6 — Catalana Cerrada: Eslava',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1 b7b6': '6...b6 — Catalana Cerrada: India de Dama',

    // ========== EXPANSIÓN MÁXIMA v2.4.1 ==========

    // --- ESPAÑOLA: más variantes Morphy ---
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 d2d3': '5.d3 — Española: Variante Cerrada Moderna',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4': '5...Nxe4 — Española: Variante Abierta',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 d7d6': '4...d6 — Española: Steinitz Diferida',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 b7b5': '4...b5 — Española: Variante Arcángel Temprana',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5c6': '4.Bxc6 — Española: Variante del Cambio',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5c6 d7c6': '4...dxc6 — Española Cambio: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5c6 d7c6 e1g1': '5.O-O — Española Cambio: Enroque',
    // Española Steinitz profunda
    'e2e4 e7e5 g1f3 b8c6 f1b5 d7d6 d2d4': '4.d4 — Steinitz: Ruptura Central',
    'e2e4 e7e5 g1f3 b8c6 f1b5 d7d6 d2d4 c8d7': '4...Bd7 — Steinitz: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 d7d6 d2d4 c8d7 b1c3': '5.Nc3 — Steinitz: Desarrollo',
    // Schliemann profundo
    'e2e4 e7e5 g1f3 b8c6 f1b5 f7f5 b1c3': '4.Nc3 — Schliemann: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 f7f5 d2d3': '4.d3 — Schliemann: Variante Tranquila',
    // Breyer más profunda
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6b8 d2d4 b8d7 b1d2': '11.Nbd2 — Breyer: Desarrollo Completo',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6b8 d2d4 b8d7 b1d2 c8b7': '11...Bb7 — Breyer: Fianchetto del Alfil',
    // Zaitsev profunda
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c8b7 d2d4': '10.d4 — Zaitsev: Ruptura Central',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c8b7 d2d4 f8e8': '10...Re8 — Zaitsev: Refuerzo',
    // Marshall más profunda
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 c2c3 d7d5 e4d5 f6d5 f3e5 c6e5': '10...Nxe5 — Marshall: Sacrificio de Pieza',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 c2c3 d7d5 e4d5 f6d5 f3e5 c6e5 e1e5 c7c6': '11...c6 — Marshall: Cadena de Peones',
    // Anti-Marshall
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 a2a4': '8.a4 — Española: Anti-Marshall',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 h2h3': '8.h3 — Española: Anti-Marshall h3',
    // Berlinesa más profunda
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6 b5c6 d7c6 d4e5': '7.dxe5 — Berlinesa: Final, Avance',
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6 b5c6 d7c6 d4e5 d6f5': '7...Nf5 — Berlinesa: Final, Bloqueo',
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6 b5c6 d7c6 d4e5 d6f5 d1d8 e8d8': '8.Qxd8+ Kxd8 — Berlinesa: Final Sin Damas',
    // Española Clásica 3...Bc5
    'e2e4 e7e5 g1f3 b8c6 f1b5 f8c5 c2c3': '4.c3 — Española Clásica: Preparando d4',
    'e2e4 e7e5 g1f3 b8c6 f1b5 f8c5 e1g1': '4.O-O — Española Clásica: Enroque',
    // Española Abierta más profunda
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4 d2d4 b7b5 a4b3 d7d5': '7...d5 — Española Abierta: Centro Fuerte',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4 d2d4 b7b5 a4b3 d7d5 d4e5': '8.dxe5 — Española Abierta: Avance',

    // --- ITALIANA más profunda ---
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4 c3d4 c5b4': '6...Bb4+ — Italiana: Centro Abierto, Jaque',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d3': '5.d3 — Italiana: Giuoco Pianissimo con c3',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 d7d6': '4...d6 — Giuoco Pianissimo: Sólida',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 e1g1': '5.O-O — Giuoco Pianissimo: Enroque Temprano',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 b1d2': '6.Nbd2 — Giuoco Pianissimo: Desarrollo',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 e1g1 e8g8 b1d2': '7.Nbd2 — Pianissimo: Tabiya con Nbd2',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 e1g1 e8g8 f1e1 a7a6 a2a4': '8.a4 — Pianissimo: Controlando b5',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 e1g1 e8g8 f1e1 a7a6 b1d2': '8.Nbd2 — Pianissimo: Sistema Moderno',
    // Evans más profundo
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5 d2d4 e5d4': '6...exd4 — Evans: Captura Central',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5 d2d4 d7d6': '6...d6 — Evans: Variante Lasker',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4c5': '5...Bc5 — Evans: Defensa Moderna',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4e7': '5...Be7 — Evans: Retirada Tímida',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5 d2d4 e5d4 e1g1': '7.O-O — Evans: Gambito Moderno',
    // Dos Caballos más profundo
    'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d4 e5d4': '4...exd4 — Dos Caballos: Aceptando',
    'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d4 e5d4 e1g1': '5.O-O — Dos Caballos: Gambito Max Lange',
    'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5': '4...d5 — Dos Caballos: Defensa Principal',
    'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5': '5.exd5 — Fried Liver: Captura',
    'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 c6a5': '5...Na5 — Dos Caballos: Contragambito',
    'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 f6d5': '5...Nxd5 — Fried Liver: Aceptando',
    'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 b7b5': '5...b5 — Dos Caballos: Ulvestad',

    // --- SICILIANA más variantes ---
    // Najdorf más profunda
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 f8e7 d1f3': '8.Qf3 — Najdorf: Bg5, Qf3',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 f8e7 d1f3 d8c7': '8...Qc7 — Najdorf: Bg5, Desarrollo',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 d8b6 d1d2': '8.Qd2 — Najdorf: Envenenado, Línea Moderna',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3 f8e7': '7...Be7 — Najdorf: Be3, Desarrollo',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3 f8e7 f2f3': '8.f3 — Najdorf: Ataque Inglés Completo',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3 f8e7 f2f3 e8g8 d1d2 b7b5': '9...b5 — Najdorf: Expansión Flanco Dama',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1c4': '6.Bc4 — Najdorf: Variante Fischer-Sozin',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1c4 e7e6': '6...e6 — Najdorf Fischer-Sozin: Línea Principal',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 g2g3': '6.g3 — Najdorf: Fianchetto',
    // Dragón más profunda
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8 d1d2 b8c6 e1c1 d7d5': '9...d5 — Dragón Yugoslavo: Ruptura Central',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8 d1d2 b8c6 e1c1 c6d4': '9...Nxd4 — Dragón: Cambio de Caballo',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 b8c6': '7...Nc6 — Dragón Yugoslavo: Desarrollo Rápido',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 f1e2 f8g7 e1g1 e8g8 f1e1': '8.Re1 — Dragón Clásica: Refuerzo',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 f1c4': '6.Bc4 — Dragón: Variante Levenfish',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 g2g3': '6.g3 — Dragón: Fianchetto',
    // Sveshnikov más profunda
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6 b5a3 b7b5 c3d5': '9.Nd5 — Sveshnikov: Caballo en d5',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6 b5a3 b7b5 c3d5 f8e7': '9...Be7 — Sveshnikov: Línea Moderna',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6 b5a3 b7b5 g5f6': '9.Bxf6 — Sveshnikov: Cambio en f6',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6 b5a3 b7b5 g5f6 g7f6': '9...gxf6 — Sveshnikov: Captura con Peón',
    // Siciliana Acelerada del Dragón profunda
    'e2e4 c7c5 g1f3 g7g6 d2d4': '3.d4 — Siciliana Acelerada: d4',
    'e2e4 c7c5 g1f3 g7g6 d2d4 c5d4': '3...cxd4 — Acelerada: Captura',
    'e2e4 c7c5 g1f3 g7g6 d2d4 c5d4 f3d4': '4.Nxd4 — Acelerada: Recuperación',
    'e2e4 c7c5 g1f3 g7g6 d2d4 c5d4 f3d4 b8c6': '4...Nc6 — Acelerada: Desarrollo',
    'e2e4 c7c5 g1f3 g7g6 d2d4 c5d4 f3d4 f8g7': '4...Bg7 — Acelerada: Hipermoderna',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g7g6': '4...g6 — Acelerada vía Nc6',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g7g6 b1c3 f8g7': '5...Bg7 — Acelerada: Fianchetto',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g7g6 c2c4': '5.c4 — Maróczy Bind',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g7g6 c2c4 f8g7': '5...Bg7 — Maróczy: Fianchetto',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g7g6 c2c4 g8f6': '5...Nf6 — Maróczy: Desarrollo',
    // Cerrada profunda
    'e2e4 c7c5 b1c3 b8c6': '2...Nc6 — Siciliana Cerrada: Clásica',
    'e2e4 c7c5 b1c3 b8c6 g2g3': '3.g3 — Siciliana Cerrada: Fianchetto',
    'e2e4 c7c5 b1c3 b8c6 g2g3 g7g6': '3...g6 — Siciliana Cerrada: Doble Fianchetto',
    'e2e4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7': '4...Bg7 — Siciliana Cerrada: Desarrollo',
    'e2e4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7 d2d3': '5.d3 — Siciliana Cerrada: Sistema Sólido',
    // Grand Prix
    'e2e4 c7c5 f2f4 d7d5': '2...d5 — Grand Prix: Contragambito',
    'e2e4 c7c5 f2f4 b8c6': '2...Nc6 — Grand Prix: Desarrollo',
    'e2e4 c7c5 f2f4 b8c6 g1f3': '3.Nf3 — Grand Prix: Línea Principal',
    // Alapin profunda
    'e2e4 c7c5 c2c3 d7d5 e4d5': '3.exd5 — Alapin: Captura',
    'e2e4 c7c5 c2c3 d7d5 e4d5 d8d5': '3...Qxd5 — Alapin: Recuperación con Dama',
    'e2e4 c7c5 c2c3 g8f6 e4e5': '3.e5 — Alapin: Avance',
    'e2e4 c7c5 c2c3 g8f6 e4e5 f6d5': '3...Nd5 — Alapin: Retirada del Caballo',
    'e2e4 c7c5 c2c3 d7d5 e4d5 d8d5 d2d4': '4.d4 — Alapin: Centro',
    'e2e4 c7c5 c2c3 d7d5 e4d5 d8d5 d2d4 g8f6': '4...Nf6 — Alapin: Desarrollo',
    // Smith-Morra profundo
    'e2e4 c7c5 d2d4 c5d4 c2c3': '3.c3 — Smith-Morra: Gambito',
    'e2e4 c7c5 d2d4 c5d4 c2c3 d4c3': '3...dxc3 — Smith-Morra: Aceptado',
    'e2e4 c7c5 d2d4 c5d4 c2c3 d4c3 b1c3': '4.Nxc3 — Smith-Morra: Desarrollo',
    'e2e4 c7c5 d2d4 c5d4 c2c3 g8f6': '3...Nf6 — Smith-Morra: Rehusado',
    'e2e4 c7c5 d2d4 c5d4 c2c3 d7d5': '3...d5 — Smith-Morra: Rehusado Central',
    // Taimanov más profunda
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6 b1c3 d8c7 c1e3': '6.Be3 — Taimanov: Ataque Inglés',
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6 b1c3 d8c7 f1e2': '6.Be2 — Taimanov: Línea Clásica',
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6 b1c3 a7a6 c1e3': '6.Be3 — Taimanov: Sistema Inglés',
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6 b1c3 a7a6 f1e2': '6.Be2 — Taimanov: Desarrollo Tranquilo',
    // Kan profunda
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6 b1c3 d8c7': '5...Qc7 — Kan: Variante Clásica',
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6 b1c3 b7b5': '5...b5 — Kan: Expansión',
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6 f1d3 g8f6': '5...Nf6 — Kan: Desarrollo',
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6 f1d3 f8c5': '5...Bc5 — Kan: Variante del Alfil',
    // Scheveningen más profunda
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6 f1e2 f8e7': '6...Be7 — Scheveningen: Desarrollo',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6 f1e2 f8e7 e1g1': '7.O-O — Scheveningen: Enroque',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6 f1e2 f8e7 e1g1 e8g8': '7...O-O — Scheveningen: Posición Tabiya',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6 c1e3 f8e7': '6...Be7 — Scheveningen Inglés: Desarrollo',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6 c1e3 a7a6': '6...a6 — Scheveningen: Transposición Najdorf',

    // --- FRANCESA más profunda ---
    // Rubinstein profunda
    'e2e4 e7e6 d2d4 d7d5 b1c3 d5e4 c3e4': '4.Nxe4 — Francesa Rubinstein: Captura',
    'e2e4 e7e6 d2d4 d7d5 b1c3 d5e4 c3e4 b8d7': '4...Nd7 — Francesa Rubinstein: Desarrollo',
    'e2e4 e7e6 d2d4 d7d5 b1c3 d5e4 c3e4 g8f6': '4...Nf6 — Francesa Rubinstein: Cambio de Caballo',
    'e2e4 e7e6 d2d4 d7d5 b1c3 d5e4 c3e4 f8d6': '4...Bd6 — Francesa Rubinstein: Fort Knox',
    // Winawer más profunda
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7 d1g4 d8c7': '7...Qc7 — Winawer: Protegiendo g7',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7 d1g4 e8g8': '7...O-O — Winawer: Gambito de Peón',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7 g1f3': '7.Nf3 — Winawer: Línea Posicional',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 g8e7': '4...Ne7 — Winawer: Variante sin c5',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 b7b6': '4...b6 — Winawer: Variante Armenia',
    // Tarrasch profunda
    'e2e4 e7e6 d2d4 d7d5 b1d2 g8f6 e4e5': '4.e5 — Tarrasch: Avance',
    'e2e4 e7e6 d2d4 d7d5 b1d2 g8f6 e4e5 f6d7': '4...Nd7 — Tarrasch: Retirada',
    'e2e4 e7e6 d2d4 d7d5 b1d2 g8f6 e4e5 f6d7 f1d3': '5.Bd3 — Tarrasch: Desarrollo del Alfil',
    'e2e4 e7e6 d2d4 d7d5 b1d2 g8f6 e4e5 f6d7 f1d3 c7c5': '5...c5 — Tarrasch: Ruptura',
    'e2e4 e7e6 d2d4 d7d5 b1d2 c7c5 g1f3': '4.Nf3 — Tarrasch Abierta: Desarrollo',
    'e2e4 e7e6 d2d4 d7d5 b1d2 c7c5 e4d5': '4.exd5 — Tarrasch Abierta: Cambio',
    'e2e4 e7e6 d2d4 d7d5 b1d2 c7c5 e4d5 e6d5': '4...exd5 — Tarrasch Abierta: Simétrica',
    // Avance más profunda
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6 f1d3': '6.Bd3 — Francesa Avance: Bd3',
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 g8e7': '5...Ne7 — Francesa Avance: Desarrollo',
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 d8b6': '4...Qb6 — Francesa Avance: Presión Temprana',
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 g8e7': '4...Ne7 — Francesa Avance: Desarrollo Moderno',
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 d4c5': '4.dxc5 — Francesa Avance: Cambio',

    // --- CARO-KANN más profunda ---
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6 g1f3 b8d7 f1d3': '8.Bd3 — Caro-Kann Clásica: Desarrollo del Alfil',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6 g1f3 b8d7 f1d3 d3g6': '8.Bxg6 — Caro-Kann: Cambio de Alfiles',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 g1f3': '6.Nf3 — Caro-Kann Clásica: Sin h4',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 g8f6 e4f6': '5.Nxf6+ — Caro-Kann Bronstein-Larsen: Cambio',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 g8f6 e4f6 e7f6': '5...exf6 — Bronstein-Larsen: Columna Abierta',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 g8f6 e4f6 g7f6': '5...gxf6 — Bronstein-Larsen: Fianchetto',
    'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2 c7c5': '5...c5 — Caro-Kann Avance: Ruptura',
    'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2 b8d7': '5...Nd7 — Caro-Kann Avance: Desarrollo',
    'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 c2c4': '4.c4 — Caro-Kann Avance: Gambito',
    // Panov
    'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 c2c4': '4.c4 — Caro-Kann: Ataque Panov',
    'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 c2c4 g8f6': '4...Nf6 — Panov: Desarrollo',
    'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 c2c4 g8f6 b1c3': '5.Nc3 — Panov: Línea Principal',
    'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 c2c4 g8f6 b1c3 e7e6': '5...e6 — Panov: Clásica',
    'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 c2c4 g8f6 b1c3 b8c6': '5...Nc6 — Panov: Desarrollo Simétrico',
    'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 c2c4 g8f6 b1c3 g7g6': '5...g6 — Panov: Fianchetto',

    // --- ESCANDINAVA más profunda ---
    'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4': '4.d4 — Escandinava Clásica: Centro',
    'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6': '4...Nf6 — Escandinava: Desarrollo',
    'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3': '5.Nf3 — Escandinava: Línea Clásica',
    'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3 c8f5': '5...Bf5 — Escandinava: Alfil Activo',
    'e2e4 d7d5 e4d5 d8d5 b1c3 d5d6 d2d4 g8f6 g1f3': '5.Nf3 — Escandinava Moderna: Desarrollo',
    'e2e4 d7d5 e4d5 d8d5 b1c3 d5d6 d2d4 g8f6 g1f3 c8g4': '5...Bg4 — Escandinava Moderna: Clavada',
    'e2e4 d7d5 e4d5 g8f6 d2d4': '3.d4 — Escandinava Marshall: Centro',
    'e2e4 d7d5 e4d5 g8f6 d2d4 f6d5': '3...Nxd5 — Marshall: Recuperación',
    'e2e4 d7d5 e4d5 g8f6 d2d4 c8g4': '3...Bg4 — Marshall: Clavada Portuguesa',

    // --- PIRC más profunda ---
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 f2f4 f8g7': '4...Bg7 — Pirc Austriaco: Fianchetto',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 f2f4 f8g7 g1f3': '5.Nf3 — Pirc Austriaco: Línea Principal',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 f2f4 f8g7 g1f3 e8g8': '5...O-O — Pirc Austriaco: Enroque',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 f2f4 f8g7 g1f3 c7c5': '5...c5 — Pirc Austriaco: Contrajuego',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3 f8g7 f1e2': '5.Be2 — Pirc Clásica: Sistema Principal',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3 f8g7 f1e2 e8g8': '5...O-O — Pirc Clásica: Enroque',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3 f8g7 f1e2 e8g8 e1g1': '6.O-O — Pirc Clásica: Posición Tabiya',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3 f8g7 f1e2 e8g8 e1g1 c7c6': '6...c6 — Pirc: Preparando ...d5',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3 f8g7 f1e2 e8g8 e1g1 b8c6': '6...Nc6 — Pirc: Desarrollo del Caballo',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 c1e3 f8g7 d1d2': '5.Qd2 — Pirc 150: Ataque Completo',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 c1e3 f8g7 d1d2 e8g8': '5...O-O — Pirc 150: Enroque',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 c1e3 f8g7 d1d2 c7c6': '5...c6 — Pirc 150: Variante Sólida',

    // --- ALEKHINE más profunda ---
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 g1f3 d6e5': '4...dxe5 — Alekhine: Cambio',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 g1f3 d6e5 f3e5': '5.Nxe5 — Alekhine: Captura del Peón',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 g1f3 c8g4 f1e2': '5.Be2 — Alekhine: Variante Alburt, Bd2',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 g1f3 g7g6 f1c4': '5.Bc4 — Alekhine: Sistema del Alfil',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 g1f3 g7g6 f1e2': '5.Be2 — Alekhine: Variante Moderna, Be2',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 c2c4 d5b6 e5d6 e7d6': '5...exd6 — Alekhine: 4 Peones, Cambio con e',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 c2c4 d5b6 e5d6 c7d6': '5...cxd6 — Alekhine: 4 Peones, Cambio con c',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 c2c4 d5b6 f2f4 d6e5': '5...dxe5 — Alekhine: 4 Peones, Captura',
    'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 c2c4 d5b6 f2f4 d6e5 f4e5': '6.fxe5 — Alekhine: 4 Peones, Centro Fuerte',
    'e2e4 g8f6 e4e5 f6d5 c2c4': '3.c4 — Alekhine: Variante Chase',
    'e2e4 g8f6 e4e5 f6d5 c2c4 d5b6': '3...Nb6 — Alekhine: Chase, Retirada',

    // --- GRÜNFELD más profunda ---
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7 f1c4 c7c5': '7...c5 — Grünfeld Cambio: Contrajuego',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7 f1c4 e8g8': '7...O-O — Grünfeld Cambio: Enroque',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7 g1f3 c7c5': '7...c5 — Grünfeld Moderna: Contrajuego',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7 g1f3 e8g8': '7...O-O — Grünfeld Moderna: Enroque',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7 f1c4 c7c5 g1e2': '8.Ne2 — Grünfeld: Variante Smyslov',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7 f1c4 c7c5 g1f3': '8.Nf3 — Grünfeld: Variante Principal',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7 f1c4 e8g8 g1e2': '8.Ne2 — Grünfeld: Enroque, Ne2',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 g1f3 f8g7 d1b3 d5c4': '5...dxc4 — Grünfeld Rusa: Gambito',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 g1f3 f8g7 d1b3 c7c6': '5...c6 — Grünfeld Rusa: Defensa',
    'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 g1f3 f8g7 c1f4': '5.Bf4 — Grünfeld: Sistema Londres',

    // --- GDR más profunda ---
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7 a1c1 c7c6 f1d3 d5c4 d3c4 b7b5': '9...b5 — GDR Ortodoxa: Expansión',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 h7h6': '6...h6 — GDR: Variante Lasker',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 h7h6 g5h4': '7.Bh4 — Lasker: Manteniendo Alfil',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 h7h6 g5f6': '7.Bxf6 — Lasker: Cambio en f6',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 f8e7': '4...Be7 — GDR: Variante Clásica',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 f8e7 c1f4': '5.Bf4 — GDR: Sistema Londres',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 c7c6': '4...c6 — GDR: Semi-Eslava por Transposición',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 f8b4': '4...Bb4 — GDR: Ragozin',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 f8b4 c1g5': '5.Bg5 — Ragozin: Línea Principal',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 f8b4 d1a4': '5.Qa4+ — Ragozin: Variante Viena',
    'd2d4 d7d5 c2c4 e7e6 b1c3 c7c6': '3...c6 — GDR: Noteboom',
    'd2d4 d7d5 c2c4 e7e6 b1c3 c7c6 g1f3 d5c4': '4...dxc4 — Noteboom: Captura',

    // --- INDIA DE REY más profunda ---
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 c3e1 c6d7': '9...Nd7 — Petrosián: Reagrupamiento',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 f3e1 f6d7': '9...Nd7 — Petrosián: Preparando f5',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 f3e1 f6d7 f2f3': '10.f3 — India de Rey: Petrosián Clásica',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 b2b4 f6h5 g2g3': '10.g3 — Bayoneta: Frenando f4',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8a6 f1e1': '8.Re1 — India de Rey Moderna: Refuerzo',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 f6d7 f1e1': '8.Re1 — Gligoric: Línea Principal',
    // Sämisch más profunda
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 e7e5 d2d5': '7.d5 — Sämisch: Centro Cerrado',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 e7e5 d2d5 c7c6': '7...c6 — Sämisch: Ruptura',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 b8c6 d1d2': '7.Qd2 — Sämisch: Enroque Largo',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 b8c6 d1d2 a7a6': '7...a6 — Sämisch: Preparando b5',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 c7c5': '6...c5 — Sämisch: Benoni Inmediata',
    // Fianchetto profundo
    'd2d4 g8f6 c2c4 g7g6 g1f3 f8g7 g2g3': '4.g3 — India de Rey: Doble Fianchetto',
    'd2d4 g8f6 c2c4 g7g6 g1f3 f8g7 g2g3 e8g8': '4...O-O — India de Rey Fianchetto: Enroque',
    'd2d4 g8f6 c2c4 g7g6 g1f3 f8g7 g2g3 e8g8 f1g2': '5.Bg2 — India de Rey Fianchetto: Desarrollo',
    'd2d4 g8f6 c2c4 g7g6 g1f3 f8g7 g2g3 e8g8 f1g2 d7d6': '5...d6 — Fianchetto: Línea Principal',
    'd2d4 g8f6 c2c4 g7g6 g1f3 f8g7 g2g3 e8g8 f1g2 d7d6 e1g1': '6.O-O — Fianchetto: Posición Tabiya',

    // --- NIMZO-INDIA más profunda ---
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 d7d5': '4...d5 — Nimzo-India Clásica: Central',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 c7c5': '4...c5 — Nimzo-India Clásica: Contrajuego',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 b8c6': '4...Nc6 — Nimzo-India Clásica: Zürich',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3 c7c5 e1g1': '7.O-O — Rubinstein: Posición Tabiya',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3 c7c5 e1g1 d5c4': '7...dxc4 — Rubinstein: Captura Central',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3 c7c5 e1g1 b8c6': '7...Nc6 — Rubinstein: Desarrollo',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 c7c5 f1d3': '5.Bd3 — Hübner: Desarrollo del Alfil',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 c7c5 g1e2': '5.Ne2 — Hübner: Desarrollo del Caballo',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 c7c5 f1d3 b8c6': '5...Nc6 — Hübner: Desarrollo',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 b7b6 g1e2': '5.Ne2 — Fischer: Desarrollo',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 b7b6 f1d3': '5.Bd3 — Fischer: Bd3',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 a2a3 b4c3 b2c3 d7d6': '5...d6 — Sämisch: Sistema Sólido',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 a2a3 b4c3 b2c3 e8g8': '5...O-O — Sämisch: Enroque Inmediato',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 f2f3': '4.f3 — Nimzo-India: Variante Kmoch',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 g2g3': '4.g3 — Nimzo-India: Fianchetto',

    // --- BENONI más profunda ---
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4 g7g6 g1f3': '7.Nf3 — Benoni: Línea Clásica con Nf3',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4 g7g6 g1f3 f8g7': '7...Bg7 — Benoni: Fianchetto del Alfil',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4 g7g6 g1f3 f8g7 f1e2': '8.Be2 — Benoni Clásica: Posición Tabiya',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4 g7g6 g1f3 f8g7 f1e2 e8g8 e1g1': '9.O-O — Benoni: Enroque',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4 g7g6 f2f4': '7.f4 — Benoni: Cuatro Peones',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4 g7g6 f2f3': '7.f3 — Benoni: Sämisch',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 g1f3 g7g6 g2g3': '7.g3 — Benoni Fianchetto: Línea Principal',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 g1f3 g7g6 g2g3 f8g7': '7...Bg7 — Benoni Fianchetto: Desarrollo',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 g1f3 g7g6 g2g3 f8g7 f1g2': '8.Bg2 — Benoni Fianchetto: Completo',

    // --- LONDRES más profundo ---
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3 b8c6 g1f3 d8b6 d1b3': '6.Qb3 — Londres: Cambio de Damas',
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3 b8c6 g1f3 e7e6': '5...e6 — Londres: Desarrollo Clásico',
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3 f8d6 f4g3': '5.Bg3 — Londres: Retirada del Alfil',
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3 c7c5': '4...c5 — Londres: Contrajuego Central',
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3 c7c5 f1d3': '5.Bd3 — Londres: Desarrollo Completo',
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3 c7c5 f1d3 b8c6': '5...Nc6 — Londres: Desarrollo del Caballo',
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6 f1d3 f8d6 f4d6 c7d6': '5.Bxd6 cxd6 — Londres: Estructura Abierta',
    'd2d4 g8f6 c1f4 d7d5 e2e3 e7e6': '3...e6 — Londres vs Nf6: Clásica',
    'd2d4 g8f6 c1f4 d7d5 e2e3 e7e6 g1f3': '4.Nf3 — Londres vs Nf6: Desarrollo',
    'd2d4 g8f6 c1f4 d7d5 e2e3 c7c5': '3...c5 — Londres vs Nf6: Contrajuego',

    // --- INGLESA más profunda ---
    'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 f8b4': '4...Bb4 — Inglesa: Cuatro Caballos, Clavada',
    'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 e2e3': '4.e3 — Inglesa: Cuatro Caballos, e3',
    'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 d2d4': '4.d4 — Inglesa: Cuatro Caballos, Ruptura',
    'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5 f6d5': '5...Nxd5 — Inglesa: Captura con Caballo',
    'c2c4 e7e5 b1c3 g8f6 g2g3': '3.g3 — Inglesa: Fianchetto vs e5',
    'c2c4 e7e5 b1c3 d7d6': '2...d6 — Inglesa: India Antigua',
    'c2c4 e7e5 b1c3 f8b4': '2...Bb4 — Inglesa: Clavada',
    'c2c4 e7e5 g2g3 g8f6 f1g2 d7d5': '3...d5 — Inglesa: Centro Abierto',
    'c2c4 e7e5 g2g3 g8f6 f1g2 d7d5 c4d5': '4.cxd5 — Inglesa: Captura Central',
    'c2c4 c7c5 b1c3 b8c6': '2...Nc6 — Inglesa Simétrica: Cuatro Caballos',
    'c2c4 c7c5 b1c3 g8f6 g2g3 d7d5': '3...d5 — Inglesa Simétrica: Ruptura Central',
    'c2c4 c7c5 b1c3 g8f6 g2g3 d7d5 c4d5 f6d5': '4...Nxd5 — Inglesa Simétrica: Captura',
    'c2c4 c7c5 g1f3 b8c6 b1c3': '3.Nc3 — Inglesa Simétrica: Tres Caballos',
    'c2c4 c7c5 g1f3 b8c6 d2d4': '3.d4 — Inglesa Simétrica: d4',
    'c2c4 c7c5 g1f3 g8f6 b1c3': '3.Nc3 — Inglesa Simétrica: Desarrollo',
    'c2c4 c7c5 g1f3 g8f6 d2d4': '3.d4 — Inglesa Simétrica: Ruptura',
    'c2c4 g8f6 b1c3 e7e5': '2...e5 — Inglesa India: e5',
    'c2c4 g8f6 b1c3 d7d5': '2...d5 — Inglesa India: Grünfeld',
    'c2c4 g8f6 b1c3 e7e6': '2...e6 — Inglesa India: Clásica',
    'c2c4 g8f6 g1f3 e7e6': '2...e6 — Inglesa India Réti: Clásica',
    'c2c4 g8f6 g1f3 g7g6': '2...g6 — Inglesa India: Fianchetto de Rey',
    'c2c4 d7d5': '1...d5 — Inglesa vs d5',
    'c2c4 d7d5 b1c3': '2.Nc3 — Inglesa vs d5: Desarrollo',
    'c2c4 d7d5 c4d5': '2.cxd5 — Inglesa vs d5: Captura',
    'c2c4 d7d5 c4d5 d8d5': '2...Qxd5 — Inglesa: Escandinava Invertida',

    // --- RÉTI más profunda ---
    'g1f3 d7d5 c2c4 d5c4 e2e3': '3.e3 — Réti: Recuperación del Peón',
    'g1f3 d7d5 c2c4 d5c4 b1a3': '3.Na3 — Réti: Gambito Variante',
    'g1f3 d7d5 c2c4 e7e6 b2b3': '3.b3 — Réti: Fianchetto de Dama',
    'g1f3 d7d5 c2c4 e7e6 b2b3 g8f6': '3...Nf6 — Réti: Fianchetto, Desarrollo',
    'g1f3 d7d5 c2c4 e7e6 b2b3 g8f6 c1b2': '4.Bb2 — Réti: Fianchetto Completo',
    'g1f3 g8f6 c2c4 e7e6': '2...e6 — Réti: India de Dama',
    'g1f3 g8f6 c2c4 g7g6': '2...g6 — Réti: India de Rey',
    'g1f3 g8f6 c2c4 b7b6': '2...b6 — Réti: India de Dama Directa',
    'g1f3 g8f6 g2g3 d7d5': '2...d5 — Réti Fianchetto: Clásica',
    'g1f3 g8f6 g2g3 d7d5 f1g2 c7c6': '3...c6 — Réti Fianchetto: Eslava',
    'g1f3 g8f6 g2g3 d7d5 f1g2 e7e6': '3...e6 — Réti Fianchetto: GDR',
    'g1f3 g8f6 g2g3 g7g6': '2...g6 — Réti: Doble Fianchetto India',
    'g1f3 c7c5 c2c4': '2.c4 — Réti vs Siciliana: Inglesa',
    'g1f3 e7e6': '1...e6 — Réti: Francesa Invertida',
    'g1f3 e7e6 c2c4': '2.c4 — Réti: Inglesa Diferida',

    // --- HOLANDESA más profunda ---
    'd2d4 f7f5 g1f3 g8f6': '2...Nf6 — Holandesa Clásica: Desarrollo',
    'd2d4 f7f5 g1f3 g8f6 g2g3': '3.g3 — Holandesa Clásica: Fianchetto',
    'd2d4 f7f5 g1f3 g8f6 g2g3 e7e6': '3...e6 — Holandesa: Muro de Piedra vía Nf3',
    'd2d4 f7f5 g1f3 g8f6 g2g3 g7g6': '3...g6 — Holandesa: Leningrado vía Nf3',
    'd2d4 f7f5 c2c4 g8f6 b1c3': '3.Nc3 — Holandesa: Desarrollo',
    'd2d4 f7f5 c2c4 g8f6 g2g3 e7e6 f1g2 f8e7': '4...Be7 — Holandesa Muro: Desarrollo',
    'd2d4 f7f5 c2c4 g8f6 g2g3 e7e6 f1g2 f8e7 g1f3': '5.Nf3 — Holandesa Muro: Línea Principal',
    'd2d4 f7f5 c2c4 g8f6 g2g3 e7e6 f1g2 f8e7 g1f3 e8g8 e1g1': '6.O-O — Holandesa Muro: Tabiya',
    'd2d4 f7f5 c2c4 g8f6 g2g3 g7g6 f1g2 f8g7 g1f3 e8g8': '5...O-O — Holandesa Leningrado: Enroque',
    'd2d4 f7f5 c2c4 g8f6 g2g3 g7g6 f1g2 f8g7 g1f3 e8g8 e1g1': '6.O-O — Holandesa Leningrado: Tabiya',
    'd2d4 f7f5 c2c4 g8f6 g2g3 g7g6 f1g2 f8g7 g1f3 e8g8 e1g1 d7d6': '6...d6 — Holandesa Leningrado: Preparando e5',
    'd2d4 f7f5 e2e4': '2.e4 — Gambito Staunton contra Holandesa',
    'd2d4 f7f5 c1g5': '2.Bg5 — Holandesa: Variante Leningrado Inversa',

    // --- COLLE más profundo ---
    'd2d4 d7d5 g1f3 g8f6 e2e3 e7e6 f1d3 c7c5 c2c3 b8c6': '5...Nc6 — Colle: Desarrollo',
    'd2d4 d7d5 g1f3 g8f6 e2e3 e7e6 f1d3 c7c5 c2c3 f8d6': '5...Bd6 — Colle: Desarrollo del Alfil',
    'd2d4 d7d5 g1f3 g8f6 e2e3 e7e6 f1d3 c7c5 c2c3 b8c6 b1d2': '6.Nbd2 — Colle: Preparando e4',
    'd2d4 d7d5 g1f3 g8f6 e2e3 e7e6 f1d3 c7c5 b2b3 b8c6': '5...Nc6 — Colle-Zukertort: Desarrollo',
    'd2d4 d7d5 g1f3 g8f6 e2e3 e7e6 f1d3 c7c5 b2b3 c8b7': '5...Bb7 — Colle-Zukertort: Fianchetto',
    'd2d4 d7d5 g1f3 g8f6 e2e3 e7e6 f1d3 c7c5 b2b3 f8e7': '5...Be7 — Colle-Zukertort: Clásica',

    // --- TROMPOWSKY más profunda ---
    'd2d4 g8f6 c1g5 f6e4 g5h4': '3.Bh4 — Trompowsky: Retirada',
    'd2d4 g8f6 c1g5 f6e4 c1f4': '3.Bf4 — Trompowsky: Desarrollo',
    'd2d4 g8f6 c1g5 d7d5 e2e3': '3.e3 — Trompowsky Clásica: Desarrollo',
    'd2d4 g8f6 c1g5 d7d5 g1f3': '3.Nf3 — Trompowsky Clásica: Línea Principal',
    'd2d4 g8f6 c1g5 e7e6 e2e4': '3.e4 — Trompowsky: Gambito',
    'd2d4 g8f6 c1g5 e7e6 g1f3': '3.Nf3 — Trompowsky: Torre',
    'd2d4 g8f6 c1g5 c7c5 d4d5': '3.d5 — Trompowsky Gambito: Avance',
    'd2d4 g8f6 c1g5 c7c5 g5f6': '3.Bxf6 — Trompowsky Gambito: Cambio',

    // --- ATAQUE TORRE más profundo ---
    'd2d4 g8f6 g1f3 e7e6 c1g5 c7c5 e2e3': '4.e3 — Torre: Desarrollo',
    'd2d4 g8f6 g1f3 e7e6 c1g5 f8e7 b1d2': '4.Nbd2 — Torre: Desarrollo del Caballo',
    'd2d4 g8f6 g1f3 e7e6 c1g5 f8e7 g5f6': '4.Bxf6 — Torre: Cambio de Alfil',
    'd2d4 g8f6 g1f3 e7e6 c1g5 d7d5': '3...d5 — Torre: Variante Cerrada',
    'd2d4 g8f6 g1f3 e7e6 c1g5 h7h6': '3...h6 — Torre: Expulsando Alfil',
    'd2d4 g8f6 g1f3 e7e6 c1g5 h7h6 g5h4': '4.Bh4 — Torre: Manteniendo la Clavada',
    'd2d4 g8f6 g1f3 e7e6 c1g5 b7b6': '3...b6 — Torre: Transposición India de Dama',

    // --- BIRD más profunda ---
    'f2f4 d7d5 g1f3 g8f6 e2e3 g7g6': '3...g6 — Bird: Fianchetto',
    'f2f4 d7d5 g1f3 g8f6 e2e3 e7e6': '3...e6 — Bird: Muro de Piedra Invertido',
    'f2f4 d7d5 g1f3 g8f6 e2e3 c7c5': '3...c5 — Bird: Contrajuego',
    'f2f4 d7d5 g1f3 g8f6 g2g3': '3.g3 — Bird: Fianchetto',
    'f2f4 d7d5 g1f3 c7c5': '2...c5 — Bird: Siciliana Invertida',
    'f2f4 d7d5 b2b3': '2.b3 — Bird-Larsen',
    'f2f4 e7e5 f4e5': '2.fxe5 — Gambito From: Aceptado',
    'f2f4 e7e5 f4e5 d7d6': '2...d6 — From: Recuperación',
    'f2f4 g8f6': '1...Nf6 — Bird: India',
    'f2f4 g7g6': '1...g6 — Bird: Moderna',

    // --- GAMBITO DE REY más profundo ---
    'e2e4 e7e5 f2f4 e5f4 g1f3 g7g5 h2h4': '4.h4 — Gambito Rey: Ataque con h4',
    'e2e4 e7e5 f2f4 e5f4 g1f3 g7g5 h2h4 g5g4': '4...g4 — Gambito Rey: Kieseritzky',
    'e2e4 e7e5 f2f4 e5f4 g1f3 g7g5 f1c4 g5g4': '4...g4 — Gambito Muzio: Sacrificio',
    'e2e4 e7e5 f2f4 e5f4 g1f3 g7g5 d2d4': '4.d4 — Gambito Rey: Clásico',
    'e2e4 e7e5 f2f4 e5f4 g1f3 g8f6': '3...Nf6 — Gambito Rey: Contragambito',
    'e2e4 e7e5 f2f4 e5f4 g1f3 d7d5': '3...d5 — Gambito Rey: Contragambito Falkbeer',
    'e2e4 e7e5 f2f4 d7d5': '2...d5 — Contragambito Falkbeer',
    'e2e4 e7e5 f2f4 d7d5 e4d5': '3.exd5 — Falkbeer: Línea Principal',
    'e2e4 e7e5 f2f4 d7d5 e4d5 e5e4': '3...e4 — Falkbeer: Avance',
    'e2e4 e7e5 f2f4 f8c5 g1f3': '3.Nf3 — Gambito Rey Rehusado: Línea Principal',
    'e2e4 e7e5 f2f4 f8c5 g1f3 d7d6': '3...d6 — Gambito Rey Rehusado: Desarrollo',
    'e2e4 e7e5 f2f4 f8c5 f4e5': '3.fxe5 — Gambito Rey Rehusado: Captura',

    // --- ESCOCESA más profunda ---
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 f8c5 d4b3 c5b6': '5...Bb6 — Escocesa Clásica: Retirada',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 b1c3': '5.Nc3 — Escocesa: Cuatro Caballos',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 d4c6': '5.Nxc6 — Escocesa: Cambio del Caballo',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 d8h4 b1c3': '5.Nc3 — Escocesa Steinitz: Desarrollo',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 d8h4 d4b5': '5.Nb5 — Escocesa Steinitz: Variante Moderna',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f1c4 f8c5': '4...Bc5 — Gambito Escocés: Italiana',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f1c4 g8f6': '4...Nf6 — Gambito Escocés: Desarrollo',

    // --- VIENESA más profunda ---
    'e2e4 e7e5 b1c3 g8f6 f2f4': '3.f4 — Vienesa: Gambito',
    'e2e4 e7e5 b1c3 g8f6 f1c4': '3.Bc4 — Vienesa: Sistema del Alfil',
    'e2e4 e7e5 b1c3 g8f6 g2g3': '3.g3 — Vienesa: Fianchetto',
    'e2e4 e7e5 b1c3 b8c6 f1c4': '3.Bc4 — Vienesa: Alfil contra Nc6',
    'e2e4 e7e5 b1c3 b8c6 g2g3': '3.g3 — Vienesa: Fianchetto contra Nc6',
    'e2e4 e7e5 b1c3 g8f6 f2f4 d7d5': '3...d5 — Vienesa: Contragambito Falkbeer',
    'e2e4 e7e5 b1c3 g8f6 f2f4 e5f4': '3...exf4 — Vienesa: Gambito Aceptado',

    // --- CATALANA más profunda ---
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3 f8e7 e1g1 e8g8': '6...O-O — Catalana Abierta: Clásica Profunda',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3 f8e7 e1g1 e8g8 d1c2': '7.Qc2 — Catalana Abierta: Recuperando c4',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3 a7a6 e1g1 b7b5': '6...b5 — Catalana Abierta: Defensa del Peón',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3 c7c5': '5...c5 — Catalana Abierta: Contrajuego',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3 b8c6': '5...Nc6 — Catalana Abierta: Desarrollo',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1 d5c4 d1c2': '7.Qc2 — Catalana: Abierta Diferida, Qc2',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1 c7c6 d1c2': '7.Qc2 — Catalana Cerrada: Eslava, Qc2',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1 b7b6 b1c3': '7.Nc3 — Catalana Cerrada: India, Nc3',

    // --- SEMI-ESLAVA más profunda ---
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3 d5c4 d3c4 b7b5 c4d3': '8.Bd3 — Meran: Retirada del Alfil',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3 d5c4 d3c4 b7b5 c4d3 c8b7': '8...Bb7 — Meran: Fianchetto',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3 d5c4 d3c4 b7b5 c4d3 a7a6': '8...a6 — Meran: Preparando c5',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 c1g5 b8d7 e2e3': '6.e3 — Anti-Meran: Desarrollo',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 c1g5 h7h6 g5h4': '6.Bh4 — Anti-Moscú: Manteniendo Alfil',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 c1g5 h7h6 g5f6 d8f6': '6...Qxf6 — Anti-Moscú: Cambio',

    // --- PHILIDOR más profunda ---
    'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6 b1c3 b8d7 f1c4': '5.Bc4 — Philidor Hanham: Alfil Activo',
    'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6 b1c3 b8d7 g2g4': '5.g4 — Philidor Hanham: Ataque Shirov',
    'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6 d4e5 f6e4': '4...Nxe4 — Philidor Cambio: Captura',
    'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6 d4e5 f6e4 d1d5': '5.Qd5 — Philidor Cambio: Presión con Dama',
    'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6 b1c3 f8e7': '4...Be7 — Philidor: Desarrollo del Alfil',
    'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6 b1c3 f8e7 f1c4': '5.Bc4 — Philidor: Alfil Activo',
    'e2e4 e7e5 g1f3 d7d6 d2d4 e5d4 f3d4': '4.Nxd4 — Philidor Cambio: Recuperación',
    'e2e4 e7e5 g1f3 d7d6 d2d4 c8g4': '3...Bg4 — Philidor: Variante de la Clavada',

    // --- CUATRO CABALLOS más profunda ---
    'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 f1b5 f8b4 e1g1': '5.O-O — Cuatro Caballos Española: Enroque',
    'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 f1b5 b8d4': '4...Nd4 — Cuatro Caballos: Rubinstein',
    'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 d2d4 e5d4': '4...exd4 — Cuatro Caballos: Escocesa, Captura',
    'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 d2d4 e5d4 f3d4': '5.Nxd4 — Cuatro Caballos Escocesa: Recuperación',
    'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 f1b5 f8b4 d2d3': '5.d3 — Cuatro Caballos: Metger',

    // --- LARSEN más profunda ---
    'b2b3 e7e5 c1b2': '2.Bb2 — Larsen: Fianchetto',
    'b2b3 d7d5 c1b2': '2.Bb2 — Larsen Clásica: Fianchetto',
    'b2b3 d7d5 c1b2 g8f6': '2...Nf6 — Larsen: Desarrollo',
    'b2b3 g8f6 c1b2': '2.Bb2 — Larsen India: Fianchetto',
    'b2b3 g8f6 c1b2 g7g6': '2...g6 — Larsen: Doble Fianchetto',
    'b2b3 e7e5 c1b2 b8c6': '2...Nc6 — Larsen: Desarrollo',
    'b2b3 e7e5 c1b2 b8c6 e2e3': '3.e3 — Larsen: Sistema con e3',
};

let currentOpeningName = '';
let lastOpeningMoveCount = 0;
let trainingOpening = null;
let trainingActive = false;
let trainingFreeMode = false;
let trainingPaused = false;
let trainingResumeCallback = null;
let trainingTimeoutId = null;
let quizMode = false;
let quizMoves = [];
let quizIndex = 0;
let quizCorrect = 0;
let quizWrong = 0;

const FAMOUS_GAMES = {
    'immortal': {
        name: 'La Partida Inmortal',
        pgn: '[Event "London"]\n[Site "London"]\n[Date "1851"]\n[White "Adolf Anderssen"]\n[Black "Lionel Kieseritzky"]\n[Result "1-0"]\n\n1.e4 e5 2.f4 exf4 3.Bc4 Qh4+ 4.Kf1 b5 5.Bxb5 Nf6 6.Nf3 Qh6 7.d3 Nh5 8.Nh4 Qg5 9.Nf5 c6 10.g4 Nf6 11.Rg1 cxb5 12.h4 Qg6 13.h5 Qg5 14.Qf3 Ng8 15.Bxf4 Qf6 16.Nc3 Bc5 17.Nd5 Qxb2 18.Bd6 Bxg1 19.e5 Qxa1+ 20.Ke2 Na6 21.Nxg7+ Kd8 22.Qf6+ Nxf6 23.Be7# 1-0'
    },
    'kasparov-deepblue': {
        name: 'Kasparov vs Deep Blue, partida 6',
        pgn: '[Event "IBM Man-Machine"]\n[Site "New York"]\n[Date "1997"]\n[White "Deep Blue"]\n[Black "Garry Kasparov"]\n[Result "1-0"]\n\n1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nd7 5.Ng5 Ngf6 6.Bd3 e6 7.N1f3 h6 8.Nxe6 Qe7 9.O-O fxe6 10.Bg6+ Kd8 11.Bf4 b5 12.a4 Bb7 13.Re1 Nd5 14.Bg3 Kc8 15.axb5 cxb5 16.Qd3 Bc6 17.Bf5 exf5 18.Rxe7 Bxe7 19.c4 1-0'
    },
    'opera': {
        name: 'La Partida de la Ópera',
        pgn: '[Event "Paris"]\n[Site "Paris"]\n[Date "1858"]\n[White "Paul Morphy"]\n[Black "Duke Karl / Count Isouard"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8# 1-0'
    },
    'evergreen': {
        name: 'La Siempre Verde',
        pgn: '[Event "Berlin"]\n[Site "Berlin"]\n[Date "1852"]\n[White "Adolf Anderssen"]\n[Black "Jean Dufresne"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4 exd4 7.O-O d3 8.Qb3 Qf6 9.e5 Qg6 10.Re1 Nge7 11.Ba3 b5 12.Qxb5 Rb8 13.Qa4 Bb6 14.Nbd2 Bb7 15.Ne4 Qf5 16.Bxd3 Qh5 17.Nf6+ gxf6 18.exf6 Rg8 19.Rad1 Qxf3 20.Rxe7+ Nxe7 21.Qxd7+ Kxd7 22.Bf5+ Ke8 23.Bd7+ Kf8 24.Bxe7# 1-0'
    },
    'kasparov-topalov': {
        name: 'Kasparov vs Topalov, Wijk aan Zee 1999',
        pgn: '[Event "Hoogovens"]\n[Site "Wijk aan Zee"]\n[Date "1999.01.20"]\n[White "Garry Kasparov"]\n[Black "Veselin Topalov"]\n[Result "1-0"]\n\n1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Be3 Bg7 5.Qd2 c6 6.f3 b5 7.Nge2 Nbd7 8.Bh6 Bxh6 9.Qxh6 Bb7 10.a3 e5 11.O-O-O Qe7 12.Kb1 a6 13.Nc1 O-O-O 14.Nb3 exd4 15.Rxd4 c5 16.Rd1 Nb6 17.g3 Kb8 18.Na5 Ba8 19.Bh3 d5 20.Qf4+ Ka7 21.Rhe1 d4 22.Nd5 Nbxd5 23.exd5 Qd6 24.Rxd4 cxd4 25.Re7+ Kb6 26.Qxd4+ Kxa5 27.b4+ Ka4 28.Qc3 Qxd5 29.Ra7 Bb7 30.Rxb7 Qc4 31.Qxf6 Kxa3 32.Qxa6+ Kxb4 33.c3+ Kxc3 34.Qa1+ Kd2 35.Qb2+ Kd1 36.Bf1 Rd2 37.Rd7 Rxd7 38.Bxc4 bxc4 39.Qxh8 Rd3 40.Qa8 c3 41.Qa4+ Ke1 42.f4 f5 43.Kc1 Rd2 44.Qa7 1-0'
    },
    'fischer-spassky': {
        name: 'Fischer vs Spassky, partida 6 (1972)',
        pgn: '[Event "World Championship"]\n[Site "Reykjavik"]\n[Date "1972.07.23"]\n[White "Robert James Fischer"]\n[Black "Boris Spassky"]\n[Result "1-0"]\n\n1.c4 e6 2.Nf3 d5 3.d4 Nf6 4.Nc3 Be7 5.Bg5 O-O 6.e3 h6 7.Bh4 b6 8.cxd5 Nxd5 9.Bxe7 Qxe7 10.Nxd5 exd5 11.Rc1 Be6 12.Qa4 c5 13.Qa3 Rc8 14.Bb5 a6 15.dxc5 bxc5 16.O-O Ra7 17.Be2 Nd7 18.Nd4 Qf8 19.Nxe6 fxe6 20.e4 d4 21.f4 Qe7 22.e5 Rb8 23.Bc4 Kh8 24.Qh3 Nf8 25.b3 a5 26.f5 exf5 27.Rxf5 Nh7 28.Rcf1 Qd8 29.Qg3 Re7 30.h4 Rbb7 31.e6 Rbc7 32.Qe5 Qe8 33.a4 Qd8 34.R1f2 Qe8 35.R2f3 Qd8 36.Bd3 Qe8 37.Qe4 Nf6 38.Rxf6 gxf6 39.Rxf6 Kg8 40.Bc4 Kh8 41.Qf4 1-0'
    },
    'game-of-century': {
        name: 'La Partida del Siglo (Byrne vs Fischer, 1956)',
        pgn: '[Event "Rosenwald Memorial"]\n[Site "New York"]\n[Date "1956.10.17"]\n[White "Donald Byrne"]\n[Black "Robert James Fischer"]\n[Result "0-1"]\n\n1.Nf3 Nf6 2.c4 g6 3.Nc3 Bg7 4.d4 O-O 5.Bf4 d5 6.Qb3 dxc4 7.Qxc4 c6 8.e4 Nbd7 9.Rd1 Nb6 10.Qc5 Bg4 11.Bg5 Na4 12.Qa3 Nxc3 13.bxc3 Nxe4 14.Bxe7 Qb6 15.Bc4 Nxc3 16.Bc5 Rfe8+ 17.Kf1 Be6 18.Bxb6 Bxc4+ 19.Kg1 Ne2+ 20.Kf1 Nxd4+ 21.Kg1 Ne2+ 22.Kf1 Nc3+ 23.Kg1 axb6 24.Qb4 Ra4 25.Qxb6 Nxd1 26.h3 Rxa2 27.Kh2 Nxf2 28.Re1 Rxe1 29.Qd8+ Bf8 30.Nxe1 Bd5 31.Nf3 Ne4 32.Qb8 b5 33.h4 h5 34.Ne5 Kg7 35.Kg1 Bc5+ 36.Kf1 Ng3+ 37.Ke1 Bb4+ 38.Kd1 Bb3+ 39.Kc1 Ne2+ 40.Kb1 Nc3+ 41.Kc1 Rc2# 0-1'
    },
    'rubinstein-immortal': {
        name: 'La Inmortal de Rubinstein (Rotlewi vs Rubinstein, 1907)',
        pgn: '[Event "5th All-Russian Masters"]\n[Site "Lodz"]\n[Date "1907.12.26"]\n[White "Georg Rotlewi"]\n[Black "Akiba Rubinstein"]\n[Result "0-1"]\n\n1.d4 d5 2.Nf3 e6 3.e3 c5 4.c4 Nc6 5.Nc3 Nf6 6.dxc5 Bxc5 7.a3 a6 8.b4 Bd6 9.Bb2 O-O 10.Qd2 Qe7 11.Bd3 dxc4 12.Bxc4 b5 13.Bd3 Rd8 14.Qe2 Bb7 15.O-O Ne5 16.Nxe5 Bxe5 17.f4 Bc7 18.e4 Rac8 19.e5 Bb6+ 20.Kh1 Ng4 21.Be4 Qh4 22.g3 Rxc3 23.gxh4 Rd2 24.Qxd2 Bxe4+ 25.Qg2 Rh3 0-1'
    },
    'lasker-bauer': {
        name: 'Lasker vs Bauer (1889) — Doble sacrificio de alfil',
        pgn: '[Event "Amsterdam"]\n[Site "Amsterdam"]\n[Date "1889"]\n[White "Emanuel Lasker"]\n[Black "Johann Hermann Bauer"]\n[Result "1-0"]\n\n1.f4 d5 2.e3 Nf6 3.b3 e6 4.Bb2 Be7 5.Bd3 b6 6.Nc3 Bb7 7.Nf3 Nbd7 8.O-O O-O 9.Ne2 c5 10.Ng3 Qc7 11.Ne5 Nxe5 12.Bxe5 Qc6 13.Qe2 a6 14.Nh5 Nxh5 15.Bxh7+ Kxh7 16.Qxh5+ Kg8 17.Bxg7 Kxg7 18.Qg4+ Kh7 19.Rf3 e5 20.Rh3+ Qh6 21.Rxh6+ Kxh6 22.Qd7 Bf6 23.Qxb7 Kg7 24.Rf1 Rab8 25.Qd7 Rfd8 26.Qg4+ Kf8 27.fxe5 Bg7 28.e6 Rb7 29.Qg6 f6 30.Rxf6+ Bxf6 31.Qxf6+ Ke8 32.Qh8+ Ke7 33.Qg7+ Kxe6 34.Qxb7 Rd6 35.Qxa6 d4 36.exd4 cxd4 37.h4 d3 38.Qxd3 1-0'
    },
    'torre-lasker': {
        name: 'Torre vs Lasker (1925) — El Molino',
        pgn: '[Event "Moscow"]\n[Site "Moscow"]\n[Date "1925"]\n[White "Carlos Torre"]\n[Black "Emanuel Lasker"]\n[Result "1-0"]\n\n1.d4 Nf6 2.Nf3 e6 3.Bg5 c5 4.e3 cxd4 5.exd4 Be7 6.Nbd2 d6 7.c3 Nbd7 8.Bd3 b6 9.Nc4 Bb7 10.Qe2 Qc7 11.O-O O-O 12.Rfe1 Rfe8 13.Rad1 Nf8 14.Bc1 Nd5 15.Ng5 b5 16.Na3 b4 17.cxb4 Nxb4 18.Qh5 Bxg5 19.Bxg5 Nxd3 20.Rxd3 Qa5 21.b4 Qf5 22.Rg3 h6 23.Nc4 Qd5 24.Ne3 Qb5 25.Bf6 Qxh5 26.Rxg7+ Kh8 27.Rxf7+ Kg8 28.Rg7+ Kh8 29.Rxb7+ Kg8 30.Rg7+ Kh8 31.Rg5+ Kh7 32.Rxh5 Kg6 33.Rh3 Kxf6 34.Rxh6+ Kg5 35.Rh3 Reb8 36.Rg3+ Kf6 37.Rf3+ Kg6 38.a3 a5 39.bxa5 Rxa5 40.Nc4 Rd5 41.Rf4 Nd7 42.Rxe6+ Kg5 43.g3 1-0'
    },
    'karpov-kasparov-85': {
        name: 'Karpov vs Kasparov, partida 16 (1985) — Brisbane Bombshell',
        pgn: '[Event "World Championship"]\n[Site "Moscow"]\n[Date "1985.10.15"]\n[White "Anatoly Karpov"]\n[Black "Garry Kasparov"]\n[Result "0-1"]\n\n1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6 5.Nb5 d6 6.c4 Nf6 7.N1c3 a6 8.Na3 d5 9.cxd5 exd5 10.exd5 Nb4 11.Be2 Bc5 12.O-O O-O 13.Bf3 Bf5 14.Bg5 Re8 15.Qd2 b5 16.Rad1 Nd3 17.Nab1 h6 18.Bh4 b4 19.Na4 Bd6 20.Bg3 Rc8 21.b3 g5 22.Bxd6 Qxd6 23.g3 Nd7 24.Bg2 Qf6 25.a3 a5 26.axb4 axb4 27.Qa2 Bg6 28.d6 g4 29.Qd2 Kg7 30.f3 Qxd6 31.fxg4 Qd4+ 32.Kh1 Nf6 33.Rf4 Ne4 34.Qxd3 Nf2+ 35.Rxf2 Bxd3 36.Rfd2 Qe3 37.Rxd3 Rc1 38.Nb2 Qf2 39.Nd2 Rxd1+ 40.Nxd1 Re1+ 0-1'
    },
    'polugaevsky-tal': {
        name: 'Polugaevsky vs Tal (1969)',
        pgn: '[Event "USSR Championship"]\n[Site "Moscow"]\n[Date "1969.09.07"]\n[White "Lev Polugaevsky"]\n[Black "Mikhail Tal"]\n[Result "1-0"]\n\n1.c4 Nf6 2.Nc3 e6 3.Nf3 d5 4.d4 c5 5.cxd5 Nxd5 6.e4 Nxc3 7.bxc3 cxd4 8.cxd4 Bb4+ 9.Bd2 Bxd2+ 10.Qxd2 O-O 11.Bc4 Nc6 12.O-O b6 13.Rad1 Bb7 14.Rfe1 Na5 15.Bd3 Rc8 16.d5 exd5 17.e5 Nc4 18.Qf4 Nb2 19.Bxh7+ Kxh7 20.Ng5+ Kg6 21.h4 Rc4 22.h5+ Kh6 23.Nxf7+ Kh7 24.Qf5+ Kg8 25.e6 Qf6 26.Qxf6 gxf6 27.Rd2 Rc6 28.Rxb2 Re8 29.Nh6+ Kh7 30.Nf5 Rexe6 31.Rxe6 Rxe6 32.Rc2 Rc6 33.Re2 Bc8 34.Re7+ Kh8 35.Nh4 f5 36.Ng6+ Kg8 37.Rxa7 1-0'
    },
    'deepblue-kasparov-96': {
        name: 'Deep Blue vs Kasparov, partida 1 (1996)',
        pgn: '[Event "Philadelphia"]\n[Site "Philadelphia"]\n[Date "1996.02.10"]\n[White "Deep Blue"]\n[Black "Garry Kasparov"]\n[Result "1-0"]\n\n1.e4 c5 2.c3 d5 3.exd5 Qxd5 4.d4 Nf6 5.Nf3 Bg4 6.Be2 e6 7.h3 Bh5 8.O-O Nc6 9.Be3 cxd4 10.cxd4 Bb4 11.a3 Ba5 12.Nc3 Qd6 13.Nb5 Qe7 14.Ne5 Bxe2 15.Qxe2 O-O 16.Rac1 Rac8 17.Bg5 Bb6 18.Bxf6 gxf6 19.Nc4 Rfd8 20.Nxb6 axb6 21.Rfd1 f5 22.Qe3 Qf6 23.Rxc8 Rxc8 24.Rc1 Rxc1 25.Qxc1 Kh7 26.Kf1 Kg7 27.Ke2 Kh6 28.Kd3 Kg5 29.f4+ Kh4 30.Qc4 f6 31.Qf7 Qxf7 32.Nxf7 Kg3 33.Nxe6 fxe5 34.fxe5 Kxh3 35.Kd4 Kg4 36.e6 h5 37.Rxh7 1-0'
    },
    'lasker-capablanca': {
        name: 'Lasker vs Capablanca, San Petersburgo 1914',
        pgn: '[Event "St. Petersburg"]\n[Site "St. Petersburg"]\n[Date "1914.05.18"]\n[White "Emanuel Lasker"]\n[Black "Jose Raul Capablanca"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Bxc6 dxc6 5.d4 exd4 6.Qxd4 Qxd4 7.Nxd4 Bd6 8.Nc3 Ne7 9.O-O O-O 10.f4 Re8 11.Nb3 f6 12.f5 b6 13.Bf4 Bb7 14.Bxd6 cxd6 15.Nd4 Rad8 16.Ne6 Rd7 17.Rad1 Nc8 18.Rf2 b5 19.Rfd2 Rde7 20.b4 Kf7 21.a3 Ba8 22.Kf2 Ra7 23.g4 h6 24.Rd3 a5 25.h4 axb4 26.axb4 Rae7 27.Kf3 Rg8 28.Kf4 g6 29.Rg3 g5+ 30.Kf3 Nb6 31.hxg5 hxg5 32.Rh3 Rd7 33.Kg3 Ke8 34.Rdh1 Bb7 35.e5 dxe5 36.Ne4 Nd5 37.N6c5 Bc8 38.Nxd7 Bxd7 39.Rh7 Rf8 40.Ra1 Kd8 41.Ra8+ Bc8 42.Nc5 1-0'
    },
    'steinitz-mongredien': {
        name: 'Steinitz vs Mongredien (1862)',
        pgn: '[Event "5th BCA Congress"]\n[Site "London"]\n[Date "1862"]\n[White "Wilhelm Steinitz"]\n[Black "Augustus Mongredien"]\n[Result "1-0"]\n\n1.e4 d5 2.exd5 Qxd5 3.Nc3 Qd8 4.d4 e6 5.Nf3 Nf6 6.Bd3 Be7 7.O-O O-O 8.Be3 b6 9.Ne5 Bb7 10.f4 Nbd7 11.Qe2 Nd5 12.Nxd5 exd5 13.Rf3 f5 14.Rh3 g6 15.g4 fxg4 16.Rxh7 Nxe5 17.fxe5 Kxh7 18.Qxg4 Rg8 19.Qh5+ Kg7 20.Qh6+ Kf7 21.Qh7+ Ke6 22.Qh3+ Kf7 23.Rf1+ Ke8 24.Qe6 Rg7 25.Bg5 Qd7 26.Bxg6+ Rxg6 27.Qxg6+ Kd8 28.Rf8+ Qe8 29.Qxe8# 1-0'
    },
    'bogolyubov-monticelli': {
        name: 'Bogolyubov vs Monticelli (1930) — The Full Monti',
        pgn: '[Event "San Remo"]\n[Site "San Remo"]\n[Date "1930.01.21"]\n[White "Efim Bogoljubov"]\n[Black "Mario Monticelli"]\n[Result "0-1"]\n\n1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Nf3 b6 5.Bg5 Bxc3+ 6.bxc3 Bb7 7.e3 d6 8.Bd3 Nbd7 9.O-O Qe7 10.Nd2 h6 11.Bh4 g5 12.Bg3 O-O-O 13.a4 a5 14.Rb1 Rdg8 15.f3 h5 16.e4 h4 17.Be1 e5 18.h3 Nh5 19.c5 dxc5 20.d5 Nf4 21.Nc4 Rh6 22.Rf2 f5 23.d6 Rxd6 24.Nxd6 Qxd6 25.Bc4 Rf8 26.exf5 Rxf5 27.Rd2 Qe7 28.Qb3 Rf8 29.Bd3 e4 30.Be4 Bxe4 31.fxe4 Qxe4 32.Qc2 Qc6 33.c4 g4 34.Bh4 gxh3 35.g3 Ne5 36.Rb3 Ne2+ 37.Rxe2 Rf1+ 38.Kxf1 Qh1+ 39.Kf2 Ng4+ 0-1'
    },
    'vallejo-shirov': {
        name: 'Vallejo vs Shirov, Linares 2002',
        pgn: '[Event "Linares"]\n[Site "Linares"]\n[Date "2002.03.09"]\n[White "Francisco Vallejo Pons"]\n[Black "Alexei Shirov"]\n[Result "1-0"]\n\n1.e4 c5 2.Nf3 d6 3.Bc4 Nf6 4.d3 e6 5.Bb3 Be7 6.O-O O-O 7.c3 Nc6 8.Re1 b5 9.Nbd2 d5 10.e5 Nd7 11.d4 Ba6 12.Nf1 b4 13.Ba4 Rc8 14.Bxc6 Rxc6 15.cxb4 Bxf1 16.Rxf1 cxb4 17.Be3 Qa5 18.g3 Rfc8 19.Ne1 Qb5 20.h4 a5 21.b3 a4 22.Nd3 Rc3 23.Nf4 Nf8 24.Qg4 Qd7 25.h5 axb3 26.axb3 Rxb3 27.h6 g6 28.Nh3 Rbc3 29.Bg5 b3 30.Rfb1 Rb8 31.Kg2 Rc7 32.Rb2 Bxg5 33.Qxg5 Qe7 34.Qe3 Qb4 35.Qf4 Qe7 36.Qf3 Rcb7 37.Rab1 Nd7 38.Rxb3 Rxb3 39.Rxb3 Qf8 40.Rxb8 Nxb8 41.Ng5 Nd7 42.Qf4 Qe7 43.Qc1 Qd8 44.Nf3 Kf8 45.Ng5 Kg8 46.Nf3 Kf8 47.Kg1 Qb8 48.Qa3+ Ke8 49.Ng5 Nf8 50.Qa4+ Ke7 51.Kg2 Qb7 52.Qa3+ Ke8 53.Qf3 Qe7 54.Qf6 1-0'
    },
    'illescas-karpov': {
        name: 'Illescas vs Karpov, Linares 1994 — The Reign in Spain',
        pgn: '[Event "Linares"]\n[Site "Linares"]\n[Date "1994.02.26"]\n[White "Miguel Illescas Cordoba"]\n[Black "Anatoly Karpov"]\n[Result "0-1"]\n\n1.Nf3 Nf6 2.c4 b6 3.g3 Bb7 4.Bg2 e6 5.Nc3 Bb4 6.O-O O-O 7.Qc2 Re8 8.d4 Bxc3 9.Qxc3 d6 10.b3 Nbd7 11.Bb2 Be4 12.Rac1 Rc8 13.Rfd1 c6 14.Qb4 Qc7 15.Qd2 Qb7 16.Qf4 d5 17.Bf1 b5 18.cxb5 cxb5 19.Ne1 Qa6 20.a3 h6 21.Rxc8 Rxc8 22.Rc1 Nb8 23.e3 Rxc1 24.Bxc1 Qb6 25.Bd2 Nbd7 26.Bb4 a5 27.Be7 e5 28.Qh4 exd4 29.Qf4 dxe3 30.Qxe3 d4 31.Qf4 Qc6 32.Bxf6 Nxf6 33.Qb8+ Kh7 34.Qxb5 Qc1 35.Nd3 Qd1 36.Nc5 Bg6 37.Kg2 Ne4 38.Be2 Qe1 39.Nxe4 Bxe4+ 40.f3 Bg6 41.h4 h5 42.f4 Be4+ 43.Bf3 g6 44.Bxe4 Qxe4+ 45.Kf2 Qe3+ 46.Kg2 d3 47.Qc4 Qe2+ 48.Kg1 Qd1+ 49.Kf2 Qd2+ 50.Kf1 Qd1+ 51.Kf2 Qe2+ 52.Kg1 Kg8 53.Qc8+ Kg7 54.Qc3+ Kf8 55.Qc5+ Ke8 56.Qc6+ Ke7 57.Qc5+ Ke6 58.Qf2 Qd1+ 59.Kg2 Qxb3 60.Qe1+ Kd7 61.Qxa5 Qc2+ 62.Kh3 d2 63.Qd5+ Kc8 0-1'
    },
    'pomar-fischer': {
        name: 'Pomar vs Fischer, Olimpiada La Habana 1966',
        pgn: '[Event "Olympiad"]\n[Site "Havana"]\n[Date "1966"]\n[White "Arturo Pomar Salamanca"]\n[Black "Robert James Fischer"]\n[Result "0-1"]\n\n1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 g6 6.e4 d6 7.Be2 Bg7 8.f4 O-O 9.Nf3 Re8 10.Nd2 c4 11.Bf3 Nbd7 12.O-O b5 13.Kh1 a6 14.a4 Rb8 15.axb5 axb5 16.e5 dxe5 17.Nde4 Nxe4 18.Nxe4 Nf6 19.d6 Be6 20.Nc5 e4 21.Nxe4 Nxe4 22.Bxe4 Qb6 23.f5 gxf5 24.Bc2 Qd4 25.Qh5 Qg4 26.Qxg4 fxg4 27.Bg5 Bxb2 28.Rad1 b4 29.d7 Red8 30.Ba4 b3 31.Rfe1 Kg7 32.Bxd8 Rxd8 33.Rd6 Bf6 34.Red1 Bg5 35.Rb6 h6 36.Rc6 Ra8 37.Bb5 Bxd7 38.h4 Bxc6 39.Bxc6 c3 40.hxg5 c2 41.gxh6+ Kh8 0-1'
    },
    'fischer-pomar-62': {
        name: 'Fischer vs Pomar, Estocolmo 1962 — Jaque continuo',
        pgn: '[Event "Stockholm Interzonal"]\n[Site "Stockholm"]\n[Date "1962.02.10"]\n[Round "9"]\n[White "Robert James Fischer"]\n[Black "Arturo Pomar Salamanca"]\n[Result "1/2-1/2"]\n[ECO "B29"]\n\n1.e4 c5 2.Nf3 Nf6 3.Nc3 d5 4.Bb5+ Bd7 5.e5 d4 6.exf6 dxc3 7.fxg7 cxd2+ 8.Qxd2 Bxg7 9.Qg5 Bf6 10.Bxd7+ Nxd7 11.Qh5 Qa5+ 12.Nd2 Qa6 13.Ne4 O-O-O 14.Qe2 Qe6 15.Nxf6 Qxe2+ 16.Kxe2 Nxf6 17.Be3 b6 18.Rad1 Rxd1 19.Rxd1 Rd8 20.Rxd8+ Kxd8 21.Kf3 Kd7 22.Kf4 Ng8 23.c4 f6 24.Ke4 e6 25.Bd2 Ne7 26.Bc3 Ng8 27.g4 Ke7 28.f4 h6 29.f5 exf5+ 30.gxf5 h5 31.Bd2 Kd7 32.a4 Ne7 33.Bc3 Ng8 34.Kf4 Ke7 35.b4 cxb4 36.Bxb4+ Kd7 37.Bf8 Ke8 38.Bd6 Kd7 39.c5 bxc5 40.Bxc5 a6 41.Ke4 Kc6 42.Bf8 Kd7 43.h3 Ke8 44.Bc5 Kd7 45.Bd4 Kd6 46.Bb2 Kc6 47.Bc3 Kd6 48.Bb4+ Kd7 49.a5 Nh6 50.Bc3 Ng8 51.Bb4 Nh6 52.Bc3 Ng8 53.Kd5 Ne7+ 54.Kc5 Nxf5 55.Bxf6 Ke6 56.Bg5 Nd6 57.Kb6 Kd5 58.Kxa6 Kc6 59.Bd2 Ne4 60.Bb4 Nf6 61.Ka7 Nd7 62.a6 Kc7 63.Ba5+ Kc6 64.Be1 Nc5 65.Bf2 Nd7 66.Bh4 Nc5 67.Be7 Nd7 68.Ba3 Kc7 69.Bb2 Kc6 70.Bd4 Kc7 71.Bg7 Kc6 72.Ba1 Nc5 73.Bd4 Nd7 74.Be3 Kc7 75.Bf4+ Kc6 76.Ka8 Kb6 77.a7 Kc6 1/2-1/2'
    },
    'carlsen-ernst': {
        name: 'Carlsen vs Ernst, Wijk aan Zee 2004 — El Efecto Magnus',
        pgn: '[Event "Corus Group C"]\n[Site "Wijk aan Zee"]\n[Date "2004.01.24"]\n[White "Magnus Carlsen"]\n[Black "Sipke Ernst"]\n[Result "1-0"]\n[WhiteElo "2484"]\n[BlackElo "2474"]\n\n1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5 5.Ng3 Bg6 6.h4 h6 7.Nf3 Nd7 8.h5 Bh7 9.Bd3 Bxd3 10.Qxd3 e6 11.Bf4 Ngf6 12.O-O-O Be7 13.Ne4 Qa5 14.Kb1 O-O 15.Nxf6+ Nxf6 16.Ne5 Rad8 17.Qe2 c5 18.Ng6 fxg6 19.Qxe6+ Kh8 20.hxg6 Ng8 21.Bxh6 gxh6 22.Rxh6+ Nxh6 23.Qxe7 Nf7 24.gxf7 Kg7 25.Rd3 Rd6 26.Rg3+ Rg6 27.Qe5+ Kxf7 28.Qf5+ Rf6 29.Qd7# 1-0'
    },
    'anand-immortal': {
        name: 'Aronian vs Anand, Tata Steel 2013 — La Inmortal de Anand',
        pgn: '[Event "Tata Steel-A 75th"]\n[Site "Wijk aan Zee"]\n[Date "2013.01.15"]\n[White "Levon Aronian"]\n[Black "Viswanathan Anand"]\n[Result "0-1"]\n[WhiteElo "2802"]\n[BlackElo "2772"]\n\n1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6 5.e3 Nbd7 6.Bd3 dxc4 7.Bxc4 b5 8.Bd3 Bd6 9.O-O O-O 10.Qc2 Bb7 11.a3 Rc8 12.Ng5 c5 13.Nxh7 Ng4 14.f4 cxd4 15.exd4 Bc5 16.Be2 Nde5 17.Bxg4 Bxd4+ 18.Kh1 Nxg4 19.Nxf8 f5 20.Ng6 Qf6 21.h3 Qxg6 22.Qe2 Qh5 23.Qd3 Be3 0-1'
    },
    'ding-liren-immortal': {
        name: 'Bai Jinshi vs Ding Liren, Liga China 2017 — La Inmortal de Ding',
        pgn: '[Event "Chinese Chess League"]\n[Site "China"]\n[Date "2017"]\n[White "Bai Jinshi"]\n[Black "Ding Liren"]\n[Result "0-1"]\n[WhiteElo "2553"]\n[BlackElo "2774"]\n\n1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Nf3 O-O 5.Bg5 c5 6.e3 cxd4 7.Qxd4 Nc6 8.Qd3 h6 9.Bh4 d5 10.Rd1 g5 11.Bg3 Ne4 12.Nd2 Nc5 13.Qc2 d4 14.Nf3 e5 15.Nxe5 dxc3 16.Rxd8 cxb2+ 17.Ke2 Rxd8 18.Qxb2 Na4 19.Qc2 Nc3+ 20.Kf3 Rd4 21.h3 h5 22.Bh2 g4+ 23.Kg3 Rd2 24.Qb3 Ne4+ 25.Kh4 Be7+ 26.Kxh5 Kg7 27.Bf4 Bf5 28.Bh6+ Kh7 29.Qxb7 Rxf2 30.Bg5 Rh8 31.Nxf7 Bg6+ 32.Kxg4 Ne5+ 0-1'
    },
    'polgar-kasparov': {
        name: 'Polgar vs Kasparov, Rusia vs Resto del Mundo 2002',
        pgn: '[Event "Russia vs Rest of the World"]\n[Site "Moscow"]\n[Date "2002.09.09"]\n[White "Judit Polgar"]\n[Black "Garry Kasparov"]\n[Result "1-0"]\n[WhiteElo "2681"]\n[BlackElo "2838"]\n\n1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 4.O-O Nxe4 5.d4 Nd6 6.Bxc6 dxc6 7.dxe5 Nf5 8.Qxd8+ Kxd8 9.Nc3 h6 10.Rd1+ Ke8 11.h3 Be7 12.Ne2 Nh4 13.Nxh4 Bxh4 14.Be3 Bf5 15.Nd4 Bh7 16.g4 Be7 17.Kg2 h5 18.Nf5 Bf8 19.Kf3 Bg6 20.Rd2 hxg4+ 21.hxg4 Rh3+ 22.Kg2 Rh7 23.Kg3 f6 24.Bf4 Bxf5 25.gxf5 fxe5 26.Re1 Bd6 27.Bxe5 Kd7 28.c4 c5 29.Bxd6 cxd6 30.Re6 Rah8 31.Rexd6+ Kc8 32.R2d5 Rh3+ 33.Kg2 Rh2+ 34.Kf3 R2h3+ 35.Ke4 b6 36.Rc6+ Kb8 37.Rd7 Rh2 38.Ke3 Rf8 39.Rcc7 Rxf5 40.Rb7+ Kc8 41.Rdc7+ Kd8 42.Rxg7 Kc8 1-0'
    },
    'petrosian-spassky-66': {
        name: 'Petrosian vs Spassky, Mundial 1966 G10 — Doble sacrificio de calidad',
        pgn: '[Event "World Championship"]\n[Site "Moscow"]\n[Date "1966.04.22"]\n[White "Tigran Petrosian"]\n[Black "Boris Spassky"]\n[Result "1-0"]\n\n1.Nf3 Nf6 2.g3 g6 3.c4 Bg7 4.Bg2 O-O 5.O-O Nc6 6.Nc3 d6 7.d4 a6 8.d5 Na5 9.Nd2 c5 10.Qc2 e5 11.b3 Ng4 12.e4 f5 13.exf5 gxf5 14.Nd1 b5 15.f3 e4 16.Bb2 exf3 17.Bxf3 Bxb2 18.Qxb2 Ne5 19.Be2 f4 20.gxf4 Bh3 21.Ne3 Bxf1 22.Rxf1 Ng6 23.Bg4 Nxf4 24.Rxf4 Rxf4 25.Be6+ Rf7 26.Ne4 Qh4 27.Nxd6 Qg5+ 28.Kh1 Raa7 29.Bxf7+ Rxf7 30.Qh8# 1-0'
    },
    'najdorf-polish-immortal': {
        name: 'Glucksberg vs Najdorf, Varsovia 1929 — La Inmortal Polaca',
        pgn: '[Event "Warsaw"]\n[Site "Warsaw"]\n[Date "1929"]\n[White "Glucksberg"]\n[Black "Miguel Najdorf"]\n[Result "0-1"]\n\n1.d4 f5 2.c4 Nf6 3.Nc3 e6 4.Nf3 d5 5.e3 c6 6.Bd3 Bd6 7.O-O O-O 8.Ne2 Nbd7 9.Ng5 Bxh2+ 10.Kh1 Ng4 11.f4 Qe8 12.g3 Qh5 13.Kg2 Bg1 14.Nxg1 Qh2+ 15.Kf3 e5 16.dxe5 Ndxe5+ 17.fxe5 Nxe5+ 18.Kf4 Ng6+ 19.Kf3 f4 20.exf4 Bg4+ 21.Kxg4 Ne5+ 22.fxe5 h5# 0-1'
    },
    'short-timman': {
        name: 'Short vs Timman, Tilburg 1991 — La Marcha del Rey',
        pgn: '[Event "Tilburg Interpolis"]\n[Site "Tilburg"]\n[Date "1991.10.21"]\n[White "Nigel Short"]\n[Black "Jan Timman"]\n[Result "1-0"]\n\n1.e4 Nf6 2.e5 Nd5 3.d4 d6 4.Nf3 g6 5.Bc4 Nb6 6.Bb3 Bg7 7.Qe2 Nc6 8.O-O O-O 9.h3 a5 10.a4 dxe5 11.dxe5 Nd4 12.Nxd4 Qxd4 13.Re1 e6 14.Nd2 Nd5 15.Nf3 Qc5 16.Qe4 Qb4 17.Bc4 Nb6 18.b3 Nxc4 19.bxc4 Re8 20.Rd1 Qc5 21.Qh4 b6 22.Be3 Qc6 23.Bh6 Bh8 24.Rd8 Bb7 25.Rad1 Bg7 26.R8d7 Rf8 27.Bxg7 Kxg7 28.R1d4 Rae8 29.Qf6+ Kg8 30.h4 h5 31.Kh2 Rc8 32.Kg3 Rce8 33.Kf4 Bc8 34.Kg5 1-0'
    },
    'topalov-shirov': {
        name: 'Topalov vs Shirov, Linares 1998 — ¡Bh3!!',
        pgn: '[Event "Linares 15th"]\n[Site "Linares"]\n[Date "1998.03.04"]\n[White "Veselin Topalov"]\n[Black "Alexei Shirov"]\n[Result "0-1"]\n[WhiteElo "2740"]\n[BlackElo "2710"]\n\n1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7 7.Bb5+ c6 8.Ba4 O-O 9.Ne2 Nd7 10.O-O e5 11.f3 Qe7 12.Be3 Rd8 13.Qc2 Nb6 14.Bb3 Be6 15.Rad1 Nc4 16.Bc1 b5 17.f4 exd4 18.Nxd4 Bg4 19.Rde1 Qc5 20.Kh1 a5 21.h3 Bd7 22.a4 bxa4 23.Ba2 Be8 24.e5 Nb6 25.f5 Nd5 26.Bd2 Nb4 27.Qxa4 Nxa2 28.Qxa2 Bxe5 29.fxg6 hxg6 30.Bg5 Rd5 31.Re3 Qd6 32.Qe2 Bd7 33.c4 Bxd4 34.cxd5 Bxe3 35.Qxe3 Re8 36.Qc3 Qxd5 37.Bh6 Re5 38.Rf3 Qc5 39.Qa1 Bf5 40.Re3 f6 41.Rxe5 Qxe5 42.Qa2+ Qd5 43.Qxd5+ cxd5 44.Bd2 a4 45.Bc3 Kf7 46.h4 Ke6 47.Kg1 Bh3 48.gxh3 Kf5 49.Kf2 Ke4 50.Bxf6 d4 51.Be7 Kd3 52.Bc5 Kc4 53.Be7 Kb3 0-1'
    },
    'ivanchuk-yusupov': {
        name: 'Ivanchuk vs Yusupov, Candidatos 1991 — Fuegos artificiales',
        pgn: '[Event "Candidates Match"]\n[Site "Brussels"]\n[Date "1991.08.24"]\n[White "Vassily Ivanchuk"]\n[Black "Artur Yusupov"]\n[Result "0-1"]\n\n1.c4 e5 2.g3 d6 3.Bg2 g6 4.d4 Nd7 5.Nc3 Bg7 6.Nf3 Ngf6 7.O-O O-O 8.Qc2 Re8 9.Rd1 c6 10.b3 Qe7 11.Ba3 e4 12.Ng5 e3 13.f4 Nf8 14.b4 Bf5 15.Qb3 h6 16.Nf3 Ng4 17.b5 g5 18.bxc6 bxc6 19.Ne5 gxf4 20.Nxc6 Qg5 21.Bxd6 Ng6 22.Nd5 Qh5 23.h4 Nxh4 24.gxh4 Qxh4 25.Nde7+ Kh8 26.Nxf5 Qh2+ 27.Kf1 Re6 28.Qb7 Rg6 29.Qxa8+ Kh7 30.Qg8+ Kxg8 31.Nce7+ Kh7 32.Nxg6 fxg6 33.Nxg7 Nf2 34.Bxf4 Qxf4 35.Ne6 Qh2 36.Rdb1 Nh3 37.Rb7+ Kh8 38.Rb8+ Qxb8 39.Bxh3 Qg3 0-1'
    },
    'spassky-bronstein': {
        name: 'Spassky vs Bronstein, URSS 1960 — Gambito de Rey brillante',
        pgn: '[Event "USSR Championship"]\n[Site "Leningrad"]\n[Date "1960.02.20"]\n[White "Boris Spassky"]\n[Black "David Bronstein"]\n[Result "1-0"]\n\n1.e4 e5 2.f4 exf4 3.Nf3 d5 4.exd5 Bd6 5.Nc3 Ne7 6.d4 O-O 7.Bd3 Nd7 8.O-O h6 9.Ne4 Nxd5 10.c4 Ne3 11.Bxe3 fxe3 12.c5 Be7 13.Bc2 Re8 14.Qd3 e2 15.Nd6 Nf8 16.Nxf7 exf1=Q+ 17.Rxf1 Bf5 18.Qxf5 Qd7 19.Qf4 Bf6 20.N3e5 Qe7 21.Bb3 Bxe5 22.Nxe5+ Kh7 23.Qe4+ 1-0'
    },
    'capablanca-marshall': {
        name: 'Capablanca vs Marshall, Nueva York 1918 — El Ataque Marshall',
        pgn: '[Event "Manhattan CC Masters"]\n[Site "New York"]\n[Date "1918.10.23"]\n[White "Jose Raul Capablanca"]\n[Black "Frank Marshall"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 O-O 8.c3 d5 9.exd5 Nxd5 10.Nxe5 Nxe5 11.Rxe5 Nf6 12.Re1 Bd6 13.h3 Ng4 14.Qf3 Qh4 15.d4 Nxf2 16.Re2 Bg4 17.hxg4 Bh2+ 18.Kf1 Bg3 19.Rxf2 Qh1+ 20.Ke2 Bxf2 21.Bd2 Bh4 22.Qh3 Rae8+ 23.Kd3 Qf1+ 24.Kc2 Bf2 25.Qf3 Qg1 26.Bd5 c5 27.dxc5 Bxc5 28.b4 Bd6 29.a4 a5 30.axb5 axb4 31.Ra6 bxc3 32.Nxc3 Bb4 33.b6 Bxc3 34.Bxc3 h6 35.b7 Re3 36.Qxf7+ Rxf7 37.b8=Q+ Kh7 38.Rxh6+ Kxh6 39.Qh8+ Kg6 40.Qh5# 1-0'
    },
    'karpov-unzicker': {
        name: 'Karpov vs Unzicker, Olimpiada Niza 1974 — Squeeze Play',
        pgn: '[Event "Nice Olympiad"]\n[Site "Nice"]\n[Date "1974.06.18"]\n[White "Anatoly Karpov"]\n[Black "Wolfgang Unzicker"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Na5 10.Bc2 c5 11.d4 Qc7 12.Nbd2 Nc6 13.d5 Nd8 14.a4 Rb8 15.axb5 axb5 16.b4 Nb7 17.Nf1 Bd7 18.Be3 Ra8 19.Qd2 Rfc8 20.Bd3 g6 21.Ng3 Bf8 22.Ra2 c4 23.Bb1 Qd8 24.Ba7 Ne8 25.Bc2 Nc7 26.Rea1 Qe7 27.Bb1 Be8 28.Ne2 Nd8 29.Nh2 Bg7 30.f4 f6 31.f5 g5 32.Bc2 Bf7 33.Ng3 Nb7 34.Bd1 h6 35.Bh5 Qe8 36.Qd1 Nd8 37.Ra3 Kf8 38.R1a2 Kg8 39.Ng4 Kf8 40.Ne3 Kg8 41.Bxf7+ Nxf7 42.Qh5 Nd8 43.Qg6 Kf8 44.Nh5 1-0'
    },
    'reti-alekhine': {
        name: 'Réti vs Alekhine, Baden-Baden 1925 — Obra maestra de Alekhine',
        pgn: '[Event "Baden-Baden"]\n[Site "Baden-Baden"]\n[Date "1925.04.25"]\n[White "Richard Reti"]\n[Black "Alexander Alekhine"]\n[Result "0-1"]\n\n1.g3 e5 2.Nf3 e4 3.Nd4 d5 4.d3 exd3 5.Qxd3 Nf6 6.Bg2 Bb4+ 7.Bd2 Bxd2+ 8.Nxd2 O-O 9.c4 Na6 10.cxd5 Nb4 11.Qc4 Nbxd5 12.N2b3 c6 13.O-O Re8 14.Rfd1 Bg4 15.Rd2 Qc8 16.Nc5 Bh3 17.Bf3 Bg4 18.Bg2 Bh3 19.Bf3 Bg4 20.Bh1 h5 21.b4 a6 22.Rc1 h4 23.a4 hxg3 24.hxg3 Qc7 25.b5 axb5 26.axb5 Re3 27.Nf3 cxb5 28.Qxb5 Nc3 29.Qxb7 Qxb7 30.Nxb7 Nxe2+ 31.Kh2 Ne4 32.Rc4 Nxf2 33.Bg2 Be6 34.Rcc2 Ng4+ 35.Kh3 Ne5+ 36.Kh2 Rxf3 37.Rxe2 Ng4+ 38.Kh3 Ne3+ 39.Kh2 Nxc2 40.Bxf3 Nd4 0-1'
    },
    'botvinnik-capablanca': {
        name: 'Botvinnik vs Capablanca, AVRO 1938 — La obra maestra de Botvinnik',
        pgn: '[Event "AVRO"]\n[Site "Rotterdam"]\n[Date "1938.11.22"]\n[White "Mikhail Botvinnik"]\n[Black "Jose Raul Capablanca"]\n[Result "1-0"]\n\n1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 d5 5.a3 Bxc3+ 6.bxc3 c5 7.cxd5 exd5 8.Bd3 O-O 9.Ne2 b6 10.O-O Ba6 11.Bxa6 Nxa6 12.Bb2 Qd7 13.a4 Rfe8 14.Qd3 c4 15.Qc2 Nb8 16.Rae1 Nc6 17.Ng3 Na5 18.f3 Nb3 19.e4 Qxa4 20.e5 Nd7 21.Qf2 g6 22.f4 f5 23.exf6 Nxf6 24.f5 Rxe1 25.Rxe1 Re8 26.Re6 Rxe6 27.fxe6 Kg7 28.Qf4 Qe8 29.Qe5 Qe7 30.Ba3 Qxa3 31.Nh5+ gxh5 32.Qg5+ Kf8 33.Qxf6+ Kg8 34.e7 Qc1+ 35.Kf2 Qc2+ 36.Kg3 Qd3+ 37.Kh4 Qe4+ 38.Kxh5 Qe2+ 39.Kh4 Qe4+ 40.g4 Qe1+ 41.Kh5 1-0'
    },
    'byrne-fischer-63': {
        name: 'R. Byrne vs Fischer, US Championship 1963 — El Premio de Brillantez',
        pgn: '[Event "US Championship"]\n[Site "New York"]\n[Date "1963.12.18"]\n[White "Robert Byrne"]\n[Black "Robert James Fischer"]\n[Result "0-1"]\n\n1.d4 Nf6 2.c4 g6 3.g3 c6 4.Bg2 d5 5.cxd5 cxd5 6.Nc3 Bg7 7.e3 O-O 8.Nge2 Nc6 9.O-O b6 10.b3 Ba6 11.Ba3 Re8 12.Qd2 e5 13.dxe5 Nxe5 14.Rfd1 Nd3 15.Qc2 Nxf2 16.Kxf2 Ng4+ 17.Kg1 Nxe3 18.Qd2 Nxg2 19.Kxg2 d4 20.Nxd4 Bb7+ 21.Kf1 Qd7 0-1'
    },
    'nezhmetdinov-chernikov': {
        name: 'Nezhmetdinov vs Chernikov, 1962 — Sacrificio de dama inmortal',
        pgn: '[Event "Chigorin Team Cup"]\n[Site "Rostov-on-Don"]\n[Date "1962"]\n[White "Rashid Nezhmetdinov"]\n[Black "Oleg Chernikov"]\n[Result "1-0"]\n\n1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 g6 5.Nc3 Bg7 6.Be3 Nf6 7.Bc4 O-O 8.Bb3 Ng4 9.Qxg4 Nxd4 10.Qh4 Qa5 11.O-O Bf6 12.Qxf6 Ne2+ 13.Nxe2 exf6 14.Nc3 Re8 15.Nd5 Re6 16.Bd4 Kg7 17.Rad1 d6 18.Rd3 Bd7 19.Rf3 Bb5 20.Bc3 Qd8 21.Nxf6 Be2 22.Nxh7+ Kg8 23.Rh3 Re5 24.f4 Bxf1 25.Kxf1 Rc8 26.Bd4 b5 27.Ng5 Rc7 28.Bxf7+ Rxf7 29.Rh8+ Kxh8 30.Nxf7+ Kh7 31.Nxd8 Rxe4 32.Nc6 Rxf4+ 33.Ke2 1-0'
    },
    'tal-larsen-65': {
        name: 'Tal vs Larsen, Candidatos 1965 — Sacrificio de caballo',
        pgn: '[Event "Candidates Semifinal"]\n[Site "Bled"]\n[Date "1965.08.08"]\n[White "Mikhail Tal"]\n[Black "Bent Larsen"]\n[Result "1-0"]\n\n1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 e6 5.Nc3 d6 6.Be3 Nf6 7.f4 Be7 8.Qf3 O-O 9.O-O-O Qc7 10.Ndb5 Qb8 11.g4 a6 12.Nd4 Nxd4 13.Bxd4 b5 14.g5 Nd7 15.Bd3 b4 16.Nd5 exd5 17.exd5 f5 18.Rhe1 Rf7 19.h4 Bb7 20.Bxf5 Rxf5 21.Rxe7 Ne5 22.Qe4 Qf8 23.fxe5 Rf4 24.Qe3 Rf3 25.Qe2 Qxe7 26.Qxf3 dxe5 27.Re1 Rd8 28.Rxe5 Qd6 29.Qf4 Rf8 30.Qe4 b3 31.axb3 Rf1+ 32.Kd2 Qb4+ 33.c3 Qd6 34.Bc5 Qxc5 35.Re8+ Rf8 36.Qe6+ Kh8 37.Qf7 1-0'
    },
    'geller-euwe': {
        name: 'Geller vs Euwe, Zúrich 1953 — Contraataque mortal',
        pgn: '[Event "Candidates Tournament"]\n[Site "Zurich"]\n[Date "1953.08.31"]\n[White "Efim Geller"]\n[Black "Max Euwe"]\n[Result "0-1"]\n\n1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 c5 5.a3 Bxc3+ 6.bxc3 b6 7.Bd3 Bb7 8.f3 Nc6 9.Ne2 O-O 10.O-O Na5 11.e4 Ne8 12.Ng3 cxd4 13.cxd4 Rc8 14.f4 Nxc4 15.f5 f6 16.Rf4 b5 17.Rh4 Qb6 18.e5 Nxe5 19.fxe6 Nxd3 20.Qxd3 Qxe6 21.Qxh7+ Kf7 22.Bh6 Rh8 23.Qxh8 Rc2 24.Rc1 Rxg2+ 25.Kf1 Qb3 26.Ke1 Qf3 0-1'
    },
    'mcconnell-morphy': {
        name: 'McConnell vs Morphy, Nueva Orleans 1849',
        pgn: '[Event "New Orleans"]\n[Site "New Orleans"]\n[Date "1849"]\n[White "James McConnell"]\n[Black "Paul Morphy"]\n[Result "0-1"]\n\n1.e4 e5 2.f4 exf4 3.Nf3 g5 4.Bc4 g4 5.d4 gxf3 6.Qxf3 Bh6 7.O-O Nc6 8.c3 Nge7 9.g4 fxg3 10.Bxh6 gxh2+ 11.Kh1 Nxd4 12.Qg3 Rg8 13.Qe3 Nef5 14.Qe1 Rg1+ 15.Qxg1 Nd3 16.Be3 hxg1=Q+ 17.Rxg1 Qh4+ 18.Rg3 Nxb2 19.Nd2 Nxc4 20.Nxc4 d5 21.Nd2 c5 22.Nf3 Qxe4 23.Bd2 Nxg3+ 24.Kg2 Nf5 25.Re1 Qf4 26.Re8+ Kd7 27.Ra8 Nd4 0-1'
    },
    'karpov-kasparov-85-g24': {
        name: 'Karpov vs Kasparov, Mundial 1985 G24 — Kasparov se corona',
        pgn: '[Event "World Championship"]\n[Site "Moscow"]\n[Date "1985.11.09"]\n[White "Anatoly Karpov"]\n[Black "Garry Kasparov"]\n[Result "0-1"]\n\n1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be2 e6 7.O-O Be7 8.f4 O-O 9.Kh1 Qc7 10.a4 Nc6 11.Be3 Re8 12.Bf3 Rb8 13.Qd2 Bd7 14.Nb3 b6 15.g4 Bc8 16.g5 Nd7 17.Qf2 Bf8 18.Bg2 Bb7 19.Rad1 g6 20.Bc1 Rbc8 21.Rd3 Nb4 22.Rh3 Bg7 23.Be3 Re7 24.Kg1 Rce8 25.Rd1 f5 26.gxf6 Nxf6 27.Rg3 Rf7 28.Bxb6 Qb8 29.Be3 Nh5 30.Rg4 Nf6 31.Rh4 g5 32.fxg5 Ng4 33.Qd2 Nxe3 34.Qxe3 Nxc2 35.Qb6 Ba8 36.Rxd6 Rb7 37.Qxa6 Rxb3 38.Rxe6 Rxb2 39.Qc4 Kh8 40.e5 Qa7+ 41.Kh1 Bxg2+ 42.Kxg2 Nd4+ 0-1'
    },
    'kasparov-anand-95': {
        name: 'Kasparov vs Anand, Mundial PCA 1995 G10 — Sacrificio de dama',
        pgn: '[Event "PCA World Championship"]\n[Site "New York"]\n[Date "1995.09.26"]\n[White "Garry Kasparov"]\n[Black "Viswanathan Anand"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Nxe4 6.d4 b5 7.Bb3 d5 8.dxe5 Be6 9.Nbd2 Nc5 10.c3 d4 11.Ng5 dxc3 12.Nxe6 fxe6 13.bxc3 Qd3 14.Bc2 Qxc3 15.Nb3 Nxb3 16.Bxb3 Nd4 17.Qg4 Qxa1 18.Bxe6 Rd8 19.Bh6 Qc3 20.Bxg7 Qd3 21.Bxh8 Qg6 22.Bf6 Be7 23.Bxe7 Qxg4 24.Bxg4 Kxe7 25.Rc1 c6 26.f4 a5 27.Kf2 a4 28.Ke3 b4 29.Bd1 a3 30.g4 Rd5 31.Rc4 c5 32.Ke4 Rd8 33.Rxc5 Ne6 34.Rd5 Rc8 35.f5 Rc4+ 36.Ke3 Nc5 37.g5 Rc1 38.Rd6 1-0'
    },
    'kramnik-kasparov-2000': {
        name: 'Kramnik vs Kasparov, Mundial 2000 G10 — Fin de una era',
        pgn: '[Event "World Championship"]\n[Site "London"]\n[Date "2000.10.24"]\n[White "Vladimir Kramnik"]\n[Black "Garry Kasparov"]\n[Result "1-0"]\n\n1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7 7.Nf3 c5 8.Be3 Qa5 9.Qd2 Bg4 10.Rb1 a6 11.Rxb7 Bxf3 12.gxf3 Nc6 13.Bc4 O-O 14.O-O cxd4 15.cxd4 Bxd4 16.Bd5 Bc3 17.Qc1 Nd4 18.Bxd4 Bxd4 19.Rxe7 Ra7 20.Rxa7 Bxa7 21.f4 Qd8 22.Qc3 Bb8 23.Qf3 Qh4 24.e5 g5 25.Re1 Qxf4 26.Qxf4 gxf4 27.e6 fxe6 28.Rxe6 Kg7 29.Rxa6 Rf5 30.Be4 Re5 31.f3 Re7 32.a4 Ra7 33.Rb6 Be5 34.Rb4 Rd7 35.Kg2 Rd2+ 36.Kh3 h5 37.Rb5 Kf6 38.a5 Ra2 39.Rb6+ Ke7 40.Bd5 1-0'
    },
    'carlsen-anand-13': {
        name: 'Carlsen vs Anand, Mundial 2013 G6 — Carlsen toma el mando',
        pgn: '[Event "World Championship"]\n[Site "Chennai"]\n[Date "2013.11.16"]\n[White "Viswanathan Anand"]\n[Black "Magnus Carlsen"]\n[Result "0-1"]\n\n1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Nge2 d5 6.a3 Be7 7.cxd5 Nxd5 8.Bd2 Nd7 9.g3 b6 10.Nxd5 exd5 11.Bg2 Bb7 12.Bb4 Nf6 13.O-O Re8 14.Rc1 c6 15.Bxe7 Rxe7 16.Re1 Qd6 17.Nf4 Bc8 18.Qa4 Rc7 19.f3 Be6 20.e4 dxe4 21.fxe4 Qd7 22.d5 cxd5 23.Qxd7 Rxd7 24.Nxe6 fxe6 25.Bh3 Kh8 26.e5 Ng8 27.Bxe6 Rdd8 28.Rc7 d4 29.Bd7 1-0'
    },
    'morphy-consultants': {
        name: 'Morphy vs Consultantes, Nueva Orleans 1858',
        pgn: '[Event "New Orleans"]\n[Site "New Orleans"]\n[Date "1858"]\n[White "Paul Morphy"]\n[Black "Consultants"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.d4 exd4 5.O-O Nxe4 6.Re1 d5 7.Bxd5 Qxd5 8.Nc3 Qa5 9.Nxe4 Be6 10.Neg5 O-O-O 11.Nxe6 fxe6 12.Rxe6 Bd6 13.Bg5 Rde8 14.Rxe8+ Rxe8 15.Qxd4 Be5 16.Nxe5 Nxe5 17.Qd5 c6 18.Qxe5 Rxe5 19.Bxd8 Re1+ 20.Rxe1 Kxd8 1-0'
    },
    'mcdonell-labourdonnais': {
        name: 'McDonnell vs La Bourdonnais, Londres 1834 — Peones imparables',
        pgn: '[Event "London"]\n[Site "London"]\n[Date "1834"]\n[White "Alexander McDonnell"]\n[Black "Louis de La Bourdonnais"]\n[Result "0-1"]\n\n1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 e5 5.Nxc6 bxc6 6.Bc4 Nf6 7.Bg5 Be7 8.Qe2 d5 9.Bxf6 Bxf6 10.Bb3 O-O 11.O-O a5 12.exd5 cxd5 13.Rd1 d4 14.c4 Qb6 15.Bc2 Bb7 16.Nd2 Rae8 17.Ne4 Bd8 18.c5 Qc6 19.f3 Be7 20.Rac1 f5 21.Qc4+ Kh8 22.Ba4 Qh6 23.Bxe8 fxe4 24.c6 exf3 25.Rc2 Qe3+ 26.Kh1 Bc8 27.Bd7 f2 28.Rf1 d3 29.Rc3 Bxd7 30.cxd7 e4 31.Qc8 Bd8 32.Qc4 Qe1 33.Rc1 d2 34.Qc5 Rg8 35.Rd1 e3 36.Qc3 Qxd1 37.Rxd1 e2 0-1'
    },
    'smyslov-reshevsky': {
        name: 'Smyslov vs Reshevsky, URSS-USA 1945 — Sacrificio de dama',
        pgn: '[Event "USSR-USA Radio Match"]\n[Site "Moscow-New York"]\n[Date "1945"]\n[White "Vassily Smyslov"]\n[Black "Samuel Reshevsky"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Nxe4 6.d4 b5 7.Bb3 d5 8.dxe5 Be6 9.c3 Bc5 10.Nbd2 O-O 11.Bc2 f5 12.Nb3 Bb6 13.Nfd4 Nxd4 14.Nxd4 Bxd4 15.cxd4 f4 16.f3 Ng3 17.hxg3 fxg3 18.Qd3 Bf5 19.Qxf5 Rxf5 20.Bxf5 Qh4 21.Bh3 Qxd4+ 22.Kh1 Qxe5 23.Bd2 Qxb2 24.Bf4 c5 25.Be6+ Kh8 26.Bxd5 Rd8 27.Rad1 c4 28.Bxg3 c3 29.Be5 b4 30.Bb3 Rd2 31.f4 h5 32.Rb1 Rf2 33.Rfe1 Qd2 34.Rbd1 Qb2 35.Rd8+ Kh7 36.Bg8+ Kg6 37.Rd6+ Kf5 38.Be6+ Kg6 39.Bd5+ Kh7 40.Be4+ Kg8 41.Bg6 1-0'
    },
    'alekhine-bogoljubov': {
        name: 'Alekhine vs Bogoljubov, Hastings 1922 — Ataque demoledor',
        pgn: '[Event "Hastings"]\n[Site "Hastings"]\n[Date "1922"]\n[White "Alexander Alekhine"]\n[Black "Efim Bogoljubov"]\n[Result "1-0"]\n\n1.d4 Nf6 2.c4 e6 3.Nf3 d5 4.Nc3 Be7 5.Bg5 Nbd7 6.e3 O-O 7.Rc1 c6 8.Qc2 a6 9.a3 h6 10.Bh4 Re8 11.Bd3 dxc4 12.Bxc4 b5 13.Bd3 c5 14.O-O cxd4 15.exd4 Nb6 16.Ne5 Nbd5 17.Nxd5 Nxd5 18.Bg3 Bb7 19.Re1 Rc8 20.Qd2 Bb4 21.axb4 Nxb4 22.Qe3 Nxd3 23.Nxd3 Qxd4 24.Qxe6 Rxe6 25.Rxe6 Rd8 26.Nc5 fxe6 27.Nxb7 Rd5 28.Rxc8+ Kh7 29.Nc5 Rd1+ 30.Bf1 e5 31.Nd3 e4 32.Nf4 g5 33.Nh5 Rd2 34.b4 a5 35.bxa5 b4 36.Rc7+ Kh8 37.a6 1-0'
    },
    'fischer-larsen-71': {
        name: 'Fischer vs Larsen, Candidatos 1971 — 6-0 aplastante',
        pgn: '[Event "Candidates Semifinal"]\n[Site "Denver"]\n[Date "1971.07.06"]\n[White "Robert James Fischer"]\n[Black "Bent Larsen"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Nb8 10.d4 Nbd7 11.Nbd2 Bb7 12.Bc2 Re8 13.Nf1 Bf8 14.Ng3 g6 15.Bg5 h6 16.Bd2 Bg7 17.a4 c5 18.d5 c4 19.b4 Nh5 20.Nxh5 gxh5 21.g3 Nf6 22.Kg2 Qd7 23.Rh1 Qh3+ 24.Kg1 Nh7 25.Be3 Rf8 26.Qe2 f5 27.exf5 Rxf5 28.Nd2 Raf8 29.f4 Ng5 30.fxg5 Rxf1+ 31.Rxf1 Rxf1+ 32.Nxf1 Qxh1+ 33.Kf2 Qxa1 34.Qxh5 Qa2+ 35.Be4 Qb2+ 36.Kg1 Qe2 37.gxh6 Bh8 38.Qg6+ Kf8 39.Qf6+ Kg8 40.Bd3 1-0'
    },
    'fischer-petrosian-71': {
        name: 'Fischer vs Petrosian, Candidatos 1971 G7 — Sacrificio en h5',
        pgn: '[Event "Candidates Final"]\n[Site "Buenos Aires"]\n[Date "1971.10.07"]\n[White "Robert James Fischer"]\n[Black "Tigran Petrosian"]\n[Result "1-0"]\n\n1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 a6 5.Bd3 Nc6 6.Nxc6 bxc6 7.O-O d5 8.c4 Nf6 9.cxd5 cxd5 10.exd5 exd5 11.Nc3 Be7 12.Qa4+ Qd7 13.Re1 Qxa4 14.Nxa4 Be6 15.Be3 O-O 16.Bc5 Rfe8 17.Bxe7 Rxe7 18.b4 Kf8 19.Nc5 Bc8 20.f3 Rea7 21.Re5 Bd7 22.Nxd7+ Nxd7 23.Re2 Rc7 24.Rae1 Nf6 25.Re7 Rxe7 26.Rxe7 Nd7 27.Rd7 g6 28.Kf2 h5 29.f4 h4 30.Kf3 f5 31.Ke3 d4+ 32.Kd2 Nb6 33.Rb7 Nd5 34.Rd7 Nc3 35.Rd6 Nxa2 36.Rxg6 Nb4 37.Bb1 a5 38.Rg5 axb4 39.Rxf5+ Ke7 40.Rb5 1-0'
    },
    'spassky-fischer-72-g1': {
        name: 'Spassky vs Fischer, Mundial 1972 G1 — Captura envenenada',
        pgn: '[Event "World Championship"]\n[Site "Reykjavik"]\n[Date "1972.07.11"]\n[White "Boris Spassky"]\n[Black "Robert James Fischer"]\n[Result "1-0"]\n\n1.d4 Nf6 2.c4 e6 3.Nf3 d5 4.Nc3 Bb4 5.e3 O-O 6.Bd3 c5 7.O-O Nc6 8.a3 Ba5 9.Ne2 dxc4 10.Bxc4 Bb6 11.dxc5 Qxd1 12.Rxd1 Bxc5 13.b4 Be7 14.Bb2 Bd7 15.Rac1 Rfd8 16.Ned4 Nxd4 17.Nxd4 Ba4 18.Bb3 Bxb3 19.Nxb3 Rxd1+ 20.Rxd1 Rc8 21.Kf1 Kf8 22.Ke2 Ne4 23.Rc1 Rxc1 24.Bxc1 f6 25.Na5 Nd6 26.Kd3 Bd8 27.Nc4 Bc7 28.Nxd6 Bxd6 29.b5 Bxh2 30.g3 h5 31.Ke2 h4 32.Kf3 Ke7 33.Kg2 hxg3 34.fxg3 Bxg3 35.Kxg3 Kd6 36.a4 Kd5 37.Ba3 Ke4 38.Bc5 a6 39.b6 f5 40.Kh4 f4 41.exf4 Kxf4 42.Kh5 Kf5 43.Be3 Ke4 44.Bf2 Kf3 45.Kg6 e5 46.Kxg7 1-0'
    },
    'carlsen-caruana-18': {
        name: 'Carlsen vs Caruana, Mundial 2018 — Desempate rápido G1',
        pgn: '[Event "World Championship Tiebreak"]\n[Site "London"]\n[Date "2018.11.28"]\n[White "Magnus Carlsen"]\n[Black "Fabiano Caruana"]\n[Result "1-0"]\n\n1.e4 c5 2.Nf3 Nc6 3.Bb5 g6 4.Bxc6 dxc6 5.d3 Bg7 6.h3 Nf6 7.Nc3 Nd7 8.Be3 e5 9.O-O O-O 10.Nh2 b6 11.f4 exf4 12.Bxf4 Nf6 13.Qd2 Be6 14.Bh6 Qd4+ 15.Kh1 Qxd3 16.Bxg7 Kxg7 17.Rf3 Qd6 18.Raf1 Nd7 19.e5 Qe7 20.Ng4 Bxg4 21.hxg4 Rfe8 22.g5 f5 23.gxf6+ Nxf6 24.Rxf6 Qxf6 25.Rxf6 Kxf6 26.Qf4+ Kg7 27.Qd4 Re6 28.Nd5 cxd5 29.Qxd5 Re1+ 30.Kh2 Rae8 31.Qd4+ Kh6 32.Qh4+ Kg7 33.Qd4+ Kf8 34.Qa7 R1e5 35.Qxa4 Rxe5 36.Qb3 Rc5 37.a4 Rce5 38.c4 Kf7 39.Qf3+ Kg7 40.Qd3 Re1 41.a5 R1e5 42.a6 Re2 43.Qd4+ Kh6 44.Qf4+ Kg7 45.Qd4+ Kh6 46.Qf4+ Kh5 47.g3 R5e4 48.Qf5 Kh6 49.Qf4+ Kh5 50.Qf5 Kh6 51.Qf4+ Kg7 52.Qd4+ Kf7 53.Qd7+ Kg8 54.a7 1-0'
    },
    'ding-nepomniachtchi-23': {
        name: 'Ding Liren vs Nepomniachtchi, Mundial 2023 G12 — Ding campeón',
        pgn: '[Event "World Championship"]\n[Site "Astana"]\n[Date "2023.04.27"]\n[White "Ding Liren"]\n[Black "Ian Nepomniachtchi"]\n[Result "1-0"]\n\n1.d4 Nf6 2.c4 e6 3.Nf3 d5 4.h3 Be7 5.Bf4 O-O 6.e3 Nbd7 7.a3 c5 8.cxd5 exd5 9.Nc3 a6 10.Be2 b5 11.O-O Bb7 12.b4 c4 13.a4 bxa4 14.Nxa4 a5 15.Nc5 Nxc5 16.bxc5 Nd7 17.Be5 axb4 18.Qb1 f6 19.Bc3 Nxc5 20.dxc5 Bxc5 21.Nd4 Qd6 22.Bb4 Bxd4 23.exd4 Qd7 24.Ra5 Bc6 25.Bg4 Qe7 26.Qa1 Rfe8 27.Bc5 Qf7 28.Qa4 Be4 29.Qxc4 dxc4 30.Rxf7 1-0'
    },
    'tal-botvinnik-60': {
        name: 'Tal vs Botvinnik, Mundial 1960 G6 — El mago de Riga',
        pgn: '[Event "World Championship"]\n[Site "Moscow"]\n[Date "1960.03.26"]\n[White "Mikhail Tal"]\n[Black "Mikhail Botvinnik"]\n[Result "1-0"]\n\n1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 c5 5.Bd3 b6 6.Ne2 Bb7 7.O-O cxd4 8.exd4 O-O 9.d5 exd5 10.cxd5 Nxd5 11.Nxd5 Bxd5 12.a3 Bd6 13.Nf4 Be4 14.Nxe4 Nc6 15.Bg5 f6 16.Be3 Na5 17.Qg4 Nc4 18.Nxd6 Nxe3 19.fxe3 Qxd6 20.Rxf6 Qe5 21.Raf1 Rxf6 22.Qxg7# 1-0'
    },
    'fischer-11-0': {
        name: 'Fischer vs US Championship 1963 — El 11-0 perfecto',
        pgn: '[Event "US Championship"]\n[Site "New York"]\n[Date "1964.01.01"]\n[White "Robert James Fischer"]\n[Black "Pal Benko"]\n[Result "1-0"]\n\n1.e4 g6 2.d4 Bg7 3.Nc3 d6 4.f4 Nf6 5.Nf3 O-O 6.Bd3 Na6 7.O-O c5 8.d5 Nc7 9.a4 b6 10.Qe1 Bb7 11.Qh4 e5 12.fxe5 dxe5 13.Bg5 Qe8 14.Nh5 Nxe4 15.Bxe4 Bxe4 16.Nxe4 Nxd5 17.Neg3 f6 18.Bd2 Qe6 19.a5 f5 20.Rae1 e4 21.Nf4 Nxf4 22.Bxf4 Qf6 23.Qxf6 Bxf6 24.axb6 axb6 25.Nh5 Be5 26.Bxe5 Rxf1+ 27.Rxf1 1-0'
    },
    'larsen-spassky-70': {
        name: 'Larsen vs Spassky, URSS vs Mundo 1970 — 1.b3 desastre',
        pgn: '[Event "USSR vs Rest of the World"]\n[Site "Belgrade"]\n[Date "1970.03.29"]\n[White "Bent Larsen"]\n[Black "Boris Spassky"]\n[Result "0-1"]\n\n1.b3 e5 2.Bb2 Nc6 3.c4 Nf6 4.Nf3 e4 5.Nd4 Bc5 6.Nxc6 dxc6 7.e3 Bf5 8.Qc2 Qe7 9.Be2 O-O-O 10.f4 Ng4 11.g3 h5 12.h3 h4 13.hxg4 hxg3 14.Rg1 Rh1 15.Rxh1 g2 16.Rf1 Qh4+ 17.Kd1 gxf1=Q+ 0-1'
    },
    'kasparov-shirov-94': {
        name: 'Kasparov vs Shirov, Horgen 1994 — Ataque fulminante',
        pgn: '[Event "Horgen"]\n[Site "Horgen"]\n[Date "1994"]\n[White "Garry Kasparov"]\n[Black "Alexei Shirov"]\n[Result "1-0"]\n\n1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3 O-O 6.Be3 Nc6 7.Nge2 a6 8.Qd2 Rb8 9.Rc1 e5 10.d5 Nd4 11.N2g3 c5 12.Be2 Nh5 13.Nxh5 gxh5 14.O-O f5 15.exf5 Bxf5 16.g4 hxg4 17.fxg4 Bd7 18.Rxf8+ Qxf8 19.Nxd4 cxd4 20.Bxd4 exd4 21.Qxd4 Bf6 22.Qf2 b5 23.cxb5 axb5 24.Rc7 Qd8 25.Bxb5 Be5 26.Be2 Rf8 27.Qg3 Bg6 28.h4 Rf6 29.h5 Be8 30.Bd3 Rf3 31.Qg2 Bf4 32.Be4 Rf2 33.Qg1 Qg5 34.Kh1 Be3 35.Qh2 Bg6 36.hxg6 hxg6 37.Qh8+ Kf7 38.Qg8# 1-0'
    },
    'capablanca-alekhine-27': {
        name: 'Capablanca vs Alekhine, Mundial 1927 G34 — La partida decisiva',
        pgn: '[Event "World Championship"]\n[Site "Buenos Aires"]\n[Date "1927.11.26"]\n[White "Jose Raul Capablanca"]\n[Black "Alexander Alekhine"]\n[Result "0-1"]\n\n1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Nbd7 5.e3 Be7 6.Nf3 O-O 7.Rc1 c6 8.Bd3 dxc4 9.Bxc4 Nd5 10.Bxe7 Qxe7 11.Ne4 N5f6 12.Ng3 e5 13.O-O exd4 14.Nxd4 Ne5 15.Bb3 Rd8 16.Qc2 Ng6 17.Ndf5 Bxf5 18.Nxf5 Qe5 19.Ng3 Nd5 20.Rfd1 Nf4 21.Qe4 Qxe4 22.Nxe4 Nxe3 23.Rxd8+ Rxd8 24.fxe3 Rd1+ 25.Rxd1 Nxd1 26.Kf1 Nxb2 27.Nc5 b6 28.Na6 Kf8 29.Ke2 Ke7 30.Kd2 Kd6 31.Kc3 Na4+ 32.Kb4 Nc5 33.Nxc5 bxc5+ 34.Ka5 Kd5 35.Ba4 c4 36.Bc2 g5 37.Kb4 f5 38.Ka5 g4 39.Kb4 c3 40.Kxc3 Ke4 41.Bd1 Kf4 42.Kd4 c5+ 43.Kd3 f4 0-1'
    },
    'tal-hecht-62': {
        name: 'Tal vs Hecht, Varna Olimpiada 1962',
        pgn: '[Event "15th Olympiad"]\n[Site "Varna"]\n[Date "1962.09.28"]\n[White "Mikhail Tal"]\n[Black "Hans-Joachim Hecht"]\n[Result "1-0"]\n\n1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 e6 5.Nc3 Qc7 6.g3 a6 7.Bg2 Nf6 8.O-O Be7 9.Re1 O-O 10.Nxc6 bxc6 11.e5 Nd5 12.Ne4 Bb7 13.Nd6 Bxd6 14.exd6 Qd8 15.c4 Nf6 16.d7 Qc7 17.Be3 Nd5 18.Bd4 f6 19.Qg4 e5 20.Qg6 Rf7 21.cxd5 exd4 22.d6 Qd8 23.dxc6 Ba6 24.Qe8+ Rf8 25.d8=Q 1-0'
    },
    'korchnoi-karpov-78': {
        name: 'Korchnoi vs Karpov, Mundial 1978 G17 — La Guerra Fría',
        pgn: '[Event "World Championship"]\n[Site "Baguio City"]\n[Date "1978.09.08"]\n[White "Viktor Korchnoi"]\n[Black "Anatoly Karpov"]\n[Result "0-1"]\n\n1.c4 e6 2.Nc3 d5 3.d4 Be7 4.Nf3 Nf6 5.Bg5 h6 6.Bh4 O-O 7.e3 b6 8.Bd3 Bb7 9.O-O Nbd7 10.Bg3 c5 11.cxd5 Nxd5 12.Nxd5 exd5 13.dxc5 Nxc5 14.Bc2 Rc8 15.Qd4 a5 16.Rfd1 Bf6 17.Qf4 g6 18.h4 Re8 19.Rd2 Bg7 20.Rad1 Ne6 21.Qg4 d4 22.h5 Bc6 23.Nxd4 Bxd4 24.Rxd4 Nxd4 25.exd4 Qf6 26.hxg6 Qxg6 27.Qxg6+ fxg6 28.Bd3 Kf7 29.d5 Bd7 30.Bxg6+ Kxg6 31.d6 Re6 32.Rd4 Kf7 33.Rf4+ Ke8 34.d7+ Ke7 35.Re4 Be8 36.Rxe6+ Kxe6 37.dxc8=Q+ Bxc8 0-1'
    },
    'fischer-taimanov-71': {
        name: 'Fischer vs Taimanov, Candidatos 1971 — 6-0 histórico',
        pgn: '[Event "Candidates Quarterfinal"]\n[Site "Vancouver"]\n[Date "1971.05.25"]\n[White "Robert James Fischer"]\n[Black "Mark Taimanov"]\n[Result "1-0"]\n\n1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 Qc7 5.Nc3 e6 6.g3 a6 7.Bg2 Nf6 8.O-O Nxd4 9.Qxd4 Bc5 10.Bf4 d6 11.Qd2 h6 12.Rad1 e5 13.Be3 Bg4 14.Bxc5 dxc5 15.f3 Be6 16.f4 Rd8 17.Nd5 Bxd5 18.exd5 e4 19.Rfe1 Rxd5 20.Rxe4+ Kf8 21.Qxd5 Nxd5 22.Re8# 1-0'
    },
    'kasparov-portisch-83': {
        name: 'Kasparov vs Portisch, Niksic 1983 — Ataque India de Rey',
        pgn: '[Event "Niksic"]\n[Site "Niksic"]\n[Date "1983"]\n[White "Garry Kasparov"]\n[Black "Lajos Portisch"]\n[Result "1-0"]\n\n1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.Nc3 Bb7 5.a3 d5 6.cxd5 Nxd5 7.Qc2 Nxc3 8.bxc3 Be7 9.e4 O-O 10.Bd3 c5 11.O-O Qc8 12.Qe2 Ba6 13.Bg5 Bxd3 14.Qxd3 Qa6 15.Qe3 Nd7 16.Bxe7 Rfe8 17.Ba3 cxd4 18.cxd4 Qd3 19.Qxd3 Nc5 20.Qc3 Nxe4 21.Qb4 Nd6 22.Nd2 Rac8 23.Rfe1 f6 24.Rab1 Kf7 25.Nf3 Nc4 26.Bb2 Red8 27.d5 exd5 28.Nd4 Rc5 29.Ne6 Rc7 30.Nxd8+ Rxd8 31.Re7+ Kg8 32.Rxg7+ Kh8 33.Qe7 Rd7 34.Qf8# 1-0'
    },
    'bernstein-capablanca': {
        name: 'Bernstein vs Capablanca, Moscú 1914 — Obra maestra de Capa',
        pgn: '[Event "Exhibition"]\n[Site "Moscow"]\n[Date "1914"]\n[White "Ossip Bernstein"]\n[Black "Jose Raul Capablanca"]\n[Result "0-1"]\n\n1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 Be7 5.Bg5 O-O 6.e3 Nbd7 7.Rc1 b6 8.cxd5 exd5 9.Qa4 Bb7 10.Ba6 Bxa6 11.Qxa6 c5 12.Bxf6 Nxf6 13.dxc5 bxc5 14.O-O Qb6 15.Qe2 c4 16.Rfd1 Rfd8 17.Nd4 Bb4 18.b3 Rac8 19.bxc4 dxc4 20.Rc2 Bxc3 21.Rxc3 Nd5 22.Rc2 c3 23.Rdc1 Rc5 24.Nb3 Rc6 25.Nd4 Rc7 26.Nb5 Rc5 27.Nxc3 Nxc3 28.Rxc3 Rxc3 29.Rxc3 Qb2 0-1'
    },
    'capablanca-tartakower': {
        name: 'Capablanca vs Tartakower, Nueva York 1924 — Final magistral',
        pgn: '[Event "New York"]\n[Site "New York"]\n[Date "1924.03.23"]\n[White "Jose Raul Capablanca"]\n[Black "Savielly Tartakower"]\n[Result "1-0"]\n\n1.d4 e6 2.Nf3 f5 3.c4 Nf6 4.Bg5 Be7 5.Nc3 O-O 6.e3 b6 7.Bd3 Bb7 8.O-O Qe8 9.Qe2 Ne4 10.Bxe7 Nxc3 11.bxc3 Qxe7 12.a4 Bxf3 13.Qxf3 Nc6 14.Rfb1 Rae8 15.Qh3 Rf6 16.f4 Na5 17.Qf3 d6 18.Re1 Qd7 19.e4 fxe4 20.Qxe4 g6 21.g3 Kf8 22.Kg2 Rf7 23.h4 d5 24.cxd5 exd5 25.Qxe8+ Qxe8 26.Rxe8+ Kxe8 27.h5 Rf6 28.hxg6 hxg6 29.Rh1 Kf8 30.Rh7 Rc6 31.g4 Nc4 32.g5 Ne3+ 33.Kf3 Nf5 34.Bxf5 gxf5 35.Kg3 Rxc3+ 36.Kh4 Rf3 37.g6 Rxf4+ 38.Kg5 Re4 39.Kf6 Kg8 40.Rg7+ Kh8 41.Rxc7 Re8 42.Kxf5 Re4 43.Kf6 Rf4+ 44.Ke5 Rg4 45.g7+ Kg8 46.Rxa7 Rg1 47.Kxd5 Rc1 48.Kd6 Rc2 49.d5 Rc1 50.Rc7 Ra1 51.Kc6 Rxa4 52.d6 1-0'
    },
    'kasparov-karpov-90': {
        name: 'Kasparov vs Karpov, Mundial 1990 G20 — Serie decisiva',
        pgn: '[Event "World Championship"]\n[Site "Lyon"]\n[Date "1990.12.17"]\n[White "Garry Kasparov"]\n[Black "Anatoly Karpov"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Bb7 10.d4 Re8 11.Nbd2 Bf8 12.a4 h6 13.Bc2 exd4 14.cxd4 Nb4 15.Bb1 c5 16.d5 Nd7 17.Ra3 f5 18.Rae3 Nf6 19.Nh2 Kh8 20.b3 bxa4 21.bxa4 c4 22.Bb2 fxe4 23.Nxe4 Nfxd5 24.Rg3 Re6 25.Ng4 Qe8 26.Nxh6 c3 27.Nf5 cxb2 28.Qg4 Bc8 29.Qh4+ Rh6 30.Nxh6 gxh6 31.Kh2 Qe5 32.Ng5 Qf6 33.Re8 Bf5 34.Qxh6+ Qxh6 35.Nf7+ Kh7 36.Bxf5+ Qg6 37.Bxg6+ Kg7 38.Rxa8 Be7 39.Rb8 a5 40.Be4+ Kxf7 41.Bxd5+ 1-0'
    },
    'carlsen-karjakin-16': {
        name: 'Carlsen vs Karjakin, Mundial 2016 Desempate G4 — Mate en 50',
        pgn: '[Event "World Championship Tiebreak"]\n[Site "New York"]\n[Date "2016.11.30"]\n[White "Magnus Carlsen"]\n[Black "Sergey Karjakin"]\n[Result "1-0"]\n\n1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.f3 e5 6.Nb3 Be7 7.c4 a5 8.Be3 a4 9.Nc1 O-O 10.Nc3 Qa5 11.Qd2 Na6 12.Be2 Nc5 13.O-O Bd7 14.Rb1 Rfc8 15.b4 axb3 16.axb3 Qd8 17.Nd3 Ne6 18.Nb4 Bc6 19.Rfd1 h5 20.Bf1 h4 21.Qf2 Nd7 22.g3 Ra3 23.Bh3 Rca8 24.Nc2 R3a6 25.Nb4 Ra5 26.Nc2 b6 27.Rd2 Qc7 28.Rbd1 Bf8 29.gxh4 Nf4 30.Bxf4 exf4 31.Bxd7 Qxd7 32.Nb4 Ra3 33.Nxc6 Qxc6 34.Nb5 Rxb3 35.Nd4 Qxc4 36.Nxb3 Qxb3 37.Qe2 Be7 38.Kg2 Qe6 39.h5 Ra3 40.Rd3 Ra2 41.R3d2 Ra3 42.Rd3 Ra7 43.Rd5 Rc7 44.Qd2 Qf6 45.Rf5 Qh4 46.Rc1 Ra7 47.Qxf4 Ra2+ 48.Kh1 Qf2 49.Rc8+ Kh7 50.Qh6# 1-0'
    },
    'tal-tringov-64': {
        name: 'Tal vs Tringov, Ámsterdam 1964 — Sacrificio brillante',
        pgn: '[Event "Amsterdam Interzonal"]\n[Site "Amsterdam"]\n[Date "1964"]\n[White "Mikhail Tal"]\n[Black "Georgi Tringov"]\n[Result "1-0"]\n\n1.e4 g6 2.d4 Bg7 3.Nc3 d6 4.Nf3 c6 5.Bg5 Qb6 6.Qd2 Qxb2 7.Rb1 Qa3 8.Bc4 Qa5 9.O-O e6 10.Rfe1 a6 11.Bf4 e5 12.dxe5 dxe5 13.Qd6 Qxd2 14.Nxd2 f6 15.Nc4 b5 16.Nd6+ Kf8 17.Bb3 Nd7 18.Nxb5 axb5 19.Rxb5 Ra6 20.Nxc8 Ne7 21.Rb8 Rxa2 22.Nd6 Bf8 23.Nf5 Nxf5 24.exf5 gxf5 25.Bxe5 Rd2 26.Bxf6 Nxf6 27.Re8# 1-0'
    },
    'tal-flesch-81': {
        name: 'Tal vs Flesch, Riga 1981 — 18 movimientos',
        pgn: '[Event "Riga"]\n[Site "Riga"]\n[Date "1981"]\n[White "Mikhail Tal"]\n[Black "Janos Flesch"]\n[Result "1-0"]\n\n1.e4 c6 2.d4 d5 3.Nd2 dxe4 4.Nxe4 Nd7 5.Nf3 Ngf6 6.Nxf6+ Nxf6 7.Bc4 Bf5 8.Qe2 e6 9.Bg5 Bg4 10.O-O-O Qa5 11.d5 O-O-O 12.Bxf6 gxf6 13.d6 Bh5 14.Nd4 Bxe2 15.Nxe2 Qb4 16.Rd4 Qa5 17.Rc4 Kb8 18.b4 1-0'
    },
    'karpov-spassky-74': {
        name: 'Karpov vs Spassky, Candidatos 1974 — Demolición posicional',
        pgn: '[Event "Candidates Semifinal"]\n[Site "Leningrad"]\n[Date "1974"]\n[White "Anatoly Karpov"]\n[Black "Boris Spassky"]\n[Result "1-0"]\n\n1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6 6.Be2 Be7 7.O-O Nc6 8.Be3 O-O 9.f4 e5 10.Nb3 exf4 11.Bxf4 Be6 12.Nd5 Bxd5 13.exd5 Ne5 14.c4 Neg4 15.Bd3 Re8 16.h3 Nh6 17.Nd4 Nf5 18.Nxf5 Bh4 19.Qf3 g6 20.Rae1 gxf5 21.Re7 Rxe7 22.Bxf5 Nd7 23.Bxd7 Rd8 24.Bf5 Bg5 25.Bxg5 Qxg5 26.Qf4 Qxf4 27.Rxf4 Kg7 28.b3 Rd7 29.Rf3 a5 30.Rg3+ Kf8 31.Kf2 Rc7 32.Ke3 Re7+ 33.Kd4 Rd7 34.Re3 a4 35.Re8+ Kg7 36.Rb8 axb3 37.axb3 Re7 38.Rxb7 Re1 39.Kc3 Rc1+ 40.Kd3 Rd1+ 41.Ke4 Rxd5 42.Rxf7+ Kh6 43.c5 dxc5 44.b4 1-0'
    },
    'karpov-kasparov-87': {
        name: 'Karpov vs Kasparov, Mundial 1987 G24 — Kasparov retiene',
        pgn: '[Event "World Championship"]\n[Site "Seville"]\n[Date "1987.12.18"]\n[White "Anatoly Karpov"]\n[Black "Garry Kasparov"]\n[Result "0-1"]\n\n1.c4 e5 2.Nc3 Nf6 3.Nf3 Nc6 4.g3 Bb4 5.Bg2 O-O 6.O-O e4 7.Ng5 Bxc3 8.bxc3 Re8 9.f3 e3 10.d3 d5 11.Qb3 Na5 12.Qa4 c6 13.cxd5 Nxd5 14.f4 b5 15.Qd1 Qd6 16.Nf3 Bg4 17.Ba3 Qb6 18.Qd2 Rad8 19.Bxe3 Nxe3 20.Qxe3 Qxe3+ 21.fxe3 Bxf3 22.Bxf3 Nc4 23.Rab1 Nxe3 24.Rf2 Nd1 25.Rf1 Ne3 26.Rf2 Ng4 27.Rf1 Rd2 28.Bxg4 Rxe2 29.Bf3 Rxa2 30.Rb4 a5 31.Rb3 a4 32.Rb4 Ra1 33.Rxa1 a3 34.Kf2 a2 35.Ra7 Rb8 36.Kg2 b4 37.cxb4 Rxb4 38.d4 Rb2+ 39.Kh3 Rf2 40.Ra3 h5 41.Kg2 Rd2 42.Be2 hxg4 43.Ra8+ Kh7 44.Ra3 f5 45.Kf1 Rd1+ 0-1'
    },
    'kasparov-kramnik-96': {
        name: 'Kasparov vs Kramnik, Dos Hermanas 1996 — Sacrificio posicional',
        pgn: '[Event "Dos Hermanas"]\n[Site "Dos Hermanas"]\n[Date "1996.05.25"]\n[White "Garry Kasparov"]\n[Black "Vladimir Kramnik"]\n[Result "1-0"]\n\n1.Nf3 Nf6 2.c4 e6 3.Nc3 d5 4.d4 Be7 5.Bg5 h6 6.Bh4 O-O 7.e3 b6 8.Bd3 Bb7 9.O-O Nbd7 10.Qe2 c5 11.Rad1 Qc7 12.Bb1 cxd4 13.exd4 dxc4 14.Qxc4 Qd6 15.Bg3 Qb4 16.Qe2 Rfd8 17.d5 exd5 18.Nxd5 Nxd5 19.Rxd5 Nf6 20.Rd2 Rxd2 21.Nxd2 Rd8 22.Nc4 Nd5 23.Re1 Bf8 24.Qf3 Nb4 25.a3 Nc2 26.Rd1 Nd4 27.Qe4 Nc6 28.Ne5 Nxe5 29.Bxe5 Bd6 30.Qg4 Bxe5 31.Rxd8+ Kh7 32.Qe4+ g6 33.Qxe5 Qd2 34.Qf4 Qxb2 35.Bd3 f5 36.Qc7+ Kh8 37.Rd7 Bc8 38.Rd8 1-0'
    },
    'anand-karpov-98': {
        name: 'Anand vs Karpov, Mundial FIDE 1998 — Anand campeón',
        pgn: '[Event "FIDE World Championship"]\n[Site "Lausanne"]\n[Date "1998.01.07"]\n[White "Viswanathan Anand"]\n[Black "Anatoly Karpov"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Na5 10.Bc2 c5 11.d4 Qc7 12.Nbd2 cxd4 13.cxd4 Nc6 14.d5 Nd8 15.Nf1 Ne8 16.a4 Rb8 17.N3h2 g6 18.f4 exf4 19.Bxf4 Ng7 20.axb5 axb5 21.Ng3 f5 22.Ng4 Nge6 23.Nxf5 gxf5 24.Bxd6 Bxd6 25.Nxd6 Qxd6 26.exf5 Nc5 27.f6 Nb6 28.Qg4+ Kh8 29.Qg7# 1-0'
    },
    'anand-topalov-05': {
        name: 'Anand vs Topalov, Sofía 2005 — Victoria brillante',
        pgn: '[Event "M-Tel Masters"]\n[Site "Sofia"]\n[Date "2005.05.13"]\n[White "Viswanathan Anand"]\n[Black "Veselin Topalov"]\n[Result "1-0"]\n\n1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be2 e6 7.O-O Be7 8.a4 Nc6 9.Be3 O-O 10.f4 Qc7 11.Kh1 Re8 12.Bf3 Rb8 13.Qd2 Bd7 14.Nb3 b6 15.g4 Bc8 16.g5 Nd7 17.Qf2 Bf8 18.Bg2 Bb7 19.Rad1 g6 20.Bc1 Nb4 21.Nd4 e5 22.fxe5 dxe5 23.Nf5 gxf5 24.Rxd7 Qc5 25.Qg3 Nc2 26.exf5 Nd4 27.f6 Bc6 28.Rd6 Qxg5 29.Qxg5+ 1-0'
    },
    'alekhine-nimzowitsch': {
        name: 'Alekhine vs Nimzowitsch, San Remo 1930 — Victoria aplastante',
        pgn: '[Event "San Remo"]\n[Site "San Remo"]\n[Date "1930.01.18"]\n[White "Alexander Alekhine"]\n[Black "Aron Nimzowitsch"]\n[Result "1-0"]\n\n1.e4 e6 2.d4 d5 3.Nc3 Bb4 4.Ne2 dxe4 5.a3 Bxc3+ 6.Nxc3 f5 7.f3 exf3 8.Qxf3 Qh4+ 9.g3 Qd8 10.Qf2 Nf6 11.Bg5 O-O 12.Bd3 Nc6 13.O-O e5 14.Nd5 Be6 15.Nxf6+ gxf6 16.Bh6 Re8 17.d5 Bd7 18.Bf4 exf4 19.Bxf5 Bxf5 20.Qxf4 Be4 21.Qxf6 Qxf6 22.Rxf6 Bxc2 23.Raf1 Kh8 24.R6f2 Bg6 25.Re1 Rxe1+ 26.Kf2 Re8 27.Re2 Rd8 28.Re7 Nd4 29.Rxb7 a5 30.Rb6 Be4 31.d6 cxd6 32.Rxd6 Rf8+ 33.Kg1 Nxb3 34.Rd7 Bc6 35.Rc7 Nd4 36.Kf2 Rf7 37.Rxc6 1-0'
    },
    'alekhine-lasker-14': {
        name: 'Alekhine vs Lasker, San Petersburgo 1914',
        pgn: '[Event "St. Petersburg"]\n[Site "St. Petersburg"]\n[Date "1914"]\n[White "Alexander Alekhine"]\n[Black "Emanuel Lasker"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 4.O-O d6 5.d4 Bd7 6.Nc3 Be7 7.Re1 exd4 8.Nxd4 O-O 9.Bxc6 bxc6 10.Bg5 h6 11.Bh4 Re8 12.Qd3 Nh7 13.Rad1 Bf8 14.f3 Ng5 15.Bf2 Ne6 16.Nb3 Nc5 17.Nxc5 dxc5 18.Qg3 Kh8 19.h4 Qe7 20.e5 Red8 21.Ne4 Be8 22.Nd6 Rxd6 23.exd6 Qxd6 24.Qxd6 cxd6 25.Rxd6 Bd7 26.Be3 Be7 27.Rd3 Rd8 28.Red1 Bf6 29.Bxc5 1-0'
    },
    'steinitz-zukertort-86': {
        name: 'Steinitz vs Zukertort, Mundial 1886 G1 — Primer campeonato',
        pgn: '[Event "World Championship"]\n[Site "New York"]\n[Date "1886.01.11"]\n[White "Johannes Zukertort"]\n[Black "Wilhelm Steinitz"]\n[Result "0-1"]\n\n1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.e3 c5 5.Nf3 Nc6 6.a3 dxc4 7.Bxc4 cxd4 8.exd4 Be7 9.O-O O-O 10.Be3 Bd7 11.Qd3 Rc8 12.Rac1 Qa5 13.Ba2 Rfd8 14.Rfe1 Be8 15.Bb1 g6 16.Qe2 Bf8 17.Red1 Bg7 18.Ba2 Ne7 19.Qd2 Qa6 20.Bg5 Nf5 21.g4 Nxd4 22.Nxd4 e5 23.Nd5 Nxd5 24.Bxd5 exd4 25.Bf6 Qb6 26.Qg5 Qxb2 27.Bxg7 Kxg7 28.Bxf7 Rc5 29.Qg3 Rf5 30.Be6 Rf3 31.Qg2 Qxa3 32.Rd3 Qe7 33.Bd5 Rf6 34.Rc2 Qe5 0-1'
    },
    'morphy-paulsen': {
        name: 'Morphy vs Paulsen, Nueva York 1857 — El Congreso Americano',
        pgn: '[Event "1st American Chess Congress"]\n[Site "New York"]\n[Date "1857.11.08"]\n[White "Paul Morphy"]\n[Black "Louis Paulsen"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.d4 exd4 5.O-O Nxe4 6.Re1 d5 7.Bxd5 Qxd5 8.Nc3 Qh5 9.Nxe4 Be6 10.Neg5 Bb4 11.Rxe6+ fxe6 12.Nxe6 Qf5 13.Nfg5 g6 14.Nxd4 Nxd4 15.Qxd4 Bf8 16.Nf3 Qe4 17.Qd8+ Kf7 18.Be3 Qxf3 19.Qd7+ Be7 20.Qxb7 Rhb8 21.Qxa8 Rxa8 22.gxf3 Rd8 23.Rd1 Rxd1+ 24.Kg2 Rd7 25.c4 Bf6 26.a4 h5 27.Bc5 Bd4 28.Bxd4 Rxd4 29.c5 Rc4 30.c6 Ke6 31.a5 Kd6 32.a6 Kxc6 33.f4 Kb6 34.a7 Ka6 35.f5 gxf5 36.f4 h4 37.Kf3 Rc3+ 38.Ke2 Ra3 39.Kd2 Kb7 40.a8=Q+ Kxa8 1-0'
    },
    'keres-spassky-55': {
        name: 'Keres vs Spassky, URSS 1955 — Ataque de alfil',
        pgn: '[Event "USSR Championship"]\n[Site "Riga"]\n[Date "1955.02.05"]\n[White "Paul Keres"]\n[Black "Boris Spassky"]\n[Result "1-0"]\n\n1.e4 e5 2.Nc3 Nf6 3.f4 d5 4.fxe5 Nxe4 5.Nf3 Be7 6.d3 Nxc3 7.bxc3 c5 8.d4 O-O 9.Bd3 Nc6 10.O-O Bg4 11.Be3 f6 12.Qd2 f5 13.Nh4 g6 14.g4 fxg4 15.Nxg6 hxg6 16.Bxg6 Bh5 17.Bf5 Bxd1 18.Be6+ Rf7 19.Rxf7 Bg4 20.Bxg4 cxd4 21.cxd4 Nxd4 22.Bxd4 Qa5 23.Bf6 Bxf6 24.exf6 Qc7 25.Raf1 Kh8 26.R7f4 Qc5+ 27.Rf2 Rd8 28.Bh5 Rd7 29.f7 Qd6 30.Be8 Qd8 31.f8=Q+ Qxf8 32.Rxf8+ Kg7 33.R1f7+ 1-0'
    },
    'spassky-tal-73': {
        name: 'Spassky vs Tal, Tallín 1973 — Duelo de genios',
        pgn: '[Event "Tallinn"]\n[Site "Tallinn"]\n[Date "1973.03.16"]\n[White "Boris Spassky"]\n[Black "Mikhail Tal"]\n[Result "1-0"]\n\n1.d4 Nf6 2.c4 c5 3.d5 d6 4.Nc3 g6 5.e4 Bg7 6.f4 O-O 7.Nf3 e6 8.Be2 exd5 9.cxd5 Re8 10.Nd2 Na6 11.O-O Nc7 12.a4 b6 13.Kh1 Ng4 14.Qe1 Bd4 15.Nc4 f5 16.Bf3 Nf6 17.e5 dxe5 18.fxe5 Nfxd5 19.e6 Nxc3 20.bxc3 Bxc3 21.Qe2 Bxa1 22.Bh6 Ne8 23.Nd6 Bd4 24.Nxe8 Rxe8 25.Qd2 Rf8 26.Qxd4 cxd4 27.e7 Qd6 28.exf8=Q+ Kxf8 29.Bxa8 Qc6 30.Bf3 1-0'
    },
    'bronstein-ljubojevic-73': {
        name: 'Bronstein vs Ljubojevic, Petropolis 1973',
        pgn: '[Event "Interzonal"]\n[Site "Petropolis"]\n[Date "1973"]\n[White "David Bronstein"]\n[Black "Ljubomir Ljubojevic"]\n[Result "1-0"]\n\n1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Bg5 e6 7.f4 Be7 8.Qf3 h6 9.Bh4 Qc7 10.O-O-O Nbd7 11.Be2 b5 12.Bxf6 Nxf6 13.e5 Bb7 14.Qe3 dxe5 15.fxe5 Nd7 16.Nxe6 fxe6 17.Qxe6 Qc5 18.Bf3 Bxf3 19.gxf3 O-O 20.Rhg1 Rf4 21.Nd5 Qd4 22.Rxd4 Rxd4 23.Qg6 Rf8 24.Nxe7+ Kh8 25.Qxg7# 1-0'
    },
    'carlsen-nakamura-11': {
        name: 'Carlsen vs Nakamura, Londres 2011',
        pgn: '[Event "London Chess Classic"]\n[Site "London"]\n[Date "2011.12.07"]\n[White "Magnus Carlsen"]\n[Black "Hikaru Nakamura"]\n[Result "1-0"]\n\n1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O Nc6 8.d5 Ne7 9.b4 Nh5 10.Re1 f5 11.Ng5 Nf6 12.f3 Kh8 13.Rb1 fxe4 14.fxe4 h6 15.Ne6 Bxe6 16.dxe6 d5 17.cxd5 Nexd5 18.Bc4 Nxb4 19.e7 Qxe7 20.Rxb4 c6 21.Bf4 exf4 22.e5 Nd5 23.Bxd5 cxd5 24.Nxd5 Qe6 25.Rxf4 Rxf4 26.Nxf4 Qf5 27.Qd5 Rd8 28.Qxb7 Qc2 29.h3 Qd2 30.Re2 Qd4+ 31.Kh2 Rd5 32.Qf3 Kh7 33.Nd3 Rd8 34.Re4 Qd6 35.Rd4 Rxd4 36.Qf7 Rd5 37.e6 Qd8 38.Qf5 Qd6+ 39.Qg5 Rd4 40.e7 1-0'
    },
    'fischer-reshevsky-61': {
        name: 'Fischer vs Reshevsky, US Ch. 1961 — Venganza del prodigio',
        pgn: '[Event "US Championship"]\n[Site "New York"]\n[Date "1961.12.18"]\n[White "Robert James Fischer"]\n[Black "Samuel Reshevsky"]\n[Result "1-0"]\n\n1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 g6 5.Nc3 Bg7 6.Be3 Nf6 7.Bc4 O-O 8.Bb3 Na5 9.e5 Ne8 10.Bxf7+ Kxf7 11.Ne6 dxe6 12.Qxd8 Nc6 13.Qd2 Nxe5 14.O-O Nc4 15.Qe2 Nxe3 16.Qxe3 Nc7 17.Rfd1 Rf6 18.Nd5 exd5 19.Qe7+ Kg8 20.Rxd5 Ne6 21.Rd7 Bf8 22.Qxb7 Rb8 23.Qa6 Bh6 24.Re1 Rbb6 25.Qa4 Rf7 26.Rxf7 Kxf7 27.Qa7+ Kf6 28.Qxa5 Bg7 29.Qc3+ Kf7 30.Qc4 Kf8 31.a4 Bd4 32.b3 Rf6 33.c3 Bf2+ 34.Kf1 Bg3 35.hxg3 Nf4 36.gxf4 Rxf4 37.a5 Rf6 38.a6 1-0'
    },
    'kramnik-aronian-07': {
        name: 'Kramnik vs Aronian, Candidatos Wijk 2007',
        pgn: '[Event "Corus"]\n[Site "Wijk aan Zee"]\n[Date "2007.01.27"]\n[White "Vladimir Kramnik"]\n[Black "Levon Aronian"]\n[Result "1-0"]\n\n1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2 d5 5.cxd5 Qxd5 6.Nf3 Qf5 7.Qb3 Nc6 8.Bd2 O-O 9.h3 b6 10.g4 Qg6 11.Rg1 Bb7 12.a3 Bxc3 13.Bxc3 Ne4 14.Bb4 Re8 15.Bg2 f5 16.gxf5 exf5 17.Nd2 Nxd2 18.Kxd2 f4 19.f3 Ne5 20.Qd1 Nd3 21.e3 fxe3+ 22.Ke2 Qf5 23.Bd3 Qh5 24.Rxg7+ Kxg7 25.Qg1+ Kh8 26.Qg5 Qxg5 27.Bxh7 Qg2+ 28.Bf2 Nxf2 29.Rg1 Qxh3 30.Bd3+ Kg7 31.Rg3 Qh2 32.Rf3 Qh4 33.Rxf2 exf2 34.Kxf2 Re3 35.Bc2 Rae8 36.Bb3 Kf6 37.d5 R3e5 38.Kf1 Re1+ 39.Kg2 Rxd5 40.Bd1 Rd2+ 41.Kh3 Rh1# 0-1'
    },
    'anand-carlsen-14': {
        name: 'Anand vs Carlsen, Mundial 2014 G11 — Anand casi iguala',
        pgn: '[Event "World Championship"]\n[Site "Sochi"]\n[Date "2014.11.23"]\n[White "Viswanathan Anand"]\n[Black "Magnus Carlsen"]\n[Result "1-0"]\n\n1.d4 Nf6 2.c4 e6 3.Nf3 d5 4.Nc3 Be7 5.Bf4 O-O 6.e3 Nbd7 7.c5 Nh5 8.Bd3 Nxf4 9.exf4 b6 10.b4 a5 11.a3 c6 12.O-O Qc7 13.g3 Ba6 14.Bxa6 Rxa6 15.Re1 Rb8 16.Qe2 Ra8 17.Red1 bxc5 18.bxc5 Qa7 19.Qa6 Qb8 20.Rab1 Qa7 21.Qa4 Rb8 22.Rb6 Ra6 23.Rdb1 Nf6 24.Qc2 Rxb6 25.Rxb6 Nd7 26.Rb1 e5 27.fxe5 Nxc5 28.Na4 Ne6 29.Rb7 Qd4 30.Nc5 Nxc5 31.dxc5 Qxc5 32.Nd4 Ra8 33.Qd2 Qc4 34.Rxe7 1-0'
    },
    'morphy-anderssen-58': {
        name: 'Morphy vs Anderssen, París 1858 G9',
        pgn: '[Event "Paris"]\n[Site "Paris"]\n[Date "1858.12.27"]\n[White "Paul Morphy"]\n[Black "Adolf Anderssen"]\n[Result "1-0"]\n\n1.e4 e5 2.Nf3 d6 3.d4 exd4 4.Nxd4 Nf6 5.Nc3 Be7 6.Be2 O-O 7.O-O c5 8.Nf3 Nc6 9.Bg5 Be6 10.Re1 Nd7 11.Bf1 Bf6 12.Bxf6 Qxf6 13.Nd5 Qd8 14.c3 Rc8 15.Qd3 Re8 16.Rad1 f5 17.exf5 Bxd5 18.Qxd5+ Kh8 19.Qf7 Nde5 20.Nxe5 Nxe5 21.Rxe5 dxe5 22.Rd7 Qf8 23.Bc4 b5 24.Bb3 c4 25.Bc2 Rc5 26.Qg6 Qf6 27.Qxf6 gxf6 28.Rxh7+ Kg8 29.Rd7 1-0'
    },
    'nakamura-carlsen-16': {
        name: 'Nakamura vs Carlsen, Zúrich 2014 — Defensa tenaz',
        pgn: '[Event "Zurich Chess Challenge"]\n[Site "Zurich"]\n[Date "2014.02.04"]\n[White "Hikaru Nakamura"]\n[Black "Magnus Carlsen"]\n[Result "0-1"]\n\n1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6 5.Bg5 h6 6.Bh4 dxc4 7.e4 g5 8.Bg3 b5 9.Be2 Bb7 10.O-O Nbd7 11.Ne5 h5 12.Nxd7 Qxd7 13.Be5 Rh6 14.f4 g4 15.e5 Nd5 16.Nxd5 cxd5 17.b3 Rg6 18.bxc4 bxc4 19.Rc1 Bb4 20.Kh1 O-O-O 21.Bf3 Rdg8 22.a3 Ba5 23.Qe2 Bc3 24.Bxc3 Qb5 25.Rb1 Qc6 26.Rb2 h4 27.Rfb1 Ba6 28.Qe1 h3 29.g3 Qc7 30.Rb6 a5 31.R1b5 Qd7 32.Rxa6 Qxa4 33.Rxa4 g3 34.R6a2 gxh2 35.Bg2 h2 0-1'
    }
};

const OPENING_TRAINING = {
    'italiana': { name: 'Apertura Italiana (Giuoco Piano)', moves: 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5', san: '1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5', desc: 'Busca control central y desarrollo rápido apuntando al punto débil f7. Juego abierto con opciones tácticas para ambos bandos.', wr: [39, 32, 29] },
    'española': { name: 'Apertura Española (Ruy López)', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5', san: '1.e4 e5 2.Nf3 Nc6 3.Bb5', desc: 'Presiona el caballo que defiende e5, buscando ventaja posicional a largo plazo. La apertura más profunda y estudiada del ajedrez.', wr: [38, 34, 28] },
    'escocesa': { name: 'Apertura Escocesa', moves: 'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4', san: '1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4', desc: 'Abre el centro inmediatamente, buscando juego activo de piezas y diagonales libres para los alfiles.', wr: [38, 33, 29] },
    'petrov': { name: 'Defensa Petrov', moves: 'e2e4 e7e5 g1f3 g8f6', san: '1.e4 e5 2.Nf3 Nf6', desc: 'Defensa simétrica y sólida. Las negras contraatacan el peón e4 en vez de defender e5, buscando igualdad rápida.', wr: [33, 41, 26] },
    'vienesa': { name: 'Apertura Vienesa', moves: 'e2e4 e7e5 b1c3', san: '1.e4 e5 2.Nc3', desc: 'Prepara f4 sin bloquear el peón f. Combina ideas del Gambito de Rey con desarrollo flexible del caballo.', wr: [38, 30, 32] },
    'gambito-rey': { name: 'Gambito de Rey', moves: 'e2e4 e7e5 f2f4', san: '1.e4 e5 2.f4', desc: 'Sacrifica un peón por iniciativa y ataque al rey. Apertura romántica y agresiva que busca abrir la columna f.', wr: [37, 26, 37] },
    'gambito-evans': { name: 'Gambito Evans', moves: 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4', san: '1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4', desc: 'Sacrifica un peón de flanco para ganar tiempos de desarrollo y construir un centro fuerte con c3 y d4.', wr: [41, 28, 31] },
    'dos-caballos': { name: 'Dos Caballos', moves: 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6', san: '1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6', desc: 'Contraataque directo al peón e4. Las negras prefieren actividad a solidez, aceptando complicaciones tácticas.', wr: [37, 30, 33] },
    'siciliana-najdorf': { name: 'Siciliana Najdorf', moves: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6', san: '1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6', desc: 'La variante más popular de la Siciliana. ...a6 prepara ...e5 o ...b5 para contrajuego en el flanco de dama manteniendo flexibilidad.', wr: [37, 30, 33] },
    'siciliana-dragon': { name: 'Siciliana Dragón', moves: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6', san: '1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6', desc: 'Fianchetto del alfil en g7 creando presión en la gran diagonal. Lleva a ataques opuestos: blancas al rey, negras al flanco de dama.', wr: [40, 27, 33] },
    'siciliana-sveshnikov': { name: 'Siciliana Sveshnikov', moves: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5', san: '1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e5', desc: 'Golpe central agresivo que expulsa el caballo. Acepta debilidad en d5 a cambio de juego activo y contrajuego dinámico.', wr: [35, 31, 34] },
    'siciliana-clasica': { name: 'Siciliana Clásica', moves: 'e2e4 c7c5 g1f3 b8c6', san: '1.e4 c5 2.Nf3 Nc6', desc: 'Desarrollo natural del caballo presionando d4. Posición flexible que puede transponerse a múltiples sistemas.', wr: [38, 29, 33] },
    'siciliana-alapin': { name: 'Siciliana Alapin', moves: 'e2e4 c7c5 c2c3', san: '1.e4 c5 2.c3', desc: 'Blancas preparan d4 reforzado con c3. Evita la complejidad teórica de la Siciliana Abierta a cambio de un centro sólido.', wr: [36, 33, 31] },
    'siciliana-smith-morra': { name: 'Gambito Smith-Morra', moves: 'e2e4 c7c5 d2d4 c5d4', san: '1.e4 c5 2.d4 cxd4', desc: 'Gambito agresivo que sacrifica un peón por desarrollo rápido, columnas abiertas y fuerte iniciativa.', wr: [40, 25, 35] },
    'francesa-winawer': { name: 'Francesa Winawer', moves: 'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4', san: '1.e4 e6 2.d4 d5 3.Nc3 Bb4', desc: 'Clava el caballo que defiende e4. Lleva a juego desequilibrado con peones doblados y ataques en flancos opuestos.', wr: [36, 30, 34] },
    'francesa-clasica': { name: 'Francesa Clásica', moves: 'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6', san: '1.e4 e6 2.d4 d5 3.Nc3 Nf6', desc: 'Presión directa sobre e4. Juego más sólido que la Winawer, con planes estratégicos de ruptura con ...c5 o ...f6.', wr: [35, 35, 30] },
    'francesa-avance': { name: 'Francesa Avance', moves: 'e2e4 e7e6 d2d4 d7d5 e4e5', san: '1.e4 e6 2.d4 d5 3.e5', desc: 'Fija la estructura de peones y gana espacio. Las negras buscan romper con ...c5 y presionar la cadena de peones blancos.', wr: [35, 33, 32] },
    'francesa-tarrasch': { name: 'Francesa Tarrasch', moves: 'e2e4 e7e6 d2d4 d7d5 b1d2', san: '1.e4 e6 2.d4 d5 3.Nd2', desc: 'Evita el clavado de la Winawer. Juego más tranquilo que permite recapturar en e4 con el caballo manteniendo la estructura.', wr: [34, 36, 30] },
    'caro-kann-clasica': { name: 'Caro-Kann Clásica', moves: 'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4', san: '1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4', desc: 'Defensa sólida que desarrolla el alfil de dama antes de cerrar la posición. Busca igualdad con estructura de peones sana.', wr: [35, 35, 30] },
    'caro-kann-avance': { name: 'Caro-Kann Avance', moves: 'e2e4 c7c6 d2d4 d7d5 e4e5', san: '1.e4 c6 2.d4 d5 3.e5', desc: 'Gana espacio en el centro. Las negras buscan contrajuego con ...c5 y ...Bf5, presionando la cadena de peones.', wr: [36, 32, 32] },
    'escandinava': { name: 'Defensa Escandinava', moves: 'e2e4 d7d5 e4d5 d8d5 b1c3', san: '1.e4 d5 2.exd5 Qxd5 3.Nc3', desc: 'Desafía e4 inmediatamente. La dama sale temprano pero obtiene desarrollo rápido del alfil de dama y estructura sólida.', wr: [42, 28, 30] },
    'pirc': { name: 'Defensa Pirc', moves: 'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6', san: '1.e4 d6 2.d4 Nf6 3.Nc3 g6', desc: 'Hipermoderna: permite que las blancas construyan un gran centro para luego atacarlo con ...e5 o ...c5 y el alfil fianchetado.', wr: [42, 27, 31] },
    'gda': { name: 'Gambito de Dama Aceptado', moves: 'd2d4 d7d5 c2c4 d5c4', san: '1.d4 d5 2.c4 dxc4', desc: 'Las negras capturan el peón del gambito para luego cederlo, ganando tiempos para desarrollar el alfil de dama activamente.', wr: [36, 37, 27] },
    'gdr-ortodoxa': { name: 'GDR Ortodoxa', moves: 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5', san: '1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5', desc: 'Sistema clásico donde las blancas presionan el centro con piezas desarrolladas. Juego posicional profundo y maniobras estratégicas.', wr: [35, 40, 25] },
    'eslava': { name: 'Defensa Eslava', moves: 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6', san: '1.d4 d5 2.c4 c6 3.Nf3 Nf6', desc: 'Defiende d5 con c6 sin bloquear el alfil de dama. Estructura sólida con planes de contrajuego en el flanco de dama.', wr: [35, 36, 29] },
    'semi-eslava': { name: 'Semi-Eslava', moves: 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6', san: '1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6', desc: 'Combina la solidez de la Eslava con la flexibilidad de la Francesa. Posiciones ricas en planes y complicaciones tácticas.', wr: [34, 36, 30] },
    'india-rey': { name: 'India de Rey', moves: 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6', san: '1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6', desc: 'Las negras permiten un centro fuerte blanco para luego atacarlo con ...e5. El alfil en g7 es una pieza clave para el contraataque.', wr: [39, 30, 31] },
    'nimzo-india': { name: 'Nimzo-India', moves: 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4', san: '1.d4 Nf6 2.c4 e6 3.Nc3 Bb4', desc: 'Clava el caballo c3 que controla e4. Dobla los peones blancos y obtiene control posicional a cambio de la pareja de alfiles.', wr: [34, 36, 30] },
    'india-dama': { name: 'India de Dama', moves: 'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6', san: '1.d4 Nf6 2.c4 e6 3.Nf3 b6', desc: 'Fianchetto del alfil de dama para controlar la diagonal e4-a8. Juego flexible con presión sobre el centro blanco.', wr: [40, 32, 28] },
    'benoni': { name: 'Benoni Moderna', moves: 'd2d4 g8f6 c2c4 c7c5 d4d5', san: '1.d4 Nf6 2.c4 c5 3.d5', desc: 'Crea asimetría con peones enfrentados. Las negras buscan contrajuego en el flanco de dama con ...b5 y presión en la columna c.', wr: [43, 27, 30] },
    'budapest': { name: 'Gambito Budapest', moves: 'd2d4 g8f6 c2c4 e7e5', san: '1.d4 Nf6 2.c4 e5', desc: 'Gambito sorpresa que sacrifica un peón por desarrollo activo. El caballo va a g4 o e4 creando amenazas inmediatas.', wr: [37, 31, 32] },
    'holandesa': { name: 'Defensa Holandesa', moves: 'd2d4 f7f5', san: '1.d4 f5', desc: 'Control agresivo de la casilla e4. Las negras buscan ataque en el flanco de rey, con planes de ...Nf6, ...e6 y ...g5.', wr: [40, 28, 32] },
    'londres': { name: 'Sistema Londres', moves: 'd2d4 d7d5 c1f4 g8f6 e2e3', san: '1.d4 d5 2.Bf4 Nf6 3.e3', desc: 'Sistema universal y sólido. Las blancas construyen una estructura con Bf4, e3, Nf3, Bd3 y c3 contra cualquier defensa.', wr: [38, 34, 28] },
    'colle': { name: 'Sistema Colle', moves: 'd2d4 d7d5 g1f3 g8f6 e2e3', san: '1.d4 d5 2.Nf3 Nf6 3.e3', desc: 'Sistema tranquilo que busca la ruptura e3-e4 preparada con Bd3 y Nbd2. Ideal para jugadores posicionales.', wr: [34, 37, 29] },
    'inglesa': { name: 'Apertura Inglesa', moves: 'c2c4 e7e5 b1c3', san: '1.c4 e5 2.Nc3', desc: 'Siciliana invertida con un tiempo extra. Control del centro desde los flancos con planes de g3, Bg2 y presión en columna c.', wr: [36, 35, 29] },
    'reti': { name: 'Apertura Réti', moves: 'g1f3 d7d5 c2c4', san: '1.Nf3 d5 2.c4', desc: 'Hipermoderna: ataca el centro desde el flanco. Flexible, puede transponerse a Inglesa, Catalana o Gambito de Dama.', wr: [36, 36, 28] },
    'catalana': { name: 'Apertura Catalana', moves: 'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5', san: '1.d4 Nf6 2.c4 e6 3.g3 d5', desc: 'Fianchetto del alfil de rey que presiona la gran diagonal a8-h1. Combina solidez posicional con presión persistente.', wr: [38, 37, 25] },
    'larsen': { name: 'Apertura Larsen', moves: 'b2b3', san: '1.b3', desc: 'Fianchetto temprano del alfil de dama. Apertura flexible y poco teórica que busca control a distancia del centro.', wr: [35, 32, 33] },

    // --- Variantes profundas ---
    'italiana-pianissimo': { name: 'Giuoco Pianissimo (Tabiya)', moves: 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 e1g1 e8g8 f1e1 a7a6', san: '1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.d3 Nf6 5.c3 d6 6.O-O O-O 7.Re1 a6', desc: 'Juego lento y estratégico. Las blancas preparan d4 con c3 mientras mantienen tensión central. Maniobras de piezas y planes a largo plazo.', wr: [38, 35, 27] },
    'gambito-evans-deep': { name: 'Gambito Evans Aceptado', moves: 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5 d2d4', san: '1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4', desc: 'Tras el sacrificio de peón, las blancas construyen un centro dominante con c3+d4 y desarrollo rápido con fuerte iniciativa.', wr: [42, 26, 32] },
    'española-cerrada': { name: 'Española Cerrada (Tabiya)', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3', san: '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3', desc: 'Posición tabiya donde se decide el plan: Breyer (Nb8), Chigorin (Na5) o Zaitsev (Bb7). Juego estratégico profundo.', wr: [36, 38, 26] },
    'española-breyer': { name: 'Española Breyer', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6b8 d2d4', san: '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Nb8 10.d4', desc: 'Reagrupamiento del caballo vía b8-d7 para reforzar el centro. Idea moderna y flexible que prepara ...Bb7 y ...c5.', wr: [35, 40, 25] },
    'española-chigorin': { name: 'Española Chigorin', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6a5 b3c2 c7c5 d2d4', san: '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Na5 10.Bc2 c5 11.d4', desc: 'Na5 apunta a ocupar c4 y presionar el flanco de dama. Con ...c5 se genera contrajuego central contra d4.', wr: [36, 37, 27] },
    'española-marshall': { name: 'Gambito Marshall', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 c2c3 d7d5 e4d5 f6d5', san: '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 O-O 8.c3 d5 9.exd5 Nxd5', desc: 'Gambito de peón por ataque directo al rey. Las negras obtienen piezas activas, columnas abiertas y fuerte iniciativa.', wr: [28, 46, 26] },
    'española-berlinesa': { name: 'Berlinesa: Muro de Berlín', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6 b5c6 d7c6', san: '1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 4.O-O Nxe4 5.d4 Nd6 6.Bxc6 dxc6', desc: 'Lleva a un final técnico sin damas. Las negras tienen pareja de alfiles y peones doblados pero estructura sólida.', wr: [34, 44, 22] },
    'petrov-deep': { name: 'Petrov Clásica', moves: 'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d7d5 f1d3', san: '1.e4 e5 2.Nf3 Nf6 3.Nxe5 d6 4.Nf3 Nxe4 5.d4 d5 6.Bd3', desc: 'Posición simétrica donde las blancas mantienen ligera ventaja de espacio. Juego técnico con maniobras precisas.', wr: [32, 43, 25] },
    'najdorf-ag5': { name: 'Najdorf 6.Bg5 (Envenenado)', moves: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 d8b6', san: '1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Bg5 e6 7.f4 Qb6', desc: 'Variante del Peón Envenenado: Qb6 amenaza b2. Extremadamente compleja y táctica, favorita de Fischer y Kasparov.', wr: [38, 29, 33] },
    'najdorf-ae3': { name: 'Najdorf 6.Be3', moves: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3', san: '1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6 6.Be3 e5 7.Nb3', desc: 'Sistema inglés moderno contra la Najdorf. Las blancas buscan juego posicional con f3, Qd2 y enroque largo.', wr: [36, 31, 33] },
    'dragon-yugoslavo': { name: 'Dragón Yugoslavo', moves: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8 d1d2 b8c6 e1c1', san: '1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6 6.Be3 Bg7 7.f3 O-O 8.Qd2 Nc6 9.O-O-O', desc: 'Enroques opuestos con ataques mutuos. Las blancas lanzan peones del flanco de rey (h4-h5) mientras las negras atacan con ...a5-a4.', wr: [42, 24, 34] },
    'sveshnikov-deep': { name: 'Sveshnikov Ndb5', moves: 'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6 b5a3 b7b5', san: '1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e5 6.Ndb5 d6 7.Bg5 a6 8.Na3 b5', desc: 'Lucha por la casilla d5. Las negras aceptan debilidades estructurales a cambio de piezas activas y contrajuego dinámico.', wr: [34, 33, 33] },
    'winawer-deep': { name: 'Winawer con Qg4', moves: 'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7 d1g4', san: '1.e4 e6 2.d4 d5 3.Nc3 Bb4 4.e5 c5 5.a3 Bxc3+ 6.bxc3 Ne7 7.Qg4', desc: 'Ataque directo al flanco de rey. Las negras deben decidir entre proteger g7 o enrocar largo, llevando a juego desequilibrado.', wr: [37, 28, 35] },
    'francesa-clasica-deep': { name: 'Francesa Clásica McCutcheon', moves: 'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7 g5e7 d8e7', san: '1.e4 e6 2.d4 d5 3.Nc3 Nf6 4.Bg5 Be7 5.e5 Nd7 6.Bxe7 Qxe7', desc: 'Tras los cambios, las negras buscan romper con ...c5 y ...f6. Posición cerrada con juego estratégico en torno a la cadena de peones.', wr: [34, 37, 29] },
    'francesa-avance-deep': { name: 'Francesa Avance con Qb6', moves: 'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6 a2a3', san: '1.e4 e6 2.d4 d5 3.e5 c5 4.c3 Nc6 5.Nf3 Qb6 6.a3', desc: 'Qb6 presiona b2 y d4 simultáneamente. Las blancas refuerzan con a3 y buscan mantener la cadena de peones intacta.', wr: [34, 34, 32] },
    'caro-kann-deep': { name: 'Caro-Kann Clásica con h4', moves: 'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6 g1f3', san: '1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Bf5 5.Ng3 Bg6 6.h4 h6 7.Nf3', desc: 'h4 gana espacio y amenaza h5 atrapando el alfil. Las negras deben jugar ...h6 preventivamente, creando debilidades potenciales.', wr: [36, 34, 30] },
    'caro-kann-avance-deep': { name: 'Caro-Kann Avance con Be2', moves: 'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2', san: '1.e4 c6 2.d4 d5 3.e5 Bf5 4.Nf3 e6 5.Be2', desc: 'Sistema tranquilo donde las blancas buscan mantener la ventaja de espacio. Las negras preparan ...c5 para romper la cadena.', wr: [35, 34, 31] },
    'gdr-ortodoxa-deep': { name: 'GDR Ortodoxa (Tabiya)', moves: 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7 a1c1 c7c6 f1d3 d5c4 d3c4', san: '1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 7.Rc1 c6 8.Bd3 dxc4 9.Bxc4', desc: 'Posición tabiya de la Ortodoxa. Las negras liberan su posición con ...dxc4 y buscan igualar con ...e5 o ...c5.', wr: [33, 42, 25] },
    'eslava-checa': { name: 'Eslava Checa con Bf5', moves: 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5 e2e3', san: '1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 dxc4 5.a4 Bf5 6.e3', desc: 'Las negras capturan c4 y desarrollan el alfil a f5 antes de jugar ...e6. a4 impide ...b5 defendiendo el peón extra.', wr: [33, 37, 30] },
    'semi-eslava-meran': { name: 'Semi-Eslava Meran', moves: 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3 d5c4 d3c4 b7b5', san: '1.d4 d5 2.c4 c6 3.Nf3 Nf6 4.Nc3 e6 5.e3 Nbd7 6.Bd3 dxc4 7.Bxc4 b5', desc: 'Contrajuego agresivo con ...b5 ganando espacio en el flanco de dama. Las negras buscan activar el alfil de dama y presionar.', wr: [35, 34, 31] },
    'india-rey-clasica': { name: 'India de Rey Clásica', moves: 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1', san: '1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O', desc: 'Posición tabiya. Las negras eligen entre Nc6 (Mar del Plata), Na6 (Moderna), Nd7 (Gligoric) según el plan de ataque deseado.', wr: [38, 31, 31] },
    'india-rey-mar-plata': { name: 'India de Rey Mar del Plata', moves: 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7', san: '1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O Nc6 8.d5 Ne7', desc: 'Variante más combativa de la India de Rey. Ataques en flancos opuestos: blancas con c5 en el flanco de dama, negras con f5 en el de rey.', wr: [37, 28, 35] },
    'india-rey-samisch': { name: 'India de Rey Sämisch', moves: 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 e7e5', san: '1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.f3 O-O 6.Be3 e5', desc: 'f3 refuerza e4 y prepara enroque largo con ataque al flanco de rey. Juego agresivo donde ambos bandos atacan sin contemplaciones.', wr: [40, 27, 33] },
    'nimzo-rubinstein': { name: 'Nimzo-India Rubinstein', moves: 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3 c7c5', san: '1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 O-O 5.Bd3 d5 6.Nf3 c5', desc: 'Las negras presionan d4 con ...c5 y ...d5. Si bxc3, las blancas tienen pareja de alfiles pero peones doblados.', wr: [33, 38, 29] },
    'nimzo-clasica': { name: 'Nimzo-India Clásica Qc2', moves: 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 e8g8 a2a3 b4c3 d1c3', san: '1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.Qc2 O-O 5.a3 Bxc3+ 6.Qxc3', desc: 'Qc2 evita los peones doblados. Las blancas obtienen pareja de alfiles y centro fuerte, las negras buen desarrollo.', wr: [35, 37, 28] },
    'benoni-deep': { name: 'Benoni Clásica Fianchetto', moves: 'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 g1f3 g7g6', san: '1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6 6.Nf3 g6', desc: 'Fianchetto del alfil para presionar d5 y e4. Las negras buscan contrajuego con ...b5 y actividad en la columna e.', wr: [42, 28, 30] },
    'londres-deep': { name: 'Londres Línea Principal', moves: 'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3 b8c6 g1f3', san: '1.d4 d5 2.Bf4 Nf6 3.e3 c5 4.c3 Nc6 5.Nf3', desc: 'Estructura sólida con Bf4+e3+c3+Nf3. Las blancas buscan Bd3, Nbd2 y eventualmente e4 para obtener ventaja de espacio.', wr: [37, 35, 28] },
    'inglesa-4caballos': { name: 'Inglesa Cuatro Caballos', moves: 'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5', san: '1.c4 e5 2.Nc3 Nf6 3.Nf3 Nc6 4.g3 d5 5.cxd5', desc: 'Posición simétrica con tensión central. Las blancas buscan explotar el fianchetto y presión en la columna c.', wr: [35, 36, 29] },
    'catalana-abierta': { name: 'Catalana Abierta', moves: 'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3 a7a6', san: '1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 dxc4 5.Nf3 a6', desc: 'Las negras capturan c4 y defienden con ...a6. El alfil en g2 ejerce presión constante en la diagonal, buscando recuperar el peón.', wr: [39, 36, 25] },
    'catalana-cerrada': { name: 'Catalana Cerrada', moves: 'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1', san: '1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 Be7 5.Nf3 O-O 6.O-O', desc: 'Las negras mantienen la tensión en el centro sin capturar c4. Juego posicional profundo con maniobras estratégicas sutiles.', wr: [37, 39, 24] },

    // --- Nuevas aperturas v2.4 ---
    'alekhine': { name: 'Defensa Alekhine', moves: 'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6', san: '1.e4 Nf6 2.e5 Nd5 3.d4 d6', desc: 'Hipermoderna: provoca el avance de peones blancos para luego atacar el centro sobreextendido. El caballo maniobra mientras las negras minan la cadena.', wr: [40, 28, 32] },
    'alekhine-4peones': { name: 'Alekhine Cuatro Peones', moves: 'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 c2c4 d5b6 f2f4', san: '1.e4 Nf6 2.e5 Nd5 3.d4 d6 4.c4 Nb6 5.f4', desc: 'Las blancas ocupan el centro con cuatro peones. Centro imponente pero potencialmente sobreextendido; las negras buscan socavarlo.', wr: [41, 25, 34] },
    'alekhine-moderna': { name: 'Alekhine Moderna', moves: 'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 g1f3', san: '1.e4 Nf6 2.e5 Nd5 3.d4 d6 4.Nf3', desc: 'Línea más flexible y popular: desarrollo natural sin comprometer la estructura. Las negras eligen entre ...Bg4, ...g6 o ...c6.', wr: [39, 30, 31] },
    'grunfeld': { name: 'Defensa Grünfeld', moves: 'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5', san: '1.d4 Nf6 2.c4 g6 3.Nc3 d5', desc: 'Contraataque al centro blanco desde el fianchetto. Tras cxd5 Nxd5, e4 el caballo salta y el Bg7 presiona el centro.', wr: [37, 33, 30] },
    'grunfeld-cambio': { name: 'Grünfeld: Variante del Cambio', moves: 'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7', san: '1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.cxd5 Nxd5 5.e4 Nxc3 6.bxc3 Bg7', desc: 'Las blancas obtienen un centro fuerte con peones en c3-d4-e4. El Bg7 presiona la diagonal y las negras buscan romper con ...c5.', wr: [38, 34, 28] },
    'grunfeld-rusa': { name: 'Grünfeld: Línea Rusa', moves: 'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 g1f3 f8g7 d1b3', san: '1.d4 Nf6 2.c4 g6 3.Nc3 d5 4.Nf3 Bg7 5.Qb3', desc: 'La dama presiona d5 y b7 simultáneamente. Las negras deben responder con precisión: ...dxc4, ...c6 o ...e6 son las opciones principales.', wr: [36, 35, 29] },
    'philidor': { name: 'Defensa Philidor', moves: 'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6', san: '1.e4 e5 2.Nf3 d6 3.d4 Nf6', desc: 'Defensa sólida pero pasiva. Las negras mantienen el centro con ...d6 y buscan contrajuego con ...Nbd7 y ...Be7.', wr: [42, 28, 30] },
    'philidor-hanham': { name: 'Philidor: Variante Hanham', moves: 'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6 b1c3 b8d7', san: '1.e4 e5 2.Nf3 d6 3.d4 Nf6 4.Nc3 Nbd7', desc: 'Las negras preparan ...Be7 y ...O-O manteniendo e5 protegido. Estructura flexible que permite ...c6 y posterior ruptura con ...d5.', wr: [41, 30, 29] },
    'trompowsky': { name: 'Apertura Trompowsky', moves: 'd2d4 g8f6 c1g5', san: '1.d4 Nf6 2.Bg5', desc: 'Clava el caballo antes de que las negras definan su estructura. Evita la teoría de la Nimzo y la India de Rey, buscando juego independiente.', wr: [38, 31, 31] },
    'torre': { name: 'Ataque Torre', moves: 'd2d4 g8f6 g1f3 e7e6 c1g5', san: '1.d4 Nf6 2.Nf3 e6 3.Bg5', desc: 'Sistema agresivo que clava el caballo y presiona la posición negra. Popular a nivel de club, con planes de Nbd2, e3 y c3.', wr: [37, 33, 30] },
    'bird': { name: 'Apertura Bird', moves: 'f2f4 d7d5 g1f3', san: '1.f4 d5 2.Nf3', desc: 'Apertura de flanco que controla e5. Puede transponerse a la Holandesa con colores invertidos. Juego original y poco teórico.', wr: [34, 30, 36] },
    'cuatro-caballos': { name: 'Cuatro Caballos', moves: 'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6', san: '1.e4 e5 2.Nf3 Nc6 3.Nc3 Nf6', desc: 'Desarrollo simétrico de caballos. Posición sólida con opción de transponerse a Española (4.Bb5) o Escocesa (4.d4).', wr: [33, 38, 29] },
    'siciliana-kan': { name: 'Siciliana Kan', moves: 'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6', san: '1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 a6', desc: 'Flexible y sólida. ...a6 prepara ...b5 y ...Bb7 sin comprometer la estructura. Permite elegir entre planes con ...d6, ...Qc7 o ...b5.', wr: [37, 31, 32] },
    'siciliana-taimanov': { name: 'Siciliana Taimanov', moves: 'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6 b1c3', san: '1.e4 c5 2.Nf3 e6 3.d4 cxd4 4.Nxd4 Nc6 5.Nc3', desc: 'Desarrollo natural del caballo presionando d4. Posición flexible con planes de ...Qc7, ...a6, ...Ne5 según la respuesta blanca.', wr: [36, 31, 33] },
    'siciliana-scheveningen': { name: 'Siciliana Scheveningen', moves: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e6', san: '1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e6', desc: 'Estructura con peones en d6+e6, sólida y flexible. Las negras pueden adaptarse con ...a6 (Najdorf), ...Be7, o ...Nc6 según la partida.', wr: [38, 29, 33] },
    'moderna': { name: 'Defensa Moderna', moves: 'e2e4 g7g6 d2d4 f8g7', san: '1.e4 g6 2.d4 Bg7', desc: 'Hipermoderna: deja que las blancas ocupen el centro para atacarlo después con ...d6, ...c5 y el potente alfil en g7.', wr: [44, 25, 31] },
    'bogo-india': { name: 'Bogo-India', moves: 'd2d4 g8f6 c2c4 e7e6 g1f3 f8b4', san: '1.d4 Nf6 2.c4 e6 3.Nf3 Bb4+', desc: 'Jaque con alfil que fuerza a las blancas a elegir: Nbd2, Bd2 o Nd2. Alternativa sólida a la Nimzo-India cuando 3.Nc3 no se juega.', wr: [36, 35, 29] },
    'gambito-rey-aceptado': { name: 'Gambito de Rey Aceptado', moves: 'e2e4 e7e5 f2f4 e5f4 g1f3', san: '1.e4 e5 2.f4 exf4 3.Nf3', desc: 'Las negras aceptan el peón y las blancas buscan recuperarlo con desarrollo rápido. Juego abierto, táctico y agresivo.', wr: [38, 25, 37] },
    'colle-zukertort': { name: 'Sistema Colle-Zukertort', moves: 'd2d4 d7d5 g1f3 g8f6 e2e3 e7e6 f1d3 c7c5 b2b3', san: '1.d4 d5 2.Nf3 Nf6 3.e3 e6 4.Bd3 c5 5.b3', desc: 'Sistema con fianchetto del alfil de dama. Bb2 controla la diagonal y prepara la ruptura e3-e4 con desarrollo armonioso.', wr: [35, 36, 29] },
    'india-dama-petrosian': { name: 'India de Dama Petrosian', moves: 'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 a2a3', san: '1.d4 Nf6 2.c4 e6 3.Nf3 b6 4.a3', desc: 'a3 previene ...Bb4 y prepara un centro sólido. Las blancas buscan d4+e4 con desarrollo armonioso y control del centro.', wr: [39, 33, 28] },
    'gda-deep': { name: 'GDA Línea Principal', moves: 'd2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3 e7e6 f1c4 c7c5', san: '1.d4 d5 2.c4 dxc4 3.Nf3 Nf6 4.e3 e6 5.Bxc4 c5', desc: 'Las negras devuelven el peón para igualar en el centro. Posición simétrica con juego de piezas donde la precisión es clave.', wr: [35, 38, 27] },
    'holandesa-leningrado': { name: 'Holandesa Leningrado', moves: 'd2d4 f7f5 c2c4 g8f6 g2g3 g7g6 f1g2 f8g7', san: '1.d4 f5 2.c4 Nf6 3.g3 g6 4.Bg2 Bg7', desc: 'Doble fianchetto con peón en f5. Las negras controlan e4 y buscan ataque en el flanco de rey con ...e5 y ...f4.', wr: [38, 29, 33] },
    'holandesa-muro': { name: 'Holandesa Muro de Piedra', moves: 'd2d4 f7f5 c2c4 g8f6 g2g3 e7e6 f1g2', san: '1.d4 f5 2.c4 Nf6 3.g3 e6 4.Bg2', desc: 'Las negras construyen un muro sólido con peones en d5-e6-f5. Control de e4 y ataque futuro en el flanco de rey.', wr: [39, 30, 31] },
    'escocesa-clasica': { name: 'Escocesa Clásica (Bc5)', moves: 'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 f8c5', san: '1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Bc5', desc: 'Las negras desarrollan el alfil activamente apuntando a d4. Posición abierta con juego táctico y presión sobre el centro.', wr: [39, 31, 30] },
    'india-rey-averbakh': { name: 'India de Rey Averbakh', moves: 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1e2', san: '1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Ne2', desc: 'El caballo en e2 apoya f4 y permite Bd2+Qd2 para enroque largo. Plan agresivo con juego en el flanco de rey.', wr: [40, 29, 31] },
    'nimzo-hubner': { name: 'Nimzo-India Hübner', moves: 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 c7c5', san: '1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 c5', desc: 'Contrajuego inmediato contra d4. Las negras buscan presionar el centro y eventualmente forzar ...Bxc3 en momento favorable.', wr: [34, 37, 29] },

    // --- Nuevas aperturas entrenables v2.4.1 ---
    'espanola-cambio': { name: 'Española: Variante del Cambio', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5c6 d7c6', san: '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Bxc6 dxc6', desc: 'Las blancas simplifican pero las negras obtienen la pareja de alfiles. Juego posicional con ventaja estructural para las blancas.', wr: [39, 33, 28] },
    'espanola-breyer': { name: 'Española: Variante Breyer', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6b8', san: '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Nb8', desc: 'El caballo retrocede a b8 para reagruparse en d7. Maniobra estratégica profunda que prepara un contraataque flexible.', wr: [35, 40, 25] },
    'espanola-marshall': { name: 'Española: Gambito Marshall', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 c2c3 d7d5', san: '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 O-O 8.c3 d5', desc: 'Gambito de peón que sacrifica material por ataque. Las negras obtienen piezas activas, columnas abiertas y presión sobre el rey.', wr: [29, 45, 26] },
    'berlinesa': { name: 'Española: Defensa Berlinesa', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6 b5c6 d7c6 d4e5 d6f5', san: '1.e4 e5 2.Nf3 Nc6 3.Bb5 Nf6 4.O-O Nxe4 5.d4 Nd6 6.Bxc6 dxc6 7.dxe5 Nf5', desc: 'El Muro de Berlín: final sin damas extremadamente sólido. Las negras buscan igualar con la pareja de alfiles y estructura flexible.', wr: [33, 45, 22] },
    'siciliana-acelerada': { name: 'Siciliana Acelerada del Dragón', moves: 'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g7g6', san: '1.e4 c5 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 g6', desc: 'Fianchetto sin ...d6 evitando el Ataque Yugoslavo. Las blancas pueden intentar el Maróczy Bind con c4.', wr: [37, 30, 33] },
    'siciliana-cerrada': { name: 'Siciliana Cerrada', moves: 'e2e4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7', san: '1.e4 c5 2.Nc3 Nc6 3.g3 g6 4.Bg2 Bg7', desc: 'Variante posicional que evita la Siciliana Abierta. Fianchetto recíproco con juego tranquilo y estratégico.', wr: [35, 32, 33] },
    'siciliana-grand-prix': { name: 'Gambito Grand Prix', moves: 'e2e4 c7c5 f2f4 b8c6 g1f3', san: '1.e4 c5 2.f4 Nc6 3.Nf3', desc: 'Ataque agresivo con f4 buscando abrir la columna f y atacar el rey. Menos teórico que la Siciliana Abierta.', wr: [39, 27, 34] },
    'francesa-rubinstein': { name: 'Francesa Rubinstein', moves: 'e2e4 e7e6 d2d4 d7d5 b1c3 d5e4 c3e4', san: '1.e4 e6 2.d4 d5 3.Nc3 dxe4 4.Nxe4', desc: 'Las negras cambian en e4 y buscan un juego sólido. El caballo en e4 es activo pero las negras obtienen posición libre de debilidades.', wr: [36, 33, 31] },
    'caro-kann-panov': { name: 'Caro-Kann: Ataque Panov', moves: 'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 c2c4 g8f6 b1c3', san: '1.e4 c6 2.d4 d5 3.exd5 cxd5 4.c4 Nf6 5.Nc3', desc: 'Transforma la Caro-Kann en una posición tipo GDR. Tensión central con opciones tácticas para ambos bandos.', wr: [36, 34, 30] },
    'escandinava-clasica': { name: 'Escandinava Clásica Qa5', moves: 'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3', san: '1.e4 d5 2.exd5 Qxd5 3.Nc3 Qa5 4.d4 Nf6 5.Nf3', desc: 'La dama en a5 mantiene presión sobre e1 y a2. Las negras buscan desarrollo rápido con ...Bf5 y ...e6.', wr: [41, 29, 30] },
    'ragozin': { name: 'GDR: Variante Ragozin', moves: 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3 f8b4', san: '1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Nf3 Bb4', desc: 'Combina ideas de la Nimzo-India con el GDR. Bb4 clava el caballo y crea presión dinámica sobre el centro.', wr: [34, 37, 29] },
    'nimzo-samisch': { name: 'Nimzo-India Sämisch', moves: 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 a2a3 b4c3 b2c3', san: '1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.a3 Bxc3+ 5.bxc3', desc: 'Las blancas fuerzan el cambio obteniendo pareja de alfiles y centro fuerte con peones doblados pero activos.', wr: [36, 34, 30] },
    'nimzo-fischer': { name: 'Nimzo-India Fischer', moves: 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 b7b6', san: '1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e3 b6', desc: 'Fianchetto del alfil de dama presionando e4 y la gran diagonal. Desarrollo flexible con planes de ...Bb7 y ...c5.', wr: [35, 36, 29] },
    'india-rey-fianchetto': { name: 'India de Rey: Sistema Fianchetto', moves: 'd2d4 g8f6 c2c4 g7g6 g1f3 f8g7 g2g3 e8g8 f1g2 d7d6', san: '1.d4 Nf6 2.c4 g6 3.Nf3 Bg7 4.g3 O-O 5.Bg2 d6', desc: 'Las blancas fianchettean ambos alfiles. Posición posicional donde la presión a largo plazo del Bg2 es la clave.', wr: [37, 35, 28] },
    'india-rey-petrosian': { name: 'India de Rey: Variante Petrosián', moves: 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 f3e1', san: '1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O Nc6 8.d5 Ne7 9.Ne1', desc: 'El caballo se retira para apoyar f3 y preparar g4. Control posicional profundo del centro y preparación de ataque en el flanco de rey.', wr: [36, 37, 27] },
    'india-rey-bayoneta': { name: 'India de Rey: Ataque Bayoneta', moves: 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 b2b4', san: '1.d4 Nf6 2.c4 g6 3.Nc3 Bg7 4.e4 d6 5.Nf3 O-O 6.Be2 e5 7.O-O Nc6 8.d5 Ne7 9.b4', desc: 'Ataque en el flanco de dama con b4-b5. Las blancas buscan abrir líneas antes de que las negras lancen el ataque con f5.', wr: [38, 33, 29] },
    'benoni-cuatro-peones': { name: 'Benoni: Cuatro Peones', moves: 'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4 g7g6 f2f4', san: '1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6 6.e4 g6 7.f4', desc: 'Centro masivo con cuatro peones. Las blancas tienen enorme presencia central pero pueden estar sobreextendidas.', wr: [44, 24, 32] },
    'benoni-fianchetto': { name: 'Benoni: Sistema Fianchetto', moves: 'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 g1f3 g7g6 g2g3 f8g7 f1g2', san: '1.d4 Nf6 2.c4 c5 3.d5 e6 4.Nc3 exd5 5.cxd5 d6 6.Nf3 g6 7.g3 Bg7 8.Bg2', desc: 'Sistema posicional donde el Bg2 presiona d5 y la diagonal. Las negras buscan contrajuego con ...a6, ...b5 y en la columna e.', wr: [40, 30, 30] },
    'siciliana-smith-morra-deep': { name: 'Smith-Morra Aceptado', moves: 'e2e4 c7c5 d2d4 c5d4 c2c3 d4c3 b1c3', san: '1.e4 c5 2.d4 cxd4 3.c3 dxc3 4.Nxc3', desc: 'Tras aceptar el gambito, las blancas obtienen desarrollo rápido, columnas abiertas y fuerte iniciativa. Peligroso en partidas rápidas.', wr: [41, 24, 35] },
    'falkbeer': { name: 'Contragambito Falkbeer', moves: 'e2e4 e7e5 f2f4 d7d5 e4d5 e5e4', san: '1.e4 e5 2.f4 d5 3.exd5 e4', desc: 'Contragambito agresivo que sacrifica un peón por iniciativa. Las negras obtienen avance central y juego activo contra el Gambito de Rey.', wr: [35, 28, 37] },
    'gambito-rey-rehusado': { name: 'Gambito de Rey Rehusado', moves: 'e2e4 e7e5 f2f4 f8c5', san: '1.e4 e5 2.f4 Bc5', desc: 'Las negras rechazan el gambito y desarrollan el alfil a c5 apuntando al debilitado f2. Línea sólida y activa.', wr: [36, 28, 36] },
    'panov': { name: 'Caro-Kann: Panov Profunda', moves: 'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5 c2c4 g8f6 b1c3 e7e6', san: '1.e4 c6 2.d4 d5 3.exd5 cxd5 4.c4 Nf6 5.Nc3 e6', desc: 'Estructura tipo GDR con Peón Aislado de Dama. Juego dinámico donde ambos bandos tienen planes claros: ataque vs bloqueo.', wr: [35, 36, 29] },
    'escocesa-gambito': { name: 'Gambito Escocés', moves: 'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f1c4', san: '1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Bc4', desc: 'Gambito que sacrifica d4 por desarrollo y control de f7. Similar al Gambito Danés con juego abierto y táctico.', wr: [40, 28, 32] },
    'holandesa-staunton': { name: 'Gambito Staunton', moves: 'd2d4 f7f5 e2e4', san: '1.d4 f5 2.e4', desc: 'Gambito agresivo que busca abrir líneas contra el rey negro debilitado por ...f5. Juego táctico con compensación por el peón.', wr: [42, 25, 33] },
};

// ===== PROBLEMAS DE AJEDREZ =====
var CHESS_PUZZLES = [
    // --- MATE EN 1 (difficulty 1) ---
    { fen: '6k1/5ppp/8/8/8/8/1Q6/K7 w - - 0 1', solution: ['b2g7'], theme: 'mate1', difficulty: 1, title: 'Mate con dama' },
    { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1', solution: ['h5f7'], theme: 'mate1', difficulty: 1, title: 'Mate del Pastor' },
    { fen: '5rk1/ppp2ppp/8/8/8/8/PPP2PPP/R4RK1 w - - 0 1', solution: ['f1f8'], theme: 'mate1', difficulty: 1, title: 'Mate en la última fila' },
    { fen: '6k1/pppp1ppp/8/8/8/8/PPPPQPPP/R3K2R w KQ - 0 1', solution: ['e2e8'], theme: 'mate1', difficulty: 1, title: 'Mate con dama' },
    { fen: 'r4rk1/pppb1ppp/8/3Nb3/8/8/PPPB1PPP/R2K3R w - - 0 1', solution: ['d5f6'], theme: 'mate1', difficulty: 1, title: 'Mate con caballo' },
    { fen: '3qk3/8/8/8/8/5B2/8/4K2R w K - 0 1', solution: ['h1h8'], theme: 'mate1', difficulty: 1, title: 'Mate con torre' },
    { fen: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 1', solution: ['h4e1'], theme: 'mate1', difficulty: 1, title: 'Mate del Loco' },
    { fen: '5r1k/6pp/8/8/8/8/R7/K5R1 w - - 0 1', solution: ['g1g8'], theme: 'mate1', difficulty: 1, title: 'Mate con torre en 8ª fila' },
    { fen: '6k1/5p1p/6p1/8/8/8/5PPP/4Q1K1 w - - 0 1', solution: ['e1e8'], theme: 'mate1', difficulty: 1, title: 'Mate con dama lejana' },
    { fen: 'r1b1kb1r/pppp1ppp/2n2n2/8/2BqP3/2N5/PPPP1PPP/R1BQ1RK1 w kq - 0 1', solution: ['c3d5'], theme: 'mate1', difficulty: 1, title: 'Descubierta mortal' },

    // --- MATE EN 2 (difficulty 2) ---
    { fen: '2bqkbn1/2pppp2/np2N3/r3P1p1/p2N2B1/5Q2/PPPPPP1P/RNB1K2R w KQ - 0 1', solution: ['f3f7', 'e8d8', 'f7d7'], theme: 'mate2', difficulty: 2, title: 'Mate de Legal' },
    { fen: 'r2qk2r/ppp2ppp/2np4/2b1p1B1/2B1P1b1/3P1N2/PPP2PPP/RN1QR1K1 w kq - 0 1', solution: ['c4f7', 'e8f8', 'd1b3'], theme: 'mate2', difficulty: 2, title: 'Sacrificio en f7' },
    { fen: '6k1/pp3ppp/8/8/8/2B5/PP3PPP/6K1 w - - 0 1', solution: ['c3g7'], theme: 'mate1', difficulty: 1, title: 'Mate con alfil y peón' },
    { fen: 'r1bqr1k1/pppp1ppp/2n2n2/8/1bBNP3/2N5/PPPP1PPP/R1BQ1RK1 w - - 0 1', solution: ['d4f5', 'g8h8', 'd1g4'], theme: 'mate2', difficulty: 2, title: 'Ataque al rey enrocado' },
    { fen: 'r3k2r/ppp2ppp/2n5/3Np1q1/2B1P3/8/PPPP1bPP/RNBQ1R1K b kq - 0 1', solution: ['g5g1', 'f1g1', 'f2g3'], theme: 'mate2', difficulty: 2, title: 'Sacrificio de dama' },
    { fen: '3r2k1/pp3ppp/8/3Q4/8/8/PPP2PPP/6K1 w - - 0 1', solution: ['d5f7', 'g8h8', 'f7f8'], theme: 'mate2', difficulty: 2, title: 'Mate con dama sola' },
    { fen: 'r1b1k2r/ppppqppp/2n5/1Bb1P3/8/5N2/PPPP1PPP/RNBQR1K1 w kq - 0 1', solution: ['e5f6', 'e7f6', 'e1e8'], theme: 'mate2', difficulty: 2, title: 'Apertura de línea' },
    { fen: '5rk1/1p3ppp/p7/8/8/1B6/PPP3PP/2KR4 w - - 0 1', solution: ['d1d8', 'f8d8', 'b3f7'], theme: 'mate2', difficulty: 2, title: 'Cambio y mate' },
    { fen: '2r3k1/5ppp/8/8/8/8/2R2PPP/2R3K1 w - - 0 1', solution: ['c2c8', 'c8c8', 'c1c8'], theme: 'mate2', difficulty: 2, title: 'Torres dobladas' },
    { fen: 'r1bqk2r/pppp1Bpp/2n2n2/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1', solution: ['e8f7', 'd1b3', 'f7e8'], theme: 'mate2', difficulty: 2, title: 'Trampa de apertura' },

    // --- TÁCTICA: Horquilla / Doble ataque (difficulty 2) ---
    { fen: 'r1bqkb1r/pppppppp/2n5/8/3nP3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1', solution: ['d1d4'], theme: 'fork', difficulty: 2, title: 'Doble ataque con dama' },
    { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1', solution: ['f1b5'], theme: 'pin', difficulty: 2, title: 'Clavada del caballo' },
    { fen: 'r3k2r/ppp2ppp/2n5/3q4/3P4/8/PPP2PPP/R1BQK1NR w KQkq - 0 1', solution: ['c1g5'], theme: 'fork', difficulty: 2, title: 'Ataque doble con alfil' },
    { fen: '5rk1/ppp2ppp/3p4/8/4n3/8/PPP2PPP/R1B1K2R b KQ - 0 1', solution: ['e4f2'], theme: 'fork', difficulty: 2, title: 'Horquilla de caballo' },
    { fen: 'r1bqk2r/ppppbppp/2n5/4N3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 1', solution: ['e5c6'], theme: 'fork', difficulty: 2, title: 'Captura con doble ataque' },
    { fen: 'r2qkbnr/ppp2ppp/2np4/4p1B1/4P1b1/5N2/PPPP1PPP/RN1QKB1R w KQkq - 0 1', solution: ['f3e5'], theme: 'fork', difficulty: 2, title: 'Ataque doble al centro' },

    // --- TÁCTICA: Clavada (difficulty 2-3) ---
    { fen: 'r1bqkbnr/ppp2ppp/2np4/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1', solution: ['c4f7'], theme: 'sacrifice', difficulty: 2, title: 'Sacrificio en f7' },
    { fen: 'rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 1', solution: ['e2e4'], theme: 'center', difficulty: 2, title: 'Dominio central' },
    { fen: 'rn1qkbnr/ppp1pppp/8/3p4/4P1b1/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1', solution: ['f3e5'], theme: 'fork', difficulty: 2, title: 'Ataque al alfil clavado' },
    { fen: 'r2qk2r/ppp1bppp/2n1bn2/3pp3/8/1BN2N2/PPPPQPPP/R1B1K2R w KQkq - 0 1', solution: ['f3d4'], theme: 'pin', difficulty: 3, title: 'Ataque a la clavada' },

    // --- MATE EN 3 (difficulty 3) ---
    { fen: '5rk1/5ppp/8/1Q6/8/8/5PPP/6K1 w - - 0 1', solution: ['b5f5', 'f8f5', 'f5f7'], theme: 'mate2', difficulty: 2, title: 'Infiltración de dama' },
    { fen: 'r1b2rk1/2p2ppp/p7/1p6/3P3q/1BP2N1P/PP4P1/RN1QR1K1 b - - 0 1', solution: ['h4f2', 'g1h1', 'f2g2'], theme: 'mate2', difficulty: 3, title: 'Mate en g2' },
    { fen: '2kr3r/ppqb1ppp/2n1pn2/2Pp4/1B6/2N1PN2/PP1Q1PPP/R3K2R w KQ - 0 1', solution: ['d2d4'], theme: 'center', difficulty: 2, title: 'Centralización de dama' },
    { fen: 'r1bq1rk1/ppppbppp/2n2n2/4p3/2BPP3/2N2N2/PPP2PPP/R1BQ1RK1 w - - 0 1', solution: ['d4e5'], theme: 'center', difficulty: 2, title: 'Ruptura central' },
    { fen: '6k1/5p1p/4p1pQ/8/8/8/5PPP/6K1 w - - 0 1', solution: ['h6g7'], theme: 'mate1', difficulty: 1, title: 'Mate en g7' },
    { fen: 'r2qr1k1/ppp2ppp/2npbn2/2b1p3/4P3/2NP1N1P/PPP1BPP1/R1BQR1K1 w - - 0 1', solution: ['d3d4'], theme: 'center', difficulty: 2, title: 'Expansión central' },

    // --- TÁCTICA: Descubierta (difficulty 3) ---
    { fen: 'r2q1rk1/pp2ppbp/2np1np1/2p5/4PP2/2NP2P1/PPP1N1BP/R1BQ1RK1 w - - 0 1', solution: ['f4f5'], theme: 'attack', difficulty: 3, title: 'Avance con amenaza' },
    { fen: 'r1bq1rk1/ppp2ppp/2n2n2/3pp3/1bPP4/2N1PN2/PP3PPP/R1BQKB1R w KQ - 0 1', solution: ['d4d5'], theme: 'fork', difficulty: 3, title: 'Avance con doble amenaza' },
    { fen: 'r2qk2r/ppp1bppp/2n2n2/3pp3/3PP1b1/2N2N2/PPP1BPPP/R1BQK2R w KQkq - 0 1', solution: ['d4d5'], theme: 'fork', difficulty: 2, title: 'Ataque descubierto' },

    // --- FINALES (difficulty 2-3) ---
    { fen: '8/8/8/8/8/5K2/4P3/5k2 w - - 0 1', solution: ['e2e4'], theme: 'endgame', difficulty: 1, title: 'Peón pasado: avanzar' },
    { fen: '8/8/4k3/8/8/4K3/4P3/8 w - - 0 1', solution: ['e3d4'], theme: 'endgame', difficulty: 2, title: 'Oposición: flanqueo' },
    { fen: '8/2k5/8/8/8/8/1KP5/8 w - - 0 1', solution: ['c2c4'], theme: 'endgame', difficulty: 1, title: 'Peón pasado: empujar' },
    { fen: '8/8/8/3k4/8/4K3/8/4R3 w - - 0 1', solution: ['e1e7'], theme: 'endgame', difficulty: 2, title: 'Rey y Torre: cortar al rey' },
    { fen: '8/8/4k3/8/8/8/4K3/R7 w - - 0 1', solution: ['a1a6'], theme: 'endgame', difficulty: 2, title: 'Técnica de la escalera' },
    { fen: '8/8/8/8/4k3/8/R3K3/8 w - - 0 1', solution: ['a2a4'], theme: 'endgame', difficulty: 2, title: 'Torre y Rey vs Rey' },

    // --- TÁCTICA: Sacrificio (difficulty 3-4) ---
    { fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2BPP3/5N2/PPP2PPP/RNBQ1RK1 w kq - 0 1', solution: ['d4e5'], theme: 'center', difficulty: 2, title: 'Captura central fuerte' },
    { fen: 'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 0 1', solution: ['e2e3'], theme: 'development', difficulty: 2, title: 'Desarrollo armonioso' },
    { fen: 'r2q1rk1/pp2ppbp/3p1np1/2pP4/4P3/2N5/PP2BPPP/R1BQ1RK1 w - - 0 1', solution: ['e4e5'], theme: 'attack', difficulty: 3, title: 'Ruptura de peón e5' },
    { fen: 'r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 1', solution: ['c3d5'], theme: 'sacrifice', difficulty: 3, title: 'Sacrificio posicional' },

    // --- TEMAS MIXTOS (difficulty 2-4) ---
    { fen: 'r3k2r/pp1n1ppp/2p1p3/q2pPb2/3P1P2/P1PB4/2P3PP/R2QK2R b KQkq - 0 1', solution: ['f5d3'], theme: 'capture', difficulty: 2, title: 'Captura ganadora' },
    { fen: 'rnbq1rk1/pp2ppbp/3p1np1/2pP4/2P1P3/2N2N2/PP2BPPP/R1BQK2R w KQ - 0 1', solution: ['e1g1'], theme: 'development', difficulty: 1, title: 'Enroque oportuno' },
    { fen: 'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1', solution: ['d2d4'], theme: 'center', difficulty: 1, title: 'Apertura del centro' },
    { fen: 'r1bqkb1r/pppppppp/2n2n2/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 1', solution: ['e4e5'], theme: 'attack', difficulty: 2, title: 'Avance ganando tiempos' },
    { fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 0 1', solution: ['b2b4'], theme: 'attack', difficulty: 3, title: 'Expansión en el flanco' },
    { fen: '2kr1b1r/ppp1pppp/2n2n2/3q4/3P4/4BN2/PPP2PPP/RN1QKB1R w KQ - 0 1', solution: ['f3g5'], theme: 'attack', difficulty: 3, title: 'Ataque al punto f7' },

    // --- MATE EN 2 AVANZADOS (difficulty 3) ---
    { fen: 'r4rk1/ppp2ppp/8/3pN3/3PnBb1/6P1/PPP2P1P/R2QR1K1 w - - 0 1', solution: ['e5f7', 'f8f7', 'f4c7'], theme: 'mate2', difficulty: 3, title: 'Sacrificio de caballo' },
    { fen: '2r2rk1/pp3ppp/8/3q4/8/2B5/PP3PPP/R2Q1RK1 w - - 0 1', solution: ['d1d5'], theme: 'capture', difficulty: 2, title: 'Captura centralizada' },
    { fen: 'r2q1rk1/ppp1bppp/2n2n2/3p4/3P1B2/2PBPN2/PP3PPP/R2QK2R w KQ - 0 1', solution: ['d1b1'], theme: 'attack', difficulty: 3, title: 'Batería dama-alfil' },

    // --- TÁCTICA: Rayos X (difficulty 3) ---
    { fen: '1r3rk1/5ppp/p1p5/3pN3/1P6/P3PP2/5KPP/1R1R4 w - - 0 1', solution: ['e5d3'], theme: 'tactic', difficulty: 2, title: 'Retirada con amenaza' },
    { fen: 'r2q1rk1/pp1b1ppp/2n1pn2/2pp4/3P1B2/2PBPN2/PP1N1PPP/R2QK2R w KQ - 0 1', solution: ['d4c5'], theme: 'capture', difficulty: 2, title: 'Cambio favorable' },

    // --- MATE ARTÍSTICO (difficulty 4) ---
    { fen: '1Q6/5pk1/2p3p1/1p2N2p/1b5P/1bn5/2r3P1/2K5 w - - 0 1', solution: ['b8g3'], theme: 'mate1', difficulty: 3, title: 'Mate inesperado' },
    { fen: 'kbK5/pp6/1P6/8/8/8/8/R7 w - - 0 1', solution: ['a1a7'], theme: 'mate1', difficulty: 2, title: 'Mate con torre en 7ª' },
    { fen: '6rk/5Npp/8/8/8/8/8/6K1 w - - 0 1', solution: ['f7g5'], theme: 'mate1', difficulty: 2, title: 'Mate ahogado del caballo' },

    // --- PROBLEMAS DE CÁLCULO (difficulty 3-4) ---
    { fen: 'r1bq1rk1/pp3ppp/2n1pn2/2pp4/3P1B2/3BPN2/PPP2PPP/RN1QK2R w KQ - 0 1', solution: ['d4c5'], theme: 'capture', difficulty: 2, title: 'Captura con ventaja' },
    { fen: 'r2qkbnr/ppp1pppp/2n5/3pPb2/3P4/8/PPP2PPP/RNBQKBNR w KQkq - 0 1', solution: ['c1e3'], theme: 'development', difficulty: 2, title: 'Desarrollo con tempo' },
    { fen: 'rnbqk2r/pppp1ppp/5n2/2b1p3/2BPP3/5N2/PPP2PPP/RNBQK2R b KQkq - 0 1', solution: ['e5d4'], theme: 'capture', difficulty: 2, title: 'Captura central' },

    // --- MATE CON PIEZA MENOR (difficulty 3) ---
    { fen: 'r5k1/ppp2ppp/2n5/8/8/2B5/PPP2PPP/4R1K1 w - - 0 1', solution: ['e1e8'], theme: 'mate1', difficulty: 1, title: 'Mate de pasillo' },
    { fen: '4r1k1/ppp2ppp/8/8/8/8/PPP2PPP/4R1K1 w - - 0 1', solution: ['e1e8'], theme: 'mate1', difficulty: 1, title: 'Mate con torre' },

    // --- PROBLEMAS INTERMEDIOS (difficulty 2) ---
    { fen: 'rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1', solution: ['e4e5'], theme: 'attack', difficulty: 2, title: 'Avance ganador e5' },
    { fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', solution: ['e7e5'], theme: 'center', difficulty: 1, title: 'Respuesta simétrica' },
    { fen: 'r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1', solution: ['d2d4'], theme: 'center', difficulty: 1, title: 'Control central clásico' },
    { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 1', solution: ['b8c6'], theme: 'development', difficulty: 1, title: 'Desarrollo natural' },

    // --- TÁCTICA: Eliminación del defensor (difficulty 3) ---
    { fen: 'r2q1rk1/ppp2ppp/2n2n2/3Np1b1/2B1P3/8/PPPP1PPP/R1BQR1K1 w - - 0 1', solution: ['d5f6'], theme: 'fork', difficulty: 3, title: 'Eliminación y ataque' },
    { fen: 'r2qr1k1/ppp2ppp/2n5/3pN3/3P4/8/PPP2PPP/R1BQR1K1 w - - 0 1', solution: ['e5c6'], theme: 'capture', difficulty: 2, title: 'Captura del defensor' },
    { fen: 'r4rk1/ppp2ppp/3b4/3pN3/3P4/8/PPP2PPP/R3R1K1 w - - 0 1', solution: ['e5f7'], theme: 'fork', difficulty: 3, title: 'Horquilla en f7' },

    // --- SACRIFICIO POSICIONAL (difficulty 3-4) ---
    { fen: 'r1bqr1k1/ppp2ppp/2nb1n2/3pp3/2PPP3/2NB1N2/PP3PPP/R1BQ1RK1 w - - 0 1', solution: ['d4d5'], theme: 'center', difficulty: 3, title: 'Avance central bloqueante' },
    { fen: 'rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R w KQkq - 0 1', solution: ['c4d5'], theme: 'capture', difficulty: 2, title: 'Captura liberadora' },

    // --- DEFENSA (difficulty 3) ---
    { fen: 'r1bqk2r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 0 1', solution: ['f6e4'], theme: 'defense', difficulty: 2, title: 'Contraataque central' },
    { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2BPP3/5N2/PPP2PPP/RNBQK2R b KQkq - 0 1', solution: ['e5d4'], theme: 'defense', difficulty: 2, title: 'Cambio en el centro' },

    // --- MATE EN 1 ADICIONALES (difficulty 1) ---
    { fen: '3r2k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', solution: ['d1d8'], theme: 'mate1', difficulty: 1, title: 'Mate con torre en 8ª' },
    { fen: 'r4rk1/ppp2p1p/8/8/8/8/PPP2PPP/R4RK1 w - - 0 1', solution: ['f1f8'], theme: 'mate1', difficulty: 1, title: 'Mate en última fila' },
    { fen: '4r1k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', solution: ['a1a8'], theme: 'mate1', difficulty: 1, title: 'Mate en 8ª fila' },

    // --- PROBLEMAS TÁCTICOS VARIADOS ---
    { fen: 'r2qkb1r/ppp2ppp/2n2n2/3pp1B1/2B1P1b1/3P1N2/PPP2PPP/RN1QK2R w KQkq - 0 1', solution: ['c4f7'], theme: 'sacrifice', difficulty: 3, title: 'Sacrificio clásico en f7' },
    { fen: 'rnbq1rk1/ppp2ppp/3p1n2/4p3/2BPP1b1/2N2N2/PPP2PPP/R1BQ1RK1 w - - 0 1', solution: ['d4d5'], theme: 'attack', difficulty: 3, title: 'Avance ganando pieza' },
    { fen: 'r2qkbnr/ppp2ppp/2n1p3/3pP3/3P4/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 1', solution: ['c2c4'], theme: 'center', difficulty: 2, title: 'Apoyo del centro' },

    // --- MÁS MATES FAMOSOS ---
    { fen: '1k1r4/pp1b1R2/3q2pp/4p3/2B5/4Q3/PPP2B2/2K5 b - - 0 1', solution: ['d6d1', 'c1d1', 'd7g4', 'd1d2', 'g4e2'], theme: 'mate3', difficulty: 4, title: 'Mate de Morphy (Opera)' },
    { fen: 'r2q1rk1/pp2ppbp/2p2np1/6B1/3PP3/2N5/PPP2PPP/R2QK2R w KQ - 0 1', solution: ['e4e5'], theme: 'attack', difficulty: 3, title: 'Ataque al enrocado' },

    // --- PROBLEMAS DE FINALES AVANZADOS ---
    { fen: '8/5pk1/8/8/8/4K3/5P2/8 w - - 0 1', solution: ['e3f4'], theme: 'endgame', difficulty: 2, title: 'Final: rey activo' },
    { fen: '8/8/1p6/1P1k4/1K6/8/8/8 w - - 0 1', solution: ['b4c3'], theme: 'endgame', difficulty: 3, title: 'Final: triangulación' },
    { fen: '8/5k2/8/5K2/6P1/8/8/8 w - - 0 1', solution: ['g4g5'], theme: 'endgame', difficulty: 2, title: 'Final: peón pasado avanza' },
    { fen: '8/2k5/3p4/1K1P4/8/8/8/8 w - - 0 1', solution: ['b5c4'], theme: 'endgame', difficulty: 3, title: 'Final: oposición diagonal' },
    { fen: '4k3/8/8/8/8/8/4KP2/8 w - - 0 1', solution: ['f2f4'], theme: 'endgame', difficulty: 1, title: 'Peón pasado: primer paso' },
];

var puzzleMode = false;
var puzzleActive = false;
var currentPuzzle = null;
var puzzleMoveIndex = 0;
var puzzleStats = { solved: 0, failed: 0, streak: 0, bestStreak: 0 };
var puzzleHistory = [];
var puzzleFilter = { theme: 'all', difficulty: 'all' };

function loadPuzzleStats() {
    try {
        var saved = localStorage.getItem('puzzleStats');
        if (saved) {
            var parsed = JSON.parse(saved);
            puzzleStats.solved = parsed.solved || 0;
            puzzleStats.failed = parsed.failed || 0;
            puzzleStats.streak = parsed.streak || 0;
            puzzleStats.bestStreak = parsed.bestStreak || 0;
        }
        var hist = localStorage.getItem('puzzleHistory');
        if (hist) puzzleHistory = JSON.parse(hist);
    } catch(e) {}
    updatePuzzleStatsUI();
}

function savePuzzleStats() {
    try {
        localStorage.setItem('puzzleStats', JSON.stringify(puzzleStats));
        localStorage.setItem('puzzleHistory', JSON.stringify(puzzleHistory.slice(-200)));
    } catch(e) {}
}

function updatePuzzleStatsUI() {
    var sc = document.getElementById('puzzle-solved-count');
    var fc = document.getElementById('puzzle-failed-count');
    var st = document.getElementById('puzzle-streak-count');
    if (sc) sc.textContent = puzzleStats.solved;
    if (fc) fc.textContent = puzzleStats.failed;
    if (st) st.textContent = puzzleStats.streak;
}

function getFilteredPuzzles() {
    return CHESS_PUZZLES.filter(function(p) {
        if (puzzleFilter.theme !== 'all' && p.theme !== puzzleFilter.theme) return false;
        if (puzzleFilter.difficulty !== 'all' && p.difficulty !== parseInt(puzzleFilter.difficulty)) return false;
        return true;
    });
}

function getThemeLabel(theme) {
    var labels = {
        'mate1': '♔ Mate en 1', 'mate2': '♔ Mate en 2', 'mate3': '♔ Mate en 3+',
        'fork': '⚔️ Horquilla', 'pin': '📌 Clavada', 'sacrifice': '💎 Sacrificio',
        'attack': '⚡ Ataque', 'defense': '🛡️ Defensa', 'endgame': '♟ Final',
        'center': '🎯 Centro', 'capture': '🔄 Captura', 'development': '📐 Desarrollo',
        'tactic': '🧠 Táctica'
    };
    return labels[theme] || theme;
}

function getDifficultyLabel(diff) {
    var labels = { 1: '⭐ Fácil', 2: '⭐⭐ Media', 3: '⭐⭐⭐ Difícil', 4: '⭐⭐⭐⭐ Experto' };
    return labels[diff] || '';
}

function startNewPuzzle() {
    var filtered = getFilteredPuzzles();
    if (filtered.length === 0) {
        showMessage('No hay problemas con estos filtros', 'info', 2500);
        return;
    }

    var unsolved = filtered.filter(function(p) {
        return puzzleHistory.indexOf(CHESS_PUZZLES.indexOf(p)) === -1;
    });
    var pool = unsolved.length > 0 ? unsolved : filtered;
    currentPuzzle = pool[Math.floor(Math.random() * pool.length)];
    puzzleMoveIndex = 0;
    puzzleActive = true;
    puzzleMode = true;

    if (trainingActive) {
        trainingActive = false;
        trainingFreeMode = false;
    }
    if (quizMode) quizMode = false;

    game = new ChessGame();
    game.loadFromFEN(currentPuzzle.fen);

    var turnColor = game.currentTurn === 'white' ? 'white' : 'black';
    playerColor = turnColor;

    lastMoveSquares = { from: null, to: null };
    bestMoveSquares = { from: null, to: null };
    selectedSquare = null;
    renderBoard();
    scrollToBoard();

    var info = document.getElementById('puzzle-info');
    info.style.display = 'block';
    document.getElementById('puzzle-title').textContent = currentPuzzle.title;
    document.getElementById('puzzle-theme-label').textContent =
        getThemeLabel(currentPuzzle.theme) + ' — ' + getDifficultyLabel(currentPuzzle.difficulty);
    document.getElementById('puzzle-instruction').textContent =
        'Juegan ' + (turnColor === 'white' ? 'BLANCAS' : 'NEGRAS') + '. Encuentra el mejor movimiento.';

    var fb = document.getElementById('puzzle-feedback');
    fb.style.display = 'none';
    fb.className = 'puzzle-feedback';

    document.getElementById('puzzle-hint').disabled = false;
    document.getElementById('puzzle-solution').disabled = false;
    document.getElementById('puzzle-skip').disabled = false;

    updateClockDisplay();
}

function puzzleUCItoCoords(uci) {
    var fromCol = uci.charCodeAt(0) - 97;
    var fromRow = 8 - parseInt(uci[1]);
    var toCol = uci.charCodeAt(2) - 97;
    var toRow = 8 - parseInt(uci[3]);
    var promo = uci.length > 4 ? uci[4] : null;
    return { fromRow: fromRow, fromCol: fromCol, toRow: toRow, toCol: toCol, promo: promo };
}

function coordsToUCI(fromRow, fromCol, toRow, toCol, promo) {
    var files = 'abcdefgh';
    var uci = files[fromCol] + (8 - fromRow) + files[toCol] + (8 - toRow);
    if (promo) uci += promo;
    return uci;
}

function handlePuzzleClick(row, col) {
    if (!puzzleActive || !currentPuzzle) return;

    var clickedPiece = game.getPiece(row, col);

    if (selectedSquare) {
        var validMoves = game.getValidMoves(selectedSquare.row, selectedSquare.col);
        var targetMove = validMoves.find(function(m) { return m.row === row && m.col === col; });

        if (targetMove) {
            var piece = game.getPiece(selectedSquare.row, selectedSquare.col);
            var isPromotion = piece && piece.type === 'pawn' && (row === 0 || row === 7);
            if (isPromotion) {
                pendingPromotionMove = {
                    fromRow: selectedSquare.row, fromCol: selectedSquare.col,
                    toRow: row, toCol: col, isPuzzle: true
                };
                selectedSquare = null;
                showPromotionDialog(piece.color);
                return;
            }
            puzzleCheckMove(selectedSquare.row, selectedSquare.col, row, col);
            return;
        } else if (clickedPiece && clickedPiece.color === game.currentTurn) {
            selectedSquare = { row: row, col: col };
            highlightValidMoves(row, col);
        } else {
            selectedSquare = null;
            renderBoard();
        }
    } else if (clickedPiece && clickedPiece.color === game.currentTurn) {
        selectedSquare = { row: row, col: col };
        highlightValidMoves(row, col);
    }
}

function puzzleCheckMove(fromRow, fromCol, toRow, toCol, promoType) {
    var playerUCI = coordsToUCI(fromRow, fromCol, toRow, toCol, promoType || null);
    var expectedUCI = currentPuzzle.solution[puzzleMoveIndex];

    if (playerUCI === expectedUCI) {
        game.makeMove(fromRow, fromCol, toRow, toCol, promoType || undefined);
        lastMoveSquares = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
        selectedSquare = null;
        puzzleMoveIndex++;

        if (puzzleMoveIndex >= currentPuzzle.solution.length) {
            puzzleSolved();
        } else {
            renderBoard();
            highlightPuzzleMove(toRow, toCol, true);
            showPuzzleFeedback('¡Correcto! Continúa...', 'correct');
            setTimeout(function() {
                puzzlePlayOpponentMove();
            }, 600);
        }
    } else {
        selectedSquare = null;
        renderBoard();
        highlightPuzzleMove(toRow, toCol, false);
        puzzleFailed();
    }
}

function puzzlePlayOpponentMove() {
    if (puzzleMoveIndex >= currentPuzzle.solution.length) return;

    var opp = currentPuzzle.solution[puzzleMoveIndex];
    var coords = puzzleUCItoCoords(opp);
    game.makeMove(coords.fromRow, coords.fromCol, coords.toRow, coords.toCol, coords.promo || undefined);
    lastMoveSquares = { from: { row: coords.fromRow, col: coords.fromCol }, to: { row: coords.toRow, col: coords.toCol } };
    puzzleMoveIndex++;

    if (puzzleMoveIndex >= currentPuzzle.solution.length) {
        puzzleSolved();
    } else {
        renderBoard();
        showPuzzleFeedback('Tu turno. Encuentra el mejor movimiento.', 'info');
    }
}

function puzzleSolved() {
    puzzleActive = false;
    puzzleStats.solved++;
    puzzleStats.streak++;
    if (puzzleStats.streak > puzzleStats.bestStreak) {
        puzzleStats.bestStreak = puzzleStats.streak;
    }
    var idx = CHESS_PUZZLES.indexOf(currentPuzzle);
    if (idx !== -1 && puzzleHistory.indexOf(idx) === -1) puzzleHistory.push(idx);
    savePuzzleStats();
    updatePuzzleStatsUI();
    renderBoard();
    showPuzzleFeedback('🎉 ¡Correcto! Problema resuelto. Racha: ' + puzzleStats.streak, 'correct');
    document.getElementById('puzzle-hint').disabled = true;
    document.getElementById('puzzle-solution').disabled = true;
    document.getElementById('puzzle-skip').textContent = '⏭ Siguiente';
}

function puzzleFailed() {
    puzzleActive = false;
    puzzleStats.failed++;
    puzzleStats.streak = 0;
    savePuzzleStats();
    updatePuzzleStatsUI();
    showPuzzleFeedback('✗ Incorrecto. La solución era: ' + formatPuzzleSolution(), 'wrong');
    showPuzzleSolutionOnBoard();
    document.getElementById('puzzle-hint').disabled = true;
    document.getElementById('puzzle-solution').disabled = true;
    document.getElementById('puzzle-skip').textContent = '⏭ Siguiente';
}

function formatPuzzleSolution() {
    var sol = currentPuzzle.solution;
    var parts = [];
    for (var i = 0; i < sol.length; i++) {
        var c = puzzleUCItoCoords(sol[i]);
        var files = 'abcdefgh';
        parts.push(files[c.fromCol] + (8 - c.fromRow) + '-' + files[c.toCol] + (8 - c.toRow));
    }
    return parts.join(', ');
}

function showPuzzleSolutionOnBoard() {
    if (!currentPuzzle) return;
    var first = currentPuzzle.solution[puzzleMoveIndex] || currentPuzzle.solution[0];
    var c = puzzleUCItoCoords(first);
    lastMoveSquares = { from: { row: c.fromRow, col: c.fromCol }, to: { row: c.toRow, col: c.toCol } };
    renderBoard();
    var squares = document.querySelectorAll('.square');
    squares.forEach(function(sq) {
        var r = parseInt(sq.dataset.row);
        var cl = parseInt(sq.dataset.col);
        if (r === c.fromRow && cl === c.fromCol) sq.classList.add('puzzle-from');
        if (r === c.toRow && cl === c.toCol) sq.classList.add('puzzle-to');
    });
}

function showPuzzleFeedback(msg, type) {
    var fb = document.getElementById('puzzle-feedback');
    fb.textContent = msg;
    fb.className = 'puzzle-feedback ' + type;
    fb.style.display = 'block';
}

function highlightPuzzleMove(row, col, correct) {
    var squares = document.querySelectorAll('.square');
    squares.forEach(function(sq) {
        var r = parseInt(sq.dataset.row);
        var c = parseInt(sq.dataset.col);
        if (r === row && c === col) {
            sq.classList.add(correct ? 'puzzle-correct-move' : 'puzzle-wrong-move');
        }
    });
}

function puzzleShowHint() {
    if (!puzzleActive || !currentPuzzle) return;
    var move = currentPuzzle.solution[puzzleMoveIndex];
    var c = puzzleUCItoCoords(move);
    renderBoard();
    var squares = document.querySelectorAll('.square');
    squares.forEach(function(sq) {
        var r = parseInt(sq.dataset.row);
        var cl = parseInt(sq.dataset.col);
        if (r === c.fromRow && cl === c.fromCol) {
            sq.classList.add('puzzle-from');
        }
    });
    showPuzzleFeedback('💡 Mueve la pieza resaltada en azul', 'info');
}

function puzzleShowSolution() {
    if (!currentPuzzle) return;
    puzzleActive = false;
    puzzleStats.failed++;
    puzzleStats.streak = 0;
    savePuzzleStats();
    updatePuzzleStatsUI();
    showPuzzleFeedback('Solución: ' + formatPuzzleSolution(), 'info');
    showPuzzleSolutionOnBoard();
    document.getElementById('puzzle-hint').disabled = true;
    document.getElementById('puzzle-solution').disabled = true;
    document.getElementById('puzzle-skip').textContent = '⏭ Siguiente';
}

function endPuzzleMode() {
    puzzleMode = false;
    puzzleActive = false;
    currentPuzzle = null;
    var info = document.getElementById('puzzle-info');
    if (info) info.style.display = 'none';
    document.getElementById('puzzle-skip').textContent = '⏭ Saltar';
}

function cancelTrainingTimeout() {
    if (trainingTimeoutId) {
        clearTimeout(trainingTimeoutId);
        trainingTimeoutId = null;
    }
}

function detectOpening() {
    const history = game.moveHistoryUCI || [];
    if (history.length === 0) return;

    if (history.length <= lastOpeningMoveCount) return;
    lastOpeningMoveCount = history.length;

    // A partir del movimiento 21 (42 half-moves), ocultar el banner
    if (history.length > 40) {
        hideOpeningBanner();
        return;
    }

    // Buscar coincidencia más larga primero
    let bestMatch = '';
    for (let len = history.length; len >= 1; len--) {
        const key = history.slice(0, len).join(' ');
        if (OPENING_NAMES[key]) {
            bestMatch = OPENING_NAMES[key];
            break;
        }
    }

    if (bestMatch && bestMatch !== currentOpeningName) {
        currentOpeningName = bestMatch;
        showOpeningName(bestMatch);
    } else if (!bestMatch && !currentOpeningName) {
        currentOpeningName = 'Variante desconocida';
        showOpeningName('Variante desconocida');
    }

    if (trainingActive) {
        const variants = getOpeningVariants(history);
        if (variants.length > 1) {
            const key = history.join(' ');
            if (trainingPaused) {
                showVariantsPopup(variants, key, (selectedVariant) => {
                    trainingResumeCallback = null;
                    continueTrainingFromVariant(selectedVariant, key);
                });
            } else {
                showVariantsPopup(variants, key);
            }
        } else {
            hideVariantsPopup(false);
        }
    }
}

function getOpeningVariants(history) {
    const currentKey = history.join(' ');
    const prefix = currentKey ? currentKey + ' ' : '';
    const variants = [];
    const seen = new Set();

    for (const key in OPENING_NAMES) {
        if (key.startsWith(prefix) && key !== currentKey) {
            const rest = key.slice(prefix.length);
            const nextMove = rest.split(' ')[0];
            if (!nextMove || seen.has(nextMove)) continue;
            seen.add(nextMove);
            const fullKey = prefix + nextMove;
            const name = OPENING_NAMES[fullKey] || OPENING_NAMES[key];
            const from = nextMove.slice(0, 2);
            const to = nextMove.slice(2, 4);
            variants.push({ move: nextMove, from, to, name, fullKey });
        }
    }
    return variants;
}

function highlightVariantSquares(v) {
    clearVariantHighlight();
    const fromCol = v.from.charCodeAt(0) - 97;
    const fromRow = 8 - parseInt(v.from[1]);
    const toCol = v.to.charCodeAt(0) - 97;
    const toRow = 8 - parseInt(v.to[1]);
    const fromSq = document.querySelector(`.square[data-row="${fromRow}"][data-col="${fromCol}"]`);
    const toSq = document.querySelector(`.square[data-row="${toRow}"][data-col="${toCol}"]`);
    if (fromSq) fromSq.classList.add('variant-highlight');
    if (toSq) toSq.classList.add('variant-highlight');
}

function clearVariantHighlight() {
    document.querySelectorAll('.variant-highlight').forEach(sq => sq.classList.remove('variant-highlight'));
}

function uciToSanCurrent(uci) {
    if (!uci || uci.length < 4) return uci;
    const PIECE_LETTERS = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: '' };
    const fromFile = uci[0], fromRank = uci[1];
    const toFile = uci[2], toRank = uci[3];
    const to = toFile + toRank;
    const promo = uci[4] ? '=' + (uci[4] === 'q' ? 'Q' : uci[4] === 'r' ? 'R' : uci[4] === 'b' ? 'B' : 'N') : '';
    if (fromFile === 'e' && toFile === 'g' && (fromRank === '1' || fromRank === '8')) return 'O-O';
    if (fromFile === 'e' && toFile === 'c' && (fromRank === '1' || fromRank === '8')) return 'O-O-O';
    if (!game) return to + promo;
    const fromCol = fromFile.charCodeAt(0) - 97;
    const fromRow = 8 - parseInt(fromRank);
    const piece = game.getPiece(fromRow, fromCol);
    if (piece) {
        const letter = PIECE_LETTERS[piece.type] || '';
        if (piece.type === 'pawn') {
            const toCol = toFile.charCodeAt(0) - 97;
            const isCapture = fromCol !== toCol;
            return (isCapture ? fromFile + 'x' : '') + to + promo;
        }
        const toCol = toFile.charCodeAt(0) - 97;
        const toRow = 8 - parseInt(toRank);
        const targetPiece = game.getPiece(toRow, toCol);
        const capture = targetPiece ? 'x' : '';
        return letter + capture + to + promo;
    }
    return to + promo;
}

function showVariantsPopup(variants, variantsKey, onSelectCallback) {
    hideVariantsPopup(false);
    if (!variants || variants.length === 0) return;

    const historyLen = variantsKey ? variantsKey.split(' ').filter(s => s).length : (game.moveHistoryUCI || []).length;
    const moveNum = Math.floor(historyLen / 2) + 1;
    const isWhiteMove = historyLen % 2 === 0;

    const popup = document.createElement('div');
    popup.id = 'variants-popup';
    popup.className = 'variants-popup';
    if (variantsKey) popup.dataset.variantsKey = variantsKey;

    const header = document.createElement('div');
    header.className = 'variants-popup-header';
    header.textContent = `📖 Variantes conocidas (${variants.length})`;
    if (onSelectCallback) {
        const hint = document.createElement('div');
        hint.className = 'variants-popup-hint';
        hint.textContent = 'Selecciona una variante para continuar';
        header.appendChild(hint);
    }
    const closeBtn = document.createElement('span');
    closeBtn.className = 'variants-popup-close';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => {
        if (onSelectCallback && trainingActive) {
            cancelTrainingTimeout();
            trainingPaused = false;
            trainingResumeCallback = null;
            hideVariantsPopup(false);
            setGameButtonsDisabled(false);
            showLoadedGameMessage('Apertura completada', false);
            showContinueButton();
        } else {
            hideVariantsPopup(true);
        }
    };
    header.appendChild(closeBtn);
    popup.appendChild(header);

    const list = document.createElement('div');
    list.className = 'variants-popup-list';

    for (const v of variants) {
        const item = document.createElement('div');
        item.className = 'variants-popup-item';
        const san = uciToSanCurrent(v.move);
        const moveLabel = isWhiteMove ? `${moveNum}.${san}` : `${moveNum}...${san}`;
        const descPart = v.name.split(' — ')[1] || v.name;
        item.innerHTML = `<span class="variant-move">${moveLabel}</span> <span class="variant-name">${descPart}</span>`;
        item.title = `${moveLabel} — ${descPart}`;
        item.addEventListener('mouseenter', () => highlightVariantSquares(v));
        item.addEventListener('mouseleave', clearVariantHighlight);
        item.addEventListener('touchstart', () => highlightVariantSquares(v), { passive: true });
        item.onclick = () => {
            clearVariantHighlight();
            hideVariantsPopup(false);
            if (onSelectCallback) {
                onSelectCallback(v);
            }
        };
        list.appendChild(item);
    }

    popup.appendChild(list);

    const boardArea = document.querySelector('.board-and-files');
    boardArea.appendChild(popup);
}

function hideVariantsPopup(resumeTraining) {
    clearVariantHighlight();
    const popup = document.getElementById('variants-popup');
    if (popup) popup.remove();
    if (resumeTraining && trainingPaused && trainingResumeCallback) {
        trainingResumeCallback();
    }
}

function getLongestLine(prefix) {
    let longest = prefix;
    for (const key in OPENING_NAMES) {
        if (key.startsWith(prefix) && key.length > longest.length) {
            longest = key;
        }
    }
    return longest;
}

function continueTrainingFromVariant(variant, fromKey) {
    cancelTrainingTimeout();
    setGameButtonsDisabled(true);
    ['resume-game', 'resume-game-sidebar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.disabled = true; el.onclick = null; }
    });

    const baseMoves = fromKey ? fromKey.split(' ') : (game.moveHistoryUCI || []);
    const currentHistory = game.moveHistoryUCI || [];

    game.gameOver = false;

    if (fromKey && currentHistory.length > baseMoves.length) {
        const targetIndex = baseMoves.length;
        while ((game.moveHistoryUCI || []).length > targetIndex && game.canUndo()) {
            game.undoMove();
        }
        currentMoveIndex = -1;
        renderBoard();
        updateCapturedPieces();
        updateMoveHistory();
        updateUndoButton();
        updateEvalBar();
    }

    const log = document.getElementById('opening-log');
    if (log && fromKey) {
        const entries = Array.from(log.querySelectorAll('.opening-entry'));
        let removing = false;
        for (const entry of entries) {
            if (removing) {
                entry.remove();
                continue;
            }
            const btn = entry.querySelector('.opening-variants-btn');
            if (btn && btn.dataset.variantsKey === fromKey) {
                removing = true;
            }
        }
    }

    trainingActive = true;
    trainingPaused = false;
    trainingResumeCallback = null;
    currentOpeningName = '';
    lastOpeningMoveCount = 0;

    const fullLine = getLongestLine(variant.fullKey);
    const allMoves = fullLine.split(' ');
    const nowHistory = game.moveHistoryUCI || [];
    const remainingMoves = allMoves.slice(nowHistory.length);

    if (remainingMoves.length === 0) {
        setGameButtonsDisabled(false);
        showLoadedGameMessage('Apertura completada', false);
        showContinueButton();
        return;
    }

    function playNextVariantMove(index) {
        if (!trainingActive || index >= remainingMoves.length || game.gameOver) {
            if (trainingActive) {
                trainingPaused = false;
                trainingResumeCallback = null;
                trainingTimeoutId = null;
                setGameButtonsDisabled(false);
                showLoadedGameMessage('Apertura completada', false);
                showContinueButton();
            }
            return;
        }

        const uci = remainingMoves[index];
        const fromCol = uci.charCodeAt(0) - 97;
        const fromRow = 8 - parseInt(uci[1]);
        const toCol = uci.charCodeAt(2) - 97;
        const toRow = 8 - parseInt(uci[3]);

        const result = game.makeMove(fromRow, fromCol, toRow, toCol);
        if (!result) {
            trainingPaused = false;
            trainingResumeCallback = null;
            trainingTimeoutId = null;
            setGameButtonsDisabled(false);
            showLoadedGameMessage('Apertura completada', false);
            showContinueButton();
            return;
        }

        lastMoveSquares = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
        renderBoard();
        updateCapturedPieces();
        updateMoveHistory();
        updateUndoButton();
        updateEvalBar();

        const history = game.moveHistoryUCI || [];
        const variantsAtPos = getOpeningVariants(history);
        if (variantsAtPos.length > 1 && index < remainingMoves.length - 1) {
            trainingPaused = true;
            trainingResumeCallback = () => {
                trainingPaused = false;
                trainingResumeCallback = null;
                trainingTimeoutId = setTimeout(() => playNextVariantMove(index + 1), 800);
            };
        }

        detectOpening();

        if (!trainingPaused) {
            trainingTimeoutId = setTimeout(() => playNextVariantMove(index + 1), 1200);
        }
    }

    trainingTimeoutId = setTimeout(() => playNextVariantMove(0), 600);
}

function showOpeningName(name) {
    let log = document.getElementById('opening-log');
    if (!log) {
        log = document.createElement('div');
        log.id = 'opening-log';
        log.className = 'opening-log';
        const boardContainer = document.querySelector('.board-container');
        boardContainer.insertBefore(log, boardContainer.firstChild);
    }

    // Marcar todos los anteriores como "old"
    log.querySelectorAll('.opening-entry').forEach(e => {
        e.classList.add('old');
        e.querySelector('.opening-banner').classList.remove('opening-fade-in');
    });

    const entryCount = log.querySelectorAll('.opening-entry').length;
    const depth = Math.floor(entryCount / 2);

    const wrapper = document.createElement('div');
    wrapper.className = 'opening-entry opening-fade-in';

    if (depth > 0) {
        const branch = document.createElement('span');
        branch.className = 'opening-branch';
        branch.textContent = '  '.repeat(depth - 1) + ' └ ';
        wrapper.appendChild(branch);
    }

    const banner = document.createElement('div');
    banner.className = 'opening-banner';
    banner.textContent = name;
    wrapper.appendChild(banner);

    const history = game.moveHistoryUCI || [];
    const variants = trainingActive ? getOpeningVariants(history) : getOpeningVariants(history);
    const entryKey = history.join(' ');
    wrapper.dataset.variantsKey = entryKey;

    const showEntryVariants = (e) => {
        e.stopPropagation();
        const existing = document.getElementById('variants-popup');
        if (existing && existing.dataset.variantsKey === entryKey) {
            hideVariantsPopup(true);
            return;
        }
        hideVariantsPopup(false);
        const btnMoves = entryKey ? entryKey.split(' ') : [];
        const freshVariants = getOpeningVariants(btnMoves);
        if (freshVariants.length === 0) return;
        if (trainingActive) {
            cancelTrainingTimeout();
            trainingPaused = true;
            trainingResumeCallback = null;
            showVariantsPopup(freshVariants, entryKey, (selectedVariant) => {
                continueTrainingFromVariant(selectedVariant, entryKey);
            });
        } else {
            showVariantsPopup(freshVariants, entryKey);
        }
    };

    wrapper.style.cursor = 'pointer';
    wrapper.onclick = showEntryVariants;

    if (variants.length > 0) {
        const varBtn = document.createElement('button');
        varBtn.className = 'opening-variants-btn';
        varBtn.textContent = `⤵ ${variants.length}`;
        varBtn.title = `Ver ${variants.length} variantes`;
        varBtn.dataset.variantsKey = entryKey;
        varBtn.onclick = showEntryVariants;
        wrapper.appendChild(varBtn);
    }

    log.appendChild(wrapper);
    log.style.display = 'flex';
}

function recalcOpening() {
    const history = game.moveHistoryUCI || [];
    lastOpeningMoveCount = history.length;

    // Limpiar log existente
    const log = document.getElementById('opening-log');
    if (log) log.remove();

    if (history.length === 0) {
        currentOpeningName = '';
        return;
    }

    if (history.length > 40) {
        return;
    }

    // Reconstruir todo el historial de aperturas detectadas
    let prevName = '';
    for (let i = 1; i <= history.length; i++) {
        let bestMatch = '';
        for (let len = i; len >= 1; len--) {
            const key = history.slice(0, len).join(' ');
            if (OPENING_NAMES[key]) {
                bestMatch = OPENING_NAMES[key];
                break;
            }
        }
        const name = bestMatch || (prevName ? '' : 'Variante desconocida');
        if (name && name !== prevName) {
            showOpeningName(name);
            prevName = name;
        }
    }
    currentOpeningName = prevName || 'Variante desconocida';
}

function hideOpeningBanner() {
    hideVariantsPopup(false);
    const log = document.getElementById('opening-log');
    if (log && log.style.display !== 'none') {
        log.querySelectorAll('.opening-entry').forEach(e => {
            e.classList.remove('opening-fade-in');
            e.classList.add('opening-fade-out');
        });
        setTimeout(() => { log.style.display = 'none'; }, 600);
    }
}

function getOpeningBookMove() {
    const moveCount = (game.moveHistoryUCI || []).length;
    if (moveCount > 20) return null;

    const history = game.moveHistoryUCI || [];

    // Primer movimiento como blancas
    if (moveCount === 0 && game.currentTurn === 'white') {
        const moves = OPENING_BOOK['start_white'];
        return moves[Math.floor(Math.random() * moves.length)];
    }

    // Buscar la posición actual en el libro (de más específica a menos)
    const keys = [];
    if (moveCount >= 3) keys.push(history.slice(0, 3).join(' '));
    if (moveCount >= 2) keys.push(history.slice(0, 2).join(' '));
    if (moveCount >= 1) keys.push(history[history.length - 1]);

    for (const key of keys) {
        if (OPENING_BOOK[key]) {
            const candidates = OPENING_BOOK[key];
            // Mezclar candidatos para elegir aleatoriamente
            const shuffled = [...candidates].sort(() => Math.random() - 0.5);

            for (const move of shuffled) {
                const allMoves = getAllPossibleMoves(game.currentTurn);
                if (allMoves.some(m => m.uci === move)) {
                    console.log(`Libro de aperturas: ${move} (de ${candidates.length} opciones)`);
                    return move;
                }
            }
        }
    }

    return null;
}

// Función para obtener el mejor movimiento (libro + Stockfish API + fallback local)
async function getStockfishBestMove() {
    console.log('Motor de ajedrez - Nivel:', aiDifficulty);

    // Intentar libro de aperturas primero (variedad)
    const bookMove = getOpeningBookMove();
    if (bookMove) {
        return bookMove;
    }
    
    // Intentar usar Stockfish API (niveles 5+: Avanzado y superiores)
    if (aiDifficulty >= 5) {
        try {
            return await getStockfishAPIMove();
        } catch (error) {
            console.warn('Stockfish API falló, usando motor local:', error);
    return await getLocalBestMove();
        }
    }
    
    // Usar motor local para niveles más bajos (más rápido)
    return await getLocalBestMove();
}

// Obtener movimiento desde motor público (stockfish.online → chess-api.com fallback)
async function getStockfishAPIMove() {
    const fen = game.toFEN();

    const API_LEVELS = {
        5: { depth: 1  },   // ~1500 ELO
        6: { depth: 3  },   // ~1800 ELO
        7: { depth: 8  },   // ~2200 ELO
        8: { depth: 15 }    // ~2500 ELO
    };
    const params = API_LEVELS[aiDifficulty] || { depth: 15 };

    try {
        const result = await analyzeWithStockfishOnline(fen, params.depth);
        console.log('stockfish.online movimiento:', result.move, 'Eval:', result.eval);
        return result.move;
    } catch (e) {
        console.warn('stockfish.online falló, usando chess-api.com:', e.message);
    }

    const response = await fetch('https://chess-api.com/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen, depth: params.depth, maxThinkingTime: 100 })
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();
    if (!data.move) throw new Error('No se recibió movimiento de la API');
    console.log('chess-api.com movimiento:', data.move, 'Eval:', data.eval);
    return data.move;
}

// Analizar posición con motor público (stockfish.online → chess-api.com fallback)
async function analyzePosition(fen, depth = 12) {
    try {
        return await analyzeWithStockfishOnline(fen, Math.min(depth, 15));
    } catch (e) {
        console.warn('stockfish.online falló, usando chess-api.com:', e.message);
        return await analyzeWithChessAPI(fen, depth);
    }
}

async function analyzeWithStockfishOnline(fen, depth = 12) {
    const url = `https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(fen)}&depth=${depth}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`stockfish.online HTTP ${response.status}`);
    const data = await response.json();
    if (!data.success) throw new Error('stockfish.online: request failed');
    const moveMatch = (data.bestmove || '').match(/^bestmove\s+(\S+)/);
    if (!moveMatch) throw new Error('stockfish.online: no bestmove');
    let evalValue = parseFloat(data.evaluation) || 0;
    if (data.mate !== null && data.mate !== undefined) {
        evalValue = data.mate > 0 ? 999 : -999;
    }
    return { move: moveMatch[1], eval: evalValue };
}

async function analyzeWithChessAPI(fen, depth = 12) {
    const response = await fetch('https://chess-api.com/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen, depth, maxThinkingTime: 100 })
    });
    if (!response.ok) throw new Error(`chess-api.com HTTP ${response.status}`);
    const data = await response.json();
    if (data.type === 'error') throw new Error(data.text || data.error || 'API error');
    return data;
}

function setAnalysisModeActive(active) {
    analysisActive = active;
    ANALYSIS_DISABLED_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (active) {
            el.classList.add('analysis-locked');
            el.disabled = true;
        } else {
            el.classList.remove('analysis-locked');
            el.disabled = false;
        }
    });
    if (!active) {
        updateUndoButton();
        checkForGameInProgress();
        onFamousGameSelect();
    }
}

// Actualizar etiqueta de la barra de errores: número, movimiento error, movimiento recomendado
function updateAnalysisNavLabel(item) {
    const navLabel = document.getElementById('analysis-nav-label');
    if (!navLabel || !item) return;
    const errorSan = item.san || uciToSan(item.playerMove, item.moveIndex);
    const bestSan = uciToSan(item.bestMove, item.moveIndex);
    const lossLabel = item.type === 'blunder' ? 'Error' : 'Imprecisión';
    navLabel.textContent = `${lossLabel}  ${item.moveNum}${item.moveSuffix || ''} ${errorSan} → ${bestSan}`;
    navLabel.classList.remove('blunder', 'imprecision');
    navLabel.classList.add(item.type === 'blunder' ? 'blunder' : 'imprecision');
}

// UCI a notación algebraica con pieza (ej: "e2e4" → "e4", "g1f3" → "Nf3")
function uciToSan(uci, stateIndex) {
    if (!uci || uci.length < 4) return uci;
    const PIECE_LETTERS = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: '' };
    const fromFile = uci[0], fromRank = uci[1];
    const toFile = uci[2], toRank = uci[3];
    const to = toFile + toRank;
    const promo = uci[4] ? '=' + (uci[4] === 'q' ? 'Q' : uci[4] === 'r' ? 'R' : uci[4] === 'b' ? 'B' : 'N') : '';

    // Enroque
    if (fromFile === 'e' && toFile === 'g' && (fromRank === '1' || fromRank === '8')) return 'O-O';
    if (fromFile === 'e' && toFile === 'c' && (fromRank === '1' || fromRank === '8')) return 'O-O-O';

    // Intentar obtener la pieza del estado del tablero
    if (game && game.gameStateHistory && stateIndex !== undefined) {
        const state = game.gameStateHistory[stateIndex];
        if (state) {
            const fromCol = fromFile.charCodeAt(0) - 97;
            const fromRow = 8 - parseInt(fromRank);
            const piece = state.board[fromRow] && state.board[fromRow][fromCol];
            if (piece) {
                const letter = PIECE_LETTERS[piece.type] || '';
                if (piece.type === 'pawn') {
                    const toCol = toFile.charCodeAt(0) - 97;
                    const isCapture = fromCol !== toCol;
                    return (isCapture ? fromFile + 'x' : '') + to + promo;
                }
                return letter + to + promo;
            }
        }
    }
    return to + promo;
}

// Análisis post-partida: errores, imprecisiones y mejores movimientos
async function analyzeGamePostGame() {
    if (!game || !game.gameStateHistory || game.gameStateHistory.length === 0) {
        showMessage('No hay partida para analizar', 'warning', 2000);
        return;
    }
    const uciMoves = game.moveHistoryUCI || [];
    if (uciMoves.length === 0) {
        showMessage('No hay movimientos para analizar', 'warning', 2000);
        return;
    }

    // Si ya existe un análisis previo, mostrarlo directamente
    if (analysisErrorsList && analysisErrorsList.length > 0) {
        scrollToBoard();
        const blunders = analysisErrorsList.filter(e => e.type === 'blunder').length;
        const mistakes = analysisErrorsList.filter(e => e.type === 'mistake').length;
        showAnalysisResults(analysisErrorsList, uciMoves.length, uciMoves.length, blunders, mistakes);
        showMessage('📊 Mostrando análisis existente', 'info', 2000);
        return;
    }

    // Pedir confirmación antes de analizar online
    const confirmed = await new Promise(resolve => {
        const msg = `<strong>Iniciar Análisis de Partida</strong><br><span style="font-size:0.9em;color:#555;">Se analizarán ${uciMoves.length} movimientos online.<br>Esto puede tardar unos segundos.</span>`;
        showMessage(msg, 'info', 0);
        const overlay2 = document.getElementById('message-overlay');
        if (overlay2) {
            const msgBox = overlay2.querySelector('.message-box');
            if (msgBox) {
                const existingClose = msgBox.querySelector('.message-close-btn');
                if (existingClose) existingClose.remove();
                const btnRow = document.createElement('div');
                btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;margin-top:14px;';
                const acceptBtn = document.createElement('button');
                acceptBtn.style.cssText = 'padding:9px 28px;background:#667eea;color:#fff;border:none;border-radius:6px;font-size:0.95rem;font-weight:600;cursor:pointer;';
                acceptBtn.textContent = 'Aceptar';
                acceptBtn.onclick = () => { hideMessage(); resolve(true); };
                const cancelBtn = document.createElement('button');
                cancelBtn.style.cssText = 'padding:9px 28px;background:#e5e7eb;color:#374151;border:none;border-radius:6px;font-size:0.95rem;font-weight:600;cursor:pointer;';
                cancelBtn.textContent = 'Cancelar';
                cancelBtn.onclick = () => { hideMessage(); resolve(false); };
                btnRow.appendChild(acceptBtn);
                btnRow.appendChild(cancelBtn);
                msgBox.appendChild(btnRow);
            }
            overlay2.onclick = (e) => { if (e.target === overlay2) { hideMessage(); resolve(false); } };
        }
    });
    if (!confirmed) return;

    scrollToBoard();

    const overlay = document.getElementById('analysis-overlay');
    const loading = document.getElementById('analysis-loading');
    const content = document.getElementById('analysis-content');
    const summary = document.getElementById('analysis-summary');
    const mistakes = document.getElementById('analysis-mistakes');

    const total = uciMoves.length;

    setAnalysisModeActive(true);
    overlay.style.display = 'flex';
    overlay.classList.add('analysis-loading-mode');
    loading.style.display = 'block';
    content.style.display = 'none';
    loading.textContent = `Movimientos analizados: 0 / ${total}`;

    const errors = []; // blunder > 2
    const mistakesList = []; // mistake 0.5-2

    let analyzed = 0;
    let apiErrors = 0;

    for (let i = 0; i < uciMoves.length; i++) {
        const turn = i % 2 === 0 ? 'white' : 'black';
        const moveNum = Math.floor(i / 2) + 1;
        const moveSuffix = turn === 'white' ? '' : '...';
        const playerMove = uciMoves[i];

        try {
            const stateBefore = game.gameStateHistory[i];
            if (!stateBefore) { apiErrors++; continue; }
            const fullMove = Math.floor(i / 2) + 1;
            const fenBefore = ChessGame.stateToFEN(stateBefore, fullMove);

            const analysisBefore = await analyzePosition(fenBefore, 10);
            const bestMove = (analysisBefore.move || '').toLowerCase();

            if (bestMove && playerMove.toLowerCase() !== bestMove) {
                const stateAfter = i + 1 < game.gameStateHistory.length ? game.gameStateHistory[i + 1] : null;
                const fenAfter = stateAfter ? ChessGame.stateToFEN(stateAfter, fullMove) : game.toFEN();
                const analysisAfter = await analyzePosition(fenAfter, 10);

                const evalBest = parseFloat(analysisBefore.eval) || 0;
                const evalPlayer = parseFloat(analysisAfter.eval) || 0;
                const loss = turn === 'white' ? evalBest - evalPlayer : evalPlayer - evalBest;

                if (loss >= 2) {
                    errors.push({ moveNum, moveSuffix, playerMove, bestMove, loss, san: game.moveHistory[i], moveIndex: i });
                } else if (loss >= 0.5) {
                    mistakesList.push({ moveNum, moveSuffix, playerMove, bestMove, loss, san: game.moveHistory[i], moveIndex: i });
                }
            }

            analyzed++;
            loading.textContent = `Movimientos analizados: ${analyzed} / ${total}`;
            await new Promise(r => setTimeout(r, 500));
        } catch (e) {
            apiErrors++;
            console.warn('Error analizando movimiento', i, e);
            if (apiErrors >= 3) {
                if (analyzed === 0) {
                    showAnalysisError();
                    return;
                }
                const moveLabel = `${moveNum}${moveSuffix || ''}`;
                await showAnalysisErrorPartial(`Análisis OK hasta movimiento ${moveLabel}`);
                break;
            }
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    const all = [...errors.map(e => ({ ...e, type: 'blunder' })), ...mistakesList.map(m => ({ ...m, type: 'mistake' }))].sort((a, b) => a.moveNum - b.moveNum || (a.moveSuffix ? 1 : -1));

    showAnalysisResults(all, total, analyzed, errors.length, mistakesList.length);
}

function showAnalysisResults(all, total, analyzed, blunderCount, mistakeCount) {
    const overlay = document.getElementById('analysis-overlay');
    const loading = document.getElementById('analysis-loading');
    const content = document.getElementById('analysis-content');
    const summary = document.getElementById('analysis-summary');
    const mistakes = document.getElementById('analysis-mistakes');

    setAnalysisModeActive(true);
    overlay.style.display = 'flex';
    overlay.classList.remove('analysis-loading-mode');
    loading.style.display = 'none';
    content.style.display = 'block';

    let summaryHtml = '';
    if (analyzed === 0) {
        summaryHtml = '<div style="color:#ef4444; font-weight:600; margin-bottom:8px;">No se pudieron analizar los movimientos.</div>';
        summaryHtml += '<div style="font-size:0.9rem; color:#666;">El servidor de análisis no está disponible. Inténtalo más tarde.</div>';
    } else {
        summaryHtml = `<div style="margin-bottom: 8px;"><strong>Resumen</strong> <span style="color:#888; font-size:0.85rem;">(${analyzed}/${total} analizados)</span></div>`;
        summaryHtml += `<div style="color:#dc2626;">• Errores graves: ${blunderCount}</div>`;
        summaryHtml += `<div style="color:#ea580c;">• Imprecisiones: ${mistakeCount}</div>`;

        if (blunderCount === 0 && mistakeCount === 0) {
            summaryHtml += '<div style="margin-top: 10px; color: #059669; font-weight: 600;">¡Partida sin errores significativos!</div>';
        }
    }

    summary.innerHTML = summaryHtml;

    analysisErrorsList = all;
    analysisErrorsCurrentIndex = 0;
    const navBar = document.getElementById('analysis-errors-nav');
    const navPrev = document.getElementById('analysis-nav-prev');
    const navNext = document.getElementById('analysis-nav-next');
    if (all.length > 0 && navBar) {
        navBar.style.display = 'flex';
        updateAnalysisNavLabel(all[0]);
        if (navPrev) navPrev.disabled = true;
        if (navNext) navNext.disabled = all.length <= 1;
    } else if (navBar) {
        navBar.style.display = 'none';
    }

    mistakes.innerHTML = all.map(item => {
        const bestSan = uciToSan(item.bestMove, item.moveIndex);
        return `<div class="analysis-move ${item.type}" data-move-index="${item.moveIndex}" data-uci="${item.playerMove}" title="Clic para ver en el tablero">
            <span class="move-num">${item.moveNum}${item.moveSuffix}</span>
            <span class="move-text">${item.san || item.playerMove} → Mejor: ${bestSan}</span>
            <span class="best-move">${item.loss.toFixed(1)}</span>
        </div>`;
    }).join('') || '<p style="color:#059669;">No se detectaron errores en la partida.</p>';

    mistakes.querySelectorAll('.analysis-move[data-move-index]').forEach((el, idx) => {
        const moveIdx = parseInt(el.dataset.moveIndex);
        const uci = el.dataset.uci;
        if (moveIdx >= 0 && uci) {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => {
                analysisErrorsCurrentIndex = idx;
                updateAnalysisNavLabel(analysisErrorsList[idx]);
                const navPrev = document.getElementById('analysis-nav-prev');
                const navNext = document.getElementById('analysis-nav-next');
                if (navPrev) navPrev.disabled = idx === 0;
                if (navNext) navNext.disabled = idx === analysisErrorsList.length - 1;
                showAnalysisPositionOnBoard(moveIdx, uci);
            });
        }
    });

    document.getElementById('analysis-close').onclick = () => {
        overlay.style.display = 'none';
        if (analysisErrorsList.length > 0) {
            showAnalysisPositionOnBoard(analysisErrorsList[0].moveIndex, analysisErrorsList[0].playerMove);
            var bc = document.querySelector('.board-container'); if (bc) bc.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            document.getElementById('analysis-errors-nav').style.display = 'none';
            clearAnalysisHighlight();
            setAnalysisModeActive(false);
        }
    };
}

function goToAnalysisError(delta) {
    if (!analysisErrorsList.length) return;
    const newIdx = analysisErrorsCurrentIndex + delta;
    if (newIdx < 0 || newIdx >= analysisErrorsList.length) return;
    analysisErrorsCurrentIndex = newIdx;
    const item = analysisErrorsList[newIdx];
    updateAnalysisNavLabel(item);
    const navPrev = document.getElementById('analysis-nav-prev');
    const navNext = document.getElementById('analysis-nav-next');
    if (navPrev) navPrev.disabled = newIdx === 0;
    if (navNext) navNext.disabled = newIdx === analysisErrorsList.length - 1;
    showAnalysisPositionOnBoard(item.moveIndex, item.playerMove);
}

function showAnalysisPositionOnBoard(moveIndex, uciMove) {
    if (!game || !game.gameStateHistory) return;
    const overlay = document.getElementById('analysis-overlay');
    if (overlay) overlay.style.display = 'none';

    restoreGameState(moveIndex);
    currentMoveIndex = moveIndex;
    updateMoveHistory();
    updateNavigationButtons();
    updateCapturedPieces();
    updateEvalBar();

    const move = parseUCIMove(uciMove);
    if (move) {
        lastMoveSquares = { from: { row: move.fromRow, col: move.fromCol }, to: { row: move.toRow, col: move.toCol } };
        const item = analysisErrorsList.find(a => a.moveIndex === moveIndex);
        const bestMove = item ? parseUCIMove(item.bestMove) : null;
        bestMoveSquares = bestMove ? { from: { row: bestMove.fromRow, col: bestMove.fromCol }, to: { row: bestMove.toRow, col: bestMove.toCol } } : { from: null, to: null };
        renderBoard();
        var bc2 = document.querySelector('.board-container'); if (bc2) bc2.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function clearAnalysisHighlight() {
    lastMoveSquares = { from: null, to: null };
    bestMoveSquares = { from: null, to: null };
    if (game) renderBoard();
}

function showAnalysisErrorPartial(message) {
    return new Promise(resolve => {
        const overlay = document.getElementById('analysis-overlay');
        const loading = document.getElementById('analysis-loading');
        if (loading) loading.textContent = message;
        const okBtn = document.createElement('button');
        okBtn.className = 'btn btn-primary';
        okBtn.textContent = 'OK';
        okBtn.style.cssText = 'margin-top:12px;min-width:80px;';
        okBtn.addEventListener('click', () => { okBtn.remove(); resolve(); });
        if (overlay) {
            const modal = overlay.querySelector('.analysis-modal');
            if (modal) modal.appendChild(okBtn);
        }
    });
}

function showAnalysisError() {
    setAnalysisModeActive(false);
    const overlay = document.getElementById('analysis-overlay');
    if (overlay) overlay.classList.remove('analysis-loading-mode');
    const loading = document.getElementById('analysis-loading');
    const content = document.getElementById('analysis-content');
    const summary = document.getElementById('analysis-summary');
    const mistakes = document.getElementById('analysis-mistakes');
    const navBar = document.getElementById('analysis-errors-nav');
    if (navBar) navBar.style.display = 'none';
    if (overlay && loading && content && summary) {
        loading.style.display = 'none';
        content.style.display = 'block';
        summary.innerHTML = '<p style="color:#ef4444;">No se pudo conectar con el servidor de análisis. Comprueba tu conexión e inténtalo de nuevo.</p>';
        if (mistakes) mistakes.innerHTML = '';
        const closeBtn = document.getElementById('analysis-close');
        if (closeBtn) closeBtn.onclick = () => { overlay.style.display = 'none'; };
    }
}

// Convertir estado del juego a notación FEN (DEPRECADO - usar game.toFEN())
function gameToFEN() {
    return game.toFEN();
}

// Valores de las piezas
const PIECE_VALUES = {
    'pawn': 100,
    'knight': 320,
    'bishop': 330,
    'rook': 500,
    'queen': 900,
    'king': 20000
};

// Tablas de posición para peones (bonifica posiciones centrales y avanzadas)
const PAWN_TABLE = [
    [0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5,  5, 10, 25, 25, 10,  5,  5],
    [0,  0,  0, 20, 20,  0,  0,  0],
    [5, -5,-10,  0,  0,-10, -5,  5],
    [5, 10, 10,-20,-20, 10, 10,  5],
    [0,  0,  0,  0,  0,  0,  0,  0]
];

// Tabla para caballos (bonifica el centro)
const KNIGHT_TABLE = [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
];

// Tabla para alfiles (bonifica diagonales largas)
const BISHOP_TABLE = [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
];

// Tabla para torres (bonifica filas 7 y columnas abiertas)
const ROOK_TABLE = [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0]
];

// Tabla para la reina (bonifica control central)
const QUEEN_TABLE = [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20]
];

// Tabla para el rey en medio juego (bonifica enroque)
const KING_MIDDLE_TABLE = [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20]
];

const KING_END_TABLE = [
    [-50,-40,-30,-20,-20,-30,-40,-50],
    [-30,-20,-10,  0,  0,-10,-20,-30],
    [-30,-10, 20, 30, 30, 20,-10,-30],
    [-30,-10, 30, 40, 40, 30,-10,-30],
    [-30,-10, 30, 40, 40, 30,-10,-30],
    [-30,-10, 20, 30, 30, 20,-10,-30],
    [-30,-30,  0,  0,  0,  0,-30,-30],
    [-50,-30,-30,-30,-30,-30,-30,-50]
];

// Análisis local mejorado (fallback)
async function getLocalBestMove() {
    console.log('Usando análisis local mejorado - Nivel:', aiDifficulty);
    
    // Obtener todos los movimientos válidos
    const allMoves = getAllPossibleMoves(game.currentTurn);
    
    if (allMoves.length === 0) {
        throw new Error('No hay movimientos válidos');
    }
    
    // Determinar profundidad de búsqueda según nivel
    let depth = 1;
    let useFullEval = true;
    let randomnessFactor = 0;
    
    let useQuiescence = false;

    if (aiDifficulty <= 1) {
        // ~400 ELO: captura piezas a veces, muchos errores graves
        depth = 1;
        useFullEval = false;
        randomnessFactor = 0.7;
    } else if (aiDifficulty <= 2) {
        // ~700 ELO: evalúa material, errores frecuentes
        depth = 1;
        useFullEval = true;
        randomnessFactor = 0.4;
    } else if (aiDifficulty <= 3) {
        // ~1000 ELO: táctica básica a 2 jugadas
        depth = 2;
        useFullEval = true;
        randomnessFactor = 0.15;
    } else {
        // ~1200 ELO: tácticas sólidas con búsqueda de capturas
        depth = 3;
        useFullEval = true;
        useQuiescence = true;
        randomnessFactor = 0.05;
    }
    
    console.log(`Evaluando con profundidad ${depth}, aleatoriedad ${randomnessFactor}`);
    
    // Evaluar movimientos (con límite de tiempo implícito)
    let bestMove = null;
    let bestScore = -Infinity;
    
    // Ordenar movimientos: primero capturas para evaluación más rápida
    allMoves.sort((a, b) => {
        const captureA = game.getPiece(a.toRow, a.toCol) ? PIECE_VALUES[game.getPiece(a.toRow, a.toCol).type] || 0 : 0;
        const captureB = game.getPiece(b.toRow, b.toCol) ? PIECE_VALUES[game.getPiece(b.toRow, b.toCol).type] || 0 : 0;
        return captureB - captureA;
    });
    
    // Limitar movimientos evaluados en niveles bajos/medios
    const maxMovesToEvaluate = depth >= 4 ? 15 : (depth >= 3 ? 20 : (depth >= 2 ? 30 : allMoves.length));
    const movesToEvaluate = allMoves.slice(0, Math.min(allMoves.length, maxMovesToEvaluate));
    
    for (const move of movesToEvaluate) {
        let score;
        
        if (depth > 1) {
            score = evaluateMoveWithMinimax(move, depth, game.currentTurn, useQuiescence);
        } else if (useFullEval) {
            score = evaluateMoveSimple(move, true);
        } else {
            score = evaluateMoveSimple(move, false);
        }
        
        // Añadir aleatoriedad según nivel
        if (randomnessFactor > 0) {
            score += (Math.random() - 0.5) * randomnessFactor * 200;
        }
        
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    
    console.log(`Mejor movimiento encontrado con score: ${bestScore}`);
    return bestMove.uci;
}

// Obtener todos los movimientos posibles para un color
function getAllPossibleMoves(color) {
    const allMoves = [];
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = game.getPiece(row, col);
            if (piece && piece.color === color) {
                const validMoves = game.getValidMoves(row, col);
                validMoves.forEach(move => {
                    allMoves.push({
                        fromRow: row,
                        fromCol: col,
                        toRow: move.row,
                        toCol: move.col,
                        piece: piece,
                        uci: moveToUCI(row, col, move.row, move.col)
                    });
                });
            }
        }
    }
    
    return allMoves;
}

function evaluateMoveSimple(move, useFullEval) {
    let score = 0;
    
    const capturedPiece = game.getPiece(move.toRow, move.toCol);
    if (capturedPiece) {
        // MVV-LVA: prefer capturing high-value pieces with low-value pieces
        score += (PIECE_VALUES[capturedPiece.type] || 0) * 10 - (PIECE_VALUES[move.piece.type] || 0);
    }

    // Position improvement via PST delta
    const fromBonus = getPositionBonus(move.piece.type, move.fromRow, move.fromCol, move.piece.color);
    const toBonus = getPositionBonus(move.piece.type, move.toRow, move.toCol, move.piece.color);
    score += (toBonus - fromBonus);
    
    if (useFullEval) {
        const center = [[3,3], [3,4], [4,3], [4,4]];
        const extCenter = [[2,2],[2,3],[2,4],[2,5],[3,2],[3,5],[4,2],[4,5],[5,2],[5,3],[5,4],[5,5]];
        if (center.some(([r,c]) => r === move.toRow && c === move.toCol)) score += 30;
        else if (extCenter.some(([r,c]) => r === move.toRow && c === move.toCol)) score += 12;
        
        const isBackRank = (move.fromRow === 0 || move.fromRow === 7);
        if (isBackRank && move.piece.type !== 'pawn' && move.piece.type !== 'king') score += 15;

        // Castling bonus
        if (move.piece.type === 'king' && Math.abs(move.toCol - move.fromCol) === 2) score += 60;

        // Pawn promotion
        if (move.piece.type === 'pawn' && (move.toRow === 0 || move.toRow === 7)) score += 800;

        // Avoid moving queen early
        if (move.piece.type === 'queen' && game.moveHistory && game.moveHistory.length < 10) {
            if (isBackRank) score -= 20;
        }
    }
    
    return score;
}

// Minimax con evaluación de posición (optimizado)
function evaluateMoveWithMinimax(move, depth, maximizingColor, useQuiescence) {
    const savedBoard = game.board.map(row => [...row]);
    const savedTurn = game.currentTurn;
    const savedCaptured = {
        white: [...game.capturedPieces.white],
        black: [...game.capturedPieces.black]
    };
    const savedEnPassant = game.enPassantTarget ? { ...game.enPassantTarget } : null;
    const savedCastling = JSON.parse(JSON.stringify(game.castlingRights));
    
    simulateMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
    
    let score;
    if (depth <= 1) {
        score = useQuiescence ? quiescence(-Infinity, Infinity, maximizingColor, 4) : evaluatePosition(maximizingColor);
    } else {
        score = minimax(depth - 1, -Infinity, Infinity, false, maximizingColor, useQuiescence);
    }
    
    game.board = savedBoard;
    game.currentTurn = savedTurn;
    game.capturedPieces = savedCaptured;
    game.enPassantTarget = savedEnPassant;
    game.castlingRights = savedCastling;
    
    return score;
}

function simulateMove(fromRow, fromCol, toRow, toCol) {
    const piece = game.board[fromRow][fromCol];
    const capturedPiece = game.board[toRow][toCol];
    const color = game.currentTurn;
    
    if (capturedPiece) {
        game.capturedPieces[color].push(capturedPiece.piece);
    }

    // En passant
    if (piece && piece.type === 'pawn' && game.enPassantTarget &&
        toRow === game.enPassantTarget.row && toCol === game.enPassantTarget.col) {
        const epRow = color === 'white' ? toRow + 1 : toRow - 1;
        const epPiece = game.board[epRow][toCol];
        if (epPiece) game.capturedPieces[color].push(epPiece.piece);
        game.board[epRow][toCol] = null;
    }

    // Update en passant target
    if (piece && piece.type === 'pawn' && Math.abs(toRow - fromRow) === 2) {
        game.enPassantTarget = { row: (fromRow + toRow) / 2, col: fromCol };
    } else {
        game.enPassantTarget = null;
    }

    // Castling
    if (piece && piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
        if (toCol === 6) {
            game.board[fromRow][5] = game.board[fromRow][7];
            game.board[fromRow][7] = null;
        } else if (toCol === 2) {
            game.board[fromRow][3] = game.board[fromRow][0];
            game.board[fromRow][0] = null;
        }
    }

    game.board[toRow][toCol] = piece;
    game.board[fromRow][fromCol] = null;
    
    // Promotion (always queen for AI simulation)
    if (piece && piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
        game.board[toRow][toCol] = { type: 'queen', color: piece.color, piece: `${piece.color === 'white' ? 'w' : 'b'}Q` };
    }

    // Update castling rights
    if (piece && piece.type === 'king') {
        if (game.castlingRights[color]) {
            game.castlingRights[color].kingSide = false;
            game.castlingRights[color].queenSide = false;
        }
    }
    if (piece && piece.type === 'rook') {
        if (game.castlingRights[color]) {
            if (fromCol === 7) game.castlingRights[color].kingSide = false;
            if (fromCol === 0) game.castlingRights[color].queenSide = false;
        }
    }

    game.currentTurn = color === 'white' ? 'black' : 'white';
}

// Algoritmo Minimax con poda alpha-beta (optimizado)
function quiescence(alpha, beta, maximizingColor, maxDepth) {
    const standPat = evaluatePosition(maximizingColor);
    if (maxDepth <= 0) return standPat;

    const currentColor = game.currentTurn;
    const isMaximizing = (currentColor === maximizingColor);

    if (isMaximizing) {
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;
    } else {
        if (standPat <= alpha) return alpha;
        if (standPat < beta) beta = standPat;
    }

    const moves = getAllPossibleMoves(currentColor);
    const captures = moves.filter(m => game.getPiece(m.toRow, m.toCol) !== null);
    if (captures.length === 0) return standPat;

    captures.sort((a, b) => {
        var pa = game.getPiece(a.toRow, a.toCol), pb = game.getPiece(b.toRow, b.toCol);
        const va = PIECE_VALUES[pa ? pa.type : ''] || 0;
        const vb = PIECE_VALUES[pb ? pb.type : ''] || 0;
        return vb - va;
    });

    for (const move of captures) {
        const sb = game.board.map(r => [...r]);
        const st = game.currentTurn;
        const sc = { white: [...game.capturedPieces.white], black: [...game.capturedPieces.black] };
        const se = game.enPassantTarget ? { ...game.enPassantTarget } : null;
        const sk = JSON.parse(JSON.stringify(game.castlingRights));

        simulateMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
        const score = quiescence(alpha, beta, maximizingColor, maxDepth - 1);

        game.board = sb; game.currentTurn = st;
        game.capturedPieces = sc; game.enPassantTarget = se; game.castlingRights = sk;

        if (isMaximizing) {
            if (score > alpha) alpha = score;
            if (alpha >= beta) return beta;
        } else {
            if (score < beta) beta = score;
            if (alpha >= beta) return alpha;
        }
    }

    return isMaximizing ? alpha : beta;
}

function minimax(depth, alpha, beta, isMaximizing, maximizingColor, useQuiescence) {
    if (depth === 0) {
        return useQuiescence ? quiescence(alpha, beta, maximizingColor, 4) : evaluatePosition(maximizingColor);
    }
    
    const currentColor = game.currentTurn;
    const moves = getAllPossibleMoves(currentColor);
    
    if (moves.length === 0) {
        if (game.isInCheck(currentColor)) {
            return isMaximizing ? (-100000 + (4 - depth)) : (100000 - (4 - depth));
        }
        return 0;
    }
    
    // MVV-LVA ordering: capturas valiosas primero, luego jaques, luego desarrollo
    moves.sort((a, b) => {
        const victimA = game.getPiece(a.toRow, a.toCol);
        const victimB = game.getPiece(b.toRow, b.toCol);
        const scoreA = victimA ? (PIECE_VALUES[victimA.type] || 0) - (PIECE_VALUES[a.piece && a.piece.type || ''] || 0) / 100 : 0;
        const scoreB = victimB ? (PIECE_VALUES[victimB.type] || 0) - (PIECE_VALUES[b.piece && b.piece.type || ''] || 0) / 100 : 0;
        return scoreB - scoreA;
    });

    const movesToEvaluate = depth > 2 ? moves.slice(0, Math.min(moves.length, 20)) : moves;
    
    if (isMaximizing) {
        let maxScore = -Infinity;
        for (const move of movesToEvaluate) {
            const savedBoard = game.board.map(row => [...row]);
            const savedTurn = game.currentTurn;
            const savedCaptured = {
                white: [...game.capturedPieces.white],
                black: [...game.capturedPieces.black]
            };
            const savedEnPassant = game.enPassantTarget ? { ...game.enPassantTarget } : null;
            const savedCastling = JSON.parse(JSON.stringify(game.castlingRights));
            
            // Simular sin guardar en historial
            simulateMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
            const score = minimax(depth - 1, alpha, beta, false, maximizingColor, useQuiescence);
            
            game.board = savedBoard;
            game.currentTurn = savedTurn;
            game.capturedPieces = savedCaptured;
            game.enPassantTarget = savedEnPassant;
            game.castlingRights = savedCastling;
            
            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break;
        }
        return maxScore;
    } else {
        let minScore = Infinity;
        for (const move of movesToEvaluate) {
            const savedBoard = game.board.map(row => [...row]);
            const savedTurn = game.currentTurn;
            const savedCaptured = {
                white: [...game.capturedPieces.white],
                black: [...game.capturedPieces.black]
            };
            const savedEnPassant = game.enPassantTarget ? { ...game.enPassantTarget } : null;
            const savedCastling = JSON.parse(JSON.stringify(game.castlingRights));
            
            simulateMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
            const score = minimax(depth - 1, alpha, beta, true, maximizingColor, useQuiescence);
            
            game.board = savedBoard;
            game.currentTurn = savedTurn;
            game.capturedPieces = savedCaptured;
            game.enPassantTarget = savedEnPassant;
            game.castlingRights = savedCastling;
            
            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) break; // Poda alpha-beta
        }
        return minScore;
    }
}

// Evaluación completa de la posición
function evaluatePosition(forColor) {
    let score = 0;
    let friendlyBishops = 0, enemyBishops = 0;
    let friendlyRooks = 0, enemyRooks = 0;
    let friendlyKnights = 0, enemyKnights = 0;
    const enemyColor = forColor === 'white' ? 'black' : 'white';
    const friendlyPawnCols = new Array(8).fill(0);
    const enemyPawnCols = new Array(8).fill(0);
    const friendlyPawnRows = [];
    const enemyPawnRows = [];
    let friendlyKingRow = 0, friendlyKingCol = 0;
    let enemyKingRow = 0, enemyKingCol = 0;
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = game.getPiece(row, col);
            if (!piece) continue;
            
            const pieceValue = PIECE_VALUES[piece.type] || 0;
            const positionBonus = getPositionBonus(piece.type, row, col, piece.color);
            const totalValue = pieceValue + positionBonus;
            
            if (piece.color === forColor) {
                score += totalValue;
                if (piece.type === 'bishop') friendlyBishops++;
                if (piece.type === 'knight') friendlyKnights++;
                if (piece.type === 'rook') friendlyRooks++;
                if (piece.type === 'pawn') { friendlyPawnCols[col]++; friendlyPawnRows.push({ row, col }); }
                if (piece.type === 'king') { friendlyKingRow = row; friendlyKingCol = col; }
            } else {
                score -= totalValue;
                if (piece.type === 'bishop') enemyBishops++;
                if (piece.type === 'knight') enemyKnights++;
                if (piece.type === 'rook') enemyRooks++;
                if (piece.type === 'pawn') { enemyPawnCols[col]++; enemyPawnRows.push({ row, col }); }
                if (piece.type === 'king') { enemyKingRow = row; enemyKingCol = col; }
            }
        }
    }

    // Bishop pair
    if (friendlyBishops >= 2) score += 40;
    if (enemyBishops >= 2) score -= 40;

    // Pawn structure
    for (let col = 0; col < 8; col++) {
        // Doubled pawns
        if (friendlyPawnCols[col] > 1) score -= 20 * (friendlyPawnCols[col] - 1);
        if (enemyPawnCols[col] > 1) score += 20 * (enemyPawnCols[col] - 1);

        // Isolated pawns (no friendly pawn on adjacent columns)
        if (friendlyPawnCols[col] > 0) {
            const left = col > 0 ? friendlyPawnCols[col - 1] : 0;
            const right = col < 7 ? friendlyPawnCols[col + 1] : 0;
            if (left === 0 && right === 0) score -= 15;
        }
        if (enemyPawnCols[col] > 0) {
            const left = col > 0 ? enemyPawnCols[col - 1] : 0;
            const right = col < 7 ? enemyPawnCols[col + 1] : 0;
            if (left === 0 && right === 0) score += 15;
        }
    }

    // Passed pawns
    for (const fp of friendlyPawnRows) {
        let passed = true;
        const dir = forColor === 'white' ? -1 : 1;
        for (let r = fp.row + dir; r >= 0 && r < 8; r += dir) {
            for (let dc = -1; dc <= 1; dc++) {
                const c = fp.col + dc;
                if (c < 0 || c > 7) continue;
                const p = game.getPiece(r, c);
                if (p && p.type === 'pawn' && p.color === enemyColor) { passed = false; break; }
            }
            if (!passed) break;
        }
        if (passed) {
            const advance = forColor === 'white' ? (7 - fp.row) : fp.row;
            score += 20 + advance * 10;
        }
    }
    for (const ep of enemyPawnRows) {
        let passed = true;
        const dir = enemyColor === 'white' ? -1 : 1;
        for (let r = ep.row + dir; r >= 0 && r < 8; r += dir) {
            for (let dc = -1; dc <= 1; dc++) {
                const c = ep.col + dc;
                if (c < 0 || c > 7) continue;
                const p = game.getPiece(r, c);
                if (p && p.type === 'pawn' && p.color === forColor) { passed = false; break; }
            }
            if (!passed) break;
        }
        if (passed) {
            const advance = enemyColor === 'white' ? (7 - ep.row) : ep.row;
            score -= 20 + advance * 10;
        }
    }

    // Rook on open/semi-open file
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const p = game.getPiece(row, col);
            if (!p || p.type !== 'rook') continue;
            if (p.color === forColor) {
                if (friendlyPawnCols[col] === 0 && enemyPawnCols[col] === 0) score += 25;
                else if (friendlyPawnCols[col] === 0) score += 12;
            } else {
                if (friendlyPawnCols[col] === 0 && enemyPawnCols[col] === 0) score -= 25;
                else if (enemyPawnCols[col] === 0) score -= 12;
            }
        }
    }

    // King safety: pawn shield in middlegame
    if (!isEndgame()) {
        score += evalKingSafety(friendlyKingRow, friendlyKingCol, forColor);
        score -= evalKingSafety(enemyKingRow, enemyKingCol, enemyColor);
    }
    
    return score;
}

function evalKingSafety(kingRow, kingCol, color) {
    let shield = 0;
    const pawnDir = color === 'white' ? -1 : 1;
    const pawnRow = kingRow + pawnDir;
    if (pawnRow >= 0 && pawnRow < 8) {
        for (let dc = -1; dc <= 1; dc++) {
            const c = kingCol + dc;
            if (c < 0 || c > 7) continue;
            const p = game.getPiece(pawnRow, c);
            if (p && p.type === 'pawn' && p.color === color) shield += 10;
            else shield -= 8;
        }
    }
    // Penalize king on open center files
    if (kingCol >= 2 && kingCol <= 5 && !isEndgame()) {
        shield -= 15;
    }
    return shield;
}

function isEndgame() {
    let material = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = game.getPiece(r, c);
            if (p && p.type !== 'king' && p.type !== 'pawn') {
                material += PIECE_VALUES[p.type] || 0;
            }
        }
    }
    return material <= 2600;
}

// Obtener bonus de posición según tipo de pieza
function getPositionBonus(pieceType, row, col, color) {
    // Invertir fila para negras
    const evalRow = color === 'white' ? row : 7 - row;
    
    let table;
    switch(pieceType) {
        case 'pawn':
            table = PAWN_TABLE;
            break;
        case 'knight':
            table = KNIGHT_TABLE;
            break;
        case 'bishop':
            table = BISHOP_TABLE;
            break;
        case 'rook':
            table = ROOK_TABLE;
            break;
        case 'queen':
            table = QUEEN_TABLE;
            break;
        case 'king':
            table = isEndgame() ? KING_END_TABLE : KING_MIDDLE_TABLE;
            break;
        default:
            return 0;
    }
    
    return table[evalRow][col];
}

// Guardar configuración en localStorage
function updatePieceStylePreview() {
    const preview = document.getElementById('piece-style-preview');
    if (!preview) return;
    if (pieceStyle === 'classic') {
        preview.style.display = 'none';
    } else {
        preview.src = `pieces/${pieceStyle}/bP.svg`;
        preview.style.display = 'block';
    }
    updatePlayerColorPawnImages();
}

function updatePlayerColorPawnImages() {
    var wImg = document.getElementById('player-color-pawn-white');
    var bImg = document.getElementById('player-color-pawn-black');
    var wTxt = document.getElementById('player-color-pawn-white-txt');
    var bTxt = document.getElementById('player-color-pawn-black-txt');
    if (!wImg || !bImg) return;
    if (SVG_PIECE_SETS.indexOf(pieceStyle) !== -1) {
        wImg.src = 'pieces/' + pieceStyle + '/wP.svg';
        bImg.src = 'pieces/' + pieceStyle + '/bP.svg';
        wImg.style.display = 'block';
        bImg.style.display = 'block';
        if (wTxt) { wTxt.classList.remove('is-visible'); wTxt.textContent = ''; }
        if (bTxt) { bTxt.classList.remove('is-visible'); bTxt.textContent = ''; }
    } else {
        wImg.style.display = 'none';
        bImg.style.display = 'none';
        if (wTxt && bTxt && PIECE_SETS.classic) {
            wTxt.textContent = PIECE_SETS.classic.WHITE_PAWN;
            bTxt.textContent = PIECE_SETS.classic.BLACK_PAWN;
            wTxt.classList.add('is-visible');
            bTxt.classList.add('is-visible');
        }
    }
}

function syncPlayerColorUI() {
    var hidden = document.getElementById('player-color');
    var wBtn = document.getElementById('player-color-btn-white');
    var bBtn = document.getElementById('player-color-btn-black');
    if (hidden) hidden.value = playerColor;
    if (wBtn && bBtn) {
        var isW = playerColor === 'white';
        wBtn.classList.toggle('player-color-option--selected', isW);
        bBtn.classList.toggle('player-color-option--selected', !isW);
        wBtn.setAttribute('aria-pressed', isW ? 'true' : 'false');
        bBtn.setAttribute('aria-pressed', isW ? 'false' : 'true');
    }
}

function saveSettings() {
    const settings = {
        playerColor: playerColor,
        aiDifficulty: aiDifficulty,
        boardTheme: boardTheme,
        pieceStyle: pieceStyle,
        showCoordinates: showCoordinates,
        showMoveInsights: showMoveInsights,
        timePerPlayer: timePerPlayer,
        incrementPerMove: incrementPerMove
    };
    localStorage.setItem('chess_settings', JSON.stringify(settings));
}

// Cargar configuración guardada
function loadSavedSettings() {
    const savedSettings = localStorage.getItem('chess_settings');
    
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            
            playerColor = settings.playerColor != null ? settings.playerColor : 'white';
            aiDifficulty = settings.aiDifficulty != null ? settings.aiDifficulty : 1;
            boardTheme = settings.boardTheme != null ? settings.boardTheme : 'classic';
            pieceStyle = settings.pieceStyle != null ? settings.pieceStyle : 'cburnett';
            showCoordinates = settings.showCoordinates !== undefined ? settings.showCoordinates : false;
            showMoveInsights = settings.showMoveInsights !== undefined ? settings.showMoveInsights : false;
            timePerPlayer = settings.timePerPlayer != null ? settings.timePerPlayer : 60;
            incrementPerMove = settings.incrementPerMove != null ? settings.incrementPerMove : 0;
            
            // Migrar niveles antiguos (1-20) a nuevos (1-8)
            if (aiDifficulty > 8) {
                const OLD_TO_NEW = { 12: 5, 15: 6, 18: 7, 20: 8 };
                aiDifficulty = OLD_TO_NEW[aiDifficulty] || (aiDifficulty <= 5 ? 2 : aiDifficulty <= 8 ? 4 : 6);
            }

            document.getElementById('player-color').value = playerColor;
            document.getElementById('ai-difficulty').value = aiDifficulty;
            document.getElementById('board-theme').value = boardTheme;
            document.getElementById('piece-style').value = pieceStyle;
            document.getElementById('show-coordinates').checked = showCoordinates;
            document.getElementById('show-move-insights').checked = showMoveInsights;
            updatePieceStylePreview();
            
            const timeControl = `${timePerPlayer}+${incrementPerMove}`;
            const timeControlSelect = document.getElementById('time-control');
            const matchingOption = Array.from(timeControlSelect.options).find(opt => opt.value === timeControl);
            if (matchingOption) {
                timeControlSelect.value = timeControl;
            }
            
        } catch (error) {
            console.error('Error al cargar configuración:', error);
        }
    }
}

function scrollToBoard() {
    const board = document.querySelector('.board-container');
    if (board) board.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const VERSION_CHANGELOG = {
    '2.5.1': [
        'Nuevo panel: Problemas de Ajedrez con 100+ puzzles',
        'Categorías: Mate en 1/2/3, Horquilla, Clavada, Sacrificio, Finales y más',
        'Filtros por categoría y dificultad (Fácil a Experto)',
        'Sistema de puntuación: aciertos, fallos y racha',
        'Pistas y soluciones disponibles'
    ],
    '2.4.6': [
        'TEST INTERNO:Ver Apertura: al finalizar, pulsar flechas azules abre variantes para continuar',
        'Análisis: botón 📊 en la barra de navegación para reabrir el resumen de errores',
        'Hover en movimientos y flechas de variantes mejorado (PC)',
    ],
    '2.4.4': [
        'Insights múltiples: un movimiento puede mostrar 2-3 mensajes de ayuda combinados',
        'Recapturas: detecta "Recuperas pieza" cuando recapturas en la misma casilla',
        'Actualización automática de PWA: borra caché antigua y recarga al detectar nueva versión',
    ],
    '2.4.3': [
        'Biblioteca de Partidas Maestras: +25 partidas nuevas, total ~85 partidas',
        'Partidas organizadas por jugador: Kasparov(11), Fischer(10), Karpov(7), Carlsen(6), Tal(6), Anand(4), y más',
        'Nuevos jugadores: Capablanca, Alekhine, Kramnik, Spassky, Keres, Bronstein, Nakamura',
        'Filtro por jugador mejorado con más partidas por maestro',
        'Campeonatos del Mundo: desde Steinitz 1886 hasta Ding Liren 2023',
        'Responsive: mini-reloj blancas/negras bajo el tablero (ideal para blitz en smartphones)',
        'Piezas capturadas justo debajo del mini-reloj; menos espacio entre tablero, reloj, capturas y botones',
        'Win-rate por apertura (blancas/tablas/negras) con barra visual',
        'Títulos de paneles con fondo gris oscuro',
        'Ajustes de layout responsive: paneles a ancho de pantalla y orden Partidas Maestras tras Aperturas',
        'PGN con análisis embebido (NAG y comentarios): exportar/copiar, importar y restaurar errores en el tablero',
        'Si ya existe análisis, «Analizar partida» muestra el resultado sin volver a llamar al motor',
        'Notación algebraica inglesa (K,Q,R,B,N) en toda la app; marca AjedrezIA en cabeceras PGN y dificultad IA',
        'Modo análisis: bloqueo de botones y selectores; Copiar PGN desactivado durante el análisis'
    ],
    '2.4.2': [
        'Responsive: mini-reloj blancas/negras bajo el tablero (ideal para blitz en smartphones)',
        'Piezas capturadas justo debajo del mini-reloj; menos espacio entre tablero, reloj, capturas y botones',
        'Títulos de paneles con fondo gris oscuro',
        'Ajustes de layout responsive: paneles a ancho de pantalla y orden Partidas Maestras tras Aperturas'
    ],
    '2.4.1': [
        '~945 posiciones en la base de aperturas (antes ~560)',
        '~112 aperturas entrenables (antes ~88)',
        'Profundidad máxima: hasta movimiento 11 en líneas principales',
        '13 estilos de piezas: Alpha, California, Maestro, Staunty, Companion, Tatiana, Leipzig, Horsey y más',
        'Entrenamiento libre: elige tu primer movimiento y explora variantes',
        'Española, Siciliana, Francesa, Caro-Kann, India de Rey, Nimzo-India: expandidas en profundidad',
        'Gambito de Rey, Grünfeld, Benoni, GDR, Ragozin: líneas hasta mov.9-11'
    ],
    '2.4': [
        '~560 posiciones en la base de aperturas (antes ~490)',
        '~80 aperturas entrenables (antes ~59)',
        'Nuevas aperturas: Alekhine, Grünfeld, Philidor, Trompowsky, Torre, Bird, Kan, Taimanov, Scheveningen, Moderna, Bogo-India, y más',
        'Líneas más profundas en aperturas existentes'
    ],
    '2.3.1': [
        'Paneles colapsables con memoria',
        'Entrenamiento mejorado con variantes',
        'Partidas famosas ampliadas'
    ]
};

function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

function checkNewVersion() {
    const savedVersion = localStorage.getItem('app_version');
    if (!savedVersion || compareVersions(APP_VERSION, savedVersion) > 0) {
        if (savedVersion) {
            const changes = VERSION_CHANGELOG[APP_VERSION];
            let msg = `<strong>🆕 Nueva Versión ${APP_VERSION}</strong>`;
            if (changes && changes.length) {
                msg += '<ul style="text-align:left;margin:8px 0 0;padding-left:18px;font-size:0.9em;">';
                changes.forEach(c => msg += `<li>${c}</li>`);
                msg += '<li style="margin-top:6px;font-style:italic;opacity:0.92;">… y muchos más cambios</li>';
                msg += '</ul>';
            } else {
                msg += '<p style="text-align:left;margin:10px 0 0;font-size:0.9em;font-style:italic;">… y muchos más cambios</p>';
            }
            setTimeout(() => showMessage(msg, 'success', 0, () => {
                localStorage.setItem('app_version', APP_VERSION);
            }), 500);
        } else {
            localStorage.setItem('app_version', APP_VERSION);
        }
    }
}

// Mostrar mensaje centrado en el tablero
function showMessage(message, type = 'info', duration = 3000, onClose = null) {
    let overlay = document.getElementById('message-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'message-overlay';
        overlay.className = 'message-overlay';
        document.body.appendChild(overlay);
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                hideMessage();
            }
        });
    }
    
    overlay._onClose = onClose;
    
    const messageBox = document.createElement('div');
    messageBox.className = `message-box message-${type}`;
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.innerHTML = message;
    messageBox.appendChild(messageText);
    
    if (duration === 0) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'message-close-btn';
        closeBtn.textContent = '✕';
        closeBtn.onclick = hideMessage;
        messageBox.appendChild(closeBtn);
    }
    
    overlay.innerHTML = '';
    overlay.appendChild(messageBox);
    overlay.style.display = 'flex';
    
    if (duration > 0) {
        setTimeout(() => {
            overlay.style.display = 'none';
            if (overlay._onClose) { overlay._onClose(); overlay._onClose = null; }
        }, duration);
    }
}

// Ocultar mensaje
function hideMessage() {
    const overlay = document.getElementById('message-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        if (overlay._onClose) { overlay._onClose(); overlay._onClose = null; }
    }
}

// Cargar estadísticas
function loadStats() {
    const savedStats = localStorage.getItem('chess_stats');
    if (savedStats) {
        try {
            stats = JSON.parse(savedStats);
        } catch (error) {
            console.error('Error al cargar estadísticas:', error);
            stats = { wins: 0, draws: 0, losses: 0 };
        }
    }
    updateStatsDisplay();
}

// Guardar estadísticas
function saveStats() {
    localStorage.setItem('chess_stats', JSON.stringify(stats));
    updateStatsDisplay();
}

// Actualizar visualización de estadísticas
function updateStatsDisplay() {
    document.getElementById('stat-wins').textContent = stats.wins;
    document.getElementById('stat-draws').textContent = stats.draws;
    document.getElementById('stat-losses').textContent = stats.losses;
}

// Registrar resultado de partida
function recordGameResult(result) {
    if (result === 'win') {
        stats.wins++;
    } else if (result === 'draw') {
        stats.draws++;
    } else if (result === 'loss') {
        stats.losses++;
    }
    saveStats();
}

// Reiniciar estadísticas
function resetStats() {
    showConfirmDialog('¿Reiniciar las estadísticas a cero?', () => {
        stats = { wins: 0, draws: 0, losses: 0 };
        saveStats();
        showMessage('Estadísticas reiniciadas', 'success', 2000);
    });
}

function resignGame() {
    if (!game || game.gameOver) {
        showMessage('No hay partida en curso', 'warning', 2000);
        return;
    }
    if (!game.moveHistory || game.moveHistory.length === 0) {
        showMessage('La partida aún no ha empezado', 'warning', 2000);
        return;
    }
    showConfirmDialog('¿Seguro que quieres abandonar la partida?', () => {
        game.gameOver = true;
        stopClock();
        recordGameResult('loss');
        clearAutoSavedGame();
        updateUndoButton();
        showMessage('Has abandonado la partida', 'error', 0);
        setTimeout(showAnalysisButton, 100);
    });
}

function offerDraw() {
    if (!game || game.gameOver) {
        showMessage('No hay partida en curso', 'warning', 2000);
        return;
    }
    if (!game.moveHistory || game.moveHistory.length < 2) {
        showMessage('Es muy pronto para pedir tablas', 'warning', 2000);
        return;
    }
    showConfirmDialog('¿Quieres ofrecer tablas?', () => {
        const aiColor = playerColor === 'white' ? 'black' : 'white';
        const aiEval = evaluatePosition(aiColor) / 100;

        // AI accepts if losing or equal, rejects if winning
        let accepted = false;
        if (aiEval < -0.5) {
            // AI is losing: very likely to accept
            accepted = Math.random() < 0.9;
        } else if (aiEval < 0.3) {
            // Position roughly equal: moderate chance
            accepted = Math.random() < 0.5;
        } else if (aiEval < 1.0) {
            // AI has slight advantage: unlikely
            accepted = Math.random() < 0.15;
        } else {
            // AI is clearly winning: almost never accepts
            accepted = Math.random() < 0.03;
        }

        if (accepted) {
            game.gameOver = true;
            stopClock();
            recordGameResult('draw');
            clearAutoSavedGame();
            showMessage('Tablas aceptadas', 'info', 3000);
        } else {
            const evalText = aiEval > 1.0 ? ' (tiene ventaja)' : '';
            showMessage(`El rival rechaza las tablas${evalText}`, 'warning', 2000);
        }
    });
}

function showConfirmDialog(message, onConfirm) {
    let overlay = document.getElementById('game-list-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'game-list-overlay';
    overlay.className = 'message-overlay';
    overlay.style.display = 'flex';
    document.body.appendChild(overlay);

    const modal = document.createElement('div');
    modal.className = 'game-list-modal';
    modal.style.textAlign = 'center';

    const text = document.createElement('p');
    text.textContent = message;
    text.style.cssText = 'font-size:1rem;color:#333;margin-bottom:20px;font-weight:500;';
    modal.appendChild(text);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'btn btn-success';
    confirmBtn.textContent = 'Confirmar';
    confirmBtn.style.marginTop = '0';
    confirmBtn.addEventListener('click', () => { overlay.remove(); onConfirm(); });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.style.marginTop = '0';
    cancelBtn.addEventListener('click', () => overlay.remove());

    btnRow.appendChild(confirmBtn);
    btnRow.appendChild(cancelBtn);
    modal.appendChild(btnRow);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar motor Stockfish
    initStockfish();

    // Mostrar versión
    const versionEl = document.getElementById('app-version');
    if (versionEl) versionEl.textContent = 'v' + APP_VERSION;

    // Comprobar si hay nueva versión
    checkNewVersion();

    // Cargar configuraciones guardadas
    loadSavedSettings();
    syncPlayerColorUI();
    updatePlayerColorPawnImages();

    // Cargar estadísticas
    loadStats();

    // Panel colapsable de Configuración
    document.querySelectorAll('.panel-collapsible').forEach(panel => {
        const key = 'panel_' + panel.id;
        if (panel.id !== 'puzzles-panel' && localStorage.getItem(key) === 'open') {
            panel.classList.remove('collapsed');
        }
        panel.querySelector('.panel-toggle').addEventListener('click', () => {
            if (panel.id === 'puzzles-panel') {
                showMessage('🚧 En Construcción 🚧', 'info', 2000);
                return;
            }
            panel.classList.toggle('collapsed');
            localStorage.setItem(key, panel.classList.contains('collapsed') ? 'closed' : 'open');
        });
    });

    // Event listeners
    document.getElementById('new-game').addEventListener('click', confirmNewGame);
    var playerColorPicker = document.getElementById('player-color-picker');
    if (playerColorPicker) {
        playerColorPicker.addEventListener('click', function(e) {
            var btn = e.target.closest('.player-color-option');
            if (!btn) return;
            var c = btn.getAttribute('data-color');
            if (c !== 'white' && c !== 'black') return;
            if (playerColor === c) return;
            playerColor = c;
            syncPlayerColorUI();
            renderBoard();
            renderCoordinateLabels();
            saveSettings();
        });
    }
    document.getElementById('ai-difficulty').addEventListener('change', (e) => {
        aiDifficulty = parseInt(e.target.value);
        console.log('Nivel de dificultad cambiado a:', aiDifficulty);
        saveSettings();
    });
    document.getElementById('board-theme').addEventListener('change', (e) => {
        boardTheme = e.target.value;
        saveSettings();
        applyBoardTheme();
    });
    document.getElementById('piece-style').addEventListener('change', (e) => {
        pieceStyle = e.target.value;
        updatePieceStylePreview();
        saveSettings();
        renderBoard();
    });
    document.getElementById('show-coordinates').addEventListener('change', (e) => {
        showCoordinates = e.target.checked;
        saveSettings();
        renderBoard();
    });
    document.getElementById('show-move-insights').addEventListener('change', (e) => {
        showMoveInsights = e.target.checked;
        saveSettings();
    });
    document.getElementById('time-control').addEventListener('change', (e) => {
        const [minutes, increment] = e.target.value.split('+').map(Number);
        timePerPlayer = minutes;
        incrementPerMove = increment;
        saveSettings();
    });

    // Botones de acciones (iconos debajo del tablero + texto en sidebar)
    ['resign-game', 'resign-game-sidebar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', resignGame);
    });
    ['offer-draw', 'offer-draw-sidebar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', offerDraw);
    });
    document.getElementById('view-analysis').addEventListener('click', () => {
        if (game && game.gameOver) analyzeGamePostGame();
    });
    ['resume-game', 'resume-game-sidebar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', function() {
            if (this.onclick) return;
            resumeGame();
        });
    });
    ['undo-move', 'undo-move-sidebar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', undoMove);
    });
    ['hint-move', 'hint-move-sidebar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', getHint);
    });
    ['analyze-game', 'analyze-game-sidebar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', () => analyzeGamePostGame());
    });
    document.getElementById('export-pgn').addEventListener('click', exportPGN);
    document.getElementById('import-pgn').addEventListener('click', importPGN);
    ['copy-pgn', 'copy-pgn-board'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('click', copyPGN);
    });

    // Estadísticas
    document.getElementById('reset-stats').addEventListener('click', resetStats);

    // Entrenador de aperturas
    const savedOpening = localStorage.getItem('selectedOpening');
    if (savedOpening) {
        document.getElementById('opening-select').value = savedOpening;
        onOpeningSelect();
    }
    document.getElementById('opening-select').addEventListener('change', onOpeningSelect);
    document.getElementById('show-known-variants').addEventListener('click', showKnownVariants);
    document.getElementById('start-opening-training').addEventListener('click', startOpeningTraining);
    document.getElementById('view-opening').addEventListener('click', viewOpening);
    document.getElementById('start-opening-quiz').addEventListener('click', startOpeningQuiz);

    populateFamousPlayerSelect();
    document.getElementById('famous-player-select').addEventListener('change', onFamousPlayerSelect);
    const savedFamousGame = localStorage.getItem('selectedFamousGame');
    if (savedFamousGame) {
        document.getElementById('famous-game-select').value = savedFamousGame;
    }
    document.getElementById('famous-game-select').addEventListener('change', onFamousGameSelect);
    document.getElementById('load-famous-game').addEventListener('click', loadFamousGame);
    onFamousGameSelect();

    // Problemas de ajedrez
    loadPuzzleStats();
    document.getElementById('start-puzzle').addEventListener('click', function() {
        puzzleFilter.theme = document.getElementById('puzzle-theme-select').value;
        puzzleFilter.difficulty = document.getElementById('puzzle-difficulty-select').value;
        document.getElementById('puzzle-skip').textContent = '⏭ Saltar';
        startNewPuzzle();
    });
    document.getElementById('puzzle-hint').addEventListener('click', puzzleShowHint);
    document.getElementById('puzzle-solution').addEventListener('click', puzzleShowSolution);
    document.getElementById('puzzle-skip').addEventListener('click', function() {
        puzzleFilter.theme = document.getElementById('puzzle-theme-select').value;
        puzzleFilter.difficulty = document.getElementById('puzzle-difficulty-select').value;
        startNewPuzzle();
    });

    // Navegación del historial
    document.getElementById('nav-first').addEventListener('click', goToFirstMove);
    document.getElementById('nav-prev').addEventListener('click', goToPreviousMove);
    document.getElementById('nav-next').addEventListener('click', goToNextMove);
    document.getElementById('nav-last').addEventListener('click', goToLastMove);

    document.addEventListener('keydown', (e) => {
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goToPreviousMove();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            goToNextMove();
        } else if (e.key === 'Home') {
            e.preventDefault();
            goToFirstMove();
        } else if (e.key === 'End') {
            e.preventDefault();
            goToLastMove();
        }
    });

    // Navegación de errores del análisis
    document.getElementById('analysis-nav-prev').addEventListener('click', () => goToAnalysisError(-1));
    document.getElementById('analysis-nav-next').addEventListener('click', () => goToAnalysisError(1));
    document.getElementById('analysis-nav-summary').addEventListener('click', () => {
        if (!analysisErrorsList || analysisErrorsList.length === 0) return;
        const total = (game.moveHistoryUCI || game.moveHistory || []).length;
        const blunders = analysisErrorsList.filter(e => e.type === 'blunder').length;
        const mistakes = analysisErrorsList.filter(e => e.type === 'mistake').length;
        showAnalysisResults(analysisErrorsList, total, total, blunders, mistakes);
    });
    const navCloseBtn = document.getElementById('analysis-nav-close');
    if (navCloseBtn) navCloseBtn.addEventListener('click', () => {
        document.getElementById('analysis-errors-nav').style.display = 'none';
        document.getElementById('analysis-overlay').style.display = 'none';
        clearAnalysisHighlight();
        setAnalysisModeActive(false);
    });

    // Bloquear zoom con gesto de pinza en móviles
    document.addEventListener('touchmove', (e) => {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());

    // Auto-guardar al cerrar o recargar la página
    window.addEventListener('beforeunload', () => {
        autoSaveGame();
    });

    // Restaurar partida en curso o iniciar nueva
    applyBoardTheme();
    const autoSavedGame = localStorage.getItem('auto_saved_game');
    if (autoSavedGame) {
        resumeGame(true);
    } else {
    startNewGame();
    }
    checkForGameInProgress();
    initCustomDropdowns();
    window.addEventListener('resize', () => {
        initCustomDropdowns();
        updateEvalBar();
    });

    document.addEventListener('click', (e) => {
        if (analysisActive) {
            const locked = e.target.closest('.analysis-locked');
            if (locked) {
                e.stopPropagation();
                e.preventDefault();
                showMessage('Cierra Modo Análisis para continuar', 'warning', 2000);
                return;
            }
        }
    }, true);

    document.addEventListener('click', (e) => {
        if (e.target.closest('#new-game, #start-opening-training, #start-opening-quiz, #resume-game, #resume-game-sidebar, #undo-move, #undo-move-sidebar, #hint-move, #hint-move-sidebar')) {
            if (window.matchMedia('(max-width: 1024px) and (orientation: portrait), (max-width: 768px)').matches) {
                setTimeout(() => {
                    var bc3 = document.querySelector('.board-container'); if (bc3) bc3.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 150);
            }
        }
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(function(reg) {
            setInterval(function() { reg.update(); }, 60 * 60 * 1000);
        }).catch(function() {});

        var swRefreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', function() {
            if (swRefreshing) return;
            swRefreshing = true;
            caches.keys().then(function(keys) {
                return Promise.all(keys.map(function(k) { return caches.delete(k); }));
            }).then(function() {
                window.location.reload();
            });
        });
    }
});

function initCustomDropdowns() {
    const isMobile = window.matchMedia('(max-width: 1024px) and (orientation: portrait), (max-width: 768px)').matches;
    document.querySelectorAll('.select').forEach(select => {
        if (!select.closest('.custom-select-wrap')) {
            const wrap = document.createElement('div');
            wrap.className = 'custom-select-wrap';
            select.parentNode.insertBefore(wrap, select);
            wrap.appendChild(select);

            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'custom-select-trigger';
            var selOpt = select.options[select.selectedIndex]; trigger.textContent = (selOpt && selOpt.text) || '';
            wrap.appendChild(trigger);

            const list = document.createElement('div');
            list.className = 'custom-select-list';
            wrap.appendChild(list);

            function buildList() {
                list.innerHTML = '';
                for (const node of select.children) {
                    if (node.tagName === 'OPTGROUP') {
                        const g = document.createElement('div');
                        g.className = 'custom-select-optgroup';
                        g.textContent = node.label;
                        list.appendChild(g);
                        for (const opt of node.children) {
                            const o = document.createElement('div');
                            o.className = 'custom-select-option' + (opt.value === select.value ? ' selected' : '');
                            o.textContent = opt.textContent;
                            o.dataset.value = opt.value;
                            o.tabIndex = 0;
                            o.addEventListener('click', () => selectOption(opt.value));
                            list.appendChild(o);
                        }
                    } else if (node.tagName === 'OPTION') {
                        const o = document.createElement('div');
                        o.className = 'custom-select-option' + (node.value === select.value ? ' selected' : '');
                        o.textContent = node.textContent;
                        o.dataset.value = node.value;
                        o.tabIndex = 0;
                        o.addEventListener('click', () => selectOption(node.value));
                        list.appendChild(o);
                    }
                }
            }

            function selectOption(val) {
                select.value = val;
                var so = select.options[select.selectedIndex]; trigger.textContent = (so && so.text) || '';
                list.classList.remove('open');
                trigger.classList.remove('open');
                list.querySelectorAll('.custom-select-option').forEach(o => {
                    o.classList.toggle('selected', o.dataset.value === val);
                });
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }

            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const open = list.classList.toggle('open');
                trigger.classList.toggle('open', open);
                if (open) buildList();
            });

            document.addEventListener('click', function closeDropdown(e) {
                if (!wrap.contains(e.target)) {
                    list.classList.remove('open');
                    trigger.classList.remove('open');
                }
            });
        }

        const wrap = select.closest('.custom-select-wrap');
        const trigger = wrap ? wrap.querySelector('.custom-select-trigger') : null;
        const list = wrap ? wrap.querySelector('.custom-select-list') : null;
        if (wrap && trigger && list) {
            if (isMobile) {
                trigger.style.display = 'block';
                var so2 = select.options[select.selectedIndex]; trigger.textContent = (so2 && so2.text) || '';
            } else {
                trigger.style.display = 'none';
            }
        }
    });
}

// Función para obtener movimientos de la IA
async function getAIMove() {
    return await getStockfishBestMove();
}

function confirmNewGame() {
    showConfirmDialog('¿Iniciar una nueva partida?', () => {
        startNewGame();
    });
}

function startNewGame() {
    scrollToBoard();
    hideMoveInsight();
    cancelTrainingTimeout();
    trainingActive = false;
    trainingFreeMode = false;
    quizMode = false;
    endPuzzleMode();
    trainingPaused = false;
    trainingResumeCallback = null;
    setGameButtonsDisabled(false);
    setFamousGameTitle('');
    document.getElementById('quiz-score').style.display = 'none';
    document.getElementById('opening-training-moves').style.display = '';
    const navBar = document.getElementById('analysis-errors-nav');
    if (navBar) navBar.style.display = 'none';
    analysisErrorsList = [];
    clearAutoSavedGame();
    hideBoardBanner();
    
    game = new ChessGame();
    selectedSquare = null;
    lastMoveSquares = { from: null, to: null };
    bestMoveSquares = { from: null, to: null };
    currentMoveIndex = -1;
    currentOpeningName = '';
    lastOpeningMoveCount = 0;
    const openingLog = document.getElementById('opening-log');
    if (openingLog) openingLog.remove();
    
    // Resetear reloj
    stopClock();
    whiteTime = timePerPlayer * 60;
    blackTime = timePerPlayer * 60;
    updateClockDisplay();

    renderBoard();
    updateCapturedPieces();
    updateMoveHistory();
    updateUndoButton();
    updateEvalBar();
    ['resume-game', 'resume-game-sidebar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
    });
    
    if (playerColor === 'black') {
        setTimeout(() => makeAIMove(), 800);
    }
}

function onOpeningSelect() {
    const select = document.getElementById('opening-select');
    const info = document.getElementById('opening-training-info');
    const btn = document.getElementById('start-opening-training');
    const variantsBtn = document.getElementById('show-known-variants');
    const key = select.value;

    const quizBtn = document.getElementById('start-opening-quiz');
    const quizScore = document.getElementById('quiz-score');

    const viewBtn = document.getElementById('view-opening');

    localStorage.setItem('selectedOpening', key);

    if (!key) {
        info.style.display = 'none';
        viewBtn.disabled = true;
        variantsBtn.disabled = true;
        quizBtn.disabled = true;
        quizScore.style.display = 'none';
        trainingOpening = null;
        return;
    }

    const opening = OPENING_TRAINING[key];
    if (!opening) return;

    trainingOpening = opening;
    document.getElementById('opening-training-name').textContent = opening.name;
    document.getElementById('opening-training-moves').textContent = opening.san;
    const descEl = document.getElementById('opening-training-desc');
    descEl.textContent = opening.desc || '';
    descEl.style.display = opening.desc ? 'block' : 'none';
    var wrEl = document.getElementById('opening-winrate');
    if (opening.wr && opening.wr.length === 3) {
        var w = opening.wr[0], d = opening.wr[1], b = opening.wr[2];
        wrEl.innerHTML = '<div class="winrate-bar">' +
            '<span class="wr-white" style="width:' + w + '%">♔ ' + w + '%</span>' +
            '<span class="wr-draw" style="width:' + d + '%">½ ' + d + '%</span>' +
            '<span class="wr-black" style="width:' + b + '%">♚ ' + b + '%</span>' +
            '</div>';
        wrEl.style.display = 'block';
    } else {
        wrEl.style.display = 'none';
    }
    info.style.display = 'block';
    variantsBtn.disabled = false;
    viewBtn.disabled = false;
    quizBtn.disabled = false;
    quizScore.style.display = 'none';
}

function viewOpening() {
    if (!trainingOpening) return;

    scrollToBoard();
    cancelTrainingTimeout();
    trainingActive = true;
    trainingFreeMode = false;
    trainingPaused = false;
    trainingResumeCallback = null;
    quizMode = false;
    setGameButtonsDisabled(true);
    document.getElementById('quiz-score').style.display = 'none';
    document.getElementById('opening-training-moves').style.display = '';
    clearAutoSavedGame();
    game = new ChessGame();
    selectedSquare = null;
    lastMoveSquares = { from: null, to: null };
    currentMoveIndex = -1;
    currentOpeningName = '';
    lastOpeningMoveCount = 0;
    const openingLog = document.getElementById('opening-log');
    if (openingLog) openingLog.remove();
    stopClock();
    whiteTime = timePerPlayer * 60;
    blackTime = timePerPlayer * 60;
    updateClockDisplay();
    renderBoard();
    updateCapturedPieces();
    updateMoveHistory();
    updateUndoButton();
    updateEvalBar();

    const uciMoves = trainingOpening.moves.split(' ');

    function playNextMove(index) {
        if (!trainingActive || index >= uciMoves.length || game.gameOver) {
            trainingPaused = false;
            trainingResumeCallback = null;
            trainingTimeoutId = null;
            setGameButtonsDisabled(false);
            showLoadedGameMessage('Apertura completada', false);
            showContinueButton();
            return;
        }

        const uci = uciMoves[index];
        const fromCol = uci.charCodeAt(0) - 97;
        const fromRow = 8 - parseInt(uci[1]);
        const toCol = uci.charCodeAt(2) - 97;
        const toRow = 8 - parseInt(uci[3]);

        const result = game.makeMove(fromRow, fromCol, toRow, toCol);
        if (result) {
            lastMoveSquares = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
            renderBoard();
            updateCapturedPieces();
            updateMoveHistory();
            updateUndoButton();
            detectOpening();
            updateEvalBar();
            trainingTimeoutId = setTimeout(() => playNextMove(index + 1), 1200);
        }
    }

    trainingTimeoutId = setTimeout(() => playNextMove(0), 600);
}

function showKnownVariants() {
    if (!trainingOpening) return;

    const moves = trainingOpening.moves.split(' ');
    const allVariants = [];

    for (let i = 0; i <= moves.length; i++) {
        const history = moves.slice(0, i);
        const variants = getOpeningVariants(history);
        if (variants.length > 0) {
            const currentKey = history.join(' ');
            const currentName = OPENING_NAMES[currentKey] || '';
            for (const v of variants) {
                const isCurrent = i < moves.length && v.move === moves[i];
                allVariants.push({
                    depth: i,
                    variant: v,
                    currentName,
                    isCurrent
                });
            }
        }
    }

    if (allVariants.length === 0) {
        showMessage('No se encontraron variantes conocidas', 'warning', 2000);
        return;
    }

    let overlay = document.getElementById('known-variants-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'known-variants-overlay';
    overlay.className = 'known-variants-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const panel = document.createElement('div');
    panel.className = 'known-variants-panel';

    const header = document.createElement('div');
    header.className = 'known-variants-header';
    header.innerHTML = `<span>📖 Variantes de: ${trainingOpening.name}</span>`;
    const closeBtn = document.createElement('span');
    closeBtn.className = 'variants-popup-close';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const list = document.createElement('div');
    list.className = 'known-variants-list';

    let lastDepth = -1;
    for (const item of allVariants) {
        const row = document.createElement('div');
        row.className = 'known-variant-row' + (item.isCurrent ? ' current-line' : '');

        const indent = '│ '.repeat(item.depth);
        const moveNum = Math.floor(item.depth / 2) + 1;
        const isBlack = item.depth % 2 === 1;
        const moveLabel = isBlack ? `${moveNum}...` : `${moveNum}.`;

        const nameParts = item.variant.name.split(' — ');
        const algebraicMove = nameParts[0] || `${moveLabel}${item.variant.from}${item.variant.to}`;
        const descPart = nameParts[1] || item.variant.name;

        row.innerHTML = `<span class="kv-indent">${indent}${item.isCurrent ? '▶' : '├'} </span><span class="kv-move">${algebraicMove}</span> <span class="kv-name">${descPart}</span>`;
        list.appendChild(row);
    }

    panel.appendChild(list);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
}

function extractPGNHeader(pgn, header) {
    const match = pgn.match(new RegExp('\\[' + header + '\\s+"([^"]*)"\\]'));
    return match ? match[1] : '';
}

function getFamousGamePlayers() {
    const players = new Map();
    for (const [key, game] of Object.entries(FAMOUS_GAMES)) {
        const white = extractPGNHeader(game.pgn, 'White');
        const black = extractPGNHeader(game.pgn, 'Black');
        if (white) {
            if (!players.has(white)) players.set(white, []);
            players.get(white).push({ key, name: game.name, color: '♔' });
        }
        if (black) {
            if (!players.has(black)) players.set(black, []);
            players.get(black).push({ key, name: game.name, color: '♚' });
        }
    }
    return players;
}

let famousGameSelectOriginalHTML = '';

function nameToLastFirst(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    const last = parts[parts.length - 1];
    const first = parts.slice(0, -1).join(' ');
    return `${last}, ${first}`;
}

function populateFamousPlayerSelect() {
    const select = document.getElementById('famous-player-select');
    const players = getFamousGamePlayers();
    const entries = [...players.keys()].map(name => ({ name, display: nameToLastFirst(name), count: players.get(name).length }));
    entries.sort((a, b) => a.display.localeCompare(b.display, 'es'));
    for (const entry of entries) {
        const opt = document.createElement('option');
        opt.value = entry.name;
        opt.textContent = `${entry.display} (${entry.count})`;
        select.appendChild(opt);
    }
    famousGameSelectOriginalHTML = document.getElementById('famous-game-select').innerHTML;
}

function onFamousPlayerSelect() {
    const playerSelect = document.getElementById('famous-player-select');
    const gameSelect = document.getElementById('famous-game-select');
    const selectedPlayer = playerSelect.value;

    if (!selectedPlayer) {
        gameSelect.innerHTML = famousGameSelectOriginalHTML;
        gameSelect.value = '';
        onFamousGameSelect();
        return;
    }

    const playerGames = new Set();
    for (const [key, game] of Object.entries(FAMOUS_GAMES)) {
        const white = extractPGNHeader(game.pgn, 'White');
        const black = extractPGNHeader(game.pgn, 'Black');
        if (white === selectedPlayer || black === selectedPlayer) {
            playerGames.add(key);
        }
    }

    gameSelect.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = `— Partidas de ${selectedPlayer} (${playerGames.size}) —`;
    gameSelect.appendChild(defaultOpt);

    for (const key of playerGames) {
        const game = FAMOUS_GAMES[key];
        const white = extractPGNHeader(game.pgn, 'White');
        const black = extractPGNHeader(game.pgn, 'Black');
        const result = extractPGNHeader(game.pgn, 'Result');
        const isWhite = white === selectedPlayer;
        const opponent = isWhite ? black : white;
        const colorIcon = isWhite ? '♔' : '♚';
        const resultIcon = result === '1-0' ? (isWhite ? '✓' : '✗') :
                           result === '0-1' ? (isWhite ? '✗' : '✓') : '½';
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = `${colorIcon} vs ${opponent} ${resultIcon} — ${game.name}`;
        gameSelect.appendChild(opt);
    }

    gameSelect.value = '';
    onFamousGameSelect();
}

function onFamousGameSelect() {
    const select = document.getElementById('famous-game-select');
    const btn = document.getElementById('load-famous-game');
    btn.disabled = !select.value;
    localStorage.setItem('selectedFamousGame', select.value);
}

function loadFamousGame() {
    const select = document.getElementById('famous-game-select');
    const key = select.value;
    if (!key) return;

    const famous = FAMOUS_GAMES[key];
    if (!famous || !famous.pgn) return;

    parsePGNAndLoad(famous.pgn, famous.name);

    if (window.matchMedia('(max-width: 600px)').matches) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function showLoadedGameMessage(title, isFinished, pgnResult) {
    const turnLabel = game.currentTurn === 'white' ? 'Blancas' : 'Negras';
    let msg = `<strong>${title.replace(/\n/g, '<br>')}</strong>`;
    let msgType = 'info';

    if (isFinished) {
        if (game.isCheckmate()) {
            const winner = game.currentTurn === 'white' ? 'Negras' : 'Blancas';
            msg += `<br>¡Jaque Mate! Ganan las ${winner}`;
            msgType = 'success';
        } else if (game.isStalemate()) {
            msg += `<br>Tablas por ahogado`;
        } else if (pgnResult === '1-0') {
            msg += `<br>Negras abandonan — Ganan Blancas`;
        } else if (pgnResult === '0-1') {
            msg += `<br>Blancas abandonan — Ganan Negras`;
        } else if (pgnResult === '1/2-1/2') {
            msg += `<br>Tablas por acuerdo`;
        } else {
            msg += `<br>Partida finalizada`;
        }
    } else {
        msg += `<br>Turno: ${turnLabel}`;
        msg += `<br>Pulsa Continuar Partida`;
    }
    msg += `<br><span style="font-size:0.85em;opacity:0.8;">Pulsa ◀ ▶ para navegar</span>`;

    showMessage(msg, msgType, 0);
}

function setGameButtonsDisabled(disabled) {
    const ids = [
        'new-game', 'resign-game', 'resign-game-sidebar',
        'offer-draw', 'offer-draw-sidebar',
        'undo-move', 'undo-move-sidebar',
        'hint-move', 'hint-move-sidebar',
        'export-pgn', 'import-pgn',
        'load-famous-game',
        'analyze-game', 'analyze-game-sidebar',
        'show-known-variants',
        'view-opening', 'start-opening-quiz'
    ];
    const openingBtns = ['show-known-variants', 'view-opening', 'start-opening-quiz'];
    const noOpening = !document.getElementById('opening-select').value;
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = disabled || (!disabled && noOpening && openingBtns.includes(id));
    });
}

function showContinueButton() {
    const resumeBtns = ['resume-game', 'resume-game-sidebar'].map(id => document.getElementById(id)).filter(Boolean);
    resumeBtns.forEach(btn => { btn.disabled = false; });
    const handler = function() {
        resumeBtns.forEach(btn => { btn.disabled = true; btn.onclick = null; });

        // Restaurar a la última posición si se estaba navegando
        const states = game.gameStateHistory || [];
        if (states.length > 0 && currentMoveIndex !== -1) {
            const last = states[states.length - 1];
            game.board = JSON.parse(JSON.stringify(last.board));
            game.currentTurn = last.currentTurn;
            game.capturedPieces = JSON.parse(JSON.stringify(last.capturedPieces));
            game.enPassantTarget = last.enPassantTarget ? { ...last.enPassantTarget } : null;
            game.castlingRights = JSON.parse(JSON.stringify(last.castlingRights));
            currentMoveIndex = -1;
        }

        game.gameOver = false;
        const finished = game.isCheckmate() || game.isStalemate();
        game.gameOver = finished;

        if (finished) {
            showLoadedGameMessage('Partida finalizada', true, null);
        }

        renderBoard();
        updateCapturedPieces();
        updateMoveHistory();
        updateNavigationButtons();
        updateEvalBar();
        autoSaveGame();

    if (!game.gameOver) {
        startClock();
            if (game.currentTurn !== playerColor) {
                setTimeout(() => makeAIMove(), 800);
            }
        }
    };
    resumeBtns.forEach(btn => { btn.onclick = handler; });
}

function startOpeningTraining() {
    scrollToBoard();
    cancelTrainingTimeout();
    trainingActive = true;
    trainingFreeMode = true;
    quizMode = false;
    setGameButtonsDisabled(true);
    document.getElementById('quiz-score').style.display = 'none';
    const movesEl = document.getElementById('opening-training-moves');
    if (movesEl) movesEl.style.display = '';
    clearAutoSavedGame();
    game = new ChessGame();
    selectedSquare = null;
    lastMoveSquares = { from: null, to: null };
    currentMoveIndex = -1;
    currentOpeningName = '';
    lastOpeningMoveCount = 0;
    const openingLog = document.getElementById('opening-log');
    if (openingLog) openingLog.remove();
    stopClock();
    whiteTime = timePerPlayer * 60;
    blackTime = timePerPlayer * 60;
    updateClockDisplay();
    renderBoard();
    updateCapturedPieces();
    updateMoveHistory();
    updateUndoButton();
    updateEvalBar();

    trainingPaused = false;
    trainingResumeCallback = null;

    if (trainingFreeMode) {
        trainingPaused = true;
        const variants = getOpeningVariants([]);
        if (variants.length > 0) {
            const key = '';
            showVariantsPopup(variants, key, (selectedVariant) => {
                trainingResumeCallback = null;
                continueTrainingFromVariant(selectedVariant, key);
            });
        }
        return;
    }

    const uciMoves = trainingOpening.moves.split(' ');

    function playNextMove(index) {
        if (!trainingActive || index >= uciMoves.length || game.gameOver) {
            if (trainingActive) onTrainingFinished();
            return;
        }

        const uci = uciMoves[index];
        const fromCol = uci.charCodeAt(0) - 97;
        const fromRow = 8 - parseInt(uci[1]);
        const toCol = uci.charCodeAt(2) - 97;
        const toRow = 8 - parseInt(uci[3]);

        const result = game.makeMove(fromRow, fromCol, toRow, toCol);
        if (result) {
            lastMoveSquares = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
            renderBoard();
            updateCapturedPieces();
            updateMoveHistory();
            updateUndoButton();
            updateEvalBar();

            const history = game.moveHistoryUCI || [];
            const variants = getOpeningVariants(history);
            if (variants.length > 1 && index < uciMoves.length - 1) {
                trainingPaused = true;
                trainingResumeCallback = () => {
                    trainingPaused = false;
                    trainingResumeCallback = null;
                    trainingTimeoutId = setTimeout(() => playNextMove(index + 1), 800);
                };
            }

            detectOpening();

            if (!trainingPaused) {
                trainingTimeoutId = setTimeout(() => playNextMove(index + 1), 1200);
            }
        }
    }

    function onTrainingFinished() {
        trainingPaused = false;
        trainingResumeCallback = null;
        trainingTimeoutId = null;
        setGameButtonsDisabled(false);
        showLoadedGameMessage('Apertura completada', false);
        showContinueButton();
    }

    trainingTimeoutId = setTimeout(() => playNextMove(0), 600);
}

function startOpeningQuiz() {
    if (!trainingOpening) return;

    scrollToBoard();
    cancelTrainingTimeout();
    trainingActive = false;
    trainingFreeMode = false;
    trainingPaused = false;
    trainingResumeCallback = null;
    clearAutoSavedGame();
    game = new ChessGame();
    selectedSquare = null;
    lastMoveSquares = { from: null, to: null };
    currentMoveIndex = -1;
    currentOpeningName = '';
    lastOpeningMoveCount = 0;
    const openingLog = document.getElementById('opening-log');
    if (openingLog) openingLog.remove();
    stopClock();
    whiteTime = timePerPlayer * 60;
    blackTime = timePerPlayer * 60;
    updateClockDisplay();

    quizMode = true;
    quizMoves = trainingOpening.moves.split(' ');
    quizIndex = 0;
    quizCorrect = 0;
    quizWrong = 0;

    document.getElementById('quiz-correct-count').textContent = '0';
    document.getElementById('quiz-wrong-count').textContent = '0';
    document.getElementById('quiz-score').style.display = 'flex';
    document.getElementById('opening-training-moves').style.display = 'none';

    renderBoard();
    updateCapturedPieces();
    updateMoveHistory();
    updateUndoButton();
    updateEvalBar();

    showMessage(`<strong>Quiz: ${trainingOpening.name}</strong><br>Juega todos los movimientos correctos (blancas y negras)<br><br><strong>Movimientos:</strong> ${trainingOpening.san}`, 'info', 0);
}

function quizCheckMove(fromRow, fromCol, toRow, toCol, promotionPiece) {
    if (!quizMode || quizIndex >= quizMoves.length) return false;

    const expectedUci = quizMoves[quizIndex];
    const playerUci = moveToUCI(fromRow, fromCol, toRow, toCol, promotionPiece);

    if (playerUci === expectedUci) {
        // Correct move
        quizCorrect++;
        document.getElementById('quiz-correct-count').textContent = quizCorrect;

        const result = game.makeMove(fromRow, fromCol, toRow, toCol, promotionPiece);
        if (result) {
            lastMoveSquares = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
            quizIndex++;
            selectedSquare = null;
            renderBoard();
            updateCapturedPieces();
            updateMoveHistory();
            detectOpening();
            updateEvalBar();

            // Flash correct highlight
            const squares = document.querySelectorAll('.square');
            squares.forEach(sq => {
                const r = parseInt(sq.dataset.row);
                const c = parseInt(sq.dataset.col);
                if (r === toRow && c === toCol) sq.classList.add('quiz-correct-move');
            });
            setTimeout(() => {
                document.querySelectorAll('.quiz-correct-move').forEach(s => s.classList.remove('quiz-correct-move'));
                if (quizIndex >= quizMoves.length) {
                    quizFinished();
                }
            }, 800);
        }
        return true;
    } else {
        // Wrong move
        quizWrong++;
        document.getElementById('quiz-wrong-count').textContent = quizWrong;

        // Show wrong highlight on player's target
        const squares = document.querySelectorAll('.square');
        squares.forEach(sq => {
            const r = parseInt(sq.dataset.row);
            const c = parseInt(sq.dataset.col);
            if (r === toRow && c === toCol) sq.classList.add('quiz-wrong-move');
        });

        // Show correct move hint
        const correctTo = {
            col: expectedUci.charCodeAt(2) - 97,
            row: 8 - parseInt(expectedUci[3])
        };
        const correctFrom = {
            col: expectedUci.charCodeAt(0) - 97,
            row: 8 - parseInt(expectedUci[1])
        };
        setTimeout(() => {
            document.querySelectorAll('.quiz-wrong-move').forEach(s => s.classList.remove('quiz-wrong-move'));
            const sqs = document.querySelectorAll('.square');
            sqs.forEach(sq => {
                const r = parseInt(sq.dataset.row);
                const c = parseInt(sq.dataset.col);
                if ((r === correctFrom.row && c === correctFrom.col) || (r === correctTo.row && c === correctTo.col)) {
                    sq.classList.add('quiz-hint');
                }
            });
            showMessage('Incorrecto. Las casillas marcadas muestran el movimiento correcto. Inténtalo de nuevo.', 'warning', 0);
            setTimeout(() => {
                document.querySelectorAll('.quiz-hint').forEach(s => s.classList.remove('quiz-hint'));
            }, 8000);
        }, 500);

        selectedSquare = null;
        renderBoard();
        return true;
    }
}

function quizFinished() {
    quizMode = false;
    document.getElementById('opening-training-moves').style.display = '';
    const total = quizCorrect + quizWrong;
    const pct = total > 0 ? Math.round(quizCorrect / total * 100) : 0;
    showMessage(`<strong>Quiz completado: ${trainingOpening.name}</strong><br>Aciertos: ${quizCorrect} | Fallos: ${quizWrong} | Precisión: ${pct}%`, 'success', 0);
    showContinueButton();
}

function applyBoardTheme() {
    const boardElement = document.getElementById('chess-board');
    boardElement.className = 'chess-board board-theme-' + boardTheme + ' piece-style-' + pieceStyle;
}

function undoMove() {
    if (!game.canUndo()) {
        showMessage('No hay movimientos para deshacer', 'warning', 2000);
        return;
    }

    hideBoardBanner();

        game.undoMove();
        if (game.canUndo()) {
        game.undoMove();
    }

    renderBoard();
    updateCapturedPieces();
    updateMoveHistory();
    updateUndoButton();
    updateEvalBar();
    recalcOpening();
    autoSaveGame();
}

function updateUndoButton() {
    const canUndo = game && game.canUndo();
    ['undo-move', 'undo-move-sidebar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !canUndo;
    });
    const analysisBtn = document.getElementById('view-analysis');
    if (analysisBtn) {
        analysisBtn.style.display = game && game.gameOver && (game.moveHistoryUCI || []).length > 0 ? 'block' : 'none';
    }
}

async function getHint() {
    if (game.gameOver) {
        showMessage('El juego ha terminado', 'warning', 2000);
        return;
    }
    
    showThinkingIndicator(true);

    try {
        const bestMove = await getAIMove();
        if (bestMove) {
            const fromSquare = bestMove.substring(0, 2);
            const toSquare = bestMove.substring(2, 4);
            showMessage(`💡 Sugerencia: ${fromSquare} → ${toSquare}`, 'info', 1000);
            
            const move = parseUCIMove(bestMove);
            if (move) {
                bestMoveSquares = {
                    from: { row: move.fromRow, col: move.fromCol },
                    to: { row: move.toRow, col: move.toCol }
                };
                renderBoard();
            }
        }
    } catch (error) {
        showMessage('Error al obtener sugerencia: ' + error.message, 'error', 3000);
    } finally {
        showThinkingIndicator(false);
    }
}

// Funciones auxiliares para UCI (notación de ajedrez)
function getMoveHistoryUCI() {
    // Convertir historial de movimientos interno a formato UCI
    // Por ahora devolvemos string vacío si no hay movimientos
    // En una implementación completa, necesitaríamos rastrear los movimientos en formato UCI
    return game.moveHistoryUCI ? game.moveHistoryUCI.join(' ') : '';
}

function parseUCIMove(uciMove) {
    // Convertir notación UCI (ej: "e2e4") a coordenadas internas
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    
    const fromFile = uciMove[0];
    const fromRank = uciMove[1];
    const toFile = uciMove[2];
    const toRank = uciMove[3];
    
    const fromCol = files.indexOf(fromFile);
    const fromRow = 8 - parseInt(fromRank);
    const toCol = files.indexOf(toFile);
    const toRow = 8 - parseInt(toRank);
    
    if (fromCol === -1 || toCol === -1 || fromRow < 0 || fromRow > 7 || toRow < 0 || toRow > 7) {
        return null;
    }
    
    return { fromRow, fromCol, toRow, toCol };
}

function moveToUCI(fromRow, fromCol, toRow, toCol, promotionPiece) {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const fromSquare = files[fromCol] + (8 - fromRow);
    const toSquare = files[toCol] + (8 - toRow);
    let uci = fromSquare + toSquare;
    if (promotionPiece) {
        const p = { queen: 'q', rook: 'r', bishop: 'b', knight: 'n' }[promotionPiece];
        if (p) uci += p;
    }
    return uci;
}

function saveGame() {
    const gameState = {
        board: game.getBoardState(),
        currentTurn: game.currentTurn,
        moveHistory: game.moveHistory,
        moveHistoryUCI: game.moveHistoryUCI || [],
        capturedPieces: game.capturedPieces,
        gameStateHistory: game.gameStateHistory || [],
        enPassantTarget: game.enPassantTarget,
        castlingRights: game.castlingRights,
        gameOver: game.gameOver,
        playerColor: playerColor,
        timestamp: new Date().toISOString()
    };

    const savedGames = JSON.parse(localStorage.getItem('saved_games') || '[]');
    const defaultName = `Partida ${savedGames.length + 1}`;
    
    showSaveDialog(defaultName, (gameName) => {
        gameState.name = gameName;
        savedGames.push(gameState);
        localStorage.setItem('saved_games', JSON.stringify(savedGames));
        showMessage('Partida guardada correctamente', 'success', 2000);
    });
}

function showSaveDialog(defaultName, onSave) {
    let overlay = document.getElementById('game-list-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'game-list-overlay';
    overlay.className = 'message-overlay';
    overlay.style.display = 'flex';
    document.body.appendChild(overlay);

    const modal = document.createElement('div');
    modal.className = 'game-list-modal';

    const title = document.createElement('h3');
    title.textContent = 'Guardar Partida';
    title.className = 'game-list-title';
    modal.appendChild(title);

    const label = document.createElement('label');
    label.textContent = 'Nombre:';
    label.style.cssText = 'display:block;margin-bottom:8px;color:#555;font-weight:600;font-size:0.9rem;';
    modal.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultName;
    input.className = 'select';
    input.style.marginBottom = '16px';
    modal.appendChild(input);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-success';
    saveBtn.textContent = '💾 Guardar';
    saveBtn.style.marginTop = '0';
    saveBtn.addEventListener('click', () => {
        const name = input.value.trim() || defaultName;
        overlay.remove();
        onSave(name);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.style.marginTop = '0';
    cancelBtn.addEventListener('click', () => overlay.remove());

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);
    modal.appendChild(btnRow);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });

    input.focus();
    input.select();

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveBtn.click();
        if (e.key === 'Escape') overlay.remove();
    });
}

function loadGame() {
    const savedGames = JSON.parse(localStorage.getItem('saved_games') || '[]');
    
    if (savedGames.length === 0) {
        showMessage('No hay partidas guardadas', 'warning', 2000);
        return;
    }

    showGameList(savedGames);
}

function showGameList(savedGames) {
    let overlay = document.getElementById('game-list-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'game-list-overlay';
    overlay.className = 'message-overlay';
    overlay.style.display = 'flex';
    document.body.appendChild(overlay);

    const modal = document.createElement('div');
    modal.className = 'game-list-modal';

    const title = document.createElement('h3');
    title.textContent = 'Partidas Guardadas';
    title.className = 'game-list-title';
    modal.appendChild(title);

    const list = document.createElement('div');
    list.className = 'game-list';

    savedGames.forEach((g, idx) => {
        const item = document.createElement('div');
        item.className = 'game-list-item';

        const name = document.createElement('span');
        name.className = 'game-list-name';
        name.textContent = g.name || `Partida ${idx + 1}`;

        const info = document.createElement('span');
        info.className = 'game-list-info';
        const date = new Date(g.timestamp).toLocaleDateString();
        const moves = (g.moveHistory || []).length;
        info.textContent = `${date} · ${moves} mov.`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'game-list-delete';
        deleteBtn.textContent = '✕';
        deleteBtn.title = 'Eliminar partida';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            savedGames.splice(idx, 1);
            localStorage.setItem('saved_games', JSON.stringify(savedGames));
            overlay.remove();
            if (savedGames.length > 0) {
                showGameList(savedGames);
            } else {
                showMessage('No quedan partidas guardadas', 'info', 2000);
            }
        });

        item.appendChild(name);
        item.appendChild(info);
        item.appendChild(deleteBtn);

        item.addEventListener('click', () => {
            overlay.remove();
            loadGameByIndex(savedGames, idx);
        });

        list.appendChild(item);
    });

    modal.appendChild(list);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-secondary';
    closeBtn.textContent = 'Cancelar';
    closeBtn.style.marginTop = '12px';
    closeBtn.style.width = '100%';
    closeBtn.addEventListener('click', () => overlay.remove());
    modal.appendChild(closeBtn);

    overlay.appendChild(modal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
}

function loadGameByIndex(savedGames, index) {
    if (index >= 0 && index < savedGames.length) {
        const savedGame = savedGames[index];
        
        stopClock();
    game = new ChessGame();
        game.board = savedGame.board;
        game.currentTurn = savedGame.currentTurn;
        game.moveHistory = savedGame.moveHistory || [];
        game.moveHistoryUCI = savedGame.moveHistoryUCI || [];
        game.capturedPieces = savedGame.capturedPieces;
        game.enPassantTarget = savedGame.enPassantTarget || null;
        game.castlingRights = savedGame.castlingRights || game.castlingRights;
        playerColor = savedGame.playerColor || playerColor;
        document.getElementById('player-color').value = playerColor;
        syncPlayerColorUI();
        selectedSquare = null;
        lastMoveSquares = { from: null, to: null };
        currentOpeningName = '';
        lastOpeningMoveCount = 0;
        const openingLog = document.getElementById('opening-log');
        if (openingLog) openingLog.remove();

        if (savedGame.gameStateHistory && savedGame.gameStateHistory.length > 0) {
            game.gameStateHistory = savedGame.gameStateHistory;
        } else {
            game.gameStateHistory = [];
        }

        game.gameStateHistory.push({
            board: JSON.parse(JSON.stringify(game.board)),
            currentTurn: game.currentTurn,
            capturedPieces: JSON.parse(JSON.stringify(game.capturedPieces)),
            enPassantTarget: game.enPassantTarget ? { ...game.enPassantTarget } : null,
            castlingRights: JSON.parse(JSON.stringify(game.castlingRights)),
            gameOver: false
        });

        // Detectar si la posición es final (ahogado, jaque mate, o triple repetición)
        game.gameOver = false;
        const isFinished = game.isCheckmate() || game.isStalemate() || game.isThreefoldRepetition();
        game.gameOver = isFinished;

        currentMoveIndex = -1;
    renderBoard();
    updateCapturedPieces();
    updateMoveHistory();
        updateUndoButton();
        updateNavigationButtons();
        updateEvalBar();
        recalcOpening();
        autoSaveGame();
    
        const numMoves = (game.moveHistory || []).length;
        showLoadedGameMessage(`Partida cargada: ${numMoves} movimientos`, isFinished, null);
        if (!isFinished) showContinueButton();
    }
}

function exportPGN() {
    if (game.moveHistory.length === 0) {
        showMessage('No hay movimientos para exportar', 'warning', 2000);
        return;
    }

    const hasAnalysis = analysisErrorsList && analysisErrorsList.length > 0;
    const pgn = buildPGNContent();
    const filename = `partida_${new Date().toISOString().slice(0,10)}_${String(new Date().getHours()).padStart(2,'0')}${String(new Date().getMinutes()).padStart(2,'0')}.pgn`;

    if (hasAnalysis) {
        showMessage('📊 Se añade Análisis de Partida al PGN', 'info', 2500);
    }

    if (window.matchMedia('(max-width: 1024px) and (orientation: portrait), (max-width: 768px)').matches) {
        exportPGNDirectMobile(pgn, filename);
    } else {
        doExportPGN(pgn, filename);
    }
}

function copyPGN() {
    if (game.moveHistory.length === 0) {
        showMessage('No hay movimientos para copiar', 'warning', 2000);
        return;
    }
    const hasAnalysis = analysisErrorsList && analysisErrorsList.length > 0;
    const pgn = buildPGNContent();
    const successMsg = hasAnalysis
        ? 'PGN copiado al portapapeles<br>📊 Se añade Análisis de Partida al PGN'
        : 'PGN copiado al portapapeles';
    navigator.clipboard.writeText(pgn).then(() => {
        showMessage(successMsg, 'success', 2500);
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = pgn;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showMessage(successMsg, 'success', 2500);
    });
}

async function exportPGNDirectMobile(pgn, suggestedName) {
    try {
        if ('showSaveFilePicker' in window) {
            const handle = await window.showSaveFilePicker({
                suggestedName: suggestedName,
                types: [{ description: 'Archivo PGN', accept: { 'text/plain': ['.pgn'] } }]
            });
            const writable = await handle.createWritable();
            await writable.write(pgn);
            await writable.close();
        } else {
            doExportPGN(pgn, suggestedName);
        }
    } catch (err) {
        if (err.name !== 'AbortError') {
            doExportPGN(pgn, suggestedName);
        }
    }
}

function pgnAnnotationForMove(moveIndex) {
    if (!analysisErrorsList || !analysisErrorsList.length) return '';
    const err = analysisErrorsList.find(e => e.moveIndex === moveIndex);
    if (!err) return '';
    const nag = err.type === 'blunder' ? '$4' : '$6';
    const label = err.type === 'blunder' ? 'Error grave' : 'Imprecisión';
    const bestSan = uciToSan(err.bestMove, err.moveIndex);
    return ` ${nag} {${label} (${err.loss.toFixed(1)}). Mejor: ${bestSan}}`;
}

function buildPGNContent() {
    const allMoves = game.moveHistory || [];
    const allMovesUCI = game.moveHistoryUCI || [];
    const hasAnalysis = analysisErrorsList && analysisErrorsList.length > 0;

    let result = '*';
    if (game.gameOver) {
        const lastMove = allMoves[allMoves.length - 1] || '';
        if (lastMove.includes('#')) {
            const winnerIsWhite = allMoves.length % 2 === 1;
            result = winnerIsWhite ? '1-0' : '0-1';
        } else {
            result = '1/2-1/2';
        }
    }

    const diffSelect = document.getElementById('ai-difficulty');
    const diffLabel = diffSelect ? diffSelect.options[diffSelect.selectedIndex].text : ('Nivel ' + aiDifficulty);
    const whitePlayer = playerColor === 'white' ? 'Jugador' : ('AjedrezIA');
    const blackPlayer = playerColor === 'black' ? 'Jugador' : ('AjedrezIA');
    var fgt = document.getElementById('famous-game-title'); const famousTitle = (fgt && fgt.textContent) || '';
    const defaultEvent = 'AjedrezIA - ' + diffLabel;

    let pgn = '';
    pgn += `[Event "${famousTitle || defaultEvent}"]\n`;
    pgn += `[Site "AjedrezIA v${APP_VERSION}"]\n`;
    pgn += `[Date "${new Date().toISOString().split('T')[0]}"]\n`;
    pgn += `[White "${whitePlayer}"]\n`;
    pgn += `[Black "${blackPlayer}"]\n`;
    pgn += `[Result "${result}"]\n`;
    pgn += `[PlyCount "${allMoves.length}"]\n`;
    if (hasAnalysis) {
        pgn += `[Annotator "Stockfish Analysis"]\n`;
    }
    pgn += '\n';

    for (let i = 0; i < allMoves.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        pgn += `${moveNum}. ${allMoves[i]}`;
        pgn += pgnAnnotationForMove(i);
        if (i + 1 < allMoves.length) {
            pgn += ` ${allMoves[i + 1]}`;
            pgn += pgnAnnotationForMove(i + 1);
        }
        pgn += ' ';
    }

    pgn += result;
    return pgn;
}

function showExportPGNDialog(defaultName, pgn) {
    let overlay = document.getElementById('game-list-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'game-list-overlay';
    overlay.className = 'message-overlay';
    overlay.style.display = 'flex';
    document.body.appendChild(overlay);

    const modal = document.createElement('div');
    modal.className = 'game-list-modal';

    const title = document.createElement('h3');
    title.textContent = 'Exportar PGN';
    title.className = 'game-list-title';
    modal.appendChild(title);

    const label = document.createElement('label');
    label.textContent = 'Nombre del archivo:';
    label.style.cssText = 'display:block;margin-bottom:8px;color:#555;font-weight:600;font-size:0.9rem;';
    modal.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultName;
    input.className = 'select';
    input.style.marginBottom = '16px';
    modal.appendChild(input);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-success';
    saveBtn.textContent = '💾 Guardar';
    saveBtn.style.marginTop = '0';
    saveBtn.addEventListener('click', async () => {
        let filename = input.value.trim() || defaultName;
        if (!filename.toLowerCase().endsWith('.pgn')) filename += '.pgn';
        overlay.remove();

        try {
            if ('showSaveFilePicker' in window) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{ description: 'Archivo PGN', accept: { 'text/plain': ['.pgn'] } }]
                });
                const writable = await handle.createWritable();
                await writable.write(pgn);
                await writable.close();
            } else {
                doExportPGN(pgn, filename);
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                doExportPGN(pgn, filename);
            }
        }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = 'Cancelar';
    cancelBtn.style.marginTop = '0';
    cancelBtn.addEventListener('click', () => overlay.remove());

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);
    modal.appendChild(btnRow);
    overlay.appendChild(modal);
}

function doExportPGN(pgn, filename) {
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importPGN() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pgn,.txt';
    
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const pgnText = event.target.result;
            parsePGNAndLoad(pgnText);
        };
        reader.readAsText(file);
    });
    
    input.click();
}

function setFamousGameTitle(name) {
    const el = document.getElementById('famous-game-title');
    if (el) {
        el.textContent = name || '';
        el.style.display = name ? 'block' : 'none';
    }
}

function parsePGNAndLoad(pgnRaw, gameTitle) {
    scrollToBoard();
    cancelTrainingTimeout();
    trainingActive = false;
    trainingFreeMode = false;
    setGameButtonsDisabled(false);
    try {
        // Eliminar BOM y normalizar whitespace
        let cleanedPgn = pgnRaw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Si hay múltiples partidas, usar solo la primera
        const gameBlocks = cleanedPgn.split(/\n\n(?=\[Event)/);
        const pgnText = gameBlocks[0] || cleanedPgn;

        // Extraer headers PGN antes de eliminarlos
        const headers = {};
        const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
        let match;
        while ((match = headerRegex.exec(pgnText)) !== null) {
            headers[match[1]] = match[2];
        }

        setFamousGameTitle(gameTitle || headers['Event'] || '');

        // Extraer anotaciones de análisis antes de limpiar
        const importedAnalysis = extractAnalysisFromPGN(pgnText);

        // Extraer movimientos: quitar headers, comentarios, variantes, NAG
        let movesText = pgnText
            .replace(/\[.*?\]\s*/g, '')
            .replace(/\{[^}]*\}/g, '')
            .replace(/;.*$/gm, '')
            .replace(/\$\d+/g, '');

        // Eliminar variantes con paréntesis anidados
        let prev;
        do {
            prev = movesText;
            movesText = movesText.replace(/\([^()]*\)/g, '');
        } while (movesText !== prev);

        movesText = movesText.replace(/\d+\.\.\./g, '').trim();

        // Capturar resultado antes de quitarlo
        const resultMatch = movesText.match(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/);
        const pgnResult = resultMatch ? resultMatch[1] : (headers['Result'] || '*');

        // Quitar resultado final
        movesText = movesText.replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/, '').trim();

        // Separar movimientos individuales: "1. e4 e5 2. Nf3 Nc6" → ["e4", "e5", "Nf3", "Nc6"]
        const moves = movesText
            .split(/\s+/)
            .filter(token => token && !token.match(/^\d+\.?$/) && !token.match(/^\$/) && !token.match(/^(1-0|0-1|1\/2-1\/2|\*)$/))
            .map(m => m.replace(/^\d+\./, ''))
            .filter(m => m.length > 0 && m.match(/^[a-hKQRBNO0]/));

        if (moves.length === 0) {
            showMessage('No se encontraron movimientos en el PGN', 'error', 3000);
            return;
        }

        // Crear nueva partida y reproducir movimientos
        stopClock();
        game = new ChessGame();
        currentMoveIndex = -1;
        currentOpeningName = '';
        lastOpeningMoveCount = 0;

        let movesPlayed = 0;
        let failedMove = null;

        console.log(`PGN Import: ${moves.length} tokens a procesar`);

        // Registro de candidatos alternativos para backtracking
        const ambiguousHistory = [];

        for (let mi = 0; mi < moves.length; mi++) {
            const sanMove = moves[mi];
            if (game.gameOver) game.gameOver = false;

            const candidates = [];
            const parsed = parseSANMove(sanMove, game, candidates);

            if (!parsed) {
                // Intentar backtracking: buscar un movimiento ambiguo anterior con alternativas
                let recovered = false;
                for (let bi = ambiguousHistory.length - 1; bi >= 0 && !recovered; bi--) {
                    const entry = ambiguousHistory[bi];
                    if (entry.triedIndex >= entry.candidates.length - 1) continue;

                    // Deshacer movimientos desde entry.moveIndex hasta ahora
                    const undoCount = movesPlayed - entry.moveIndex;
                    for (let u = 0; u < undoCount; u++) {
                        game.undoMove();
                        movesPlayed--;
                    }

                    // Probar el siguiente candidato
                    entry.triedIndex++;
                    const altParsed = entry.candidates[entry.triedIndex];
                    if (game.gameOver) game.gameOver = false;
                    const altResult = game.makeMove(altParsed.fromRow, altParsed.fromCol, altParsed.toRow, altParsed.toCol, altParsed.promotion);
                    if (altResult) {
                        movesPlayed++;
                        // Eliminar entradas de historial posteriores
                        ambiguousHistory.length = bi + 1;
                        // Re-jugar los movimientos subsiguientes
                        let replayOk = true;
                        for (let ri = entry.tokenIndex + 1; ri <= mi; ri++) {
                            if (game.gameOver) game.gameOver = false;
                            const rCandidates = [];
                            const rParsed = parseSANMove(moves[ri], game, rCandidates);
                            if (!rParsed) { replayOk = false; break; }
                            const rResult = game.makeMove(rParsed.fromRow, rParsed.fromCol, rParsed.toRow, rParsed.toCol, rParsed.promotion);
                            if (!rResult) { replayOk = false; break; }
                            movesPlayed++;
                            if (rCandidates.length > 1) {
                                ambiguousHistory.push({ moveIndex: movesPlayed - 1, tokenIndex: ri, candidates: rCandidates, triedIndex: 0 });
                            }
                        }
                        if (replayOk) {
                            console.log(`PGN Import: backtrack exitoso en movimiento ${entry.moveIndex + 1}`);
                            recovered = true;
                        }
                    }
                }
                if (!recovered) {
                    const moveNum = Math.floor(movesPlayed / 2) + 1;
                    const side = game.currentTurn === 'white' ? '' : '...';
                    failedMove = `${moveNum}.${side}${sanMove}`;
                    console.warn(`PGN Import STOP: no se pudo parsear "${sanMove}" (mov ${movesPlayed + 1}, turno ${game.currentTurn})`);
                    break;
                }
                continue;
            }

            const result = game.makeMove(parsed.fromRow, parsed.fromCol, parsed.toRow, parsed.toCol, parsed.promotion);
            if (!result) {
                const moveNum = Math.floor(movesPlayed / 2) + 1;
                const side = game.currentTurn === 'white' ? '' : '...';
                failedMove = `${moveNum}.${side}${sanMove}`;
                console.warn(`PGN Import STOP: movimiento inválido "${sanMove}" (${parsed.fromRow},${parsed.fromCol} → ${parsed.toRow},${parsed.toCol})`);
                break;
            }
            movesPlayed++;

            if (candidates.length > 1) {
                ambiguousHistory.push({ moveIndex: movesPlayed - 1, tokenIndex: mi, candidates, triedIndex: 0 });
            }
        }

        console.log(`PGN Import: ${movesPlayed}/${moves.length} movimientos cargados`);

        // Solo declarar terminada si la posición lo indica O si el PGN se cargó completo.
        // Triple repetición solo cuenta si se cargaron todos los movimientos
        // (para no bloquear imports de PGNs que continuaron tras la repetición).
        const positionFinished = game.isCheckmate() || game.isStalemate();
        const allLoaded = movesPlayed === moves.length;
        const isFinished = positionFinished ||
            (allLoaded && (pgnResult !== '*' || game.isThreefoldRepetition()));
        game.gameOver = isFinished;
        game.gameStateHistory.push({
            board: JSON.parse(JSON.stringify(game.board)),
            currentTurn: game.currentTurn,
            capturedPieces: JSON.parse(JSON.stringify(game.capturedPieces)),
            enPassantTarget: game.enPassantTarget ? { ...game.enPassantTarget } : null,
            castlingRights: JSON.parse(JSON.stringify(game.castlingRights)),
            gameOver: isFinished
        });

        selectedSquare = null;
        lastMoveSquares = { from: null, to: null };
        const openingLog = document.getElementById('opening-log');
        if (openingLog) openingLog.remove();

        renderBoard();
        updateCapturedPieces();
        updateMoveHistory();
        updateUndoButton();
        updateNavigationButtons();
        updateEvalBar();
        recalcOpening();
        autoSaveGame();

        // Construir mensaje con info de la partida
        let msg = '';
        if (headers['Event'] && headers['Event'] !== '?') msg += headers['Event'] + '\n';
        if (headers['White'] || headers['Black']) {
            msg += `${headers['White'] || '?'} vs ${headers['Black'] || '?'}\n`;
        }
        if (headers['Date'] && headers['Date'] !== '?') msg += `Fecha: ${headers['Date']}\n`;
        if (headers['Site'] && headers['Site'] !== '?') msg += `${headers['Site']}\n`;
        if (pgnResult && pgnResult !== '*') {
            const resultText = pgnResult === '1-0' ? '1-0 (Ganan blancas)' :
                               pgnResult === '0-1' ? '0-1 (Ganan negras)' :
                               '½-½ (Tablas)';
            msg += `Resultado: ${resultText}\n`;
        }
        if (headers['ECO']) msg += `Apertura: ${headers['ECO']}\n`;
        const fullMoves = Math.ceil(movesPlayed / 2);
        const totalFullMoves = Math.ceil(moves.length / 2);
        msg += `Movimientos: ${fullMoves}`;
        if (movesPlayed < moves.length) {
            msg += ` de ${totalFullMoves}`;
            if (failedMove) {
                msg += `\n⚠ Error en ${failedMove}`;
            }
        }
        if (headers['WhiteElo'] || headers['BlackElo']) {
            msg += `\nELO: ${headers['WhiteElo'] || '?'} / ${headers['BlackElo'] || '?'}`;
        }

        // Restaurar análisis si el PGN contenía anotaciones
        if (importedAnalysis.length > 0) {
            resolveAnalysisUCI(importedAnalysis);
            analysisErrorsList = importedAnalysis;
            analysisErrorsCurrentIndex = 0;
            msg += '\n📊 Análisis Existente incluido en el PGN';
        }

        showLoadedGameMessage(msg, isFinished, pgnResult);
        if (!isFinished) showContinueButton();

        // Abrir el overlay de análisis si se importaron anotaciones
        if (importedAnalysis.length > 0) {
            const blunders = importedAnalysis.filter(e => e.type === 'blunder').length;
            const mistakesCount = importedAnalysis.filter(e => e.type === 'mistake').length;
            const totalMoves = (game.moveHistoryUCI || game.moveHistory || []).length;
            setTimeout(() => {
                showAnalysisResults(importedAnalysis, totalMoves, totalMoves, blunders, mistakesCount);
            }, 600);
        }

    } catch (error) {
        console.error('Error al importar PGN:', error);
        showMessage('Error al importar el archivo PGN', 'error', 3000);
    }
}

function spanishSanToEnglish(san) {
    return san.replace(/^R/, 'K').replace(/^D/, 'Q').replace(/^T/, 'R').replace(/^A/, 'B').replace(/^C/, 'N');
}

function resolveAnalysisUCI(analysisList) {
    const uciMoves = game.moveHistoryUCI || [];
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

    for (const item of analysisList) {
        const idx = item.moveIndex;

        // playerMove: usar el UCI real de la partida
        if (idx < uciMoves.length) {
            item.playerMove = uciMoves[idx];
        }

        // bestMove: convertir SAN → UCI usando el estado ANTES del movimiento
        if (item.bestMove && game.gameStateHistory && game.gameStateHistory[idx]) {
            const state = game.gameStateHistory[idx];
            const tempGame = new ChessGame();
            tempGame.board = JSON.parse(JSON.stringify(state.board));
            tempGame.currentTurn = state.currentTurn;
            tempGame.castlingRights = JSON.parse(JSON.stringify(state.castlingRights));
            tempGame.enPassantTarget = state.enPassantTarget ? { ...state.enPassantTarget } : null;

            const bestEnglish = spanishSanToEnglish(item.bestMove);
            const parsed = parseSANMove(bestEnglish, tempGame);
            if (parsed) {
                let uci = files[parsed.fromCol] + (8 - parsed.fromRow) + files[parsed.toCol] + (8 - parsed.toRow);
                if (parsed.promotion) {
                    const promoChar = { queen: 'q', rook: 'r', bishop: 'b', knight: 'n' };
                    uci += promoChar[parsed.promotion] || '';
                }
                item.bestMove = uci;
            }
        }
    }
}

function extractAnalysisFromPGN(pgnText) {
    const analysis = [];
    let movesSection = pgnText.replace(/\[.*?\]\s*/g, '').replace(/;.*$/gm, '');

    // Remove nested variations (parentheses)
    let prev;
    do {
        prev = movesSection;
        movesSection = movesSection.replace(/\([^()]*\)/g, '');
    } while (movesSection !== prev);

    // Tokenize: move numbers, SAN moves, NAGs ($N), comments ({...}), results
    const tokens = [];
    const tokenRegex = /(\d+\.+)|(\$\d+)|(\{[^}]*\})|([a-hKQRBNDTACO0][a-h1-8xO\-+=#+!?]*)|(1-0|0-1|1\/2-1\/2|\*)/g;
    let tm;
    while ((tm = tokenRegex.exec(movesSection)) !== null) {
        if (tm[1]) tokens.push({ type: 'movenum', value: tm[1] });
        else if (tm[2]) tokens.push({ type: 'nag', value: parseInt(tm[2].slice(1)) });
        else if (tm[3]) tokens.push({ type: 'comment', value: tm[3].slice(1, -1) });
        else if (tm[4]) tokens.push({ type: 'san', value: tm[4] });
        else if (tm[5]) tokens.push({ type: 'result', value: tm[5] });
    }

    // Walk tokens: track ply index and collect NAG+comment after each SAN
    let plyIndex = 0;
    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok.type === 'result') break;
        if (tok.type === 'movenum') continue;

        if (tok.type === 'san') {
            const san = tok.value.replace(/[+#!?]/g, '');
            const moveNum = Math.floor(plyIndex / 2) + 1;
            const moveSuffix = plyIndex % 2 === 1 ? '...' : '';

            // Look ahead for NAG and comment
            let nag = null;
            let comment = '';
            if (i + 1 < tokens.length && tokens[i + 1].type === 'nag') {
                nag = tokens[i + 1].value;
                i++;
            }
            if (i + 1 < tokens.length && tokens[i + 1].type === 'comment') {
                comment = tokens[i + 1].value;
                i++;
            }

            if (nag === 4 || nag === 6) {
                const type = nag === 4 ? 'blunder' : 'mistake';
                let loss = type === 'blunder' ? 3.0 : 1.0;
                let bestMove = '';

                const lossMatch = comment.match(/\(([\d.]+)\)/);
                if (lossMatch) loss = parseFloat(lossMatch[1]);

                const bestMatch = comment.match(/Mejor:\s*(\S+)/);
                if (bestMatch) bestMove = bestMatch[1];

                analysis.push({ moveIndex: plyIndex, moveNum, moveSuffix, type, loss, san, bestMove, playerMove: san });
            }

            plyIndex++;
        }
    }
    return analysis;
}

function parseSANMove(san, gameState, allCandidates) {
    const color = gameState.currentTurn;
    san = san.replace(/[+#!?]/g, '');

    if (san === 'O-O' || san === '0-0') {
        const row = color === 'white' ? 7 : 0;
        return { fromRow: row, fromCol: 4, toRow: row, toCol: 6 };
    }
    if (san === 'O-O-O' || san === '0-0-0') {
        const row = color === 'white' ? 7 : 0;
        return { fromRow: row, fromCol: 4, toRow: row, toCol: 2 };
    }

    const files = 'abcdefgh';
    const pieceMap = { 'K': 'king', 'Q': 'queen', 'R': 'rook', 'B': 'bishop', 'N': 'knight' };

    let pieceType = 'pawn';
    let disambigFile = -1;
    let disambigRank = -1;
    let toFile, toRank;
    let promotion = null;

    let s = san;

    const promoMatch = s.match(/=?([QRBN])$/);
    if (promoMatch) {
        promotion = promoMatch[1];
        s = s.replace(/=?[QRBN]$/, '');
    }

    if (s[0] && pieceMap[s[0]]) {
        pieceType = pieceMap[s[0]];
        s = s.substring(1);
    }

    s = s.replace('x', '');

    if (s.length < 2) return null;
    toFile = files.indexOf(s[s.length - 2]);
    toRank = 8 - parseInt(s[s.length - 1]);
    if (toFile < 0 || toRank < 0 || toRank > 7) return null;

    const disambig = s.substring(0, s.length - 2);
    for (const ch of disambig) {
        if (files.includes(ch)) disambigFile = files.indexOf(ch);
        else if (ch >= '1' && ch <= '8') disambigRank = 8 - parseInt(ch);
    }

    const promoMap = { 'Q': 'queen', 'R': 'rook', 'B': 'bishop', 'N': 'knight' };
    const candidates = [];

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameState.getPiece(row, col);
            if (!piece || piece.color !== color || piece.type !== pieceType) continue;

            if (disambigFile >= 0 && col !== disambigFile) continue;
            if (disambigRank >= 0 && row !== disambigRank) continue;

            const validMoves = gameState.getValidMoves(row, col);
            if (validMoves.some(m => m.row === toRank && m.col === toFile)) {
                candidates.push({
                    fromRow: row,
                    fromCol: col,
                    toRow: toRank,
                    toCol: toFile,
                    promotion: promotion ? promoMap[promotion] : undefined
                });
            }
        }
    }

    if (allCandidates) {
        allCandidates.push(...candidates);
    }
    return candidates[0] || null;
}

// Funciones para reanudar partida
function checkForGameInProgress() {
    const autoSavedGame = localStorage.getItem('auto_saved_game');
    ['resume-game', 'resume-game-sidebar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !autoSavedGame;
    });
}

function resumeGame(silent) {
    const autoSavedGame = localStorage.getItem('auto_saved_game');
    
    if (!autoSavedGame) {
        if (!silent) showMessage('No hay partida en curso para continuar', 'warning', 2000);
        return;
    }
    
    cancelTrainingTimeout();
    trainingActive = false;
    trainingFreeMode = false;
    setGameButtonsDisabled(false);
    scrollToBoard();
    try {
        const savedState = JSON.parse(autoSavedGame);
        
        // Restaurar todas las configuraciones
        playerColor = savedState.playerColor != null ? savedState.playerColor : 'white';
        aiDifficulty = savedState.aiDifficulty != null ? savedState.aiDifficulty : 20;
        boardTheme = savedState.boardTheme != null ? savedState.boardTheme : 'classic';
        pieceStyle = savedState.pieceStyle != null ? savedState.pieceStyle : 'classic';
        timePerPlayer = savedState.timePerPlayer != null ? savedState.timePerPlayer : 3;
        incrementPerMove = savedState.incrementPerMove != null ? savedState.incrementPerMove : 2;
        whiteTime = savedState.whiteTime != null ? savedState.whiteTime : timePerPlayer * 60;
        blackTime = savedState.blackTime != null ? savedState.blackTime : timePerPlayer * 60;
        lastMoveSquares = savedState.lastMoveSquares != null ? savedState.lastMoveSquares : { from: null, to: null };
        currentMoveIndex = savedState.currentMoveIndex != null ? savedState.currentMoveIndex : -1;
        
        // Actualizar UI con las configuraciones
        document.getElementById('player-color').value = playerColor;
        syncPlayerColorUI();
        document.getElementById('ai-difficulty').value = aiDifficulty;
        document.getElementById('board-theme').value = boardTheme;
        document.getElementById('piece-style').value = pieceStyle;
        updatePieceStylePreview();
        
        const timeControl = `${timePerPlayer}+${incrementPerMove}`;
        const timeControlSelect = document.getElementById('time-control');
        const matchingOption = Array.from(timeControlSelect.options).find(opt => opt.value === timeControl);
        if (matchingOption) {
            timeControlSelect.value = timeControl;
        }
        
        applyBoardTheme();
        
        // Restaurar el estado del juego
        game = new ChessGame();
        game.board = savedState.board;
        game.currentTurn = savedState.currentTurn;
        game.moveHistory = savedState.moveHistory || [];
        game.moveHistoryUCI = savedState.moveHistoryUCI || [];
        game.capturedPieces = savedState.capturedPieces;
        game.enPassantTarget = savedState.enPassantTarget || null;
        game.castlingRights = savedState.castlingRights;
        game.gameOver = savedState.gameOver || false;
        game.gameStateHistory = savedState.gameStateHistory || [];
        
        // Actualizar visualización
        renderBoard();
        updateCapturedPieces();
        updateMoveHistory();
        updateUndoButton();
        updateClockDisplay();
        updateNavigationButtons();
        updateEvalBar();
        
        const hasMoves = game.moveHistory && game.moveHistory.length > 0;
        if (!game.gameOver && hasMoves) {
            startClock();
        }
        
        // Restaurar banner de apertura
        if (hasMoves) {
            recalcOpening();
        }
        
        // Si es el turno de la IA, que mueva
        if (!game.gameOver && game.currentTurn !== playerColor) {
            setTimeout(() => makeAIMove(), 800);
        }
        
        if (!silent) showMessage('Partida continuada correctamente', 'success', 2000);
    } catch (error) {
        console.error('Error al reanudar partida:', error);
        if (!silent) showMessage('Error al continuar la partida', 'error', 3000);
        localStorage.removeItem('auto_saved_game');
        checkForGameInProgress();
        startNewGame();
    }
}

function autoSaveGame() {
    if (!game || game.gameOver) {
        clearAutoSavedGame();
        return;
    }
    
    const gameState = {
        board: game.board,
        currentTurn: game.currentTurn,
        moveHistory: game.moveHistory || [],
        capturedPieces: game.capturedPieces,
        enPassantTarget: game.enPassantTarget,
        castlingRights: game.castlingRights,
        gameOver: game.gameOver,
        gameStateHistory: game.gameStateHistory || [],
        moveHistoryUCI: game.moveHistoryUCI || [],
        playerColor: playerColor,
        aiDifficulty: aiDifficulty,
        boardTheme: boardTheme,
        pieceStyle: pieceStyle,
        timePerPlayer: timePerPlayer,
        incrementPerMove: incrementPerMove,
        whiteTime: whiteTime,
        blackTime: blackTime,
        lastMoveSquares: lastMoveSquares,
        currentMoveIndex: currentMoveIndex,
        timestamp: new Date().toISOString()
    };
    
    try {
        localStorage.setItem('auto_saved_game', JSON.stringify(gameState));
        checkForGameInProgress();
    } catch (error) {
        console.error('Error al guardar automáticamente:', error);
    }
}

function clearAutoSavedGame() {
    localStorage.removeItem('auto_saved_game');
    checkForGameInProgress();
}

// Funciones del reloj de ajedrez
function startClock() {
    stopClock();
    clockInterval = setInterval(() => {
        if (game.currentTurn === 'white') {
            whiteTime--;
            if (whiteTime <= 0) {
                stopClock();
                game.gameOver = true;
                clearAutoSavedGame();
                
                // Registrar estadística (negras ganan)
                if (playerColor === 'black') {
                    recordGameResult('win');
                } else {
                    recordGameResult('loss');
                }
                
                showMessage('¡Se acabó el tiempo de las blancas! Las negras ganan.', 'error', 0);
                setTimeout(showAnalysisButton, 100);
                return;
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                stopClock();
                game.gameOver = true;
                clearAutoSavedGame();
                
                // Registrar estadística (blancas ganan)
                if (playerColor === 'white') {
                    recordGameResult('win');
                } else {
                    recordGameResult('loss');
                }
                
                showMessage('¡Se acabó el tiempo de las negras! Las blancas ganan.', 'error', 0);
                setTimeout(showAnalysisButton, 100);
                return;
            }
        }
        updateClockDisplay();
    }, 1000);
}

function stopClock() {
    if (clockInterval) {
        clearInterval(clockInterval);
        clockInterval = null;
    }
}

function updateClockDisplay() {
    const whiteElement = document.getElementById('white-time');
    const blackElement = document.getElementById('black-time');
    
    var wt = formatTime(whiteTime);
    var bt = formatTime(blackTime);

    whiteElement.textContent = wt;
    blackElement.textContent = bt;

    var isWhiteTurn = game.currentTurn === 'white';
    var wWarn = whiteTime <= 60 && whiteTime > 30;
    var wDanger = whiteTime <= 30;
    var bWarn = blackTime <= 60 && blackTime > 30;
    var bDanger = blackTime <= 30;

    var whiteClock = whiteElement.parentElement;
    var blackClock = blackElement.parentElement;
    
    whiteClock.classList.toggle('active', isWhiteTurn);
    blackClock.classList.toggle('active', !isWhiteTurn);
    whiteClock.classList.toggle('warning', wWarn);
    whiteClock.classList.toggle('danger', wDanger);
    blackClock.classList.toggle('warning', bWarn);
    blackClock.classList.toggle('danger', bDanger);

    var miniW = document.getElementById('mini-white-time');
    var miniB = document.getElementById('mini-black-time');
    if (miniW && miniB) {
        miniW.textContent = wt;
        miniB.textContent = bt;
        var mwp = document.getElementById('mini-clock-white');
        var mbp = document.getElementById('mini-clock-black');
        if (mwp && mbp) {
            mwp.classList.toggle('active', isWhiteTurn);
            mbp.classList.toggle('active', !isWhiteTurn);
            mwp.classList.toggle('warning', wWarn);
            mwp.classList.toggle('danger', wDanger);
            mbp.classList.toggle('warning', bWarn);
            mbp.classList.toggle('danger', bDanger);
        }
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function renderBoard() {
    const boardElement = document.getElementById('chess-board');
    boardElement.innerHTML = '';
    
    // Aplicar clase de estilo de piezas al tablero
    boardElement.className = 'chess-board board-theme-' + boardTheme + ' piece-style-' + pieceStyle;
    
    const isFlipped = playerColor === 'black';
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const displayRow = isFlipped ? 7 - row : row;
            const displayCol = isFlipped ? 7 - col : col;
            
            const square = document.createElement('div');
            square.className = 'square';
            square.dataset.row = displayRow;
            square.dataset.col = displayCol;
            
            // Color del cuadrado
            const isLight = (displayRow + displayCol) % 2 === 0;
            square.classList.add(isLight ? 'light' : 'dark');
            
            // Resaltar último movimiento (error del jugador)
            if (lastMoveSquares.from && 
                lastMoveSquares.from.row === displayRow && 
                lastMoveSquares.from.col === displayCol) {
                square.classList.add('last-move');
            }
            if (lastMoveSquares.to && 
                lastMoveSquares.to.row === displayRow && 
                lastMoveSquares.to.col === displayCol) {
                square.classList.add('last-move');
            }
            // Resaltar movimiento recomendado por el análisis (verde)
            if (bestMoveSquares.from && 
                bestMoveSquares.from.row === displayRow && 
                bestMoveSquares.from.col === displayCol) {
                square.classList.add('best-move');
            }
            if (bestMoveSquares.to && 
                bestMoveSquares.to.row === displayRow && 
                bestMoveSquares.to.col === displayCol) {
                square.classList.add('best-move');
            }
            
            if (showCoordinates) {
            const coordinate = document.createElement('span');
            coordinate.className = 'square-coordinate';
            coordinate.textContent = files[displayCol] + (8 - displayRow);
            square.appendChild(coordinate);
            }
            
            // Agregar pieza si existe
            const piece = game.getPiece(displayRow, displayCol);
            if (piece) {
                // Verificar si se debe usar SVG o emoji
                if (SVG_PIECE_SETS.includes(pieceStyle)) {
                    // Usar imagen SVG
                    const pieceImg = document.createElement('img');
                    pieceImg.className = 'piece piece-svg';
                    pieceImg.dataset.color = piece.color;
                    pieceImg.dataset.type = piece.type;
                    
                    // Mapeo correcto de tipos a caracteres de notación de ajedrez
                    const typeMap = {
                        'king': 'K',
                        'queen': 'Q',
                        'rook': 'R',
                        'bishop': 'B',
                        'knight': 'N',  // ¡Importante! N para kNight
                        'pawn': 'P'
                    };
                    
                    const colorChar = piece.color === 'white' ? 'w' : 'b';
                    const typeChar = typeMap[piece.type];
                    const fileName = `${colorChar}${typeChar}.svg`;
                    
                    pieceImg.src = `pieces/${pieceStyle}/${fileName}`;
                    pieceImg.alt = piece.piece;
                    square.appendChild(pieceImg);
                } else {
                    // Usar emoji/texto
                const pieceElement = document.createElement('span');
                pieceElement.className = 'piece';
                    pieceElement.dataset.color = piece.color;
                    pieceElement.dataset.type = piece.type;
                pieceElement.textContent = piece.piece;
                square.appendChild(pieceElement);
                }
            }
            
            // Event listener para clics
            square.addEventListener('click', () => handleSquareClick(displayRow, displayCol));

            square.addEventListener('mousedown', (e) => handleDragStart(e, displayRow, displayCol));
            
            boardElement.appendChild(square);
        }
    }
    
    // Renderizar etiquetas de coordenadas en los bordes
    renderCoordinateLabels();
}

function renderCoordinateLabels() {
    const isFlipped = playerColor === 'black';
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
    
    // Etiquetas de filas (izquierda)
    const rankLabelsLeft = document.getElementById('rank-labels-left');
    rankLabelsLeft.innerHTML = '';
    const displayRanks = isFlipped ? [...ranks].reverse() : ranks;
    displayRanks.forEach(rank => {
        const label = document.createElement('div');
        label.className = 'rank-label';
        label.textContent = rank;
        rankLabelsLeft.appendChild(label);
    });
    
    // Etiquetas de columnas (abajo)
    const fileLabelsBottom = document.getElementById('file-labels-bottom');
    fileLabelsBottom.innerHTML = '';
    const displayFiles = isFlipped ? [...files].reverse() : files;
    displayFiles.forEach(file => {
        const label = document.createElement('div');
        label.className = 'file-label';
        label.textContent = file;
        fileLabelsBottom.appendChild(label);
    });
}

function handleFreeTrainingClick(row, col) {
    const clickedPiece = game.getPiece(row, col);
    
    if (selectedSquare) {
        const validMoves = game.getValidMoves(selectedSquare.row, selectedSquare.col);
        const targetMove = validMoves.find(m => m.row === row && m.col === col);
        if (targetMove) {
            const piece = game.getPiece(selectedSquare.row, selectedSquare.col);
            const isPromotion = piece && piece.type === 'pawn' && (row === 0 || row === 7);
            if (isPromotion) {
                pendingPromotionMove = { fromRow: selectedSquare.row, fromCol: selectedSquare.col, toRow: row, toCol: col, isQuiz: false, isFreeTraining: true };
            selectedSquare = null;
                showPromotionDialog(piece.color);
                return;
            }
            executeFreeTrainingMove(selectedSquare.row, selectedSquare.col, row, col);
            return;
        } else if (clickedPiece && clickedPiece.color === game.currentTurn) {
            selectedSquare = { row, col };
            highlightValidMoves(row, col);
        } else {
            selectedSquare = null;
            renderBoard();
        }
    } else if (clickedPiece && clickedPiece.color === game.currentTurn) {
        selectedSquare = { row, col };
        highlightValidMoves(row, col);
    }
}

function executeFreeTrainingMove(fromRow, fromCol, toRow, toCol, promotionPiece) {
    const result = game.makeMove(fromRow, fromCol, toRow, toCol, promotionPiece);
    if (!result) return;

    lastMoveSquares = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
    bestMoveSquares = { from: null, to: null };
    selectedSquare = null;
            renderBoard();
            updateCapturedPieces();
            updateMoveHistory();
            updateUndoButton();
    updateEvalBar();
    detectOpening();

    const history = game.moveHistoryUCI || [];
    const variants = getOpeningVariants(history);

    if (variants.length > 0) {
        trainingPaused = true;
        const key = history.join(' ');
        showVariantsPopup(variants, key, (selectedVariant) => {
            trainingResumeCallback = null;
            continueTrainingFromVariant(selectedVariant, key);
        });
    } else {
        trainingActive = false;
        trainingFreeMode = false;
        setGameButtonsDisabled(false);
        showLoadedGameMessage('No hay más variantes en la base de datos', false);
        showContinueButton();
    }
}

function handleSquareClick(row, col) {
    if (dragState) return;
    if (analysisActive) return;
    if (game.gameOver && !puzzleMode) return;

    if (puzzleMode && puzzleActive) {
        handlePuzzleClick(row, col);
        return;
    }

    if (trainingFreeMode && trainingActive) {
        handleFreeTrainingClick(row, col);
        return;
    }
    
    // Quiz mode: player must play both white and black moves
    if (quizMode) {
    const clickedPiece = game.getPiece(row, col);
    
    if (selectedSquare) {
        const validMoves = game.getValidMoves(selectedSquare.row, selectedSquare.col);
        const targetMove = validMoves.find(m => m.row === row && m.col === col);
        
        if (targetMove) {
                const piece = game.getPiece(selectedSquare.row, selectedSquare.col);
                const isPromotion = piece && piece.type === 'pawn' && (row === 0 || row === 7);
                if (isPromotion) {
                    pendingPromotionMove = { fromRow: selectedSquare.row, fromCol: selectedSquare.col, toRow: row, toCol: col, isQuiz: true };
            selectedSquare = null;
                    showPromotionDialog(piece.color);
                    return;
                }
                quizCheckMove(selectedSquare.row, selectedSquare.col, row, col);
                return;
            } else if (clickedPiece && clickedPiece.color === game.currentTurn) {
                selectedSquare = { row, col };
                highlightValidMoves(row, col);
            } else {
                selectedSquare = null;
                renderBoard();
            }
        } else if (clickedPiece && clickedPiece.color === game.currentTurn) {
            selectedSquare = { row, col };
            highlightValidMoves(row, col);
        }
        return;
    }

    // Solo permitir mover las piezas del jugador (siempre vs IA)
    if (game.currentTurn !== playerColor) return;
    
    const clickedPiece = game.getPiece(row, col);
    
    if (selectedSquare) {
        const validMoves = game.getValidMoves(selectedSquare.row, selectedSquare.col);
        const targetMove = validMoves.find(m => m.row === row && m.col === col);
        
        if (targetMove) {
            const piece = game.getPiece(selectedSquare.row, selectedSquare.col);
            const isPromotion = piece && piece.type === 'pawn' && (row === 0 || row === 7);

            if (isPromotion) {
                pendingPromotionMove = {
                    fromRow: selectedSquare.row,
                    fromCol: selectedSquare.col,
                    toRow: row,
                    toCol: col,
                    isQuiz: false
                };
                selectedSquare = null;
                showPromotionDialog(piece.color);
                return;
            }

            executeMove(selectedSquare.row, selectedSquare.col, row, col);
        } else if (clickedPiece && clickedPiece.color === playerColor) {
            // Seleccionar otra pieza propia
            selectedSquare = { row, col };
            highlightValidMoves(row, col);
        } else {
            // Deseleccionar
            selectedSquare = null;
            renderBoard();
        }
    } else if (clickedPiece && clickedPiece.color === playerColor) {
        // Seleccionar una pieza
        selectedSquare = { row, col };
        highlightValidMoves(row, col);
    }
}

// --- Drag & Drop ---

function handleDragStart(e, row, col) {
    if (e.button !== 0) return;
    if (analysisActive || !game || (game.gameOver && !puzzleMode)) return;
    if ('ontouchstart' in window && e.pointerType === 'touch') return;

    const piece = game.getPiece(row, col);
    if (!piece) return;

    const isPuzzleActive = puzzleMode && puzzleActive;
    const isFreeTraining = trainingFreeMode && trainingActive;
    const allowedColor = (quizMode || isFreeTraining || isPuzzleActive) ? game.currentTurn : playerColor;
    if (piece.color !== allowedColor) return;
    if (!quizMode && !isFreeTraining && !isPuzzleActive && game.currentTurn !== playerColor) return;

    e.preventDefault();

    const squareEl = e.currentTarget;
    const pieceEl = squareEl.querySelector('.piece, .piece-svg');
    if (!pieceEl) return;

    const rect = squareEl.getBoundingClientRect();
    const ghost = pieceEl.cloneNode(true);
    ghost.className = pieceEl.className + ' drag-ghost';
    ghost.style.width = rect.width * 0.85 + 'px';
    ghost.style.height = rect.height * 0.85 + 'px';
    ghost.style.left = (e.clientX - rect.width * 0.425) + 'px';
    ghost.style.top = (e.clientY - rect.height * 0.425) + 'px';
    document.body.appendChild(ghost);

    pieceEl.style.opacity = '0.25';

    const validMoves = game.getValidMoves(row, col);

    selectedSquare = { row, col };
    highlightValidMoves(row, col);

    const newPieceEl = document.querySelector(`.square[data-row="${row}"][data-col="${col}"] .piece, .square[data-row="${row}"][data-col="${col}"] .piece-svg`);
    if (newPieceEl) newPieceEl.style.opacity = '0.25';

    dragState = {
        fromRow: row,
        fromCol: col,
        ghost,
        validMoves,
        squareSize: rect.width
    };
}

function handleDragMove(e) {
    if (!dragState) return;
    e.preventDefault();
    const sz = dragState.squareSize;
    dragState.ghost.style.left = (e.clientX - sz * 0.425) + 'px';
    dragState.ghost.style.top = (e.clientY - sz * 0.425) + 'px';
}

function handleDragEnd(e) {
    if (!dragState) return;

    const { fromRow, fromCol, ghost, validMoves } = dragState;
    ghost.remove();
    dragState = null;

    const boardEl = document.getElementById('chess-board');
    const boardRect = boardEl.getBoundingClientRect();
    const x = e.clientX - boardRect.left;
    const y = e.clientY - boardRect.top;

    if (x < 0 || y < 0 || x > boardRect.width || y > boardRect.height) {
        selectedSquare = null;
        renderBoard();
        return;
    }

    const squareSize = boardRect.width / 8;
    let gridCol = Math.floor(x / squareSize);
    let gridRow = Math.floor(y / squareSize);
    gridCol = Math.max(0, Math.min(7, gridCol));
    gridRow = Math.max(0, Math.min(7, gridRow));

    const isFlipped = playerColor === 'black';
    const dropCol = isFlipped ? 7 - gridCol : gridCol;
    const dropRow = isFlipped ? 7 - gridRow : gridRow;

    if (dropRow === fromRow && dropCol === fromCol) {
        return;
    }

    const targetMove = validMoves.find(m => m.row === dropRow && m.col === dropCol);
    if (targetMove) {
        const piece = game.getPiece(fromRow, fromCol);
        const isPromotion = piece && piece.type === 'pawn' && (dropRow === 0 || dropRow === 7);
        if (isPromotion) {
            pendingPromotionMove = { fromRow, fromCol, toRow: dropRow, toCol: dropCol, isQuiz: quizMode, isFreeTraining: trainingFreeMode && trainingActive, isPuzzle: puzzleMode && puzzleActive };
            selectedSquare = null;
            showPromotionDialog(piece.color);
            return;
        }
        if (puzzleMode && puzzleActive) {
            puzzleCheckMove(fromRow, fromCol, dropRow, dropCol);
        } else if (trainingFreeMode && trainingActive) {
            executeFreeTrainingMove(fromRow, fromCol, dropRow, dropCol);
        } else if (quizMode) {
            quizCheckMove(fromRow, fromCol, dropRow, dropCol);
        } else {
            executeMove(fromRow, fromCol, dropRow, dropCol);
        }
    } else {
        selectedSquare = null;
        renderBoard();
    }
}

document.addEventListener('mousemove', handleDragMove);
document.addEventListener('mouseup', handleDragEnd);

var moveInsightTimeout = null;
var moveInsightFadeTimeout = null;
var moveInsightVisibleUntil = 0;

function getMoveInsight(fromRow, fromCol, toRow, toCol, piece, capturedPiece, moveCount) {
    var insights = [];
    var type = piece.type;
    var color = piece.color;
    var enemyColor = color === 'white' ? 'black' : 'white';
    var centerSquares = [[3,3],[3,4],[4,3],[4,4]];
    var extCenter = [[2,2],[2,3],[2,4],[2,5],[3,2],[3,5],[4,2],[4,5],[5,2],[5,3],[5,4],[5,5]];
    var isCenter = centerSquares.some(function(s) { return s[0] === toRow && s[1] === toCol; });
    var isExtCenter = extCenter.some(function(s) { return s[0] === toRow && s[1] === toCol; });
    var backRank = color === 'white' ? 7 : 0;
    var enemyBackRank = color === 'white' ? 0 : 7;
    var pieceValues = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
    var capName = { pawn: 'peón', knight: 'caballo', bishop: 'alfil', rook: 'torre', queen: 'dama', king: 'rey' };

    // --- Funciones auxiliares ---
    function isSquareAttackedBy(r, c, attackerColor) {
        for (var ar = 0; ar < 8; ar++) {
            for (var ac = 0; ac < 8; ac++) {
                var ap = game.getPiece(ar, ac);
                if (ap && ap.color === attackerColor) {
                    var moves = game.getMovesWithoutCheckValidation(ar, ac);
                    if (moves.some(function(m) { return m.row === r && m.col === c; })) return true;
                }
            }
        }
        return false;
    }

    function isSquareDefendedBy(r, c, defenderColor) {
        for (var dr2 = 0; dr2 < 8; dr2++) {
            for (var dc2 = 0; dc2 < 8; dc2++) {
                if (dr2 === r && dc2 === c) continue;
                var dp2 = game.getPiece(dr2, dc2);
                if (dp2 && dp2.color === defenderColor) {
                    var dMoves = game.getMovesWithoutCheckValidation(dr2, dc2);
                    if (dMoves.some(function(m) { return m.row === r && m.col === c; })) return true;
                }
            }
        }
        return false;
    }

    function minAttackerValue(r, c, attackerColor) {
        var minVal = 99;
        for (var ar2 = 0; ar2 < 8; ar2++) {
            for (var ac2 = 0; ac2 < 8; ac2++) {
                var ap2 = game.getPiece(ar2, ac2);
                if (ap2 && ap2.color === attackerColor) {
                    var moves = game.getMovesWithoutCheckValidation(ar2, ac2);
                    if (moves.some(function(m) { return m.row === r && m.col === c; })) {
                        var v = pieceValues[ap2.type] || 0;
                        if (v < minVal) minVal = v;
                    }
                }
            }
        }
        return minVal;
    }

    function countMaterial(clr) {
        var total = 0;
        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                var p = game.getPiece(r, c);
                if (p && p.color === clr) total += (pieceValues[p.type] || 0);
            }
        }
        return total;
    }

    function countPiecesOfType(clr, pType) {
        var n = 0;
        for (var r = 0; r < 8; r++) {
            for (var c = 0; c < 8; c++) {
                var p = game.getPiece(r, c);
                if (p && p.color === clr && p.type === pType) n++;
            }
        }
        return n;
    }

    var isEndgame = countMaterial('white') + countMaterial('black') <= 24;

    // =============================================
    //  1. ENROQUE (prioridad máxima, retorno directo)
    // =============================================
    if (type === 'king' && Math.abs(fromCol - toCol) === 2) {
        var side = toCol > fromCol ? 'corto' : 'largo';
        insights.push({ text: '🏰 ¡Enroque ' + side + '! Rey a salvo y torre activa', type: 'great' });
    }

    // =============================================
    //  2. JAQUE
    // =============================================
    var givesCheck = game.isInCheck(enemyColor);
    if (givesCheck) {
        if (capturedPiece) {
            insights.push({ text: '⚡ ¡Captura con jaque! Ganas tempo y material', type: 'great' });
        } else if (type === 'knight') {
            insights.push({ text: '⚡ ¡Jaque de caballo! Difícil de bloquear', type: 'great' });
        } else if (type === 'pawn') {
            insights.push({ text: '⚡ ¡Jaque de peón! Amenaza inesperada', type: 'great' });
        } else if (type === 'rook' || type === 'bishop') {
            insights.push({ text: '⚡ ¡Jaque! Obligas al rival a reaccionar', type: 'great' });
        } else {
            insights.push({ text: '⚡ ¡Jaque! Presión directa sobre el rey', type: 'great' });
        }
    }

    // =============================================
    //  3. CAPTURAS
    // =============================================
    if (capturedPiece) {
        var myVal = pieceValues[type] || 0;
        var capVal = pieceValues[capturedPiece.type] || 0;

        // Detectar recaptura: el rival capturó en esta misma casilla en su último movimiento
        var isRecapture = false;
        var uciHist = game.moveHistoryUCI || [];
        if (uciHist.length >= 2) {
            var prevEnemyUCI = uciHist[uciHist.length - 2];
            var prevTo = prevEnemyUCI.substring(2, 4);
            var filesArr = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            var curTo = filesArr[toCol] + (8 - toRow);
            var sanHist = game.moveHistory || [];
            var prevSAN = sanHist.length >= 2 ? sanHist[sanHist.length - 2] : '';
            if (prevTo === curTo && prevSAN.indexOf('x') !== -1) {
                isRecapture = true;
            }
        }

        if (capturedPiece.type === 'queen') {
            insights.push({ text: '💎 ¡Capturas la dama! Ventaja decisiva', type: 'great' });
        } else if (capVal > myVal + 1) {
            insights.push({ text: '💎 ¡Ganas ' + capName[capturedPiece.type] + '! Ventaja de material clara', type: 'great' });
        } else if (capVal > myVal) {
            insights.push({ text: '💎 Capturas ' + capName[capturedPiece.type] + ' — ¡buen cambio!', type: 'great' });
        } else if (capVal === myVal) {
            if (isRecapture) {
                insights.push({ text: '🔄 ¡Recuperas pieza! Cambio de ' + capName[capturedPiece.type] + ' por ' + capName[type], type: 'good' });
            } else {
                insights.push({ text: '🔄 Cambio de ' + capName[capturedPiece.type] + ' por ' + capName[type], type: 'info' });
            }
        } else if (capVal < myVal) {
            if (isRecapture) {
                insights.push({ text: '🔄 ¡Recuperas pieza! Capturas ' + capName[capturedPiece.type], type: 'good' });
            } else if (capturedPiece.type === 'pawn') {
                insights.push({ text: '💎 ¡Captura limpia! Ganas un peón', type: 'good' });
            } else if (capVal >= 3) {
                insights.push({ text: '💎 ¡Captura limpia! Te llevas el ' + capName[capturedPiece.type], type: 'great' });
            } else {
                insights.push({ text: '💎 Captura limpia — ganas ' + capName[capturedPiece.type], type: 'good' });
            }
        } else {
            insights.push({ text: '⚔️ Capturas ' + capName[capturedPiece.type], type: 'good' });
        }
    }

    // =============================================
    //  4. TÁCTICAS (horquilla, clavada, enfilada, batería)
    // =============================================

    // --- Horquilla de caballo ---
    if (type === 'knight') {
        var knightTargets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
        var attacked = [];
        for (var ki = 0; ki < knightTargets.length; ki++) {
            var kr = toRow + knightTargets[ki][0];
            var kc = toCol + knightTargets[ki][1];
            if (kr >= 0 && kr < 8 && kc >= 0 && kc < 8) {
                var kp = game.getPiece(kr, kc);
                if (kp && kp.color === enemyColor && (pieceValues[kp.type] >= 3 || kp.type === 'king')) {
                    attacked.push(kp.type);
                }
            }
        }
        if (attacked.indexOf('king') !== -1 && attacked.length >= 2) {
            insights.push({ text: '🐴 ¡Horquilla al rey! El rival perderá material', type: 'great' });
        } else if (attacked.length >= 2) {
            insights.push({ text: '🐴 ¡Horquilla! Atacas ' + capName[attacked[0]] + ' y ' + capName[attacked[1]], type: 'great' });
        }
    }

    // --- Horquilla de peón (ataca dos piezas a la vez) ---
    if (type === 'pawn' && !capturedPiece) {
        var pawnAtkDir = color === 'white' ? -1 : 1;
        var pForkTargets = [];
        for (var pfc = -1; pfc <= 1; pfc += 2) {
            var pfr = toRow + pawnAtkDir, pfcc = toCol + pfc;
            if (pfr >= 0 && pfr < 8 && pfcc >= 0 && pfcc < 8) {
                var pfp = game.getPiece(pfr, pfcc);
                if (pfp && pfp.color === enemyColor && pieceValues[pfp.type] >= 3) {
                    pForkTargets.push(pfp.type);
                }
            }
        }
        if (pForkTargets.length >= 2) {
            insights.push({ text: '♟ ¡Horquilla de peón! Atacas ' + capName[pForkTargets[0]] + ' y ' + capName[pForkTargets[1]], type: 'great' });
        }
    }

    // --- Clavada (pieza enemiga no puede moverse por proteger al rey) ---
    if (type === 'bishop' || type === 'rook' || type === 'queen') {
        var pinDetected = false;
        var directions = [];
        if (type === 'bishop' || type === 'queen') directions.push([-1,-1],[-1,1],[1,-1],[1,1]);
        if (type === 'rook' || type === 'queen') directions.push([-1,0],[1,0],[0,-1],[0,1]);
        for (var di = 0; di < directions.length && !pinDetected; di++) {
            var dr = directions[di][0], dc = directions[di][1];
            var firstPiece = null, secondPiece = null;
            var pr = toRow + dr, pc = toCol + dc;
            while (pr >= 0 && pr < 8 && pc >= 0 && pc < 8) {
                var pp = game.getPiece(pr, pc);
                if (pp) {
                    if (!firstPiece) { firstPiece = pp; }
                    else { secondPiece = pp; break; }
                }
                pr += dr; pc += dc;
            }
            if (firstPiece && secondPiece &&
                firstPiece.color === enemyColor && secondPiece.color === enemyColor) {
                if (secondPiece.type === 'king' && pieceValues[firstPiece.type] >= 1) {
                    insights.push({ text: '📌 ¡Clavada! El ' + capName[firstPiece.type] + ' enemigo no puede moverse', type: 'great' });
                    pinDetected = true;
                } else if (pieceValues[secondPiece.type] > pieceValues[firstPiece.type] && pieceValues[firstPiece.type] >= 3) {
                    insights.push({ text: '📌 ¡Enfilada! Amenazas ' + capName[firstPiece.type] + ' y ' + capName[secondPiece.type] + ' detrás', type: 'great' });
                    pinDetected = true;
                }
            }
        }
    }

    // --- Batería (dama + alfil o dama + torre en misma línea) ---
    if ((type === 'queen' || type === 'rook' || type === 'bishop') && !capturedPiece) {
        var batteryDirs = [];
        if (type === 'queen' || type === 'bishop') batteryDirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
        if (type === 'queen' || type === 'rook') batteryDirs.push([-1,0],[1,0],[0,-1],[0,1]);
        for (var bti = 0; bti < batteryDirs.length; bti++) {
            var bdr = batteryDirs[bti][0], bdc = batteryDirs[bti][1];
            var bpr = toRow + bdr, bpc = toCol + bdc;
            while (bpr >= 0 && bpr < 8 && bpc >= 0 && bpc < 8) {
                var bpp = game.getPiece(bpr, bpc);
                if (bpp) {
                    if (bpp.color === color) {
                        var isBattery = false;
                        if (type === 'queen' && (bpp.type === 'bishop' || bpp.type === 'rook')) isBattery = true;
                        if (type === 'bishop' && bpp.type === 'queen') isBattery = true;
                        if (type === 'rook' && bpp.type === 'queen') isBattery = true;
                        if (isBattery) {
                            insights.push({ text: '🔋 ¡Batería! ' + capName[type] + ' y ' + capName[bpp.type] + ' apuntan juntas', type: 'great' });
                        }
                    }
                    break;
                }
                bpr += bdr; bpc += bdc;
            }
        }
    }

    // =============================================
    //  5. DESARROLLO Y APERTURA
    // =============================================

    // --- Desarrollo de piezas menores ---
    if ((type === 'knight' || type === 'bishop') && fromRow === backRank && moveCount <= 20) {
        var pName = type === 'knight' ? 'caballo' : 'alfil';
        if (isCenter || isExtCenter) {
            insights.push({ text: '📐 Desarrollas ' + pName + ' hacia el centro — ¡buena actividad!', type: 'good' });
        } else {
            insights.push({ text: '📐 Desarrollas ' + pName + ' — una pieza más lista para jugar', type: 'good' });
        }
    }

    // --- Alfil fianchetado ---
    if (type === 'bishop' && !capturedPiece) {
        var fianchettoSquares = [[5,1],[5,6],[2,1],[2,6]];
        var isFianchetto = fianchettoSquares.some(function(s) { return s[0] === toRow && s[1] === toCol; });
        if (isFianchetto) {
            insights.push({ text: '🏹 ¡Fianchetto! Tu alfil domina la gran diagonal', type: 'good' });
        }
    }

    // --- Dama temprana ---
    if (type === 'queen' && fromRow === backRank && moveCount <= 8 && !capturedPiece) {
        insights.push({ text: '⚠️ Dama temprana — puede ser atacada y perder tiempos', type: 'warning' });
    }

    // --- Repetición de pieza en apertura ---
    if (moveCount <= 12 && !capturedPiece && type !== 'pawn') {
        var uciHistory = game.moveHistoryUCI || [];
        if (uciHistory.length >= 3) {
            var lastPlayerMoves = [];
            var step = 0;
            for (var ui = uciHistory.length - 1; ui >= 0 && step < 3; ui--) {
                if (step % 2 === 0) lastPlayerMoves.push(uciHistory[ui]);
                step++;
            }
            if (lastPlayerMoves.length >= 2) {
                var prevTo = lastPlayerMoves[1].substring(2, 4);
                var currFrom = lastPlayerMoves[0].substring(0, 2);
                if (prevTo === currFrom) {
                    insights.push({ text: '⚠️ Mueves la misma pieza dos veces — desarrolla las demás', type: 'warning' });
                }
            }
        }
    }

    // --- Piezas sin desarrollar ---
    if (moveCount >= 14 && moveCount <= 22 && !capturedPiece) {
        var undeveloped = 0;
        var startCols = [1, 2, 5, 6];
        for (var sc = 0; sc < startCols.length; sc++) {
            var sp = game.getPiece(backRank, startCols[sc]);
            if (sp && sp.color === color && (sp.type === 'knight' || sp.type === 'bishop')) {
                undeveloped++;
            }
        }
        if (undeveloped >= 2) {
            insights.push({ text: '⚠️ Aún tienes ' + undeveloped + ' piezas en casa — ¡necesitan salir!', type: 'warning' });
        }
    }

    // --- Apertura completada ---
    if (moveCount >= 8 && moveCount <= 16 && !capturedPiece) {
        var developed = 0;
        var devCols = [1, 2, 5, 6];
        for (var dci = 0; dci < devCols.length; dci++) {
            var dp = game.getPiece(backRank, devCols[dci]);
            if (!dp || dp.color !== color || (dp.type !== 'knight' && dp.type !== 'bishop')) {
                developed++;
            }
        }
        var kingCastled = false;
        var kp2 = game.getPiece(backRank, 6);
        var kp3 = game.getPiece(backRank, 2);
        if ((kp2 && kp2.type === 'king' && kp2.color === color) ||
            (kp3 && kp3.type === 'king' && kp3.color === color)) {
            kingCastled = true;
        }
        if (developed >= 4 && kingCastled) {
            insights.push({ text: '✅ ¡Desarrollo completo! Piezas activas y rey enrocado', type: 'great' });
        }
    }

    // =============================================
    //  6. PEONES
    // =============================================
    if (type === 'pawn') {
        if (toRow === 0 || toRow === 7) {
            insights.push({ text: '👑 ¡Coronación! Tu peón se transforma en pieza mayor', type: 'great' });
        } else if ((color === 'white' && toRow <= 1) || (color === 'black' && toRow >= 6)) {
            insights.push({ text: '♟ ¡Peón a punto de coronar! Amenaza imparable', type: 'great' });
        } else if (isCenter && moveCount <= 10) {
            var doublePush = Math.abs(fromRow - toRow) === 2;
            if (doublePush) {
                insights.push({ text: '🎯 Peón doble al centro — ¡controlas casillas clave!', type: 'good' });
            } else {
                insights.push({ text: '🎯 Peón al centro — espacio y control', type: 'good' });
            }
        }

        // Peón pasado
        {
            var isPassed = true;
            var pawnDir = color === 'white' ? -1 : 1;
            var promoRow = color === 'white' ? 0 : 7;
            for (var cr = toRow + pawnDir; cr !== promoRow + pawnDir; cr += pawnDir) {
                if (cr < 0 || cr > 7) break;
                for (var cc = toCol - 1; cc <= toCol + 1; cc++) {
                    if (cc < 0 || cc > 7) continue;
                    var cp = game.getPiece(cr, cc);
                    if (cp && cp.type === 'pawn' && cp.color === enemyColor) {
                        isPassed = false; break;
                    }
                }
                if (!isPassed) break;
            }
            if (isPassed && toRow !== backRank) {
                var distToPromo = Math.abs(toRow - promoRow);
                if (distToPromo <= 3) {
                    insights.push({ text: '♟ ¡Peón pasado avanzado! Muy peligroso', type: 'great' });
                } else {
                    insights.push({ text: '♟ Peón pasado — sin peones rivales que lo frenen', type: 'good' });
                }
            }
        }

        // Peón aislado
        if (!capturedPiece) {
            var hasAdjacentPawn = false;
            for (var ipc = toCol - 1; ipc <= toCol + 1; ipc += 2) {
                if (ipc < 0 || ipc > 7) continue;
                for (var ipr = 0; ipr < 8; ipr++) {
                    var ipp = game.getPiece(ipr, ipc);
                    if (ipp && ipp.type === 'pawn' && ipp.color === color) { hasAdjacentPawn = true; break; }
                }
                if (hasAdjacentPawn) break;
            }
            if (!hasAdjacentPawn) {
                insights.push({ text: '⚠️ Peón aislado — no tiene peones aliados que lo protejan', type: 'warning' });
            }
        }

        // Peón doblado
        if (!capturedPiece) {
            var pawnsInCol = 0;
            for (var dpr = 0; dpr < 8; dpr++) {
                var dpp = game.getPiece(dpr, toCol);
                if (dpp && dpp.type === 'pawn' && dpp.color === color) pawnsInCol++;
            }
            if (pawnsInCol >= 2) {
                insights.push({ text: '⚠️ Peones doblados en la misma columna — estructura débil', type: 'warning' });
            }
        }
    }

    // =============================================
    //  7. TORRES
    // =============================================
    if (type === 'rook') {
        // Torres dobladas en columna (antes de columna abierta para priorizar)
        for (var tdr = 0; tdr < 8; tdr++) {
            if (tdr === toRow) continue;
            var tdp = game.getPiece(tdr, toCol);
            if (tdp && tdp.type === 'rook' && tdp.color === color) {
                insights.push({ text: '🗼 ¡Torres dobladas! Poder duplicado en la columna', type: 'great' });
                break;
            }
        }

        // Torres conectadas en fila
        {
            for (var tc = 0; tc < 8; tc++) {
                if (tc === toCol) continue;
                var tp = game.getPiece(toRow, tc);
                if (tp && tp.type === 'rook' && tp.color === color) {
                    var pathClear = true;
                    var minC = Math.min(tc, toCol), maxC = Math.max(tc, toCol);
                    for (var tcc = minC + 1; tcc < maxC; tcc++) {
                        if (game.getPiece(toRow, tcc)) { pathClear = false; break; }
                    }
                    if (pathClear) {
                        insights.push({ text: '🗼 Torres conectadas — se apoyan mutuamente', type: 'good' });
                        break;
                    }
                }
            }
        }

        // Torre en 7ª fila
        if (toRow === (color === 'white' ? 1 : 6)) {
            insights.push({ text: '🗼 ¡Torre en séptima fila! Ataca peones y encierra al rey', type: 'great' });
        }

        // Columna abierta / semi-abierta
        {
            var hasOwnPawn = false, hasEnemyPawn = false;
            for (var rr = 0; rr < 8; rr++) {
                var rp = game.getPiece(rr, toCol);
                if (rp && rp.type === 'pawn') {
                    if (rp.color === color) hasOwnPawn = true;
                    else hasEnemyPawn = true;
                }
            }
            if (!hasOwnPawn && !hasEnemyPawn) {
                insights.push({ text: '🗼 Torre en columna abierta — ¡máxima influencia!', type: 'good' });
            } else if (!hasOwnPawn && hasEnemyPawn) {
                insights.push({ text: '🗼 Torre en columna semi-abierta — presión sobre el peón rival', type: 'good' });
            }
        }

        // Torre detrás de peón pasado
        {
            var pDir = color === 'white' ? -1 : 1;
            for (var tpr = toRow + pDir; tpr >= 0 && tpr < 8; tpr += pDir) {
                var tpp = game.getPiece(tpr, toCol);
                if (tpp) {
                    if (tpp.type === 'pawn' && tpp.color === color) {
                        var tIsPassed = true;
                        for (var tcr = tpr + pDir; tcr >= 0 && tcr < 8; tcr += pDir) {
                            for (var tpcc = toCol - 1; tpcc <= toCol + 1; tpcc++) {
                                if (tpcc < 0 || tpcc > 7) continue;
                                var tcp = game.getPiece(tcr, tpcc);
                                if (tcp && tcp.type === 'pawn' && tcp.color === enemyColor) { tIsPassed = false; break; }
                            }
                            if (!tIsPassed) break;
                        }
                        if (tIsPassed) {
                            insights.push({ text: '🗼 Torre apoyando peón pasado — ¡combinación ganadora!', type: 'great' });
                        }
                    }
                    break;
                }
            }
        }
    }

    // =============================================
    //  8. CABALLO
    // =============================================
    if (type === 'knight') {
        if (isCenter && moveCount > 5) {
            insights.push({ text: '🐴 Caballo centralizado — controla hasta 8 casillas', type: 'good' });
        }
    }

    if (type === 'knight' && !isCenter) {
        var advancedRow = color === 'white' ? (toRow <= 3) : (toRow >= 4);
        if (advancedRow && moveCount > 8) {
            var canBeAttackedByPawn = false;
            for (var adr = -1; adr <= 1; adr += 2) {
                var checkRow = toRow + (color === 'white' ? -1 : 1);
                var checkCol = toCol + adr;
                if (checkRow >= 0 && checkRow < 8 && checkCol >= 0 && checkCol < 8) {
                    var cpawn = game.getPiece(checkRow, checkCol);
                    if (cpawn && cpawn.type === 'pawn' && cpawn.color === enemyColor) canBeAttackedByPawn = true;
                }
            }
            if (!canBeAttackedByPawn) {
                insights.push({ text: '🐴 ¡Puesto avanzado! Caballo protegido e inamovible', type: 'great' });
            }
        }
    }

    // =============================================
    //  9. REY
    // =============================================
    if (type === 'king') {
        var totalPieces = 0;
        for (var ar = 0; ar < 8; ar++) {
            for (var ac2 = 0; ac2 < 8; ac2++) {
                var ap2 = game.getPiece(ar, ac2);
                if (ap2 && ap2.type !== 'king' && ap2.type !== 'pawn') totalPieces++;
            }
        }
        if (totalPieces <= 4 && (isCenter || isExtCenter)) {
            insights.push({ text: '👑 Rey activo en el final — ¡pieza decisiva!', type: 'good' });
        } else if (totalPieces <= 4) {
            insights.push({ text: '👑 Activas el rey — en el final es una pieza fuerte', type: 'good' });
        } else if (totalPieces > 4 && !isEndgame) {
            insights.push({ text: '⚠️ Rey expuesto en el medio juego — puede ser peligroso', type: 'warning' });
        }
    }

    // =============================================
    // 10. DETECCIÓN DE ERRORES
    // =============================================

    // --- Pieza colgada (en casilla atacada sin defensa) ---
    if (type !== 'king') {
        var movedValue = pieceValues[type] || 0;
        var isAttacked = isSquareAttackedBy(toRow, toCol, enemyColor);
        var isDefended = isSquareDefendedBy(toRow, toCol, color);

        if (isAttacked && !isDefended && movedValue >= 5) {
            insights.push({ text: '🚨 ¡Tu ' + capName[type] + ' puede ser capturada gratis!', type: 'danger' });
        } else if (isAttacked && !isDefended && movedValue >= 3) {
            insights.push({ text: '🚨 ¡' + capName[type].charAt(0).toUpperCase() + capName[type].slice(1) + ' en peligro! Está sin protección', type: 'danger' });
        } else if (isAttacked && !isDefended && movedValue > 0) {
            insights.push({ text: '⚠️ Tu ' + capName[type] + ' queda en casilla atacada', type: 'warning' });
        } else if (isAttacked && isDefended && movedValue > 1) {
            var minAtk = minAttackerValue(toRow, toCol, enemyColor);
            if (minAtk < movedValue) {
                insights.push({ text: '⚠️ Tu ' + capName[type] + ' puede caer ante pieza de menor valor', type: 'warning' });
            }
        }
    }

    // --- Dejas pieza sin protección al moverte ---
    if (type !== 'pawn') {
        var foundHanging = false;
        for (var hi = 0; hi < 8 && !foundHanging; hi++) {
            for (var hj = 0; hj < 8; hj++) {
                var hp = game.getPiece(hi, hj);
                if (!hp || hp.color !== color || hp.type === 'king') continue;
                if (hi === toRow && hj === toCol) continue;
                var hVal = pieceValues[hp.type] || 0;
                if (hVal < 3) continue;
                var tempBoard = game.getPiece(toRow, toCol);
                game.board[toRow][toCol] = null;
                game.board[fromRow][fromCol] = piece;
                var oldMoves = game.getMovesWithoutCheckValidation(fromRow, fromCol);
                var wasDefByMe = oldMoves.some(function(m) { return m.row === hi && m.col === hj; });
                game.board[fromRow][fromCol] = null;
                game.board[toRow][toCol] = tempBoard;
                if (!wasDefByMe) continue;
                var stillDefended = isSquareDefendedBy(hi, hj, color);
                var isHanging = isSquareAttackedBy(hi, hj, enemyColor);
                if (isHanging && !stillDefended) {
                    insights.push({ text: '⚠️ Cuidado: tu ' + capName[hp.type] + ' ha quedado sin defensa', type: 'warning' });
                    foundHanging = true;
                    break;
                }
            }
        }
    }

    // --- Peones del enroque debilitados ---
    if (type === 'pawn' && !capturedPiece) {
        var kingRow = backRank;
        var kingOnKingside = false;
        var kingOnQueenside = false;
        var kpCheck = game.getPiece(kingRow, 6);
        if (kpCheck && kpCheck.type === 'king' && kpCheck.color === color) kingOnKingside = true;
        var kpCheck2 = game.getPiece(kingRow, 2);
        if (kpCheck2 && kpCheck2.type === 'king' && kpCheck2.color === color) kingOnQueenside = true;

        if (kingOnKingside && (fromCol >= 5 && fromCol <= 7)) {
            var pawnAdvanced = color === 'white' ? (toRow < fromRow) : (toRow > fromRow);
            if (pawnAdvanced && Math.abs(fromRow - backRank) <= 2) {
                insights.push({ text: '⚠️ Avanzar peones del enroque debilita la defensa del rey', type: 'warning' });
            }
        }
        if (kingOnQueenside && (fromCol >= 0 && fromCol <= 2)) {
            var pawnAdv2 = color === 'white' ? (toRow < fromRow) : (toRow > fromRow);
            if (pawnAdv2 && Math.abs(fromRow - backRank) <= 2) {
                insights.push({ text: '⚠️ Avanzar peones del enroque debilita la defensa del rey', type: 'warning' });
            }
        }
    }

    // --- Caballo en el borde ---
    if (type === 'knight' && !capturedPiece) {
        if (toCol === 0 || toCol === 7 || toRow === 0 || toRow === 7) {
            insights.push({ text: '⚠️ Caballo en el borde — pierde movilidad y fuerza', type: 'warning' });
        }
    }

    // --- Alfil bloqueado por peones propios ---
    if (type === 'bishop' && !capturedPiece && moveCount > 10) {
        var bishopDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
        var blockedDirs = 0;
        for (var bdi = 0; bdi < 4; bdi++) {
            var br2 = toRow + bishopDirs[bdi][0];
            var bc2 = toCol + bishopDirs[bdi][1];
            if (br2 < 0 || br2 > 7 || bc2 < 0 || bc2 > 7) {
                blockedDirs++;
            } else {
                var bp2 = game.getPiece(br2, bc2);
                if (bp2 && bp2.color === color && bp2.type === 'pawn') blockedDirs++;
            }
        }
        if (blockedDirs >= 3) {
            insights.push({ text: '⚠️ Alfil atrapado entre tus peones — busca abrirle diagonales', type: 'warning' });
        }
    }

    // --- Sin enrocar tardío ---
    if (moveCount >= 16 && moveCount <= 24 && !capturedPiece) {
        var myKingPos = null;
        for (var ksr = 0; ksr < 8; ksr++) {
            for (var ksc = 0; ksc < 8; ksc++) {
                var ksp = game.getPiece(ksr, ksc);
                if (ksp && ksp.type === 'king' && ksp.color === color) { myKingPos = { row: ksr, col: ksc }; break; }
            }
            if (myKingPos) break;
        }
        if (myKingPos && myKingPos.row === backRank && (myKingPos.col === 4 || myKingPos.col === 3)) {
            if (!isEndgame) {
                insights.push({ text: '⚠️ Tu rey sigue en el centro sin enrocar — ¡búscale refugio!', type: 'warning' });
            }
        }
    }

    // =============================================
    // 11. VENTAJA MATERIAL
    // =============================================
    if (insights.length === 0 && !capturedPiece) {
        var myMat = countMaterial(color);
        var enemyMat = countMaterial(enemyColor);
        var diff = myMat - enemyMat;
        if (diff >= 5 && moveCount > 20) {
            insights.push({ text: '💪 Ventaja material clara — simplifica y gana', type: 'info' });
        } else if (diff <= -5 && moveCount > 20) {
            insights.push({ text: '🔍 Desventaja material — busca complicaciones tácticas', type: 'info' });
        }
    }

    // =============================================
    // 12. FALLBACK: CONTROL DEL CENTRO / ESPACIO
    // =============================================
    if (insights.length === 0 && !capturedPiece) {
        if (isCenter) {
            insights.push({ text: '🎯 Controlas el centro del tablero', type: 'good' });
        } else if (isExtCenter && moveCount <= 15) {
            insights.push({ text: '♟ Refuerzas tu influencia en el centro', type: 'info' });
        } else if (type === 'pawn' && isEndgame) {
            insights.push({ text: '♟ Avanza peones en el final — cada paso cuenta', type: 'info' });
        }
    }

    // Deduplicar por texto y limitar a 3 insights
    var seen = {};
    var unique = [];
    for (var ui = 0; ui < insights.length; ui++) {
        if (!seen[insights[ui].text]) {
            seen[insights[ui].text] = true;
            unique.push(insights[ui]);
        }
    }

    // Prioridad: danger > warning > great > good > info
    var typePriority = { danger: 0, warning: 1, great: 2, good: 3, info: 4 };
    unique.sort(function(a, b) {
        return (typePriority[a.type] || 5) - (typePriority[b.type] || 5);
    });

    return unique.slice(0, 3);
}

function showMoveInsight(fromRow, fromCol, toRow, toCol, piece, capturedPiece) {
    if (!showMoveInsights) return;
    var moveCount = (game.moveHistory || []).length;
    var insights = getMoveInsight(fromRow, fromCol, toRow, toCol, piece, capturedPiece, moveCount);
    if (insights.length === 0) return;

    var el = document.getElementById('move-insight');
    if (!el) return;

    if (moveInsightTimeout) clearTimeout(moveInsightTimeout);
    if (moveInsightFadeTimeout) clearTimeout(moveInsightFadeTimeout);

    // Use highest-priority type for the container style
    var topType = insights[0].type;

    // Build combined message
    var combinedText = insights.map(function(ins) { return ins.text; }).join('\n');

    el.style.animation = 'none';
    el.offsetHeight;
    el.innerHTML = '';

    if (insights.length === 1) {
        el.textContent = combinedText;
    } else {
        for (var i = 0; i < insights.length; i++) {
            var line = document.createElement('div');
            line.className = 'insight-line';
            line.textContent = insights[i].text;
            el.appendChild(line);
        }
    }

    el.className = 'move-insight insight-' + topType;
    el.style.display = 'block';
    el.style.animation = 'insightFadeIn 0.35s ease-out';

    var displayTime = insights.length > 1 ? 4500 : 3000;
    moveInsightVisibleUntil = Date.now() + displayTime;

    moveInsightTimeout = setTimeout(function() {
        el.style.animation = 'insightFadeOut 0.5s ease-out forwards';
        moveInsightFadeTimeout = setTimeout(function() {
            el.style.display = 'none';
            el.style.animation = '';
            moveInsightVisibleUntil = 0;
        }, 500);
    }, displayTime);
}

function hideMoveInsight() {
    if (Date.now() < moveInsightVisibleUntil) return;
    var el = document.getElementById('move-insight');
    if (el) {
        el.style.display = 'none';
        el.style.animation = '';
    }
    if (moveInsightTimeout) {
        clearTimeout(moveInsightTimeout);
        moveInsightTimeout = null;
    }
    if (moveInsightFadeTimeout) {
        clearTimeout(moveInsightFadeTimeout);
        moveInsightFadeTimeout = null;
    }
    moveInsightVisibleUntil = 0;
}

function executeMove(fromRow, fromCol, toRow, toCol, promotionPiece) {
    var pieceBeforeMove = game.getPiece(fromRow, fromCol);
    var capturedBeforeMove = game.getPiece(toRow, toCol);
    const result = game.makeMove(fromRow, fromCol, toRow, toCol, promotionPiece);
    lastMoveSquares = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
    bestMoveSquares = { from: null, to: null };
    selectedSquare = null;
    if (!clockInterval) startClock();
    addTimeIncrement();
    renderBoard();
    updateCapturedPieces();
    updateMoveHistory();
    updateUndoButton();
    autoSaveGame();
    detectOpening();
    updateEvalBar();
    if (pieceBeforeMove) {
        showMoveInsight(fromRow, fromCol, toRow, toCol, pieceBeforeMove, capturedBeforeMove);
    }
    handleGameResult(result);
    if (!game.gameOver && game.currentTurn !== playerColor) {
        setTimeout(() => makeAIMove(), 800);
    }
}

function showPromotionDialog(pieceColor) {
    const overlay = document.getElementById('promotion-overlay');
    const container = document.getElementById('promotion-pieces');
    if (!overlay || !container) return;

    const pieces = [
        { type: 'queen', symbol: pieceColor === 'white' ? '♕' : '♛' },
        { type: 'rook', symbol: pieceColor === 'white' ? '♖' : '♜' },
        { type: 'bishop', symbol: pieceColor === 'white' ? '♗' : '♝' },
        { type: 'knight', symbol: pieceColor === 'white' ? '♘' : '♞' }
    ];

    container.innerHTML = '';
    pieces.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'promotion-piece-btn';
        btn.textContent = p.symbol;
        btn.title = p.type === 'queen' ? 'Dama' : p.type === 'rook' ? 'Torre' : p.type === 'bishop' ? 'Alfil' : 'Caballo';
        btn.addEventListener('click', () => {
            if (pendingPromotionMove) {
                const { fromRow, fromCol, toRow, toCol, isQuiz, isFreeTraining, isPuzzle } = pendingPromotionMove;
                if (isPuzzle) {
                    puzzleCheckMove(fromRow, fromCol, toRow, toCol, p.type.charAt(0));
                } else if (isFreeTraining) {
                    executeFreeTrainingMove(fromRow, fromCol, toRow, toCol, p.type);
                } else if (isQuiz) {
                    quizCheckMove(fromRow, fromCol, toRow, toCol, p.type);
                } else {
                    executeMove(fromRow, fromCol, toRow, toCol, p.type);
                }
                pendingPromotionMove = null;
                overlay.style.display = 'none';
            }
        });
        container.appendChild(btn);
    });
    overlay.style.display = 'flex';
}

function highlightValidMoves(row, col) {
    renderBoard();
    
    // Resaltar cuadrado seleccionado
    const squares = document.querySelectorAll('.square');
    squares.forEach(square => {
        const r = parseInt(square.dataset.row);
        const c = parseInt(square.dataset.col);
        
        if (r === row && c === col) {
            square.classList.add('selected');
        }
    });
    
    // Resaltar movimientos válidos
    const validMoves = game.getValidMoves(row, col);
    validMoves.forEach(move => {
        squares.forEach(square => {
            const r = parseInt(square.dataset.row);
            const c = parseInt(square.dataset.col);
            
            if (r === move.row && c === move.col) {
                square.classList.add('valid-move');
                if (game.getPiece(r, c)) {
                    square.classList.add('has-piece');
                }
            }
        });
    });
}

function addTimeIncrement() {
    // Agregar incremento al jugador que acaba de hacer el movimiento
    // El turno ya cambió, así que agregamos al jugador contrario
    const previousPlayer = game.currentTurn === 'white' ? 'black' : 'white';
    
    if (incrementPerMove > 0) {
        if (previousPlayer === 'white') {
            whiteTime += incrementPerMove;
    } else {
            blackTime += incrementPerMove;
        }
        updateClockDisplay();
    }
}

function updateCapturedPieces() {
    const whiteElement = document.getElementById('captured-white');
    const blackElement = document.getElementById('captured-black');
    if (!whiteElement || !blackElement) return;
    whiteElement.textContent = game.capturedPieces.white.join(' ') || '-';
    blackElement.textContent = game.capturedPieces.black.join(' ') || '-';
}

function updateMoveHistory() {
    const historyDisplay = document.getElementById('move-history-display');
    if (!historyDisplay) return;
    
    historyDisplay.innerHTML = '';
    
    if (!game || !game.moveHistory || game.moveHistory.length === 0) {
        historyDisplay.innerHTML = '<span style="color: #999; font-size: 0.85rem;">No hay movimientos</span>';
        updateNavigationButtons();
        return;
    }
    
    // Agrupar movimientos por turno completo (blancas + negras)
    for (let i = 0; i < game.moveHistory.length; i += 2) {
        const moveNumber = Math.floor(i / 2) + 1;
        const whiteMove = game.moveHistory[i];
        const blackMove = game.moveHistory[i + 1];
        
        // Movimiento de blancas
        const whiteMoveItem = document.createElement('span');
        whiteMoveItem.className = 'move-item';
        whiteMoveItem.textContent = `${moveNumber}. ${whiteMove}`;
        whiteMoveItem.dataset.index = i;
        // currentMoveIndex apunta al índice en gameStateHistory;
        // movimiento i corresponde a gameStateHistory[i+1]
        if (currentMoveIndex === i + 1) {
            whiteMoveItem.classList.add('active');
        }
        whiteMoveItem.addEventListener('click', () => goToMove(i));
        historyDisplay.appendChild(whiteMoveItem);
        
        // Movimiento de negras (si existe)
        if (blackMove) {
            const blackMoveItem = document.createElement('span');
            blackMoveItem.className = 'move-item';
            blackMoveItem.textContent = blackMove;
            blackMoveItem.dataset.index = i + 1;
            if (currentMoveIndex === i + 2) {
                blackMoveItem.classList.add('active');
            }
            blackMoveItem.addEventListener('click', () => goToMove(i + 1));
            historyDisplay.appendChild(blackMoveItem);
        }
    }
    
    // Si estamos en la posición final
    if (currentMoveIndex === -1) {
        const items = historyDisplay.querySelectorAll('.move-item');
        if (items.length > 0) {
            items[items.length - 1].classList.add('active');
        }
    }
    
    // Scroll al movimiento activo
    const activeItem = historyDisplay.querySelector('.move-item.active');
    if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
    
    updateNavigationButtons();
}

function updateNavigationButtons() {
    const navFirst = document.getElementById('nav-first');
    const navPrev = document.getElementById('nav-prev');
    const navNext = document.getElementById('nav-next');
    const navLast = document.getElementById('nav-last');
    
    const totalStates = game ? (game.gameStateHistory || []).length : 0;
    const canNavigate = totalStates > 1;
    const atEnd = currentMoveIndex === -1;
    const atStart = currentMoveIndex === 0;
    
    navFirst.disabled = !canNavigate || atStart;
    navPrev.disabled = !canNavigate || atStart;
    navNext.disabled = !canNavigate || atEnd;
    navLast.disabled = !canNavigate || atEnd;
}

// gameStateHistory layout:
//   [0] = estado ANTES del movimiento 0 (posición inicial)
//   [1] = estado ANTES del movimiento 1 (= después del movimiento 0)
//   ...
//   [N] = estado final (después del último movimiento) — añadido al cargar
//
// currentMoveIndex:
//   -1 = posición final (último estado)
//    0 = después del movimiento 0 → mostrar gameStateHistory[1]
//    i = después del movimiento i → mostrar gameStateHistory[i+1]
//   "inicio" = posición inicial → mostrar gameStateHistory[0], currentMoveIndex = 0 especial

function goToFirstMove() {
    const states = game ? (game.gameStateHistory || []) : [];
    if (states.length < 2) return;
    hideBoardBanner();
    currentMoveIndex = 1;
    restoreGameState(1);
    updateMoveHistory();
}

function goToPreviousMove() {
    const states = game ? (game.gameStateHistory || []) : [];
    if (states.length < 2) return;
    hideBoardBanner();
    if (currentMoveIndex === -1) {
        // Desde el final, ir al penúltimo estado (después del penúltimo movimiento)
        currentMoveIndex = states.length - 2;
    } else if (currentMoveIndex > 0) {
        currentMoveIndex--;
    } else {
        return;
    }
    
        restoreGameState(currentMoveIndex);
        updateMoveHistory();
}

function goToNextMove() {
    const states = game ? (game.gameStateHistory || []) : [];
    if (states.length < 2 || currentMoveIndex === -1) return;
    hideBoardBanner();
    
    if (currentMoveIndex < states.length - 2) {
        currentMoveIndex++;
        restoreGameState(currentMoveIndex);
    } else {
        currentMoveIndex = -1;
        restoreGameState(states.length - 1);
    }
        updateMoveHistory();
}

function goToLastMove() {
    const states = game ? (game.gameStateHistory || []) : [];
    if (states.length < 2) return;
    hideBoardBanner();
    currentMoveIndex = -1;
    restoreGameState(states.length - 1);
    updateMoveHistory();
}

function goToMove(moveIndex) {
    const states = game ? (game.gameStateHistory || []) : [];
    if (states.length < 2) return;
    
    // Click en movimiento i → mostrar posición después de ese movimiento = states[i+1]
    const stateIdx = moveIndex + 1;
    if (stateIdx >= states.length) {
        currentMoveIndex = -1;
        restoreGameState(states.length - 1);
    } else {
        currentMoveIndex = moveIndex + 1;
        restoreGameState(stateIdx);
    }
    updateMoveHistory();
}

function restoreGameState(stateIndex) {
    if (!game || !game.gameStateHistory) return;
    
    if (stateIndex < 0) stateIndex = 0;
    if (stateIndex >= game.gameStateHistory.length) {
        stateIndex = game.gameStateHistory.length - 1;
    }
    
    const state = game.gameStateHistory[stateIndex];
    if (!state) return;
    
    game.board = JSON.parse(JSON.stringify(state.board));
    game.currentTurn = state.currentTurn;
    game.capturedPieces = JSON.parse(JSON.stringify(state.capturedPieces));
    game.enPassantTarget = state.enPassantTarget ? { ...state.enPassantTarget } : null;
    game.castlingRights = JSON.parse(JSON.stringify(state.castlingRights));
    game.gameOver = state.gameOver != null ? state.gameOver : false;
    
    renderBoard();
    updateCapturedPieces();
    updateNavigationButtons();
    updateEvalBar();
}

function showBoardBanner(text, type) {
    const banner = document.getElementById('board-banner');
    if (!banner) return;
    banner.className = 'board-banner';
    banner.textContent = text;
    banner.classList.add(`banner-${type}`);
    banner.onclick = hideBoardBanner;
}

function hideBoardBanner() {
    const banner = document.getElementById('board-banner');
    if (!banner) return;
    banner.className = 'board-banner';
    banner.textContent = '';
}

function handleGameResult(result) {
    if (result.status === 'checkmate') {
        const winner = result.winner === 'white' ? 'Blancas' : 'Negras';
        stopClock();
        clearAutoSavedGame();
        showBoardBanner(`♚ ¡JAQUE MATE! — Ganan ${winner}`, 'checkmate');
        
        if (result.winner === playerColor) {
            recordGameResult('win');
        } else {
            recordGameResult('loss');
        }
        
        setTimeout(() => {
            showMessage(`¡Jaque mate! ${winner} ganan.`, 'success', 0);
            showAnalysisButton();
        }, 300);
    } else if (result.status === 'stalemate') {
        stopClock();
        clearAutoSavedGame();
        showBoardBanner('½ TABLAS — Ahogado', 'stalemate');
        
        recordGameResult('draw');
        
        setTimeout(() => {
            showMessage('¡Tablas por ahogado!', 'info', 0);
            showAnalysisButton();
        }, 300);
    } else if (result.status === 'threefold') {
        stopClock();
        clearAutoSavedGame();
        showBoardBanner('½ TABLAS — Triple repetición', 'stalemate');
        
        recordGameResult('draw');
        
        setTimeout(() => {
            showMessage('¡Tablas por triple repetición!', 'info', 0);
            showAnalysisButton();
        }, 300);
    } else if (result.status === 'check') {
        showBoardBanner('♔ ¡JAQUE!', 'check');
        setTimeout(hideBoardBanner, 1500);
    }
}

function showAnalysisButton() {
    const overlay = document.getElementById('message-overlay');
    const box = overlay ? overlay.querySelector('.message-box') : null;
    if (!overlay || !box) return;
    const existing = box.querySelector('.analysis-btn');
    if (existing) return;
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary analysis-btn';
    btn.style.marginTop = '12px';
    btn.textContent = '📊 Ver análisis post-partida';
    btn.onclick = () => {
        overlay.style.display = 'none';
        analyzeGamePostGame();
    };
    box.appendChild(btn);
}

async function makeAIMove() {
    showThinkingIndicator(true);
    
    try {
        const bestMove = await getAIMove();
        
        if (bestMove) {
            const move = parseUCIMove(bestMove);
        
            if (move) {
                lastMoveSquares = {
                    from: { row: move.fromRow, col: move.fromCol },
                    to: { row: move.toRow, col: move.toCol }
                };
                bestMoveSquares = { from: null, to: null };
                
                const result = game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
                
                // Agregar incremento al jugador que acaba de mover
                addTimeIncrement();
            
                // Pequeña pausa antes de actualizar el tablero para efecto visual
                await new Promise(resolve => setTimeout(resolve, 200));
                
                renderBoard();
                updateCapturedPieces();
                updateMoveHistory();
                updateUndoButton();
                
                autoSaveGame();
                detectOpening();
                updateEvalBar();
            
                handleGameResult(result);
            } else {
                showMessage('Error al parsear el movimiento de la IA', 'error', 3000);
            }
        } else {
            showMessage('La IA no pudo generar un movimiento válido', 'error', 3000);
        }
    } catch (error) {
        console.error('Error en movimiento de IA:', error);
        showMessage('Error al obtener movimiento de la IA: ' + error.message, 'error', 3000);
    } finally {
        showThinkingIndicator(false);
    }
}

function showThinkingIndicator(show) {
    const indicator = document.getElementById('thinking-indicator');
    indicator.style.display = show ? 'flex' : 'none';
}

function updateEvalBar() {
    if (!game) return;

    const rawScore = evaluatePosition('white');
    // Convert centipawns to pawns, clamp to ±10
    const evalPawns = Math.max(-10, Math.min(10, rawScore / 100));
    // Map ±10 to 0%-100% (50% = equal, 100% = white winning)
    const pct = Math.max(2, Math.min(98, 50 + evalPawns * 5));

    const isHorizontal = window.matchMedia('(max-width: 600px)').matches;
    const fill = document.getElementById(isHorizontal ? 'eval-bar-fill-mobile' : 'eval-bar-fill');
    const label = document.getElementById(isHorizontal ? 'eval-bar-label-mobile' : 'eval-bar-label');
    if (!fill || !label) return;

    if (isHorizontal) {
        fill.style.width = pct + '%';
        fill.style.height = '100%';
    } else {
        fill.style.height = pct + '%';
        fill.style.width = '100%';
    }

    const sign = evalPawns > 0 ? '+' : '';
    label.textContent = sign + evalPawns.toFixed(1);

    // Color the label based on who's winning
    if (evalPawns > 0.3) {
        label.style.color = '#fff';
    } else if (evalPawns < -0.3) {
        label.style.color = '#ccc';
    } else {
        label.style.color = '#aaa';
    }
}

