let game = null;
let playerColor = 'white';
let selectedSquare = null;
let gameMode = 'vs-ai'; // vs-ai, vs-human, puzzle
let aiDifficulty = 20; // Nivel Stockfish (0-20)
let boardTheme = 'classic';
let pieceStyle = 'classic'; // Estilo de piezas
let clockEnabled = true; // Reloj siempre activado
let timePerPlayer = 3; // minutos (base)
let incrementPerMove = 2; // segundos de incremento
let whiteTime = 180; // segundos
let blackTime = 180; // segundos
let clockInterval = null;
let lastMoveSquares = { from: null, to: null }; // Guardar último movimiento para resaltar
let currentMoveIndex = -1; // Índice del movimiento actual en visualización (-1 = posición actual)
let gameStateSnapshots = []; // Estados del juego en cada movimiento

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
let pendingPromotionMove = null; // { fromRow, fromCol, toRow, toCol, isQuiz } cuando hay promoción pendiente

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
const SVG_PIECE_SETS = ['cburnett', 'merida', 'pixel', 'fantasy', 'letter'];

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

// Nombres de aperturas por secuencia de movimientos UCI
const OPENING_NAMES = {
    // Primer movimiento blancas
    'e2e4': '1.e4 — Apertura de Peón de Rey',
    'd2d4': '1.d4 — Apertura de Peón de Dama',
    'c2c4': '1.c4 — Apertura Inglesa',
    'g1f3': '1.Cf3 — Apertura Réti',
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
    'e2e4 e7e5 g1f3': '2.Cf3 — Apertura del Caballo de Rey',
    'e2e4 e7e5 g1f3 b8c6': '2...Cc6 — Defensa de los Dos Caballos',
    'e2e4 e7e5 g1f3 b8c6 f1b5': '3.Ab5 — Apertura Española (Ruy López)',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6': '3...a6 — Española: Variante Morphy',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4': '4.Aa4 — Española: Morphy Clásica',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6': '4...Cf6 — Española: Abierta',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1': '5.O-O — Española: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7': '5...Ae7 — Española: Cerrada',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 b7b5': '5...b5 — Española: Arcángel',
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6': '3...Cf6 — Española: Defensa Berlinesa',
    'e2e4 e7e5 g1f3 b8c6 f1b5 f8c5': '3...Ac5 — Española: Defensa Clásica',
    'e2e4 e7e5 g1f3 b8c6 f1b5 d7d6': '3...d6 — Española: Defensa Steinitz',
    'e2e4 e7e5 g1f3 b8c6 f1b5 f7f5': '3...f5 — Española: Gambito Schliemann',
    'e2e4 e7e5 g1f3 b8c6 f1c4': '3.Ac4 — Apertura Italiana (Giuoco Piano)',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5': '3...Ac5 — Italiana: Giuoco Piano',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3': '4.c3 — Italiana: Giuoco Piano Lento',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4': '4.b4 — Gambito Evans',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3': '4.d3 — Italiana: Giuoco Pianissimo',
    'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6': '3...Cf6 — Italiana: Dos Caballos',
    'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d4': '4.d4 — Dos Caballos: Ataque Moderno',
    'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 g1g5': '4.Cg5 — Dos Caballos: Ataque Fried Liver',
    'e2e4 e7e5 g1f3 b8c6 d2d4': '3.d4 — Apertura Escocesa',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4': '3...exd4 — Escocesa: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4': '4.Cxd4 — Escocesa Clásica',
    'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f1c4': '4.Ac4 — Gambito Escocés',
    'e2e4 e7e5 g1f3 b8c6 b1c3': '3.Cc3 — Apertura de los Cuatro Caballos',
    'e2e4 e7e5 g1f3 g8f6': '2...Cf6 — Defensa Petrov',
    'e2e4 e7e5 g1f3 g8f6 f3e5': '3.Cxe5 — Petrov: Línea Principal',
    'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6': '3...d6 — Petrov: Variante Clásica',
    'e2e4 e7e5 g1f3 g8f6 d2d4': '3.d4 — Petrov: Ataque Steinitz',
    'e2e4 e7e5 g1f3 g8f6 b1c3': '3.Cc3 — Petrov: Tres Caballos',
    'e2e4 e7e5 f1c4': '2.Ac4 — Apertura del Alfil',
    'e2e4 e7e5 f2f4': '2.f4 — Gambito de Rey',
    'e2e4 e7e5 f2f4 e5f4': '2...exf4 — Gambito de Rey Aceptado',
    'e2e4 e7e5 f2f4 f8c5': '2...Ac5 — Gambito de Rey Rehusado',
    'e2e4 e7e5 d2d4': '2.d4 — Gambito del Centro',
    'e2e4 e7e5 b1c3': '2.Cc3 — Apertura Vienesa',
    'e2e4 e7e5 b1c3 g8f6': '2...Cf6 — Vienesa: Variante Falkbeer',
    'e2e4 e7e5 b1c3 b8c6': '2...Cc6 — Vienesa: Línea Principal',

    // Siciliana variantes
    'e2e4 c7c5 g1f3': '2.Cf3 — Siciliana Abierta',
    'e2e4 c7c5 g1f3 d7d6': '2...d6 — Siciliana Najdorf / Dragón',
    'e2e4 c7c5 g1f3 d7d6 d2d4': '3.d4 — Siciliana Abierta: Variante Principal',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4': '3...cxd4 — Siciliana Abierta',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4': '4.Cxd4 — Siciliana: Línea Principal',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6': '4...Cf6 — Siciliana: Preparando Najdorf/Dragón',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3': '5.Cc3 — Siciliana: Línea Clásica',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6': '5...a6 — Siciliana Najdorf',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6': '5...g6 — Siciliana Dragón',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5': '5...e5 — Siciliana Sveshnikov',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 b8c6': '5...Cc6 — Siciliana Clásica',
    'e2e4 c7c5 g1f3 b8c6': '2...Cc6 — Siciliana Clásica',
    'e2e4 c7c5 g1f3 b8c6 d2d4': '3.d4 — Siciliana Clásica Abierta',
    'e2e4 c7c5 g1f3 e7e6': '2...e6 — Siciliana Paulsen / Taimanov',
    'e2e4 c7c5 g1f3 e7e6 d2d4': '3.d4 — Siciliana Paulsen: Línea Principal',
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 a7a6': '4...a6 — Siciliana Kan',
    'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 b8c6': '4...Cc6 — Siciliana Taimanov',
    'e2e4 c7c5 g1f3 g7g6': '2...g6 — Siciliana Acelerada del Dragón',
    'e2e4 c7c5 b1c3': '2.Cc3 — Siciliana Cerrada',
    'e2e4 c7c5 c2c3': '2.c3 — Siciliana Alapin',
    'e2e4 c7c5 c2c3 d7d5': '2...d5 — Alapin: Línea Principal',
    'e2e4 c7c5 c2c3 g8f6': '2...Cf6 — Alapin: Variante Moderna',
    'e2e4 c7c5 d2d4': '2.d4 — Gambito Smith-Morra',
    'e2e4 c7c5 d2d4 c5d4': '2...cxd4 — Smith-Morra Aceptado',
    'e2e4 c7c5 f2f4': '2.f4 — Gambito Grand Prix',

    // Francesa variantes
    'e2e4 e7e6 d2d4': '2.d4 — Francesa: Variante Principal',
    'e2e4 e7e6 d2d4 d7d5': '2...d5 — Francesa Clásica',
    'e2e4 e7e6 d2d4 d7d5 b1c3': '3.Cc3 — Francesa: Winawer / Clásica',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4': '3...Ab4 — Francesa: Variante Winawer',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5': '4.e5 — Winawer: Línea Principal',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5': '4...c5 — Winawer: Variante Clásica',
    'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6': '3...Cf6 — Francesa: Variante Clásica',
    'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5': '4.Ag5 — Francesa Clásica: Línea McCutcheon',
    'e2e4 e7e6 d2d4 d7d5 b1c3 d5e4': '3...dxe4 — Francesa: Variante Rubinstein',
    'e2e4 e7e6 d2d4 d7d5 e4e5': '3.e5 — Francesa: Variante del Avance',
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5': '3...c5 — Francesa Avance: Línea Principal',
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3': '4.c3 — Francesa Avance: Variante Nimzowitsch',
    'e2e4 e7e6 d2d4 d7d5 b1d2': '3.Cd2 — Francesa: Variante Tarrasch',
    'e2e4 e7e6 d2d4 d7d5 b1d2 g8f6': '3...Cf6 — Tarrasch: Línea Principal',
    'e2e4 e7e6 d2d4 d7d5 b1d2 c7c5': '3...c5 — Tarrasch: Variante Abierta',

    // Caro-Kann variantes
    'e2e4 c7c6 d2d4': '2.d4 — Caro-Kann: Variante Principal',
    'e2e4 c7c6 d2d4 d7d5': '2...d5 — Caro-Kann Clásica',
    'e2e4 c7c6 d2d4 d7d5 b1c3': '3.Cc3 — Caro-Kann: Variante Clásica',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4': '3...dxe4 — Caro-Kann Clásica: Línea Principal',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4': '4.Cxe4 — Caro-Kann: Variante Principal',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5': '4...Af5 — Caro-Kann: Clásica con Af5',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 b8d7': '4...Cd7 — Caro-Kann: Variante Smyslov',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 g8f6': '4...Cf6 — Caro-Kann: Bronstein-Larsen',
    'e2e4 c7c6 d2d4 d7d5 e4e5': '3.e5 — Caro-Kann: Variante del Avance',
    'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5': '3...Af5 — Caro-Kann Avance: Línea Principal',
    'e2e4 c7c6 d2d4 d7d5 e4d5': '3.exd5 — Caro-Kann: Variante del Cambio',
    'e2e4 c7c6 d2d4 d7d5 e4d5 c6d5': '3...cxd5 — Caro-Kann: Cambio Simétrico',

    // Escandinava
    'e2e4 d7d5 e4d5': '2.exd5 — Escandinava: Línea Principal',
    'e2e4 d7d5 e4d5 d8d5': '2...Dxd5 — Escandinava: Recuperación Inmediata',
    'e2e4 d7d5 e4d5 d8d5 b1c3': '3.Cc3 — Escandinava: Línea Principal',
    'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5': '3...Da5 — Escandinava: Variante Clásica',
    'e2e4 d7d5 e4d5 d8d5 b1c3 d5d6': '3...Dd6 — Escandinava: Variante Moderna',
    'e2e4 d7d5 e4d5 g8f6': '2...Cf6 — Escandinava: Variante Moderna (Marshall)',

    // Pirc / Moderna
    'e2e4 d7d6 d2d4': '2.d4 — Pirc: Variante Principal',
    'e2e4 d7d6 d2d4 g8f6': '2...Cf6 — Pirc Clásica',
    'e2e4 d7d6 d2d4 g8f6 b1c3': '3.Cc3 — Pirc: Línea Principal',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6': '3...g6 — Pirc: Sistema Clásico',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 f2f4': '4.f4 — Pirc: Ataque Austriaco',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3': '4.Cf3 — Pirc: Línea Clásica',
    'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 c1e3': '4.Ae3 — Pirc: Sistema 150 Ataque',

    // 1.d4 respuestas
    'd2d4 d7d5': '1...d5 — Juego Cerrado',
    'd2d4 g8f6': '1...Cf6 — Defensa India',
    'd2d4 e7e6': '1...e6 — Defensa Francesa Invertida',
    'd2d4 f7f5': '1...f5 — Defensa Holandesa',
    'd2d4 c7c5': '1...c5 — Defensa Benoni',
    'd2d4 g7g6': '1...g6 — Defensa India de Rey Moderna',
    'd2d4 d7d6': '1...d6 — Defensa India Antigua',

    // Gambito de Dama
    'd2d4 d7d5 c2c4': '2.c4 — Gambito de Dama',
    'd2d4 d7d5 c2c4 d5c4': '2...dxc4 — Gambito de Dama Aceptado',
    'd2d4 d7d5 c2c4 d5c4 g1f3': '3.Cf3 — GDA: Línea Principal',
    'd2d4 d7d5 c2c4 d5c4 e2e3': '3.e3 — GDA: Variante Clásica',
    'd2d4 d7d5 c2c4 e7e6': '2...e6 — Gambito de Dama Rehusado',
    'd2d4 d7d5 c2c4 e7e6 b1c3': '3.Cc3 — GDR: Línea Principal',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6': '3...Cf6 — GDR Clásico',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5': '4.Ag5 — GDR: Variante Ortodoxa',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7': '4...Ae7 — GDR Ortodoxa: Línea Principal',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 g1f3': '4.Cf3 — GDR: Variante del Cambio',
    'd2d4 d7d5 c2c4 e7e6 g1f3': '3.Cf3 — GDR: Sistema Cf3',
    'd2d4 d7d5 c2c4 e7e6 g1f3 g8f6': '3...Cf6 — GDR: Línea Clásica',
    'd2d4 d7d5 c2c4 c7c6': '2...c6 — Defensa Eslava',
    'd2d4 d7d5 c2c4 c7c6 g1f3': '3.Cf3 — Eslava: Línea Principal',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6': '3...Cf6 — Eslava Clásica',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3': '4.Cc3 — Eslava: Variante Principal',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4': '4...dxc4 — Eslava: Variante Checa',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6': '4...e6 — Semi-Eslava',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3': '5.e3 — Semi-Eslava: Meran',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 c1g5': '5.Ag5 — Semi-Eslava: Anti-Meran',
    'd2d4 d7d5 c2c4 g8f6': '2...Cf6 — Defensa Marshall',
    'd2d4 d7d5 g1f3': '2.Cf3 — Sistema Londres / Colle',
    'd2d4 d7d5 g1f3 g8f6': '2...Cf6 — Sistema Colle',
    'd2d4 d7d5 g1f3 g8f6 c1f4': '3.Af4 — Sistema Londres',
    'd2d4 d7d5 g1f3 g8f6 e2e3': '3.e3 — Sistema Colle: Línea Principal',
    'd2d4 d7d5 c1f4': '2.Af4 — Sistema Londres',
    'd2d4 d7d5 c1f4 g8f6': '2...Cf6 — Londres: Línea Principal',
    'd2d4 d7d5 c1f4 g8f6 e2e3': '3.e3 — Londres: Variante Clásica',
    'd2d4 d7d5 c1f4 g8f6 g1f3': '3.Cf3 — Londres: Línea Moderna',

    // India de Rey
    'd2d4 g8f6 c2c4': '2.c4 — Sistema Indio',
    'd2d4 g8f6 c2c4 g7g6': '2...g6 — India de Rey',
    'd2d4 g8f6 c2c4 g7g6 b1c3': '3.Cc3 — India de Rey: Línea Principal',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7': '3...Ag7 — India de Rey: Fianchetto',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4': '4.e4 — India de Rey: Línea Clásica',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6': '4...d6 — India de Rey: Variante Principal',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3': '5.Cf3 — India de Rey: Clásica',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3': '5.f3 — India de Rey: Sämisch',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1e2': '5.Ce2 — India de Rey: Averbakh',
    'd2d4 g8f6 c2c4 g7g6 g1f3': '3.Cf3 — India de Rey: Fianchetto',
    'd2d4 g8f6 c2c4 g7g6 g2g3': '3.g3 — India de Rey: Sistema Fianchetto',
    'd2d4 g8f6 c2c4 e7e6': '2...e6 — India de Dama / Nimzo-India',
    'd2d4 g8f6 c2c4 e7e6 b1c3': '3.Cc3 — Nimzo-India',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4': '3...Ab4 — Nimzo-India: Línea Principal',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2': '4.Dc2 — Nimzo-India: Variante Clásica',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3': '4.e3 — Nimzo-India: Variante Rubinstein',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 a2a3': '4.a3 — Nimzo-India: Variante Sämisch',
    'd2d4 g8f6 c2c4 e7e6 g1f3': '3.Cf3 — India de Dama',
    'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6': '3...b6 — India de Dama: Línea Principal',
    'd2d4 g8f6 c2c4 e7e6 g1f3 f8b4': '3...Ab4+ — Bogo-India',
    'd2d4 g8f6 c2c4 e7e6 g1f3 d7d5': '3...d5 — GDR: Transposición',
    'd2d4 g8f6 c2c4 e7e6 g2g3': '3.g3 — Catalana',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5': '3...d5 — Catalana: Línea Principal',
    'd2d4 g8f6 c2c4 c7c5': '2...c5 — Benoni Moderna',
    'd2d4 g8f6 c2c4 c7c5 d4d5': '3.d5 — Benoni: Línea Principal',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6': '3...e6 — Benoni Moderna: Clásica',
    'd2d4 g8f6 c2c4 e7e5': '2...e5 — Gambito Budapest',
    'd2d4 g8f6 c2c4 b7b6': '2...b6 — Defensa India de Dama',
    'd2d4 g8f6 g1f3': '2.Cf3 — Sistema Indio de Dama',
    'd2d4 g8f6 c1f4': '2.Af4 — Sistema Londres vs India',
    'd2d4 g8f6 c1f4 d7d5': '2...d5 — Londres vs India: Línea Principal',
    'd2d4 g8f6 c1f4 g7g6': '2...g6 — Londres vs India de Rey',

    // Holandesa
    'd2d4 f7f5 c2c4': '2.c4 — Holandesa: Variante Principal',
    'd2d4 f7f5 g1f3': '2.Cf3 — Holandesa: Clásica',
    'd2d4 f7f5 g2g3': '2.g3 — Holandesa: Leningrado',
    'd2d4 f7f5 c2c4 g8f6': '2...Cf6 — Holandesa: Línea Principal',
    'd2d4 f7f5 c2c4 g8f6 g2g3': '3.g3 — Holandesa: Leningrado Moderna',
    'd2d4 f7f5 c2c4 e7e6': '2...e6 — Holandesa: Muro de Piedra',

    // Inglesa continuaciones
    'c2c4 e7e5': '1...e5 — Inglesa: Siciliana Invertida',
    'c2c4 e7e5 b1c3': '2.Cc3 — Inglesa: Línea Principal',
    'c2c4 e7e5 b1c3 g8f6': '2...Cf6 — Inglesa: Variante Principal',
    'c2c4 e7e5 b1c3 g8f6 g1f3': '3.Cf3 — Inglesa: Cuatro Caballos',
    'c2c4 e7e5 g2g3': '2.g3 — Inglesa: Fianchetto',
    'c2c4 c7c5': '1...c5 — Inglesa Simétrica',
    'c2c4 c7c5 g1f3': '2.Cf3 — Inglesa Simétrica: Línea Principal',
    'c2c4 c7c5 b1c3': '2.Cc3 — Inglesa Simétrica: Cc3',
    'c2c4 g8f6': '1...Cf6 — Inglesa: India',
    'c2c4 g8f6 b1c3': '2.Cc3 — Inglesa India: Línea Principal',
    'c2c4 g8f6 g1f3': '2.Cf3 — Inglesa India: Sistema Réti',
    'c2c4 e7e6': '1...e6 — Inglesa: Agincourt',
    'c2c4 g7g6': '1...g6 — Inglesa: Moderna',

    // Réti
    'g1f3 d7d5': '1...d5 — Réti: Clásica',
    'g1f3 d7d5 c2c4': '2.c4 — Réti: Gambito',
    'g1f3 d7d5 c2c4 d5c4': '2...dxc4 — Réti: Gambito Aceptado',
    'g1f3 d7d5 c2c4 e7e6': '2...e6 — Réti: Línea Principal',
    'g1f3 d7d5 c2c4 c7c6': '2...c6 — Réti: Eslava',
    'g1f3 d7d5 g2g3': '2.g3 — Réti: Sistema Catalán',
    'g1f3 d7d5 g2g3 g8f6': '2...Cf6 — Réti Catalán: Línea Principal',
    'g1f3 g8f6': '1...Cf6 — Réti: Simétrica',
    'g1f3 g8f6 c2c4': '2.c4 — Réti: Transposición India',
    'g1f3 g8f6 g2g3': '2.g3 — Réti: Doble Fianchetto',
    'g1f3 c7c5': '1...c5 — Réti: Siciliana Invertida',
    'g1f3 f7f5': '1...f5 — Réti: Holandesa',

    // Larsen
    'b2b3 e7e5': '1...e5 — Larsen: Línea Principal',
    'b2b3 d7d5': '1...d5 — Larsen: Clásica',
    'b2b3 g8f6': '1...Cf6 — Larsen: India',

    // Húngara
    'g2g3 d7d5': '1...d5 — Húngara: Clásica',
    'g2g3 e7e5': '1...e5 — Húngara: Línea Principal',
    'g2g3 g8f6': '1...Cf6 — Húngara: India',

    // ========== VARIANTES PROFUNDAS (movimientos 9-20) ==========

    // --- ESPAÑOLA (Ruy López) profunda ---
    // Cerrada: línea principal Breyer/Chigorin
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1': '6.Te1 — Española Cerrada: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5': '6...b5 — Española Cerrada: Variante Clásica',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3': '7.Ab3 — Española Cerrada: Ab3',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6': '7...d6 — Española Cerrada: Preparando O-O',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3': '8.c3 — Española Cerrada: Sistema Clásico',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8': '8...O-O — Española Cerrada: Posición Tabiya',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3': '9.h3 — Española Cerrada: Evitando Ag4',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6b8': '9...Cb8 — Española: Variante Breyer',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6b8 d2d4': '10.d4 — Breyer: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6b8 d2d4 b8d7': '10...Cbd7 — Breyer: Reagrupamiento',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c8b7': '9...Ab7 — Española: Variante Zaitsev',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6a5': '9...Ca5 — Española: Variante Chigorin',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6a5 b3c2': '10.Ac2 — Chigorin: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6a5 b3c2 c7c5': '10...c5 — Chigorin: Contrajuego Central',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6a5 b3c2 c7c5 d2d4': '11.d4 — Chigorin: Ruptura Central',
    // Berlinesa profunda
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1': '4.O-O — Berlinesa: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4': '4...Cxe4 — Berlinesa: Muro de Berlín',
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4': '5.d4 — Berlinesa: Muro, Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6': '5...Cd6 — Berlinesa: Muro, Variante Moderna',
    'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6 b5c6 d7c6': '6.Axc6 — Berlinesa: Final del Muro',
    // Española Abierta profunda
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4': '5...Cxe4 — Española: Variante Abierta',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4 d2d4': '6.d4 — Española Abierta: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4 d2d4 b7b5': '6...b5 — Española Abierta: Clásica',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f6e4 d2d4 b7b5 a4b3': '7.Ab3 — Española Abierta: Ab3',
    // Marshall
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8': '7...O-O — Española: Preparando Marshall',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 c2c3 d7d5': '8...d5 — Española: Gambito Marshall',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 c2c3 d7d5 e4d5': '9.exd5 — Marshall: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 c2c3 d7d5 e4d5 f6d5': '9...Cxd5 — Marshall: Recuperación',

    // --- ITALIANA profunda ---
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6': '4...Cf6 — Italiana: Giuoco Piano, Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4': '5.d4 — Italiana: Ruptura Central',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4': '5...exd4 — Italiana: Cambio Central',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4 c3d4': '6.cxd4 — Italiana: Centro Abierto',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6': '4...Cf6 — Giuoco Pianissimo: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3': '5.c3 — Giuoco Pianissimo: Moderno',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6': '5...d6 — Giuoco Pianissimo: Clásica',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 e1g1': '6.O-O — Giuoco Pianissimo: Enroque',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 e1g1 e8g8': '6...O-O — Giuoco Pianissimo: Posición Tabiya',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 e1g1 e8g8 f1e1': '7.Te1 — Giuoco Pianissimo: Refuerzo Central',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 e1g1 e8g8 f1e1 a7a6': '7...a6 — Giuoco Pianissimo: Preparando b5',
    // Gambito Evans profundo
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4': '4...Axb4 — Evans Aceptado',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3': '5.c3 — Evans: Línea Principal',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5': '5...Aa5 — Evans: Retirada Clásica',
    'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5 d2d4': '6.d4 — Evans: Ruptura Central',

    // --- SICILIANA NAJDORF profunda ---
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5': '6.Ag5 — Najdorf: Ataque Inglés',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6': '6...e6 — Najdorf: Variante Principal',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4': '7.f4 — Najdorf: Ataque Inglés con f4',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 f8e7': '7...Ae7 — Najdorf: Línea Clásica',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 d8b6': '7...Db6 — Najdorf: Envenenado',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3': '6.Ae3 — Najdorf: Sistema Inglés Moderno',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5': '6...e5 — Najdorf: Ae3 con e5',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3': '7.Cb3 — Najdorf: Ae3 e5 Cb3',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e6': '6...e6 — Najdorf: Ae3, Scheveningen',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f2f3': '6.f3 — Najdorf: Ataque Inglés f3',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f2f3 e7e5': '6...e5 — Najdorf: f3 con e5',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1e2': '6.Ae2 — Najdorf: Variante Opočenský',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1e2 e7e5': '6...e5 — Najdorf: Ae2 con e5',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 f1e2 e7e5 d4b3': '7.Cb3 — Najdorf: Ae2 e5 Cb3',

    // --- SICILIANA DRAGÓN profunda ---
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3': '6.Ae3 — Dragón: Ataque Yugoslavo',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7': '6...Ag7 — Dragón: Yugoslavo, Línea Principal',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3': '7.f3 — Dragón: Yugoslavo con f3',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8': '7...O-O — Dragón: Yugoslavo, Enroque',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8 d1d2': '8.Dd2 — Dragón: Yugoslavo Clásico',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8 d1d2 b8c6': '8...Cc6 — Dragón: Yugoslavo, Preparando Ataque',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8 d1d2 b8c6 e1c1': '9.O-O-O — Dragón: Enroques Opuestos',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 f1e2': '6.Ae2 — Dragón: Variante Clásica',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 f1e2 f8g7': '6...Ag7 — Dragón Clásica: Fianchetto',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 f1e2 f8g7 e1g1': '7.O-O — Dragón Clásica: Enroque',
    'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 f1e2 f8g7 e1g1 e8g8': '7...O-O — Dragón Clásica: Posición Tabiya',

    // --- SICILIANA SVESHNIKOV profunda ---
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5': '5...e5 — Sveshnikov: Línea Principal',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5': '6.Cdb5 — Sveshnikov: Variante Principal',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6': '6...d6 — Sveshnikov: Línea Clásica',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5': '7.Ag5 — Sveshnikov: Ataque con Ag5',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6': '7...a6 — Sveshnikov: Expulsando el Caballo',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6 b5a3': '8.Ca3 — Sveshnikov: Retirada a a3',
    'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6 b5a3 b7b5': '8...b5 — Sveshnikov: Expansión en el Flanco',

    // --- FRANCESA profunda ---
    // Winawer profunda
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3': '5.a3 — Winawer: Variante con a3',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3': '5...Axc3+ — Winawer: Cambio de Alfil',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3': '6.bxc3 — Winawer: Estructura Doblada',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7': '6...Ce7 — Winawer: Línea Principal Moderna',
    'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7 d1g4': '7.Dg4 — Winawer: Ataque con Dg4',
    // Clásica profunda
    'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7': '4...Ae7 — Francesa Clásica: Línea McCutcheon',
    'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5': '5.e5 — Francesa Clásica: Avance',
    'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7': '5...Cd7 — Francesa Clásica: Retirada',
    'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7 g5e7 d8e7': '6.Axe7 Dxe7 — Francesa Clásica: Cambio',
    // Avance profunda
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6': '4...Cc6 — Francesa Avance: Desarrollo',
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3': '5.Cf3 — Francesa Avance: Clásica',
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6': '5...Db6 — Francesa Avance: Presión sobre d4',
    'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6 a2a3': '6.a3 — Francesa Avance: Línea Moderna',

    // --- CARO-KANN profunda ---
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3': '5.Cg3 — Caro-Kann Clásica: Cg3',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6': '5...Ag6 — Caro-Kann: Retirada del Alfil',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4': '6.h4 — Caro-Kann: Ataque con h4',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6': '6...h6 — Caro-Kann: Frenando h5',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6 g1f3': '7.Cf3 — Caro-Kann Clásica: Línea Principal',
    'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6 g1f3 b8d7': '7...Cd7 — Caro-Kann: Desarrollo Flexible',
    'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 b1c3': '4.Cc3 — Caro-Kann Avance: Variante Tal',
    'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3': '4.Cf3 — Caro-Kann Avance: Línea Corta',
    'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6': '4...e6 — Caro-Kann Avance: Clásica',
    'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2': '5.Ae2 — Caro-Kann Avance: Línea Principal',

    // --- GAMBITO DE DAMA REHUSADO profundo ---
    'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 c2c3 d7d5 e4d5 f6d5 f3e5': '10.Cxe5 — Marshall: Línea Principal',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3': '5.e3 — GDR Ortodoxa: Línea Principal',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8': '5...O-O — GDR Ortodoxa: Enroque',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3': '6.Cf3 — GDR Ortodoxa: Desarrollo',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7': '6...Cbd7 — GDR Ortodoxa: Clásica',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7 a1c1': '7.Tc1 — GDR Ortodoxa: Torre en c1',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7 a1c1 c7c6': '7...c6 — GDR Ortodoxa: Posición Tabiya',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7 a1c1 c7c6 f1d3': '8.Ad3 — GDR Ortodoxa: Sistema Clásico',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7 a1c1 c7c6 f1d3 d5c4': '8...dxc4 — GDR Ortodoxa: Captura Central',
    'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7 a1c1 c7c6 f1d3 d5c4 d3c4': '9.Axc4 — GDR Ortodoxa: Recuperación',

    // --- ESLAVA / SEMI-ESLAVA profunda ---
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7': '5...Cbd7 — Semi-Eslava: Meran, Desarrollo',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3': '6.Ad3 — Semi-Eslava: Meran, Ad3',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3 d5c4': '6...dxc4 — Semi-Eslava: Meran Aceptada',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3 d5c4 d3c4': '7.Axc4 — Semi-Eslava: Meran, Línea Principal',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3 d5c4 d3c4 b7b5': '7...b5 — Semi-Eslava: Meran, Variante Principal',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 c1g5 b8d7': '5...Cbd7 — Semi-Eslava: Anti-Meran con Ag5',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 c1g5 h7h6': '5...h6 — Semi-Eslava: Anti-Moscú',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4': '5.a4 — Eslava: Variante Clásica con a4',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5': '5...Af5 — Eslava Checa: Línea Principal',
    'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5 e2e3': '6.e3 — Eslava Checa: Línea Clásica',

    // --- INDIA DE REY profunda ---
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8': '5...O-O — India de Rey Clásica: Enroque',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2': '6.Ae2 — India de Rey: Variante Clásica',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5': '6...e5 — India de Rey: Variante Principal',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1': '7.O-O — India de Rey: Posición Tabiya',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6': '7...Cc6 — India de Rey: Sistema Clásico',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5': '8.d5 — India de Rey: Mar del Plata',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7': '8...Ce7 — India de Rey: Mar del Plata, Línea Principal',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 c3e1': '9.Ce1 — India de Rey: Petrosián',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7 f3e1': '9.Cd2 — India de Rey: Bayoneta (preparación)',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8a6': '7...Ca6 — India de Rey: Variante Moderna',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 f6d7': '7...Cd7 — India de Rey: Variante Gligoric',
    // Sämisch profunda
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8': '5...O-O — Sämisch: Enroque',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3': '6.Ae3 — Sämisch: Línea Principal',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 e7e5': '6...e5 — Sämisch: Contraataque Central',
    'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 b8c6': '6...Cc6 — Sämisch: Desarrollo Flexible',

    // --- NIMZO-INDIA profunda ---
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 e8g8': '4...O-O — Nimzo-India Clásica: Enroque',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 e8g8 a2a3': '5.a3 — Nimzo-India Clásica: Expulsando Alfil',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 e8g8 a2a3 b4c3': '5...Axc3+ — Nimzo-India: Cambio en c3',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 e8g8 a2a3 b4c3 d1c3': '6.Dxc3 — Nimzo-India: Recuperación',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8': '4...O-O — Nimzo-India Rubinstein: Enroque',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3': '5.Ad3 — Rubinstein: Línea Principal',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5': '5...d5 — Rubinstein: Central',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3': '6.Cf3 — Rubinstein: Desarrollo',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3 c7c5': '6...c5 — Rubinstein: Contrajuego',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 c7c5': '4...c5 — Nimzo-India: Variante Hübner',
    'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 b7b6': '4...b6 — Nimzo-India: Fischer',

    // --- CATALANA profunda ---
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2': '4.Ag2 — Catalana: Fianchetto',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7': '4...Ae7 — Catalana: Cerrada',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4': '4...dxc4 — Catalana: Abierta',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3': '5.Cf3 — Catalana Abierta: Línea Principal',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3 f8e7': '5...Ae7 — Catalana Abierta: Clásica',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3 a7a6': '5...a6 — Catalana Abierta: Variante Moderna',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3': '5.Cf3 — Catalana Cerrada: Desarrollo',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8': '5...O-O — Catalana Cerrada: Enroque',
    'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1': '6.O-O — Catalana Cerrada: Posición Tabiya',

    // --- BENONI profunda ---
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3': '4.Cc3 — Benoni Moderna: Línea Principal',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5': '4...exd5 — Benoni: Captura Central',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5': '5.cxd5 — Benoni: Recuperación',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6': '5...d6 — Benoni Moderna: Posición Tabiya',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4': '6.e4 — Benoni: Cuatro Peones',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 e2e4 g7g6': '6...g6 — Benoni: Fianchetto de Rey',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 g1f3': '6.Cf3 — Benoni: Línea Clásica',
    'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 g1f3 g7g6': '6...g6 — Benoni Clásica: Fianchetto',

    // --- PETROV profunda ---
    'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3': '4.Cf3 — Petrov: Retirada',
    'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4': '4...Cxe4 — Petrov: Recuperación Simétrica',
    'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4': '5.d4 — Petrov: Centro Fuerte',
    'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d7d5': '5...d5 — Petrov: Línea Simétrica',
    'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d7d5 f1d3': '6.Ad3 — Petrov: Desarrollo Clásico',
    'e2e4 e7e5 g1f3 g8f6 d2d4 f6e4': '3...Cxe4 — Petrov: Ataque Steinitz, Captura',
    'e2e4 e7e5 g1f3 g8f6 d2d4 f6e4 f1d3': '4.Ad3 — Petrov Steinitz: Desarrollo',
    'e2e4 e7e5 g1f3 g8f6 d2d4 f6e4 f1d3 d7d5': '4...d5 — Petrov Steinitz: Central',
    'e2e4 e7e5 g1f3 g8f6 d2d4 f6e4 f1d3 d7d5 f3e5': '5.Cxe5 — Petrov Steinitz: Línea Principal',

    // --- SISTEMA LONDRES profundo ---
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5': '3...c5 — Londres: Contrajuego Central',
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3': '4.c3 — Londres: Refuerzo Central',
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3 b8c6': '4...Cc6 — Londres: Desarrollo',
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3 b8c6 g1f3': '5.Cf3 — Londres: Línea Principal',
    'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3 b8c6 g1f3 d8b6': '5...Db6 — Londres: Presión sobre b2',
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6': '3...e6 — Londres: Configuración Cerrada',
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3': '4.Cf3 — Londres: Sistema Clásico',
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3 f8d6': '4...Ad6 — Londres: Cambio de Alfil',
    'd2d4 d7d5 c1f4 g8f6 e2e3 e7e6 g1f3 f8d6 f4d6': '5.Axd6 — Londres: Cambio Directo',
    'd2d4 d7d5 c1f4 g8f6 g1f3 c7c5': '3...c5 — Londres Moderna: Contrajuego',
    'd2d4 d7d5 c1f4 g8f6 g1f3 e7e6': '3...e6 — Londres Moderna: Clásica',
    'd2d4 d7d5 c1f4 g8f6 g1f3 e7e6 e2e3': '4.e3 — Londres Moderna: Sólida',

    // --- INGLESA profunda ---
    'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6': '3...Cc6 — Inglesa: Cuatro Caballos',
    'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3': '4.g3 — Inglesa: Cuatro Caballos con g3',
    'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5': '4...d5 — Inglesa: Cuatro Caballos Central',
    'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5': '5.cxd5 — Inglesa: Captura Central',
    'c2c4 e7e5 b1c3 b8c6': '2...Cc6 — Inglesa: Gran Prix Invertida',
    'c2c4 e7e5 g2g3 g8f6': '2...Cf6 — Inglesa Fianchetto: Desarrollo',
    'c2c4 e7e5 g2g3 g8f6 f1g2': '3.Ag2 — Inglesa: Fianchetto Completo',
    'c2c4 c7c5 b1c3 g8f6': '2...Cf6 — Inglesa Simétrica: Desarrollo',
    'c2c4 c7c5 b1c3 g8f6 g2g3': '3.g3 — Inglesa Simétrica: Fianchetto',
    'c2c4 c7c5 g1f3 g8f6': '2...Cf6 — Inglesa Simétrica: Dos Caballos',
    'c2c4 c7c5 g1f3 b8c6': '2...Cc6 — Inglesa Simétrica: Clásica',
};

let currentOpeningName = '';
let lastOpeningMoveCount = 0;
let trainingOpening = null;
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
    }
};

const OPENING_TRAINING = {
    'italiana': { name: 'Apertura Italiana (Giuoco Piano)', moves: 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5', san: '1.e4 e5 2.Cf3 Cc6 3.Ac4 Ac5', desc: 'Busca control central y desarrollo rápido apuntando al punto débil f7. Juego abierto con opciones tácticas para ambos bandos.' },
    'española': { name: 'Apertura Española (Ruy López)', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5', san: '1.e4 e5 2.Cf3 Cc6 3.Ab5', desc: 'Presiona el caballo que defiende e5, buscando ventaja posicional a largo plazo. La apertura más profunda y estudiada del ajedrez.' },
    'escocesa': { name: 'Apertura Escocesa', moves: 'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4', san: '1.e4 e5 2.Cf3 Cc6 3.d4 exd4 4.Cxd4', desc: 'Abre el centro inmediatamente, buscando juego activo de piezas y diagonales libres para los alfiles.' },
    'petrov': { name: 'Defensa Petrov', moves: 'e2e4 e7e5 g1f3 g8f6', san: '1.e4 e5 2.Cf3 Cf6', desc: 'Defensa simétrica y sólida. Las negras contraatacan el peón e4 en vez de defender e5, buscando igualdad rápida.' },
    'vienesa': { name: 'Apertura Vienesa', moves: 'e2e4 e7e5 b1c3', san: '1.e4 e5 2.Cc3', desc: 'Prepara f4 sin bloquear el peón f. Combina ideas del Gambito de Rey con desarrollo flexible del caballo.' },
    'gambito-rey': { name: 'Gambito de Rey', moves: 'e2e4 e7e5 f2f4', san: '1.e4 e5 2.f4', desc: 'Sacrifica un peón por iniciativa y ataque al rey. Apertura romántica y agresiva que busca abrir la columna f.' },
    'gambito-evans': { name: 'Gambito Evans', moves: 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4', san: '1.e4 e5 2.Cf3 Cc6 3.Ac4 Ac5 4.b4', desc: 'Sacrifica un peón de flanco para ganar tiempos de desarrollo y construir un centro fuerte con c3 y d4.' },
    'dos-caballos': { name: 'Dos Caballos', moves: 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6', san: '1.e4 e5 2.Cf3 Cc6 3.Ac4 Cf6', desc: 'Contraataque directo al peón e4. Las negras prefieren actividad a solidez, aceptando complicaciones tácticas.' },
    'siciliana-najdorf': { name: 'Siciliana Najdorf', moves: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6', san: '1.e4 c5 2.Cf3 d6 3.d4 cxd4 4.Cxd4 Cf6 5.Cc3 a6', desc: 'La variante más popular de la Siciliana. ...a6 prepara ...e5 o ...b5 para contrajuego en el flanco de dama manteniendo flexibilidad.' },
    'siciliana-dragon': { name: 'Siciliana Dragón', moves: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6', san: '1.e4 c5 2.Cf3 d6 3.d4 cxd4 4.Cxd4 Cf6 5.Cc3 g6', desc: 'Fianchetto del alfil en g7 creando presión en la gran diagonal. Lleva a ataques opuestos: blancas al rey, negras al flanco de dama.' },
    'siciliana-sveshnikov': { name: 'Siciliana Sveshnikov', moves: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5', san: '1.e4 c5 2.Cf3 d6 3.d4 cxd4 4.Cxd4 Cf6 5.Cc3 e5', desc: 'Golpe central agresivo que expulsa el caballo. Acepta debilidad en d5 a cambio de juego activo y contrajuego dinámico.' },
    'siciliana-clasica': { name: 'Siciliana Clásica', moves: 'e2e4 c7c5 g1f3 b8c6', san: '1.e4 c5 2.Cf3 Cc6', desc: 'Desarrollo natural del caballo presionando d4. Posición flexible que puede transponerse a múltiples sistemas.' },
    'siciliana-alapin': { name: 'Siciliana Alapin', moves: 'e2e4 c7c5 c2c3', san: '1.e4 c5 2.c3', desc: 'Blancas preparan d4 reforzado con c3. Evita la complejidad teórica de la Siciliana Abierta a cambio de un centro sólido.' },
    'siciliana-smith-morra': { name: 'Gambito Smith-Morra', moves: 'e2e4 c7c5 d2d4 c5d4', san: '1.e4 c5 2.d4 cxd4', desc: 'Gambito agresivo que sacrifica un peón por desarrollo rápido, columnas abiertas y fuerte iniciativa.' },
    'francesa-winawer': { name: 'Francesa Winawer', moves: 'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4', san: '1.e4 e6 2.d4 d5 3.Cc3 Ab4', desc: 'Clava el caballo que defiende e4. Lleva a juego desequilibrado con peones doblados y ataques en flancos opuestos.' },
    'francesa-clasica': { name: 'Francesa Clásica', moves: 'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6', san: '1.e4 e6 2.d4 d5 3.Cc3 Cf6', desc: 'Presión directa sobre e4. Juego más sólido que la Winawer, con planes estratégicos de ruptura con ...c5 o ...f6.' },
    'francesa-avance': { name: 'Francesa Avance', moves: 'e2e4 e7e6 d2d4 d7d5 e4e5', san: '1.e4 e6 2.d4 d5 3.e5', desc: 'Fija la estructura de peones y gana espacio. Las negras buscan romper con ...c5 y presionar la cadena de peones blancos.' },
    'francesa-tarrasch': { name: 'Francesa Tarrasch', moves: 'e2e4 e7e6 d2d4 d7d5 b1d2', san: '1.e4 e6 2.d4 d5 3.Cd2', desc: 'Evita el clavado de la Winawer. Juego más tranquilo que permite recapturar en e4 con el caballo manteniendo la estructura.' },
    'caro-kann-clasica': { name: 'Caro-Kann Clásica', moves: 'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4', san: '1.e4 c6 2.d4 d5 3.Cc3 dxe4 4.Cxe4', desc: 'Defensa sólida que desarrolla el alfil de dama antes de cerrar la posición. Busca igualdad con estructura de peones sana.' },
    'caro-kann-avance': { name: 'Caro-Kann Avance', moves: 'e2e4 c7c6 d2d4 d7d5 e4e5', san: '1.e4 c6 2.d4 d5 3.e5', desc: 'Gana espacio en el centro. Las negras buscan contrajuego con ...c5 y ...Af5, presionando la cadena de peones.' },
    'escandinava': { name: 'Defensa Escandinava', moves: 'e2e4 d7d5 e4d5 d8d5 b1c3', san: '1.e4 d5 2.exd5 Dxd5 3.Cc3', desc: 'Desafía e4 inmediatamente. La dama sale temprano pero obtiene desarrollo rápido del alfil de dama y estructura sólida.' },
    'pirc': { name: 'Defensa Pirc', moves: 'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6', san: '1.e4 d6 2.d4 Cf6 3.Cc3 g6', desc: 'Hipermoderna: permite que las blancas construyan un gran centro para luego atacarlo con ...e5 o ...c5 y el alfil fianchetado.' },
    'gda': { name: 'Gambito de Dama Aceptado', moves: 'd2d4 d7d5 c2c4 d5c4', san: '1.d4 d5 2.c4 dxc4', desc: 'Las negras capturan el peón del gambito para luego cederlo, ganando tiempos para desarrollar el alfil de dama activamente.' },
    'gdr-ortodoxa': { name: 'GDR Ortodoxa', moves: 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5', san: '1.d4 d5 2.c4 e6 3.Cc3 Cf6 4.Ag5', desc: 'Sistema clásico donde las blancas presionan el centro con piezas desarrolladas. Juego posicional profundo y maniobras estratégicas.' },
    'eslava': { name: 'Defensa Eslava', moves: 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6', san: '1.d4 d5 2.c4 c6 3.Cf3 Cf6', desc: 'Defiende d5 con c6 sin bloquear el alfil de dama. Estructura sólida con planes de contrajuego en el flanco de dama.' },
    'semi-eslava': { name: 'Semi-Eslava', moves: 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6', san: '1.d4 d5 2.c4 c6 3.Cf3 Cf6 4.Cc3 e6', desc: 'Combina la solidez de la Eslava con la flexibilidad de la Francesa. Posiciones ricas en planes y complicaciones tácticas.' },
    'india-rey': { name: 'India de Rey', moves: 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6', san: '1.d4 Cf6 2.c4 g6 3.Cc3 Ag7 4.e4 d6', desc: 'Las negras permiten un centro fuerte blanco para luego atacarlo con ...e5. El alfil en g7 es una pieza clave para el contraataque.' },
    'nimzo-india': { name: 'Nimzo-India', moves: 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4', san: '1.d4 Cf6 2.c4 e6 3.Cc3 Ab4', desc: 'Clava el caballo c3 que controla e4. Dobla los peones blancos y obtiene control posicional a cambio de la pareja de alfiles.' },
    'india-dama': { name: 'India de Dama', moves: 'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6', san: '1.d4 Cf6 2.c4 e6 3.Cf3 b6', desc: 'Fianchetto del alfil de dama para controlar la diagonal e4-a8. Juego flexible con presión sobre el centro blanco.' },
    'benoni': { name: 'Benoni Moderna', moves: 'd2d4 g8f6 c2c4 c7c5 d4d5', san: '1.d4 Cf6 2.c4 c5 3.d5', desc: 'Crea asimetría con peones enfrentados. Las negras buscan contrajuego en el flanco de dama con ...b5 y presión en la columna c.' },
    'budapest': { name: 'Gambito Budapest', moves: 'd2d4 g8f6 c2c4 e7e5', san: '1.d4 Cf6 2.c4 e5', desc: 'Gambito sorpresa que sacrifica un peón por desarrollo activo. El caballo va a g4 o e4 creando amenazas inmediatas.' },
    'holandesa': { name: 'Defensa Holandesa', moves: 'd2d4 f7f5', san: '1.d4 f5', desc: 'Control agresivo de la casilla e4. Las negras buscan ataque en el flanco de rey, con planes de ...Cf6, ...e6 y ...g5.' },
    'londres': { name: 'Sistema Londres', moves: 'd2d4 d7d5 c1f4 g8f6 e2e3', san: '1.d4 d5 2.Af4 Cf6 3.e3', desc: 'Sistema universal y sólido. Las blancas construyen una estructura con Af4, e3, Cf3, Ad3 y c3 contra cualquier defensa.' },
    'colle': { name: 'Sistema Colle', moves: 'd2d4 d7d5 g1f3 g8f6 e2e3', san: '1.d4 d5 2.Cf3 Cf6 3.e3', desc: 'Sistema tranquilo que busca la ruptura e3-e4 preparada con Ad3 y Cbd2. Ideal para jugadores posicionales.' },
    'inglesa': { name: 'Apertura Inglesa', moves: 'c2c4 e7e5 b1c3', san: '1.c4 e5 2.Cc3', desc: 'Siciliana invertida con un tiempo extra. Control del centro desde los flancos con planes de g3, Ag2 y presión en columna c.' },
    'reti': { name: 'Apertura Réti', moves: 'g1f3 d7d5 c2c4', san: '1.Cf3 d5 2.c4', desc: 'Hipermoderna: ataca el centro desde el flanco. Flexible, puede transponerse a Inglesa, Catalana o Gambito de Dama.' },
    'catalana': { name: 'Apertura Catalana', moves: 'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5', san: '1.d4 Cf6 2.c4 e6 3.g3 d5', desc: 'Fianchetto del alfil de rey que presiona la gran diagonal a8-h1. Combina solidez posicional con presión persistente.' },
    'larsen': { name: 'Apertura Larsen', moves: 'b2b3', san: '1.b3', desc: 'Fianchetto temprano del alfil de dama. Apertura flexible y poco teórica que busca control a distancia del centro.' },

    // --- Variantes profundas ---
    'italiana-pianissimo': { name: 'Giuoco Pianissimo (Tabiya)', moves: 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 d2d3 g8f6 c2c3 d7d6 e1g1 e8g8 f1e1 a7a6', san: '1.e4 e5 2.Cf3 Cc6 3.Ac4 Ac5 4.d3 Cf6 5.c3 d6 6.O-O O-O 7.Te1 a6', desc: 'Juego lento y estratégico. Las blancas preparan d4 con c3 mientras mantienen tensión central. Maniobras de piezas y planes a largo plazo.' },
    'gambito-evans-deep': { name: 'Gambito Evans Aceptado', moves: 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5 d2d4', san: '1.e4 e5 2.Cf3 Cc6 3.Ac4 Ac5 4.b4 Axb4 5.c3 Aa5 6.d4', desc: 'Tras el sacrificio de peón, las blancas construyen un centro dominante con c3+d4 y desarrollo rápido con fuerte iniciativa.' },
    'española-cerrada': { name: 'Española Cerrada (Tabiya)', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3', san: '1.e4 e5 2.Cf3 Cc6 3.Ab5 a6 4.Aa4 Cf6 5.O-O Ae7 6.Te1 b5 7.Ab3 d6 8.c3 O-O 9.h3', desc: 'Posición tabiya donde se decide el plan: Breyer (Cb8), Chigorin (Ca5) o Zaitsev (Ab7). Juego estratégico profundo.' },
    'española-breyer': { name: 'Española Breyer', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6b8 d2d4', san: '1.e4 e5 2.Cf3 Cc6 3.Ab5 a6 4.Aa4 Cf6 5.O-O Ae7 6.Te1 b5 7.Ab3 d6 8.c3 O-O 9.h3 Cb8 10.d4', desc: 'Reagrupamiento del caballo vía b8-d7 para reforzar el centro. Idea moderna y flexible que prepara ...Ab7 y ...c5.' },
    'española-chigorin': { name: 'Española Chigorin', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8 h2h3 c6a5 b3c2 c7c5 d2d4', san: '1.e4 e5 2.Cf3 Cc6 3.Ab5 a6 4.Aa4 Cf6 5.O-O Ae7 6.Te1 b5 7.Ab3 d6 8.c3 O-O 9.h3 Ca5 10.Ac2 c5 11.d4', desc: 'Ca5 apunta a ocupar c4 y presionar el flanco de dama. Con ...c5 se genera contrajuego central contra d4.' },
    'española-marshall': { name: 'Gambito Marshall', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 e8g8 c2c3 d7d5 e4d5 f6d5', san: '1.e4 e5 2.Cf3 Cc6 3.Ab5 a6 4.Aa4 Cf6 5.O-O Ae7 6.Te1 b5 7.Ab3 O-O 8.c3 d5 9.exd5 Cxd5', desc: 'Gambito de peón por ataque directo al rey. Las negras obtienen piezas activas, columnas abiertas y fuerte iniciativa.' },
    'española-berlinesa': { name: 'Berlinesa: Muro de Berlín', moves: 'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6 b5c6 d7c6', san: '1.e4 e5 2.Cf3 Cc6 3.Ab5 Cf6 4.O-O Cxe4 5.d4 Cd6 6.Axc6 dxc6', desc: 'Lleva a un final técnico sin damas. Las negras tienen pareja de alfiles y peones doblados pero estructura sólida.' },
    'petrov-deep': { name: 'Petrov Clásica', moves: 'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d7d5 f1d3', san: '1.e4 e5 2.Cf3 Cf6 3.Cxe5 d6 4.Cf3 Cxe4 5.d4 d5 6.Ad3', desc: 'Posición simétrica donde las blancas mantienen ligera ventaja de espacio. Juego técnico con maniobras precisas.' },
    'najdorf-ag5': { name: 'Najdorf 6.Ag5 (Envenenado)', moves: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1g5 e7e6 f2f4 d8b6', san: '1.e4 c5 2.Cf3 d6 3.d4 cxd4 4.Cxd4 Cf6 5.Cc3 a6 6.Ag5 e6 7.f4 Db6', desc: 'Variante del Peón Envenenado: Db6 amenaza b2. Extremadamente compleja y táctica, favorita de Fischer y Kasparov.' },
    'najdorf-ae3': { name: 'Najdorf 6.Ae3', moves: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5 d4b3', san: '1.e4 c5 2.Cf3 d6 3.d4 cxd4 4.Cxd4 Cf6 5.Cc3 a6 6.Ae3 e5 7.Cb3', desc: 'Sistema inglés moderno contra la Najdorf. Las blancas buscan juego posicional con f3, Dd2 y enroque largo.' },
    'dragon-yugoslavo': { name: 'Dragón Yugoslavo', moves: 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7 f2f3 e8g8 d1d2 b8c6 e1c1', san: '1.e4 c5 2.Cf3 d6 3.d4 cxd4 4.Cxd4 Cf6 5.Cc3 g6 6.Ae3 Ag7 7.f3 O-O 8.Dd2 Cc6 9.O-O-O', desc: 'Enroques opuestos con ataques mutuos. Las blancas lanzan peones del flanco de rey (h4-h5) mientras las negras atacan con ...a5-a4.' },
    'sveshnikov-deep': { name: 'Sveshnikov Cdb5', moves: 'e2e4 c7c5 g1f3 b8c6 d2d4 c5d4 f3d4 g8f6 b1c3 e7e5 d4b5 d7d6 c1g5 a7a6 b5a3 b7b5', san: '1.e4 c5 2.Cf3 Cc6 3.d4 cxd4 4.Cxd4 Cf6 5.Cc3 e5 6.Cdb5 d6 7.Ag5 a6 8.Ca3 b5', desc: 'Lucha por la casilla d5. Las negras aceptan debilidades estructurales a cambio de piezas activas y contrajuego dinámico.' },
    'winawer-deep': { name: 'Winawer con Dg4', moves: 'e2e4 e7e6 d2d4 d7d5 b1c3 f8b4 e4e5 c7c5 a2a3 b4c3 b2c3 g8e7 d1g4', san: '1.e4 e6 2.d4 d5 3.Cc3 Ab4 4.e5 c5 5.a3 Axc3+ 6.bxc3 Ce7 7.Dg4', desc: 'Ataque directo al flanco de rey. Las negras deben decidir entre proteger g7 o enrocar largo, llevando a juego desequilibrado.' },
    'francesa-clasica-deep': { name: 'Francesa Clásica McCutcheon', moves: 'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7 g5e7 d8e7', san: '1.e4 e6 2.d4 d5 3.Cc3 Cf6 4.Ag5 Ae7 5.e5 Cd7 6.Axe7 Dxe7', desc: 'Tras los cambios, las negras buscan romper con ...c5 y ...f6. Posición cerrada con juego estratégico en torno a la cadena de peones.' },
    'francesa-avance-deep': { name: 'Francesa Avance con Db6', moves: 'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6 a2a3', san: '1.e4 e6 2.d4 d5 3.e5 c5 4.c3 Cc6 5.Cf3 Db6 6.a3', desc: 'Db6 presiona b2 y d4 simultáneamente. Las blancas refuerzan con a3 y buscan mantener la cadena de peones intacta.' },
    'caro-kann-deep': { name: 'Caro-Kann Clásica con h4', moves: 'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6 g1f3', san: '1.e4 c6 2.d4 d5 3.Cc3 dxe4 4.Cxe4 Af5 5.Cg3 Ag6 6.h4 h6 7.Cf3', desc: 'h4 gana espacio y amenaza h5 atrapando el alfil. Las negras deben jugar ...h6 preventivamente, creando debilidades potenciales.' },
    'caro-kann-avance-deep': { name: 'Caro-Kann Avance con Ae2', moves: 'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2', san: '1.e4 c6 2.d4 d5 3.e5 Af5 4.Cf3 e6 5.Ae2', desc: 'Sistema tranquilo donde las blancas buscan mantener la ventaja de espacio. Las negras preparan ...c5 para romper la cadena.' },
    'gdr-ortodoxa-deep': { name: 'GDR Ortodoxa (Tabiya)', moves: 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7 a1c1 c7c6 f1d3 d5c4 d3c4', san: '1.d4 d5 2.c4 e6 3.Cc3 Cf6 4.Ag5 Ae7 5.e3 O-O 6.Cf3 Cbd7 7.Tc1 c6 8.Ad3 dxc4 9.Axc4', desc: 'Posición tabiya de la Ortodoxa. Las negras liberan su posición con ...dxc4 y buscan igualar con ...e5 o ...c5.' },
    'eslava-checa': { name: 'Eslava Checa con Af5', moves: 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5 e2e3', san: '1.d4 d5 2.c4 c6 3.Cf3 Cf6 4.Cc3 dxc4 5.a4 Af5 6.e3', desc: 'Las negras capturan c4 y desarrollan el alfil a f5 antes de jugar ...e6. a4 impide ...b5 defendiendo el peón extra.' },
    'semi-eslava-meran': { name: 'Semi-Eslava Meran', moves: 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 e7e6 e2e3 b8d7 f1d3 d5c4 d3c4 b7b5', san: '1.d4 d5 2.c4 c6 3.Cf3 Cf6 4.Cc3 e6 5.e3 Cbd7 6.Ad3 dxc4 7.Axc4 b5', desc: 'Contrajuego agresivo con ...b5 ganando espacio en el flanco de dama. Las negras buscan activar el alfil de dama y presionar.' },
    'india-rey-clasica': { name: 'India de Rey Clásica', moves: 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1', san: '1.d4 Cf6 2.c4 g6 3.Cc3 Ag7 4.e4 d6 5.Cf3 O-O 6.Ae2 e5 7.O-O', desc: 'Posición tabiya. Las negras eligen entre Cc6 (Mar del Plata), Ca6 (Moderna), Cd7 (Gligoric) según el plan de ataque deseado.' },
    'india-rey-mar-plata': { name: 'India de Rey Mar del Plata', moves: 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5 e1g1 b8c6 d4d5 c6e7', san: '1.d4 Cf6 2.c4 g6 3.Cc3 Ag7 4.e4 d6 5.Cf3 O-O 6.Ae2 e5 7.O-O Cc6 8.d5 Ce7', desc: 'Variante más combativa de la India de Rey. Ataques en flancos opuestos: blancas con c5 en el flanco de dama, negras con f5 en el de rey.' },
    'india-rey-samisch': { name: 'India de Rey Sämisch', moves: 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 f2f3 e8g8 c1e3 e7e5', san: '1.d4 Cf6 2.c4 g6 3.Cc3 Ag7 4.e4 d6 5.f3 O-O 6.Ae3 e5', desc: 'f3 refuerza e4 y prepara enroque largo con ataque al flanco de rey. Juego agresivo donde ambos bandos atacan sin contemplaciones.' },
    'nimzo-rubinstein': { name: 'Nimzo-India Rubinstein', moves: 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3 c7c5', san: '1.d4 Cf6 2.c4 e6 3.Cc3 Ab4 4.e3 O-O 5.Ad3 d5 6.Cf3 c5', desc: 'Las negras presionan d4 con ...c5 y ...d5. Si bxc3, las blancas tienen pareja de alfiles pero peones doblados.' },
    'nimzo-clasica': { name: 'Nimzo-India Clásica Dc2', moves: 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 d1c2 e8g8 a2a3 b4c3 d1c3', san: '1.d4 Cf6 2.c4 e6 3.Cc3 Ab4 4.Dc2 O-O 5.a3 Axc3+ 6.Dxc3', desc: 'Dc2 evita los peones doblados. Las blancas obtienen pareja de alfiles y centro fuerte, las negras buen desarrollo.' },
    'benoni-deep': { name: 'Benoni Clásica Fianchetto', moves: 'd2d4 g8f6 c2c4 c7c5 d4d5 e7e6 b1c3 e6d5 c4d5 d7d6 g1f3 g7g6', san: '1.d4 Cf6 2.c4 c5 3.d5 e6 4.Cc3 exd5 5.cxd5 d6 6.Cf3 g6', desc: 'Fianchetto del alfil para presionar d5 y e4. Las negras buscan contrajuego con ...b5 y actividad en la columna e.' },
    'londres-deep': { name: 'Londres Línea Principal', moves: 'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3 b8c6 g1f3', san: '1.d4 d5 2.Af4 Cf6 3.e3 c5 4.c3 Cc6 5.Cf3', desc: 'Estructura sólida con Af4+e3+c3+Cf3. Las blancas buscan Ad3, Cbd2 y eventualmente e4 para obtener ventaja de espacio.' },
    'inglesa-4caballos': { name: 'Inglesa Cuatro Caballos', moves: 'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5', san: '1.c4 e5 2.Cc3 Cf6 3.Cf3 Cc6 4.g3 d5 5.cxd5', desc: 'Posición simétrica con tensión central. Las blancas buscan explotar el fianchetto y presión en la columna c.' },
    'catalana-abierta': { name: 'Catalana Abierta', moves: 'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 d5c4 g1f3 a7a6', san: '1.d4 Cf6 2.c4 e6 3.g3 d5 4.Ag2 dxc4 5.Cf3 a6', desc: 'Las negras capturan c4 y defienden con ...a6. El alfil en g2 ejerce presión constante en la diagonal, buscando recuperar el peón.' },
    'catalana-cerrada': { name: 'Catalana Cerrada', moves: 'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1', san: '1.d4 Cf6 2.c4 e6 3.g3 d5 4.Ag2 Ae7 5.Cf3 O-O 6.O-O', desc: 'Las negras mantienen la tensión en el centro sin capturar c4. Juego posicional profundo con maniobras estratégicas sutiles.' },
};

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
    
    // Intentar usar Stockfish API (niveles 12+)
    if (aiDifficulty >= 12) {
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

// Obtener movimiento desde Stockfish 17 API
async function getStockfishAPIMove() {
    console.log('Consultando Stockfish 17 API...');
    
    // Construir FEN de la posición actual
    const fen = game.toFEN();
    
    // Mapear dificultad (12-20) a profundidad de búsqueda
    const depth = Math.min(18, Math.max(10, Math.floor(aiDifficulty * 0.9)));
    
    const response = await fetch('https://chess-api.com/v1', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            fen: fen,
            depth: depth
        })
    });
    
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.move) {
        throw new Error('No se recibió movimiento de la API');
    }
    
    console.log('Stockfish 17 movimiento:', data.move, 'Evaluación:', data.eval);
    return data.move;
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

    if (aiDifficulty <= 3) {
        depth = 1;
        useFullEval = false;
        randomnessFactor = 0.8;
    } else if (aiDifficulty <= 5) {
        depth = 2;
        useFullEval = false;
        randomnessFactor = 0.4;
    } else if (aiDifficulty <= 8) {
        depth = 3;
        useFullEval = true;
        useQuiescence = true;
        randomnessFactor = 0.05;
    } else if (aiDifficulty <= 12) {
        depth = 3;
        useFullEval = true;
        useQuiescence = true;
        randomnessFactor = 0.03;
    } else if (aiDifficulty <= 16) {
        depth = 4;
        useFullEval = true;
        useQuiescence = true;
        randomnessFactor = 0;
    } else {
        depth = 4;
        useFullEval = true;
        useQuiescence = true;
        randomnessFactor = 0;
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
        const va = PIECE_VALUES[game.getPiece(a.toRow, a.toCol)?.type] || 0;
        const vb = PIECE_VALUES[game.getPiece(b.toRow, b.toCol)?.type] || 0;
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
        const scoreA = victimA ? (PIECE_VALUES[victimA.type] || 0) - (PIECE_VALUES[a.piece?.type] || 0) / 100 : 0;
        const scoreB = victimB ? (PIECE_VALUES[victimB.type] || 0) - (PIECE_VALUES[b.piece?.type] || 0) / 100 : 0;
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
function saveSettings() {
    const settings = {
        playerColor: playerColor,
        aiDifficulty: aiDifficulty,
        boardTheme: boardTheme,
        pieceStyle: pieceStyle,
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
            
            playerColor = settings.playerColor ?? 'white';
            aiDifficulty = settings.aiDifficulty ?? 20;
            boardTheme = settings.boardTheme ?? 'classic';
            pieceStyle = settings.pieceStyle ?? 'classic';
            timePerPlayer = settings.timePerPlayer ?? 3;
            incrementPerMove = settings.incrementPerMove ?? 2;
            
            // Actualizar UI
            document.getElementById('player-color').value = playerColor;
            document.getElementById('ai-difficulty').value = aiDifficulty;
            document.getElementById('board-theme').value = boardTheme;
            document.getElementById('piece-style').value = pieceStyle;
            
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

// Mostrar mensaje centrado en el tablero
function showMessage(message, type = 'info', duration = 3000) {
    // Crear overlay si no existe
    let overlay = document.getElementById('message-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'message-overlay';
        overlay.className = 'message-overlay';
        document.body.appendChild(overlay);
        
        // Permitir cerrar haciendo clic en el overlay
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                hideMessage();
            }
        });
    }
    
    // Crear mensaje
    const messageBox = document.createElement('div');
    messageBox.className = `message-box message-${type}`;
    
    const messageText = document.createElement('div');
    messageText.className = 'message-text';
    messageText.innerHTML = message;
    messageBox.appendChild(messageText);
    
    // Añadir botón de cerrar si el mensaje es permanente
    if (duration === 0) {
        const closeBtn = document.createElement('button');
        closeBtn.className = 'message-close-btn';
        closeBtn.textContent = '✕';
        closeBtn.onclick = hideMessage;
        messageBox.appendChild(closeBtn);
    }
    
    // Limpiar mensajes anteriores
    overlay.innerHTML = '';
    overlay.appendChild(messageBox);
    overlay.style.display = 'flex';
    
    // Ocultar automáticamente después de la duración (si no es permanente)
    if (duration > 0) {
        setTimeout(() => {
            overlay.style.display = 'none';
        }, duration);
    }
}

// Ocultar mensaje
function hideMessage() {
    const overlay = document.getElementById('message-overlay');
    if (overlay) {
        overlay.style.display = 'none';
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
    showConfirmDialog('¿Seguro que quieres abandonar la partida?', () => {
        game.gameOver = true;
        stopClock();
        recordGameResult('loss');
        clearAutoSavedGame();
        showMessage('Has abandonado la partida', 'error', 3000);
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

    // Cargar configuraciones guardadas
    loadSavedSettings();
    
    // Cargar estadísticas
    loadStats();

    // Event listeners
    document.getElementById('new-game').addEventListener('click', confirmNewGame);
    document.getElementById('player-color').addEventListener('change', (e) => {
        playerColor = e.target.value;
        saveSettings();
    });
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
        saveSettings();
        renderBoard();
    });
    document.getElementById('time-control').addEventListener('change', (e) => {
        const [minutes, increment] = e.target.value.split('+').map(Number);
        timePerPlayer = minutes;
        incrementPerMove = increment;
        saveSettings();
    });

    // Botones de acciones
    document.getElementById('resign-game').addEventListener('click', resignGame);
    document.getElementById('offer-draw').addEventListener('click', offerDraw);
    document.getElementById('resume-game').addEventListener('click', function() {
        if (this.onclick) return;
        resumeGame();
    });
    document.getElementById('undo-move').addEventListener('click', undoMove);
    document.getElementById('hint-move').addEventListener('click', getHint);
    document.getElementById('export-pgn').addEventListener('click', exportPGN);
    document.getElementById('import-pgn').addEventListener('click', importPGN);

    // Estadísticas
    document.getElementById('reset-stats').addEventListener('click', resetStats);

    // Entrenador de aperturas
    document.getElementById('opening-select').addEventListener('change', onOpeningSelect);
    document.getElementById('start-opening-training').addEventListener('click', startOpeningTraining);
    document.getElementById('start-opening-quiz').addEventListener('click', startOpeningQuiz);

    document.getElementById('famous-game-select').addEventListener('change', onFamousGameSelect);
    document.getElementById('load-famous-game').addEventListener('click', loadFamousGame);
    onFamousGameSelect();

    // Navegación del historial
    document.getElementById('nav-first').addEventListener('click', goToFirstMove);
    document.getElementById('nav-prev').addEventListener('click', goToPreviousMove);
    document.getElementById('nav-next').addEventListener('click', goToNextMove);
    document.getElementById('nav-last').addEventListener('click', goToLastMove);

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
    window.addEventListener('resize', initCustomDropdowns);

    document.addEventListener('click', (e) => {
        if (e.target.closest('#new-game, #start-opening-training, #start-opening-quiz, #resume-game, #undo-move, #hint-move')) {
            if (window.matchMedia('(max-width: 768px)').matches) {
                setTimeout(() => {
                    document.querySelector('.board-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 150);
            }
        }
    });
});

function initCustomDropdowns() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    document.querySelectorAll('.select').forEach(select => {
        if (!select.closest('.custom-select-wrap')) {
            const wrap = document.createElement('div');
            wrap.className = 'custom-select-wrap';
            select.parentNode.insertBefore(wrap, select);
            wrap.appendChild(select);

            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'custom-select-trigger';
            trigger.textContent = select.options[select.selectedIndex]?.text || '';
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
                trigger.textContent = select.options[select.selectedIndex]?.text || '';
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
        const trigger = wrap?.querySelector('.custom-select-trigger');
        const list = wrap?.querySelector('.custom-select-list');
        if (wrap && trigger && list) {
            if (isMobile) {
                trigger.style.display = 'block';
                trigger.textContent = select.options[select.selectedIndex]?.text || '';
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
    if (game && !game.gameOver && game.moveHistory && game.moveHistory.length > 0) {
        showConfirmDialog('¿Iniciar una nueva partida? Se perderá la partida actual.', () => {
            startNewGame();
        });
    } else {
        startNewGame();
    }
}

function startNewGame() {
    quizMode = false;
    setFamousGameTitle('');
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
    document.getElementById('resume-game').disabled = true;
    
    if (playerColor === 'black') {
        setTimeout(() => makeAIMove(), 800);
    }
}

function onOpeningSelect() {
    const select = document.getElementById('opening-select');
    const info = document.getElementById('opening-training-info');
    const btn = document.getElementById('start-opening-training');
    const key = select.value;

    const quizBtn = document.getElementById('start-opening-quiz');
    const quizScore = document.getElementById('quiz-score');

    if (!key) {
        info.style.display = 'none';
        btn.style.display = 'none';
        quizBtn.style.display = 'none';
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
    info.style.display = 'block';
    btn.style.display = 'block';
    quizBtn.style.display = 'block';
    quizScore.style.display = 'none';
}

function onFamousGameSelect() {
    const select = document.getElementById('famous-game-select');
    const btn = document.getElementById('load-famous-game');
    btn.disabled = !select.value;
}

function loadFamousGame() {
    const select = document.getElementById('famous-game-select');
    const key = select.value;
    if (!key) return;

    const famous = FAMOUS_GAMES[key];
    if (!famous || !famous.pgn) return;

    parsePGNAndLoad(famous.pgn, famous.name);
    showMessage(`Partida cargada: ${famous.name}`, 'success', 3000);

    if (window.matchMedia('(max-width: 600px)').matches) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function showLoadedGameMessage(title, isFinished) {
    const turnLabel = game.currentTurn === 'white' ? 'Blancas' : 'Negras';
    let msg = `<strong>${title}</strong>`;

    if (isFinished) {
        if (game.isCheckmate()) {
            const winner = game.currentTurn === 'white' ? 'Negras' : 'Blancas';
            msg += `<br>¡Jaque Mate! Ganan las ${winner}`;
        } else {
            msg += `<br>Tablas por ahogado`;
        }
    } else {
        msg += `<br>Turno: ${turnLabel}`;
        msg += `<br>Pulsa Continuar Partida`;
    }
    msg += `<br>Pulsa ◀ ▶ para navegar por los movimientos`;

    showMessage(msg, isFinished && game.isCheckmate() ? 'success' : 'info', 0);
}

function showContinueButton() {
    const resumeBtn = document.getElementById('resume-game');
    resumeBtn.disabled = false;
    resumeBtn.onclick = function() {
        resumeBtn.disabled = true;
        resumeBtn.onclick = null;

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
            showLoadedGameMessage('Partida finalizada', true);
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
}

function startOpeningTraining() {
    if (!trainingOpening) return;

    quizMode = false;
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
        if (index >= uciMoves.length || game.gameOver) {
            onTrainingFinished();
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

            setTimeout(() => playNextMove(index + 1), 1200);
        }
    }

    function onTrainingFinished() {
        showLoadedGameMessage('Apertura completada', false);
        showContinueButton();
    }

    setTimeout(() => playNextMove(0), 600);
}

function startOpeningQuiz() {
    if (!trainingOpening) return;

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

    // Deshacer 2 movimientos (el del jugador y el de la IA)
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
    const undoButton = document.getElementById('undo-move');
    undoButton.disabled = !game.canUndo();
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
            showMessage(`💡 Sugerencia: Mueve de ${fromSquare} a ${toSquare}`, 'info', 5000);
            
            // Convertir notación UCI a coordenadas internas
            const move = parseUCIMove(bestMove);
            if (move) {
                highlightValidMoves(move.fromRow, move.fromCol);
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

        // Detectar si la posición es final
        game.gameOver = false;
        const isFinished = game.isCheckmate() || game.isStalemate();
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
        showLoadedGameMessage(`Partida cargada: ${numMoves} movimientos`, isFinished);
        if (!isFinished) showContinueButton();
    }
}

function exportPGN() {
    if (game.moveHistory.length === 0) {
        showMessage('No hay movimientos para exportar', 'warning', 2000);
        return;
    }

    const pgn = buildPGNContent();

    if (window.matchMedia('(max-width: 768px)').matches) {
        const defaultName = `partida_${new Date().toISOString().slice(0,10)}_${String(new Date().getHours()).padStart(2,'0')}${String(new Date().getMinutes()).padStart(2,'0')}.pgn`;
        showExportPGNDialog(defaultName, pgn);
    } else {
        doExportPGN(pgn, `partida_${new Date().getTime()}.pgn`);
        showMessage('Archivo PGN exportado correctamente', 'success', 2000);
    }
}

function buildPGNContent() {
    let pgn = '[Event "Partida vs Claude"]\n';
    pgn += `[Date "${new Date().toISOString().split('T')[0]}"]\n`;
    pgn += '[White "Jugador"]\n';
    pgn += '[Black "Claude AI"]\n';
    pgn += '\n';
    for (let i = 0; i < game.moveHistory.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        pgn += `${moveNum}. ${game.moveHistory[i]}`;
        if (i + 1 < game.moveHistory.length) {
            pgn += ` ${game.moveHistory[i + 1]}`;
        }
        pgn += ' ';
    }
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
            showMessage('Archivo PGN exportado correctamente', 'success', 2000);
        } catch (err) {
            if (err.name !== 'AbortError') {
                doExportPGN(pgn, filename);
                showMessage('Archivo PGN exportado correctamente', 'success', 2000);
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

function parsePGNAndLoad(pgnText, gameTitle) {
    try {
        setFamousGameTitle(gameTitle || '');
        // Extraer movimientos: quitar headers [...]  y comentarios {...}
        let movesText = pgnText
            .replace(/\[.*?\]\s*/g, '')
            .replace(/\{.*?\}/g, '')
            .replace(/\(.*?\)/g, '')
            .replace(/\d+\.\.\./g, '')
            .replace(/;.*$/gm, '')
            .trim();

        // Quitar resultado final
        movesText = movesText.replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/, '').trim();

        // Separar movimientos individuales: "1. e4 e5 2. Nf3 Nc6" → ["e4", "e5", "Nf3", "Nc6"]
        const moves = movesText
            .split(/\s+/)
            .filter(token => token && !token.match(/^\d+\.?$/))
            .map(m => m.replace(/^\d+\./, ''));

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

        for (const sanMove of moves) {
            const parsed = parseSANMove(sanMove, game);
            if (!parsed) {
                console.warn('No se pudo parsear movimiento:', sanMove, 'después de', movesPlayed, 'movimientos');
                break;
            }

            const result = game.makeMove(parsed.fromRow, parsed.fromCol, parsed.toRow, parsed.toCol, parsed.promotion);
            if (!result) {
                console.warn('Movimiento inválido:', sanMove);
                break;
            }
            movesPlayed++;
        }

        game.gameStateHistory.push({
            board: JSON.parse(JSON.stringify(game.board)),
            currentTurn: game.currentTurn,
            capturedPieces: JSON.parse(JSON.stringify(game.capturedPieces)),
            enPassantTarget: game.enPassantTarget ? { ...game.enPassantTarget } : null,
            castlingRights: JSON.parse(JSON.stringify(game.castlingRights)),
            gameOver: false
        });

        selectedSquare = null;
        lastMoveSquares = { from: null, to: null };
        const openingLog = document.getElementById('opening-log');
        if (openingLog) openingLog.remove();

        const isFinished = game.isCheckmate() || game.isStalemate();
        game.gameOver = isFinished;

        renderBoard();
        updateCapturedPieces();
        updateMoveHistory();
        updateUndoButton();
        updateNavigationButtons();
        updateEvalBar();
        recalcOpening();
        autoSaveGame();

        showLoadedGameMessage(`PGN importado: ${movesPlayed} movimientos`, isFinished);
        if (!isFinished) showContinueButton();

    } catch (error) {
        console.error('Error al importar PGN:', error);
        showMessage('Error al importar el archivo PGN', 'error', 3000);
    }
}

function parseSANMove(san, gameState) {
    const color = gameState.currentTurn;
    san = san.replace(/[+#!?]/g, '');

    // Enroque
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

    // Detectar promoción: e8=Q o e8Q
    const promoMatch = s.match(/=?([QRBN])$/);
    if (promoMatch) {
        promotion = promoMatch[1];
        s = s.replace(/=?[QRBN]$/, '');
    }

    // Detectar tipo de pieza
    if (s[0] && pieceMap[s[0]]) {
        pieceType = pieceMap[s[0]];
        s = s.substring(1);
    }

    // Quitar 'x' (captura)
    s = s.replace('x', '');

    // Las últimas 2 letras son la casilla destino
    if (s.length < 2) return null;
    toFile = files.indexOf(s[s.length - 2]);
    toRank = 8 - parseInt(s[s.length - 1]);
    if (toFile < 0 || toRank < 0 || toRank > 7) return null;

    // Desambiguación (lo que queda antes del destino)
    const disambig = s.substring(0, s.length - 2);
    for (const ch of disambig) {
        if (files.includes(ch)) disambigFile = files.indexOf(ch);
        else if (ch >= '1' && ch <= '8') disambigRank = 8 - parseInt(ch);
    }

    // Buscar la pieza que puede hacer este movimiento
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameState.getPiece(row, col);
            if (!piece || piece.color !== color || piece.type !== pieceType) continue;

            if (disambigFile >= 0 && col !== disambigFile) continue;
            if (disambigRank >= 0 && row !== disambigRank) continue;

            const validMoves = gameState.getValidMoves(row, col);
            if (validMoves.some(m => m.row === toRank && m.col === toFile)) {
                const promoMap = { 'Q': 'queen', 'R': 'rook', 'B': 'bishop', 'N': 'knight' };
                return {
                    fromRow: row,
                    fromCol: col,
                    toRow: toRank,
                    toCol: toFile,
                    promotion: promotion ? promoMap[promotion] : undefined
                };
            }
        }
    }

    return null;
}

// Funciones para reanudar partida
function checkForGameInProgress() {
    const autoSavedGame = localStorage.getItem('auto_saved_game');
    const resumeButton = document.getElementById('resume-game');
    resumeButton.disabled = !autoSavedGame;
}

function resumeGame(silent) {
    const autoSavedGame = localStorage.getItem('auto_saved_game');
    
    if (!autoSavedGame) {
        if (!silent) showMessage('No hay partida en curso para continuar', 'warning', 2000);
        return;
    }
    
    try {
        const savedState = JSON.parse(autoSavedGame);
        
        // Restaurar todas las configuraciones
        playerColor = savedState.playerColor ?? 'white';
        aiDifficulty = savedState.aiDifficulty ?? 20;
        boardTheme = savedState.boardTheme ?? 'classic';
        pieceStyle = savedState.pieceStyle ?? 'classic';
        timePerPlayer = savedState.timePerPlayer ?? 3;
        incrementPerMove = savedState.incrementPerMove ?? 2;
        whiteTime = savedState.whiteTime ?? timePerPlayer * 60;
        blackTime = savedState.blackTime ?? timePerPlayer * 60;
        lastMoveSquares = savedState.lastMoveSquares ?? { from: null, to: null };
        currentMoveIndex = savedState.currentMoveIndex ?? -1;
        
        // Actualizar UI con las configuraciones
        document.getElementById('player-color').value = playerColor;
        document.getElementById('ai-difficulty').value = aiDifficulty;
        document.getElementById('board-theme').value = boardTheme;
        document.getElementById('piece-style').value = pieceStyle;
        
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
    
    whiteElement.textContent = formatTime(whiteTime);
    blackElement.textContent = formatTime(blackTime);

    // Actualizar estilos activos
    const whiteClock = whiteElement.parentElement;
    const blackClock = blackElement.parentElement;
    
    whiteClock.classList.toggle('active', game.currentTurn === 'white');
    blackClock.classList.toggle('active', game.currentTurn === 'black');

    // Advertencias de tiempo
    whiteClock.classList.toggle('warning', whiteTime <= 60 && whiteTime > 30);
    whiteClock.classList.toggle('danger', whiteTime <= 30);
    blackClock.classList.toggle('warning', blackTime <= 60 && blackTime > 30);
    blackClock.classList.toggle('danger', blackTime <= 30);
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
            const displayRow = isFlipped ? row : row;
            const displayCol = isFlipped ? 7 - col : col;
            
            const square = document.createElement('div');
            square.className = 'square';
            square.dataset.row = displayRow;
            square.dataset.col = displayCol;
            
            // Color del cuadrado
            const isLight = (displayRow + displayCol) % 2 === 0;
            square.classList.add(isLight ? 'light' : 'dark');
            
            // Resaltar último movimiento
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
            
            // Agregar coordenadas en la esquina superior derecha
            const coordinate = document.createElement('span');
            coordinate.className = 'square-coordinate';
            coordinate.textContent = files[displayCol] + (8 - displayRow);
            square.appendChild(coordinate);
            
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

function handleSquareClick(row, col) {
    if (game.gameOver) return;

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

function executeMove(fromRow, fromCol, toRow, toCol, promotionPiece) {
    const result = game.makeMove(fromRow, fromCol, toRow, toCol, promotionPiece);
    lastMoveSquares = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
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
                const { fromRow, fromCol, toRow, toCol, isQuiz } = pendingPromotionMove;
                if (isQuiz) {
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
    
    currentMoveIndex = 0;
    restoreGameState(0);
    updateMoveHistory();
}

function goToPreviousMove() {
    const states = game ? (game.gameStateHistory || []) : [];
    if (states.length < 2) return;
    
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
    
    renderBoard();
    updateCapturedPieces();
    updateNavigationButtons();
    updateEvalBar();
}

function handleGameResult(result) {
    if (result.status === 'checkmate') {
        const winner = result.winner === 'white' ? 'Blancas' : 'Negras';
        stopClock();
        clearAutoSavedGame();
        
        // Registrar estadística
        if (result.winner === playerColor) {
            recordGameResult('win');
        } else {
            recordGameResult('loss');
        }
        
        setTimeout(() => {
            showMessage(`¡Jaque mate! ${winner} ganan.`, 'success', 0);
        }, 300);
    } else if (result.status === 'stalemate') {
        stopClock();
        clearAutoSavedGame();
        
        // Registrar tablas
        recordGameResult('draw');
        
        setTimeout(() => {
            showMessage('¡Tablas por ahogado!', 'info', 0);
        }, 300);
    } else if (result.status === 'check') {
        console.log('¡Jaque!');
    }
}

async function makeAIMove() {
    showThinkingIndicator(true);
    
    try {
        const bestMove = await getAIMove();
        
        if (bestMove) {
            const move = parseUCIMove(bestMove);
        
            if (move) {
                // Guardar último movimiento para resaltar
                lastMoveSquares = {
                    from: { row: move.fromRow, col: move.fromCol },
                    to: { row: move.toRow, col: move.toCol }
                };
                
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
    if (!game || game.gameOver) return;

    const rawScore = evaluatePosition('white');
    // Convert centipawns to pawns, clamp to ±10
    const evalPawns = Math.max(-10, Math.min(10, rawScore / 100));
    // Map ±10 to 0%-100% (50% = equal, 100% = white winning)
    const pct = Math.max(2, Math.min(98, 50 + evalPawns * 5));

    const fill = document.getElementById('eval-bar-fill');
    const label = document.getElementById('eval-bar-label');
    if (!fill || !label) return;

    fill.style.height = pct + '%';

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

