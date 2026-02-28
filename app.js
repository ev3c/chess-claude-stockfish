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

// Función para obtener el mejor movimiento (Stockfish 17 API + fallback local)
async function getStockfishBestMove() {
    console.log('Motor de ajedrez - Nivel:', aiDifficulty);
    
    // Intentar usar Stockfish API (niveles 15-20)
    if (aiDifficulty >= 15) {
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
    
    // Mapear dificultad (15-20) a profundidad de búsqueda (10-18)
    const depth = Math.min(18, 8 + aiDifficulty);
    
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
    
    if (aiDifficulty <= 3) {
        // Muy fácil: movimientos casi aleatorios
        depth = 1;
        useFullEval = false;
        randomnessFactor = 0.8;
    } else if (aiDifficulty <= 5) {
        // Fácil: evaluación básica
        depth = 1;
        useFullEval = false;
        randomnessFactor = 0.5;
    } else if (aiDifficulty <= 8) {
        // Principiante: evaluación completa, poca profundidad
        depth = 1;
        useFullEval = true;
        randomnessFactor = 0.3;
    } else if (aiDifficulty <= 12) {
        // Intermedio: búsqueda a profundidad 2
        depth = 2;
        useFullEval = true;
        randomnessFactor = 0.15;
    } else if (aiDifficulty <= 16) {
        // Avanzado: búsqueda a profundidad 2 (optimizado)
        depth = 2;
        useFullEval = true;
        randomnessFactor = 0.05;
    } else {
        // Experto/Maestro: búsqueda a profundidad 3 (optimizado)
        depth = 3;
        useFullEval = true;
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
    const maxMovesToEvaluate = depth > 2 ? 20 : (depth > 1 ? 30 : allMoves.length);
    const movesToEvaluate = allMoves.slice(0, Math.min(allMoves.length, maxMovesToEvaluate));
    
    for (const move of movesToEvaluate) {
        let score;
        
        if (useFullEval && depth > 1) {
            // Minimax con profundidad
            score = evaluateMoveWithMinimax(move, depth, game.currentTurn);
        } else {
            // Evaluación simple
            score = evaluateMoveSimple(move, useFullEval);
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

// Evaluación simple de un movimiento
function evaluateMoveSimple(move, useFullEval) {
    let score = 0;
    
    // Captura de pieza
    const capturedPiece = game.getPiece(move.toRow, move.toCol);
    if (capturedPiece) {
        score += PIECE_VALUES[capturedPiece.type] || 0;
    }
    
    if (useFullEval) {
        // Bonificar control del centro
        const centerSquares = [[3,3], [3,4], [4,3], [4,4]];
        if (centerSquares.some(([r,c]) => r === move.toRow && c === move.toCol)) {
            score += 30;
        }
        
        // Bonificar desarrollo (mover piezas desde posición inicial)
        const isBackRank = (move.fromRow === 0 || move.fromRow === 7);
        if (isBackRank && move.piece.type !== 'pawn') {
            score += 10;
        }
    }
    
    return score;
}

// Minimax con evaluación de posición (optimizado)
function evaluateMoveWithMinimax(move, depth, maximizingColor) {
    // Guardar estado actual completo (sin usar makeMove para evitar guardar en historial)
    const savedBoard = game.board.map(row => [...row]);
    const savedTurn = game.currentTurn;
    const savedCaptured = {
        white: [...game.capturedPieces.white],
        black: [...game.capturedPieces.black]
    };
    const savedEnPassant = game.enPassantTarget ? { ...game.enPassantTarget } : null;
    const savedCastling = JSON.parse(JSON.stringify(game.castlingRights));
    
    // Simular el movimiento directamente SIN guardar en historial
    simulateMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
    
    // Evaluar la posición resultante
    let score;
    if (depth <= 1) {
        score = evaluatePosition(maximizingColor);
    } else {
        // Continuar búsqueda
        score = minimax(depth - 1, -Infinity, Infinity, false, maximizingColor);
    }
    
    // Restaurar estado completo
    game.board = savedBoard;
    game.currentTurn = savedTurn;
    game.capturedPieces = savedCaptured;
    game.enPassantTarget = savedEnPassant;
    game.castlingRights = savedCastling;
    
    return score;
}

// Simular movimiento sin guardar en historial (solo para IA)
function simulateMove(fromRow, fromCol, toRow, toCol) {
    const piece = game.board[fromRow][fromCol];
    const capturedPiece = game.board[toRow][toCol];
    
    // Capturar pieza si existe
    if (capturedPiece) {
        game.capturedPieces[game.currentTurn].push(capturedPiece.piece);
    }
    
    // Mover la pieza
    game.board[toRow][toCol] = piece;
    game.board[fromRow][fromCol] = null;
    
    // Cambiar turno
    game.currentTurn = game.currentTurn === 'white' ? 'black' : 'white';
}

// Algoritmo Minimax con poda alpha-beta (optimizado)
function minimax(depth, alpha, beta, isMaximizing, maximizingColor) {
    if (depth === 0) {
        return evaluatePosition(maximizingColor);
    }
    
    const currentColor = game.currentTurn;
    const moves = getAllPossibleMoves(currentColor);
    
    if (moves.length === 0) {
        // Jaque mate o ahogado
        if (game.gameOver) {
            return isMaximizing ? -100000 : 100000;
        }
        return 0;
    }
    
    // Ordenar movimientos: primero capturas (mejora poda alpha-beta)
    moves.sort((a, b) => {
        const captureA = game.getPiece(a.toRow, a.toCol) ? 1 : 0;
        const captureB = game.getPiece(b.toRow, b.toCol) ? 1 : 0;
        return captureB - captureA;
    });
    
    // Limitar número de movimientos evaluados en niveles intermedios
    const movesToEvaluate = depth > 1 ? moves.slice(0, Math.min(moves.length, 25)) : moves;
    
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
            const score = minimax(depth - 1, alpha, beta, false, maximizingColor);
            
            game.board = savedBoard;
            game.currentTurn = savedTurn;
            game.capturedPieces = savedCaptured;
            game.enPassantTarget = savedEnPassant;
            game.castlingRights = savedCastling;
            
            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break; // Poda alpha-beta
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
            
            // Simular sin guardar en historial
            simulateMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
            const score = minimax(depth - 1, alpha, beta, true, maximizingColor);
            
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
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = game.getPiece(row, col);
            if (!piece) continue;
            
            const pieceValue = PIECE_VALUES[piece.type] || 0;
            const positionBonus = getPositionBonus(piece.type, row, col, piece.color);
            
            const totalValue = pieceValue + positionBonus;
            
            if (piece.color === forColor) {
                score += totalValue;
            } else {
                score -= totalValue;
            }
        }
    }
    
    return score;
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
            table = KING_MIDDLE_TABLE;
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
    messageText.textContent = message;
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
    if (confirm('¿Estás seguro de que quieres reiniciar las estadísticas?')) {
        stats = { wins: 0, draws: 0, losses: 0 };
        saveStats();
        showMessage('Estadísticas reiniciadas', 'success', 2000);
    }
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
    document.getElementById('new-game').addEventListener('click', startNewGame);
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
    document.getElementById('resume-game').addEventListener('click', resumeGame);
    document.getElementById('undo-move').addEventListener('click', undoMove);
    document.getElementById('hint-move').addEventListener('click', getHint);
    document.getElementById('save-game').addEventListener('click', saveGame);
    document.getElementById('load-game').addEventListener('click', loadGame);
    document.getElementById('export-pgn').addEventListener('click', exportPGN);
    
    // Estadísticas
    document.getElementById('reset-stats').addEventListener('click', resetStats);

    // Navegación del historial
    document.getElementById('nav-first').addEventListener('click', goToFirstMove);
    document.getElementById('nav-prev').addEventListener('click', goToPreviousMove);
    document.getElementById('nav-next').addEventListener('click', goToNextMove);
    document.getElementById('nav-last').addEventListener('click', goToLastMove);

    // Verificar si hay una partida en curso para reanudar
    checkForGameInProgress();
    
    // Iniciar primera partida
    applyBoardTheme();
    startNewGame();
});

// Función para obtener movimientos de la IA
async function getAIMove() {
    return await getStockfishBestMove();
}

function startNewGame() {
    // Limpiar el guardado automático al iniciar nueva partida
    clearAutoSavedGame();
    
    game = new ChessGame();
    selectedSquare = null;
    lastMoveSquares = { from: null, to: null };
    currentMoveIndex = -1;
    
    // Resetear reloj
    stopClock();
    whiteTime = timePerPlayer * 60;
    blackTime = timePerPlayer * 60;
    updateClockDisplay();
    
    renderBoard();
    updateCapturedPieces();
    updateMoveHistory();
    updateUndoButton();
    
    // Si el jugador es negras, la IA mueve primero
    if (playerColor === 'black') {
        setTimeout(() => makeAIMove(), 800);
    }

    // Iniciar reloj
    if (!game.gameOver) {
        startClock();
    }
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

function moveToUCI(fromRow, fromCol, toRow, toCol) {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const fromSquare = files[fromCol] + (8 - fromRow);
    const toSquare = files[toCol] + (8 - toRow);
    return fromSquare + toSquare;
}

function saveGame() {
    const gameState = {
        board: game.getBoardState(),
        currentTurn: game.currentTurn,
        moveHistory: game.moveHistory,
        capturedPieces: game.capturedPieces,
        playerColor: playerColor,
        timestamp: new Date().toISOString()
    };

    const savedGames = JSON.parse(localStorage.getItem('saved_games') || '[]');
    const gameName = prompt('Nombre para esta partida:', `Partida ${savedGames.length + 1}`);
    
    if (gameName) {
        gameState.name = gameName;
        savedGames.push(gameState);
        localStorage.setItem('saved_games', JSON.stringify(savedGames));
        showMessage('Partida guardada correctamente', 'success', 2000);
    }
}

function loadGame() {
    const savedGames = JSON.parse(localStorage.getItem('saved_games') || '[]');
    
    if (savedGames.length === 0) {
        showMessage('No hay partidas guardadas', 'warning', 2000);
        return;
    }

    let message = 'Selecciona una partida para cargar:\n\n';
    savedGames.forEach((game, index) => {
        const date = new Date(game.timestamp).toLocaleString();
        message += `${index + 1}. ${game.name} (${date})\n`;
    });

    const selection = prompt(message + '\nIngresa el número:');
    const index = parseInt(selection) - 1;

    if (index >= 0 && index < savedGames.length) {
        const savedGame = savedGames[index];
        
        game = new ChessGame();
        game.board = savedGame.board;
        game.currentTurn = savedGame.currentTurn;
        game.moveHistory = savedGame.moveHistory;
        game.capturedPieces = savedGame.capturedPieces;
        playerColor = savedGame.playerColor;
    
        renderBoard();
        updateCapturedPieces();
        updateMoveHistory();
    
        showMessage('Partida cargada correctamente', 'success', 2000);
    }
}

function exportPGN() {
    if (game.moveHistory.length === 0) {
        showMessage('No hay movimientos para exportar', 'warning', 2000);
        return;
    }

    let pgn = '[Event "Partida vs Claude"]\n';
    pgn += `[Date "${new Date().toISOString().split('T')[0]}"]\n`;
    pgn += '[White "Jugador"]\n';
    pgn += '[Black "Claude AI"]\n';
    pgn += '\n';

    // Convertir historial a formato PGN
    for (let i = 0; i < game.moveHistory.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        pgn += `${moveNum}. ${game.moveHistory[i]}`;
        if (i + 1 < game.moveHistory.length) {
            pgn += ` ${game.moveHistory[i + 1]}`;
        }
        pgn += ' ';
    }

    // Crear y descargar archivo
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partida_${new Date().getTime()}.pgn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showMessage('Archivo PGN exportado correctamente', 'success', 2000);
}

// Funciones para reanudar partida
function checkForGameInProgress() {
    const autoSavedGame = localStorage.getItem('auto_saved_game');
    const resumeButton = document.getElementById('resume-game');
    
    if (autoSavedGame) {
        // Hay una partida en curso, mostrar el botón
        resumeButton.style.display = 'block';
    } else {
        resumeButton.style.display = 'none';
    }
}

function resumeGame() {
    const autoSavedGame = localStorage.getItem('auto_saved_game');
    
    if (!autoSavedGame) {
        showMessage('No hay partida en curso para reanudar', 'warning', 2000);
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
        
        // Reiniciar el reloj si el juego no ha terminado
        if (!game.gameOver) {
            startClock();
        }
        
        showMessage('Partida reanudada correctamente', 'success', 2000);
    } catch (error) {
        console.error('Error al reanudar partida:', error);
        showMessage('Error al reanudar la partida', 'error', 3000);
        localStorage.removeItem('auto_saved_game');
        checkForGameInProgress();
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
    
    // Solo permitir mover las piezas del jugador (siempre vs IA)
    if (game.currentTurn !== playerColor) return;
    
    const clickedPiece = game.getPiece(row, col);
    
    // Si hay un cuadrado seleccionado
    if (selectedSquare) {
        const validMoves = game.getValidMoves(selectedSquare.row, selectedSquare.col);
        const targetMove = validMoves.find(m => m.row === row && m.col === col);
        
        if (targetMove) {
            // Realizar el movimiento
            const result = game.makeMove(selectedSquare.row, selectedSquare.col, row, col);
            
            // Guardar último movimiento para resaltar
            lastMoveSquares = {
                from: { row: selectedSquare.row, col: selectedSquare.col },
                to: { row: row, col: col }
            };
            
            selectedSquare = null;
            
            // Agregar incremento al jugador que acaba de mover
            addTimeIncrement();
            
            renderBoard();
            updateCapturedPieces();
            updateMoveHistory();
            updateUndoButton();
            
            // Guardar automáticamente el estado
            autoSaveGame();
            
            handleGameResult(result);
            
            // Turno de la IA (siempre activo)
            if (!game.gameOver && game.currentTurn !== playerColor) {
                setTimeout(() => makeAIMove(), 800);
            }
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
        if (currentMoveIndex === i) {
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
            if (currentMoveIndex === i + 1) {
                blackMoveItem.classList.add('active');
            }
            blackMoveItem.addEventListener('click', () => goToMove(i + 1));
            historyDisplay.appendChild(blackMoveItem);
        }
    }
    
    // Si estamos en la posición actual (última)
    if (currentMoveIndex === -1 || currentMoveIndex === game.moveHistory.length - 1) {
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
    
    const hasHistory = game && game.moveHistory && game.moveHistory.length > 0;
    const atStart = currentMoveIndex === -1 || currentMoveIndex === 0;
    const atEnd = currentMoveIndex === -1 || currentMoveIndex >= game.moveHistory.length - 1;
    
    navFirst.disabled = !hasHistory || atStart;
    navPrev.disabled = !hasHistory || atStart;
    navNext.disabled = !hasHistory || atEnd;
    navLast.disabled = !hasHistory || atEnd;
}

function goToFirstMove() {
    if (!game || !game.gameStateHistory || game.gameStateHistory.length === 0) return;
    
    currentMoveIndex = 0;
    restoreGameState(0);
    updateMoveHistory();
}

function goToPreviousMove() {
    if (!game || !game.gameStateHistory) return;
    
    if (currentMoveIndex === -1) {
        currentMoveIndex = game.moveHistory.length - 1;
    }
    
    if (currentMoveIndex > 0) {
        currentMoveIndex--;
        restoreGameState(currentMoveIndex);
        updateMoveHistory();
    }
}

function goToNextMove() {
    if (!game || !game.gameStateHistory) return;
    
    if (currentMoveIndex === -1) return;
    
    if (currentMoveIndex < game.moveHistory.length - 1) {
        currentMoveIndex++;
        restoreGameState(currentMoveIndex);
        updateMoveHistory();
    } else {
        // Volver a la posición actual
        currentMoveIndex = -1;
        restoreGameState(game.gameStateHistory.length - 1);
        updateMoveHistory();
    }
}

function goToLastMove() {
    if (!game || !game.gameStateHistory) return;
    
    currentMoveIndex = -1;
    restoreGameState(game.gameStateHistory.length - 1);
    updateMoveHistory();
}

function goToMove(moveIndex) {
    if (!game || !game.gameStateHistory) return;
    
    currentMoveIndex = moveIndex;
    restoreGameState(moveIndex);
    updateMoveHistory();
}

function restoreGameState(stateIndex) {
    if (!game || !game.gameStateHistory || stateIndex < 0) return;
    
    // Obtener el estado guardado ANTES del movimiento (stateIndex + 1 porque guardamos antes de mover)
    const targetStateIndex = stateIndex;
    
    if (targetStateIndex >= game.gameStateHistory.length) {
        // Restaurar posición actual (última)
        targetStateIndex = game.gameStateHistory.length - 1;
    }
    
    const state = game.gameStateHistory[targetStateIndex];
    if (!state) return;
    
    // Restaurar el estado del juego
    game.board = JSON.parse(JSON.stringify(state.board));
    game.currentTurn = state.currentTurn;
    game.capturedPieces = JSON.parse(JSON.stringify(state.capturedPieces));
    game.enPassantTarget = state.enPassantTarget ? { ...state.enPassantTarget } : null;
    game.castlingRights = JSON.parse(JSON.stringify(state.castlingRights));
    game.gameOver = state.gameOver;
    
    // Actualizar la visualización
    renderBoard();
    updateCapturedPieces();
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
                
                // Guardar automáticamente el estado
                autoSaveGame();
            
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

