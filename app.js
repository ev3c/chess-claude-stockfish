let game = null;
let playerColor = 'white';
let selectedSquare = null;
let apiKey = '';
let gameMode = 'vs-ai'; // vs-ai, vs-human, puzzle
let aiDifficulty = 'advanced';
let boardTheme = 'classic';
let clockEnabled = true; // Reloj siempre activado
let timePerPlayer = 3; // minutos (base)
let incrementPerMove = 2; // segundos de incremento
let whiteTime = 180; // segundos
let blackTime = 180; // segundos
let clockInterval = null;

// Puzzles predefinidos
const chessPuzzles = [
    {
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        solution: [{ from: 'h5', to: 'f7' }],
        description: 'Mate en 1: Las blancas dan mate'
    },
    {
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        solution: [{ from: 'f3', to: 'f7' }],
        description: 'Mate del Loco: Mate en 1'
    }
];
let currentPuzzleIndex = 0;

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    // Cargar configuraciones guardadas
    const savedApiKey = localStorage.getItem('claude_api_key');
    if (savedApiKey) {
        apiKey = savedApiKey;
        document.getElementById('api-key').value = savedApiKey;
    }

    const savedTheme = localStorage.getItem('board_theme');
    if (savedTheme) {
        boardTheme = savedTheme;
        document.getElementById('board-theme').value = savedTheme;
    }

    // Event listeners
    document.getElementById('save-key').addEventListener('click', saveApiKey);
    document.getElementById('test-key').addEventListener('click', testApiKey);
    document.getElementById('new-game').addEventListener('click', startNewGame);
    document.getElementById('player-color').addEventListener('change', (e) => {
        playerColor = e.target.value;
    });
    document.getElementById('game-mode').addEventListener('change', (e) => {
        gameMode = e.target.value;
        updateUIForGameMode();
    });
    document.getElementById('ai-difficulty').addEventListener('change', (e) => {
        aiDifficulty = e.target.value;
    });
    document.getElementById('board-theme').addEventListener('change', (e) => {
        boardTheme = e.target.value;
        localStorage.setItem('board_theme', boardTheme);
        applyBoardTheme();
    });
    document.getElementById('time-control').addEventListener('change', (e) => {
        const [minutes, increment] = e.target.value.split('+').map(Number);
        timePerPlayer = minutes;
        incrementPerMove = increment;
    });

    // Botones de acciones
    document.getElementById('undo-move').addEventListener('click', undoMove);
    document.getElementById('hint-move').addEventListener('click', getHint);
    document.getElementById('analyze-game').addEventListener('click', analyzeGame);
    document.getElementById('save-game').addEventListener('click', saveGame);
    document.getElementById('load-game').addEventListener('click', loadGame);
    document.getElementById('export-pgn').addEventListener('click', exportPGN);

    // Iniciar primera partida
    applyBoardTheme();
    startNewGame();
});

function saveApiKey() {
    const input = document.getElementById('api-key');
    apiKey = input.value.trim();
    
    if (apiKey) {
        localStorage.setItem('claude_api_key', apiKey);
        alert('API Key guardada correctamente');
    } else {
        alert('Por favor ingresa una API Key válida');
    }
}

async function testApiKey() {
    const input = document.getElementById('api-key');
    const testKey = input.value.trim();
    
    if (!testKey) {
        alert('Por favor ingresa una API Key primero');
        return;
    }
    
    const button = document.getElementById('test-key');
    button.disabled = true;
    button.textContent = 'Probando...';
    
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': testKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 50,
                messages: [{
                    role: 'user',
                    content: 'Responde solo "OK" si recibes este mensaje.'
                }]
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            alert('✅ Conexión exitosa!\n\nTu API Key funciona correctamente.\nPuedes guardarla y comenzar a jugar.');
            console.log('Respuesta de prueba:', data);
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('Error de prueba:', errorData);
            
            let errorMsg = '❌ Error de conexión\n\n';
            if (response.status === 401) {
                errorMsg += 'API Key inválida o expirada.\nVerifica que la copiaste correctamente de console.anthropic.com';
            } else if (response.status === 429) {
                errorMsg += 'Límite de uso excedido.\nRevisa tu plan en console.anthropic.com';
            } else if (response.status === 403) {
                errorMsg += 'Acceso denegado.\nVerifica que tu API Key tenga los permisos correctos.';
            } else {
                errorMsg += `Código de error: ${response.status}\n${errorData.error?.message || response.statusText}`;
            }
            alert(errorMsg);
        }
    } catch (error) {
        console.error('Error en la prueba:', error);
        alert('❌ Error de red\n\nNo se pudo conectar con la API de Anthropic.\nVerifica tu conexión a internet.\n\nDetalle: ' + error.message);
    } finally {
        button.disabled = false;
        button.textContent = 'Probar Conexión';
    }
}

function startNewGame() {
    game = new ChessGame();
    selectedSquare = null;
    
    // Resetear reloj (siempre activo)
    stopClock();
    whiteTime = timePerPlayer * 60;
    blackTime = timePerPlayer * 60;
    updateClockDisplay();

    // Modo puzzle
    if (gameMode === 'puzzle') {
        loadPuzzle();
    }
    
    renderBoard();
    updateCapturedPieces();
    updateMoveHistory();
    updateUndoButton();
    
    // Si el jugador es negras y es modo IA, Claude mueve primero
    if (gameMode === 'vs-ai' && playerColor === 'black') {
        setTimeout(() => makeClaudeMove(), 500);
    }

    // Iniciar reloj (siempre activo)
    if (!game.gameOver) {
        startClock();
    }
}

function loadPuzzle() {
    if (currentPuzzleIndex >= chessPuzzles.length) {
        alert('¡Felicitaciones! Has completado todos los puzzles.');
        currentPuzzleIndex = 0;
    }
    const puzzle = chessPuzzles[currentPuzzleIndex];
    alert(puzzle.description);
    // Aquí se podría implementar la carga desde FEN
    // Por ahora usamos el tablero estándar
}

function updateUIForGameMode() {
    const aiSettings = document.getElementById('ai-settings');
    if (gameMode === 'vs-ai') {
        aiSettings.style.display = 'block';
    } else {
        aiSettings.style.display = 'none';
    }
}

function applyBoardTheme() {
    const boardElement = document.getElementById('chess-board');
    boardElement.className = 'chess-board board-theme-' + boardTheme;
}

function undoMove() {
    if (!game.canUndo()) {
        alert('No hay movimientos para deshacer');
        return;
    }

    // Deshacer 2 movimientos en modo IA (el del jugador y el de la IA)
    if (gameMode === 'vs-ai') {
        game.undoMove();
        if (game.canUndo()) {
            game.undoMove();
        }
    } else {
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
    if (!apiKey) {
        alert('Por favor configura tu API Key de Anthropic primero');
        return;
    }

    if (game.gameOver) {
        alert('El juego ha terminado');
        return;
    }

    showThinkingIndicator(true);

    try {
        const move = await getClaudeMove(true); // true = modo sugerencia
        if (move) {
            const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            const fromSquare = files[move.fromCol] + (8 - move.fromRow);
            const toSquare = files[move.toCol] + (8 - move.toRow);
            alert(`💡 Sugerencia: Mueve de ${fromSquare} a ${toSquare}`);
            
            // Resaltar el movimiento sugerido
            highlightValidMoves(move.fromRow, move.fromCol);
        }
    } catch (error) {
        alert('Error al obtener sugerencia: ' + error.message);
    } finally {
        showThinkingIndicator(false);
    }
}

async function analyzeGame() {
    if (!apiKey) {
        alert('Por favor configura tu API Key de Anthropic primero');
        return;
    }

    if (game.moveHistory.length === 0) {
        alert('No hay movimientos para analizar');
        return;
    }

    showThinkingIndicator(true);

    try {
        const analysis = await getGameAnalysis();
        // Crear un modal o alert con el análisis
        const analysisWindow = window.open('', 'Análisis de Partida', 'width=600,height=400');
        analysisWindow.document.write(`
            <html>
            <head>
                <title>Análisis de Partida</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { color: #667eea; }
                    pre { white-space: pre-wrap; background: #f5f5f5; padding: 15px; border-radius: 5px; }
                </style>
            </head>
            <body>
                <h1>📊 Análisis de Partida</h1>
                <pre>${analysis}</pre>
            </body>
            </html>
        `);
    } catch (error) {
        alert('Error al analizar la partida: ' + error.message);
    } finally {
        showThinkingIndicator(false);
    }
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
        alert('Partida guardada correctamente');
    }
}

function loadGame() {
    const savedGames = JSON.parse(localStorage.getItem('saved_games') || '[]');
    
    if (savedGames.length === 0) {
        alert('No hay partidas guardadas');
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
        
        // Restaurar el estado del juego
        game = new ChessGame();
        game.board = savedGame.board;
        game.currentTurn = savedGame.currentTurn;
        game.moveHistory = savedGame.moveHistory;
        game.capturedPieces = savedGame.capturedPieces;
        playerColor = savedGame.playerColor;

        renderBoard();
        updateCapturedPieces();
        updateMoveHistory();
        
        alert('Partida cargada correctamente');
    }
}

function exportPGN() {
    if (game.moveHistory.length === 0) {
        alert('No hay movimientos para exportar');
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

    alert('Archivo PGN exportado correctamente');
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
                alert('¡Se acabó el tiempo de las blancas! Las negras ganan.');
                return;
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                stopClock();
                game.gameOver = true;
                alert('¡Se acabó el tiempo de las negras! Las blancas ganan.');
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
            
            // Agregar coordenadas en la esquina superior derecha
            const coordinate = document.createElement('span');
            coordinate.className = 'square-coordinate';
            coordinate.textContent = files[displayCol] + (8 - displayRow);
            square.appendChild(coordinate);
            
            // Agregar pieza si existe
            const piece = game.getPiece(displayRow, displayCol);
            if (piece) {
                const pieceElement = document.createElement('span');
                pieceElement.className = 'piece';
                pieceElement.textContent = piece.piece;
                square.appendChild(pieceElement);
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
    
    // En modo humano vs humano, permitir mover ambos colores
    const allowedColor = (gameMode === 'vs-human' || gameMode === 'puzzle') 
        ? game.currentTurn 
        : playerColor;
    
    if (gameMode === 'vs-ai' && game.currentTurn !== playerColor) return;
    
    const clickedPiece = game.getPiece(row, col);
    
    // Si hay un cuadrado seleccionado
    if (selectedSquare) {
        const validMoves = game.getValidMoves(selectedSquare.row, selectedSquare.col);
        const targetMove = validMoves.find(m => m.row === row && m.col === col);
        
        if (targetMove) {
            // Realizar el movimiento
            const result = game.makeMove(selectedSquare.row, selectedSquare.col, row, col);
            selectedSquare = null;
            
            // Agregar incremento al jugador que acaba de mover
            addTimeIncrement();
            
            renderBoard();
            updateCapturedPieces();
            updateMoveHistory();
            updateUndoButton();
            
            handleGameResult(result);
            
            // Turno de Claude solo en modo IA
            if (gameMode === 'vs-ai' && !game.gameOver && game.currentTurn !== playerColor) {
                setTimeout(() => makeClaudeMove(), 500);
            }

            // Verificar puzzle
            if (gameMode === 'puzzle') {
                checkPuzzleSolution();
            }
        } else if (clickedPiece && clickedPiece.color === allowedColor) {
            // Seleccionar otra pieza propia
            selectedSquare = { row, col };
            highlightValidMoves(row, col);
        } else {
            // Deseleccionar
            selectedSquare = null;
            renderBoard();
        }
    } else if (clickedPiece && clickedPiece.color === allowedColor) {
        // Seleccionar una pieza
        selectedSquare = { row, col };
        highlightValidMoves(row, col);
    }
}

function checkPuzzleSolution() {
    // Aquí se implementaría la verificación de la solución del puzzle
    const puzzle = chessPuzzles[currentPuzzleIndex];
    // Por ahora, simplemente avanzar al siguiente puzzle después de unos movimientos
    if (game.moveHistory.length >= 2) {
        setTimeout(() => {
            alert('¡Correcto! Siguiente puzzle...');
            currentPuzzleIndex++;
            startNewGame();
        }, 1000);
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
    const historyElement = document.getElementById('move-history');
    historyElement.innerHTML = '';
    
    game.moveHistory.forEach((move, index) => {
        const moveElement = document.createElement('div');
        moveElement.className = 'move-entry';
        const moveNumber = Math.floor(index / 2) + 1;
        const color = index % 2 === 0 ? 'Blancas' : 'Negras';
        moveElement.textContent = `${moveNumber}. ${color}: ${move}`;
        historyElement.appendChild(moveElement);
    });
    
    // Scroll al final
    historyElement.scrollTop = historyElement.scrollHeight;
}

function handleGameResult(result) {
    if (result.status === 'checkmate') {
        const winner = result.winner === 'white' ? 'Blancas' : 'Negras';
        setTimeout(() => {
            alert(`¡Jaque mate! ${winner} ganan.`);
        }, 300);
    } else if (result.status === 'stalemate') {
        setTimeout(() => {
            alert('¡Tablas por ahogado!');
        }, 300);
    }
}

async function makeClaudeMove() {
    if (!apiKey) {
        alert('Por favor configura tu API Key de Anthropic primero');
        return;
    }
    
    showThinkingIndicator(true);
    
    try {
        const move = await getClaudeMove();
        
        if (move) {
            const result = game.makeMove(move.fromRow, move.fromCol, move.toRow, move.toCol);
            
            // Agregar incremento al jugador que acaba de mover
            addTimeIncrement();
            
            renderBoard();
            updateCapturedPieces();
            updateMoveHistory();
            
            handleGameResult(result);
        } else {
            alert('Claude no pudo generar un movimiento válido');
        }
    } catch (error) {
        console.error('Error completo:', error);
        let errorMessage = 'Error al comunicarse con Claude.\n\n';
        
        if (error.message.includes('API Error: 401')) {
            errorMessage += '❌ API Key inválida o expirada.\nVerifica tu API Key en console.anthropic.com';
        } else if (error.message.includes('API Error: 429')) {
            errorMessage += '⚠️ Límite de uso excedido.\nRevisa tu plan en console.anthropic.com';
        } else if (error.message.includes('API Error: 500') || error.message.includes('API Error: 529')) {
            errorMessage += '🔧 Servidor de Anthropic con problemas.\nIntenta nuevamente en unos minutos.';
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            errorMessage += '🌐 Error de conexión.\nVerifica tu conexión a internet.';
        } else {
            errorMessage += 'Detalles: ' + error.message;
        }
        
        alert(errorMessage);
    } finally {
        showThinkingIndicator(false);
    }
}

async function getClaudeMove(isHint = false) {
    const boardState = describeBoardState();
    const validMovesDescription = describeValidMoves();
    
    // Ajustar el prompt según el nivel de dificultad
    let difficultyInstruction = '';
    switch (aiDifficulty) {
        case 'beginner':
            difficultyInstruction = 'Juega como un principiante. Haz movimientos simples y a veces comete pequeños errores. No pienses demasiado en estrategias avanzadas.';
            break;
        case 'intermediate':
            difficultyInstruction = 'Juega a nivel intermedio. Usa tácticas básicas pero evita las estrategias más complejas.';
            break;
        case 'advanced':
            difficultyInstruction = 'Juega a nivel avanzado. Usa tácticas y estrategias sólidas.';
            break;
        case 'expert':
            difficultyInstruction = 'Eres un gran maestro de ajedrez. Analiza profundamente y juega al más alto nivel.';
            break;
    }

    const hintInstruction = isHint 
        ? 'Sugiere el MEJOR movimiento posible para ayudar al jugador.' 
        : difficultyInstruction;
    
    const prompt = `Eres un jugador de ajedrez. ${hintInstruction}

POSICIÓN ACTUAL DEL TABLERO (formato FEN):
${game.toFEN()}

DESCRIPCIÓN DEL TABLERO:
${boardState}

TU COLOR: ${game.currentTurn === 'white' ? 'Blancas' : 'Negras'}

MOVIMIENTOS VÁLIDOS DISPONIBLES:
${validMovesDescription}

Responde ÚNICAMENTE con el movimiento elegido en el siguiente formato JSON exacto:
{"from": "e2", "to": "e4"}

Donde "from" es la casilla de origen (por ejemplo: e2, g1, etc.) y "to" es la casilla de destino.
Las columnas van de 'a' a 'h' y las filas de '1' a '8'.

NO incluyas ningún texto adicional, solo el JSON.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1024,
            messages: [{
                role: 'user',
                content: prompt
            }]
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error de API:', errorData);
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Respuesta completa de la API:', data);
    
    if (!data.content || !data.content[0] || !data.content[0].text) {
        console.error('Respuesta inesperada de la API:', data);
        throw new Error('Respuesta inválida de la API');
    }
    
    const claudeResponse = data.content[0].text.trim();
    
    console.log('Respuesta de Claude:', claudeResponse);
    
    // Extraer JSON de la respuesta
    const jsonMatch = claudeResponse.match(/\{[^}]+\}/);
    if (!jsonMatch) {
        console.error('No se encontró JSON en la respuesta:', claudeResponse);
        return null;
    }
    
    const moveData = JSON.parse(jsonMatch[0]);
    const move = parseMove(moveData.from, moveData.to);
    
    if (move && isValidMove(move)) {
        return move;
    }
    
    console.error('Movimiento inválido:', moveData);
    return null;
}

function describeBoardState() {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    let description = '';
    
    for (let row = 0; row < 8; row++) {
        const rank = 8 - row;
        description += `Fila ${rank}: `;
        
        for (let col = 0; col < 8; col++) {
            const file = files[col];
            const piece = game.getPiece(row, col);
            
            if (piece) {
                const color = piece.color === 'white' ? 'Blanca' : 'Negra';
                const typeName = {
                    'king': 'Rey',
                    'queen': 'Reina',
                    'rook': 'Torre',
                    'bishop': 'Alfil',
                    'knight': 'Caballo',
                    'pawn': 'Peón'
                };
                description += `${file}${rank}=${typeName[piece.type]} ${color}, `;
            }
        }
        description += '\n';
    }
    
    return description;
}

function describeValidMoves() {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    let description = '';
    let moveCount = 0;
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = game.getPiece(row, col);
            if (piece && piece.color === game.currentTurn) {
                const validMoves = game.getValidMoves(row, col);
                
                if (validMoves.length > 0) {
                    const fromSquare = files[col] + (8 - row);
                    const typeName = {
                        'king': 'Rey',
                        'queen': 'Reina',
                        'rook': 'Torre',
                        'bishop': 'Alfil',
                        'knight': 'Caballo',
                        'pawn': 'Peón'
                    };
                    
                    description += `${typeName[piece.type]} en ${fromSquare} puede ir a: `;
                    description += validMoves.map(m => 
                        files[m.col] + (8 - m.row)
                    ).join(', ');
                    description += '\n';
                    moveCount += validMoves.length;
                }
            }
        }
    }
    
    description += `\nTotal de movimientos posibles: ${moveCount}`;
    return description;
}

function parseMove(from, to) {
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    
    // Parsear "from" (ej: "e2")
    const fromCol = files.indexOf(from[0]);
    const fromRow = 8 - parseInt(from[1]);
    
    // Parsear "to" (ej: "e4")
    const toCol = files.indexOf(to[0]);
    const toRow = 8 - parseInt(to[1]);
    
    if (fromCol === -1 || toCol === -1 || 
        isNaN(fromRow) || isNaN(toRow) ||
        fromRow < 0 || fromRow > 7 || toRow < 0 || toRow > 7) {
        return null;
    }
    
    return { fromRow, fromCol, toRow, toCol };
}

function isValidMove(move) {
    const piece = game.getPiece(move.fromRow, move.fromCol);
    if (!piece || piece.color !== game.currentTurn) {
        return false;
    }
    
    const validMoves = game.getValidMoves(move.fromRow, move.fromCol);
    return validMoves.some(m => m.row === move.toRow && m.col === move.toCol);
}

async function getGameAnalysis() {
    const prompt = `Eres un experto analista de ajedrez. Analiza la siguiente partida y proporciona un análisis detallado.

HISTORIAL DE MOVIMIENTOS:
${game.moveHistory.join(', ')}

POSICIÓN ACTUAL (FEN):
${game.toFEN()}

TABLERO ACTUAL:
${describeBoardState()}

Por favor proporciona:
1. Un resumen de la partida
2. Movimientos clave y momentos decisivos
3. Errores cometidos por ambos jugadores
4. Sugerencias de mejora
5. Evaluación de la posición actual

Sé conciso pero informativo.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2048,
            messages: [{
                role: 'user',
                content: prompt
            }]
        })
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

function showThinkingIndicator(show) {
    const indicator = document.getElementById('thinking-indicator');
    indicator.style.display = show ? 'flex' : 'none';
}

