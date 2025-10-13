let game = null;
let playerColor = 'white';
let selectedSquare = null;
let apiKey = '';

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    // Cargar API key guardada
    const savedApiKey = localStorage.getItem('claude_api_key');
    if (savedApiKey) {
        apiKey = savedApiKey;
        document.getElementById('api-key').value = savedApiKey;
    }

    // Event listeners
    document.getElementById('save-key').addEventListener('click', saveApiKey);
    document.getElementById('test-key').addEventListener('click', testApiKey);
    document.getElementById('new-game').addEventListener('click', startNewGame);
    document.getElementById('player-color').addEventListener('change', (e) => {
        playerColor = e.target.value;
    });

    // Iniciar primera partida
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
    
    renderBoard();
    updateGameStatus();
    updateCapturedPieces();
    updateMoveHistory();
    
    // Si el jugador es negras, Claude mueve primero
    if (playerColor === 'black') {
        setTimeout(() => makeClaudeMove(), 500);
    }
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
    if (game.currentTurn !== playerColor) return;
    
    const clickedPiece = game.getPiece(row, col);
    
    // Si hay un cuadrado seleccionado
    if (selectedSquare) {
        const validMoves = game.getValidMoves(selectedSquare.row, selectedSquare.col);
        const targetMove = validMoves.find(m => m.row === row && m.col === col);
        
        if (targetMove) {
            // Realizar el movimiento
            const result = game.makeMove(selectedSquare.row, selectedSquare.col, row, col);
            selectedSquare = null;
            
            renderBoard();
            updateGameStatus();
            updateCapturedPieces();
            updateMoveHistory();
            
            handleGameResult(result);
            
            // Turno de Claude
            if (!game.gameOver && game.currentTurn !== playerColor) {
                setTimeout(() => makeClaudeMove(), 500);
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

function updateGameStatus() {
    const turnElement = document.getElementById('current-turn');
    const stateElement = document.getElementById('game-state');
    
    turnElement.textContent = game.currentTurn === 'white' ? 'Blancas' : 'Negras';
    
    if (game.gameOver) {
        stateElement.textContent = 'Juego terminado';
    } else if (game.isInCheck(game.currentTurn)) {
        stateElement.textContent = '¡Jaque!';
    } else {
        stateElement.textContent = 'En progreso';
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
            
            renderBoard();
            updateGameStatus();
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

async function getClaudeMove() {
    const boardState = describeBoardState();
    const validMovesDescription = describeValidMoves();
    
    const prompt = `Eres un jugador experto de ajedrez. Analiza la siguiente posición y elige el mejor movimiento.

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

function showThinkingIndicator(show) {
    const indicator = document.getElementById('thinking-indicator');
    indicator.style.display = show ? 'flex' : 'none';
}

