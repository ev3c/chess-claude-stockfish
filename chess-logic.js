// Representación de las piezas de ajedrez
const PIECES = {
    WHITE_KING: '♔',
    WHITE_QUEEN: '♕',
    WHITE_ROOK: '♖',
    WHITE_BISHOP: '♗',
    WHITE_KNIGHT: '♘',
    WHITE_PAWN: '♙',
    BLACK_KING: '♚',
    BLACK_QUEEN: '♛',
    BLACK_ROOK: '♜',
    BLACK_BISHOP: '♝',
    BLACK_KNIGHT: '♞',
    BLACK_PAWN: '♟'
};

// Función para obtener las piezas según el estilo seleccionado
function getPieceSet() {
    if (typeof pieceStyle !== 'undefined' && typeof PIECE_SETS !== 'undefined' && PIECE_SETS[pieceStyle]) {
        return {
            WHITE_KING: PIECE_SETS[pieceStyle].WHITE_KING,
            WHITE_QUEEN: PIECE_SETS[pieceStyle].WHITE_QUEEN,
            WHITE_ROOK: PIECE_SETS[pieceStyle].WHITE_ROOK,
            WHITE_BISHOP: PIECE_SETS[pieceStyle].WHITE_BISHOP,
            WHITE_KNIGHT: PIECE_SETS[pieceStyle].WHITE_KNIGHT,
            WHITE_PAWN: PIECE_SETS[pieceStyle].WHITE_PAWN,
            BLACK_KING: PIECE_SETS[pieceStyle].BLACK_KING,
            BLACK_QUEEN: PIECE_SETS[pieceStyle].BLACK_QUEEN,
            BLACK_ROOK: PIECE_SETS[pieceStyle].BLACK_ROOK,
            BLACK_BISHOP: PIECE_SETS[pieceStyle].BLACK_BISHOP,
            BLACK_KNIGHT: PIECE_SETS[pieceStyle].BLACK_KNIGHT,
            BLACK_PAWN: PIECE_SETS[pieceStyle].BLACK_PAWN
        };
    }
    return PIECES;
}

class ChessGame {
    constructor() {
        this.board = this.initializeBoard();
        this.currentTurn = 'white';
        this.selectedSquare = null;
        this.moveHistory = [];
        this.moveHistoryUCI = []; // Historial en formato UCI para Stockfish
        this.capturedPieces = { white: [], black: [] };
        this.gameOver = false;
        this.enPassantTarget = null;
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        this.boardHistory = []; // Para deshacer movimientos
        this.gameStateHistory = []; // Para guardar estados completos
    }

    initializeBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        const pieceSet = getPieceSet();
        
        // Piezas negras
        board[0] = [
            { piece: pieceSet.BLACK_ROOK, color: 'black', type: 'rook' },
            { piece: pieceSet.BLACK_KNIGHT, color: 'black', type: 'knight' },
            { piece: pieceSet.BLACK_BISHOP, color: 'black', type: 'bishop' },
            { piece: pieceSet.BLACK_QUEEN, color: 'black', type: 'queen' },
            { piece: pieceSet.BLACK_KING, color: 'black', type: 'king' },
            { piece: pieceSet.BLACK_BISHOP, color: 'black', type: 'bishop' },
            { piece: pieceSet.BLACK_KNIGHT, color: 'black', type: 'knight' },
            { piece: pieceSet.BLACK_ROOK, color: 'black', type: 'rook' }
        ];
        board[1] = Array(8).fill(null).map(() => ({ 
            piece: pieceSet.BLACK_PAWN, 
            color: 'black', 
            type: 'pawn' 
        }));
        
        // Piezas blancas
        board[6] = Array(8).fill(null).map(() => ({ 
            piece: pieceSet.WHITE_PAWN, 
            color: 'white', 
            type: 'pawn' 
        }));
        board[7] = [
            { piece: pieceSet.WHITE_ROOK, color: 'white', type: 'rook' },
            { piece: pieceSet.WHITE_KNIGHT, color: 'white', type: 'knight' },
            { piece: pieceSet.WHITE_BISHOP, color: 'white', type: 'bishop' },
            { piece: pieceSet.WHITE_QUEEN, color: 'white', type: 'queen' },
            { piece: pieceSet.WHITE_KING, color: 'white', type: 'king' },
            { piece: pieceSet.WHITE_BISHOP, color: 'white', type: 'bishop' },
            { piece: pieceSet.WHITE_KNIGHT, color: 'white', type: 'knight' },
            { piece: pieceSet.WHITE_ROOK, color: 'white', type: 'rook' }
        ];
        
        return board;
    }

    getPiece(row, col) {
        return this.board[row]?.[col];
    }

    isValidPosition(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    getValidMoves(row, col) {
        const piece = this.getPiece(row, col);
        if (!piece || piece.color !== this.currentTurn) return [];

        let moves = [];
        
        switch(piece.type) {
            case 'pawn':
                moves = this.getPawnMoves(row, col);
                break;
            case 'rook':
                moves = this.getRookMoves(row, col);
                break;
            case 'knight':
                moves = this.getKnightMoves(row, col);
                break;
            case 'bishop':
                moves = this.getBishopMoves(row, col);
                break;
            case 'queen':
                moves = this.getQueenMoves(row, col);
                break;
            case 'king':
                moves = this.getKingMoves(row, col);
                break;
        }

        // Filtrar movimientos que dejarían al rey en jaque
        return moves.filter(move => !this.wouldBeInCheck(row, col, move.row, move.col));
    }

    getPawnMoves(row, col) {
        const moves = [];
        const piece = this.getPiece(row, col);
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;

        // Movimiento simple hacia adelante
        if (!this.getPiece(row + direction, col)) {
            moves.push({ row: row + direction, col });
            
            // Movimiento doble desde posición inicial
            if (row === startRow && !this.getPiece(row + 2 * direction, col)) {
                moves.push({ row: row + 2 * direction, col });
            }
        }

        // Capturas diagonales
        [-1, 1].forEach(offset => {
            const newCol = col + offset;
            const target = this.getPiece(row + direction, newCol);
            if (target && target.color !== piece.color) {
                moves.push({ row: row + direction, col: newCol });
            }
            
            // En passant
            if (this.enPassantTarget && 
                this.enPassantTarget.row === row + direction && 
                this.enPassantTarget.col === newCol) {
                moves.push({ row: row + direction, col: newCol, enPassant: true });
            }
        });

        return moves;
    }

    getRookMoves(row, col) {
        return this.getLinearMoves(row, col, [
            [-1, 0], [1, 0], [0, -1], [0, 1]
        ]);
    }

    getBishopMoves(row, col) {
        return this.getLinearMoves(row, col, [
            [-1, -1], [-1, 1], [1, -1], [1, 1]
        ]);
    }

    getQueenMoves(row, col) {
        return this.getLinearMoves(row, col, [
            [-1, 0], [1, 0], [0, -1], [0, 1],
            [-1, -1], [-1, 1], [1, -1], [1, 1]
        ]);
    }

    getLinearMoves(row, col, directions) {
        const moves = [];
        const piece = this.getPiece(row, col);

        directions.forEach(([dRow, dCol]) => {
            let newRow = row + dRow;
            let newCol = col + dCol;

            while (this.isValidPosition(newRow, newCol)) {
                const target = this.getPiece(newRow, newCol);
                
                if (!target) {
                    moves.push({ row: newRow, col: newCol });
                } else {
                    if (target.color !== piece.color) {
                        moves.push({ row: newRow, col: newCol });
                    }
                    break;
                }
                
                newRow += dRow;
                newCol += dCol;
            }
        });

        return moves;
    }

    getKnightMoves(row, col) {
        const moves = [];
        const piece = this.getPiece(row, col);
        const offsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];

        offsets.forEach(([dRow, dCol]) => {
            const newRow = row + dRow;
            const newCol = col + dCol;
            
            if (this.isValidPosition(newRow, newCol)) {
                const target = this.getPiece(newRow, newCol);
                if (!target || target.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        });

        return moves;
    }

    getKingMoves(row, col) {
        const moves = [];
        const piece = this.getPiece(row, col);
        const offsets = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];

        offsets.forEach(([dRow, dCol]) => {
            const newRow = row + dRow;
            const newCol = col + dCol;
            
            if (this.isValidPosition(newRow, newCol)) {
                const target = this.getPiece(newRow, newCol);
                if (!target || target.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        });

        // Enroque
        if (this.canCastle(row, col, 'kingside')) {
            moves.push({ row, col: col + 2, castling: 'kingside' });
        }
        if (this.canCastle(row, col, 'queenside')) {
            moves.push({ row, col: col - 2, castling: 'queenside' });
        }

        return moves;
    }

    canCastle(row, col, side) {
        const piece = this.getPiece(row, col);
        
        // Verificar derechos de enroque
        if (!this.castlingRights[piece.color][side]) {
            return false;
        }
        
        // No se puede enrocar si el rey está en jaque
        if (this.isInCheck(piece.color)) {
            return false;
        }

        if (side === 'kingside') {
            // Verificar que la torre esté en su lugar
            const rook = this.getPiece(row, 7);
            if (!rook || rook.type !== 'rook' || rook.color !== piece.color) {
                return false;
            }
            
            // Enroque corto: verificar f y g están vacías (columnas 5 y 6)
            if (this.getPiece(row, col + 1) || this.getPiece(row, col + 2)) {
                return false;
            }
            
            // Verificar que el rey no pase por jaque en f y g
            if (this.wouldBeInCheckSimple(row, col, row, col + 1, piece.color) ||
                this.wouldBeInCheckSimple(row, col, row, col + 2, piece.color)) {
                return false;
            }
        } else {
            // Verificar que la torre esté en su lugar
            const rook = this.getPiece(row, 0);
            if (!rook || rook.type !== 'rook' || rook.color !== piece.color) {
                return false;
            }
            
            // Enroque largo: verificar b, c y d están vacías (columnas 1, 2 y 3)
            if (this.getPiece(row, col - 1) || this.getPiece(row, col - 2) || this.getPiece(row, col - 3)) {
                return false;
            }
            
            // Verificar que el rey no pase por jaque en d y c
            if (this.wouldBeInCheckSimple(row, col, row, col - 1, piece.color) ||
                this.wouldBeInCheckSimple(row, col, row, col - 2, piece.color)) {
                return false;
            }
        }

        return true;
    }

    wouldBeInCheckSimple(fromRow, fromCol, toRow, toCol, color) {
        // Simular el movimiento sin usar getValidMoves para evitar recursión
        const originalPiece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        
        this.board[toRow][toCol] = originalPiece;
        this.board[fromRow][fromCol] = null;

        const inCheck = this.isInCheck(color);

        // Restaurar el tablero
        this.board[fromRow][fromCol] = originalPiece;
        this.board[toRow][toCol] = capturedPiece;

        return inCheck;
    }

    wouldBeInCheck(fromRow, fromCol, toRow, toCol) {
        // Simular el movimiento
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        const inCheck = this.isInCheck(piece.color);

        // Restaurar el tablero
        this.board[fromRow][fromCol] = piece;
        this.board[toRow][toCol] = capturedPiece;

        return inCheck;
    }

    isInCheck(color) {
        // Encontrar el rey
        let kingPos = null;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                if (piece && piece.type === 'king' && piece.color === color) {
                    kingPos = { row, col };
                    break;
                }
            }
            if (kingPos) break;
        }

        if (!kingPos) return false;

        // Verificar si alguna pieza enemiga puede atacar al rey
        const enemyColor = color === 'white' ? 'black' : 'white';
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                if (piece && piece.color === enemyColor) {
                    const moves = this.getMovesWithoutCheckValidation(row, col);
                    if (moves.some(move => move.row === kingPos.row && move.col === kingPos.col)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    getMovesWithoutCheckValidation(row, col) {
        const piece = this.getPiece(row, col);
        if (!piece) return [];

        switch(piece.type) {
            case 'pawn':
                return this.getPawnAttackSquares(row, col);
            case 'rook':
                return this.getRookMoves(row, col);
            case 'knight':
                return this.getKnightMoves(row, col);
            case 'bishop':
                return this.getBishopMoves(row, col);
            case 'queen':
                return this.getQueenMoves(row, col);
            case 'king':
                const offsets = [
                    [-1, -1], [-1, 0], [-1, 1],
                    [0, -1], [0, 1],
                    [1, -1], [1, 0], [1, 1]
                ];
                const moves = [];
                offsets.forEach(([dRow, dCol]) => {
                    const newRow = row + dRow;
                    const newCol = col + dCol;
                    if (this.isValidPosition(newRow, newCol)) {
                        moves.push({ row: newRow, col: newCol });
                    }
                });
                return moves;
            default:
                return [];
        }
    }

    getPawnAttackSquares(row, col) {
        const moves = [];
        const piece = this.getPiece(row, col);
        const direction = piece.color === 'white' ? -1 : 1;

        [-1, 1].forEach(offset => {
            const newRow = row + direction;
            const newCol = col + offset;
            if (this.isValidPosition(newRow, newCol)) {
                moves.push({ row: newRow, col: newCol });
            }
        });

        return moves;
    }

    isCheckmate() {
        if (!this.isInCheck(this.currentTurn)) return false;
        return !this.hasValidMoves();
    }

    isStalemate() {
        if (this.isInCheck(this.currentTurn)) return false;
        return !this.hasValidMoves();
    }

    hasValidMoves() {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                if (piece && piece.color === this.currentTurn) {
                    if (this.getValidMoves(row, col).length > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.getPiece(fromRow, fromCol);
        const capturedPiece = this.getPiece(toRow, toCol);
        const move = this.getValidMoves(fromRow, fromCol).find(
            m => m.row === toRow && m.col === toCol
        );

        if (!move) return false;

        // Guardar estado completo antes del movimiento
        this.saveGameState();
        
        // Generar notación ANTES de cualquier cambio en el tablero
        let notation = this.getMoveNotation(fromRow, fromCol, toRow, toCol, piece, capturedPiece);
        
        // Guardar en formato UCI para Stockfish
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const uciMove = files[fromCol] + (8 - fromRow) + files[toCol] + (8 - toRow);
        this.moveHistoryUCI.push(uciMove);

        // Actualizar derechos de enroque ANTES de mover piezas
        if (piece.type === 'king') {
            this.castlingRights[piece.color].kingside = false;
            this.castlingRights[piece.color].queenside = false;
        }
        if (piece.type === 'rook') {
            if (fromCol === 0) this.castlingRights[piece.color].queenside = false;
            if (fromCol === 7) this.castlingRights[piece.color].kingside = false;
        }

        // Actualizar en passant
        this.enPassantTarget = null;
        if (piece.type === 'pawn' && Math.abs(fromRow - toRow) === 2) {
            this.enPassantTarget = {
                row: (fromRow + toRow) / 2,
                col: fromCol
            };
        }

        // Capturar pieza si existe
        if (capturedPiece) {
            this.capturedPieces[this.currentTurn].push(capturedPiece.piece);
        }

        // Manejar en passant
        if (move.enPassant) {
            const capturedRow = piece.color === 'white' ? toRow + 1 : toRow - 1;
            const captured = this.getPiece(capturedRow, toCol);
            if (captured) {
                this.capturedPieces[this.currentTurn].push(captured.piece);
                this.board[capturedRow][toCol] = null;
            }
        }

        // Realizar el movimiento del rey/pieza
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        // Manejar enroque (mover la torre DESPUÉS de mover el rey)
        if (move.castling) {
            const rookCol = move.castling === 'kingside' ? 7 : 0;
            const newRookCol = move.castling === 'kingside' ? toCol - 1 : toCol + 1;
            this.board[toRow][newRookCol] = this.board[toRow][rookCol];
            this.board[toRow][rookCol] = null;
        }

        // Promoción de peón
        if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
            this.promotePawn(toRow, toCol);
            // Actualizar notación con promoción
            notation += '=Q';
        }

        // Cambiar turno
        this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';

        // Verificar fin del juego y agregar símbolos
        let gameStatus = { status: 'normal' };
        
        if (this.isCheckmate()) {
            this.gameOver = true;
            notation += '#'; // Símbolo de jaque mate
            gameStatus = { status: 'checkmate', winner: piece.color };
        } else if (this.isStalemate()) {
            this.gameOver = true;
            gameStatus = { status: 'stalemate' };
        } else if (this.isInCheck(this.currentTurn)) {
            notation += '+'; // Símbolo de jaque
            gameStatus = { status: 'check' };
        }
        
        // Guardar en historial con símbolos de jaque
        this.moveHistory.push(notation);

        return gameStatus;
    }

    promotePawn(row, col) {
        const piece = this.getPiece(row, col);
        const pieceSet = getPieceSet();
        piece.type = 'queen';
        piece.piece = piece.color === 'white' ? pieceSet.WHITE_QUEEN : pieceSet.BLACK_QUEEN;
    }

    getMoveNotation(fromRow, fromCol, toRow, toCol, piece, capturedPiece) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const toSquare = files[toCol] + (8 - toRow);
        
        let notation = '';
        
        // Notación algebraica estándar
        if (piece.type === 'pawn') {
            // Peón: solo mostrar captura si es necesario
            if (capturedPiece) {
                notation += files[fromCol] + 'x' + toSquare;
            } else {
                notation += toSquare;
            }
        } else if (piece.type === 'king') {
            // Verificar enroque
            if (Math.abs(fromCol - toCol) === 2) {
                notation = toCol > fromCol ? 'O-O' : 'O-O-O';
            } else {
                notation = 'K' + (capturedPiece ? 'x' : '') + toSquare;
            }
        } else {
            // Otras piezas: letra + casilla destino
            const pieceSymbols = {
                'queen': 'Q',
                'rook': 'R',
                'bishop': 'B',
                'knight': 'N'
            };
            notation = pieceSymbols[piece.type];
            if (capturedPiece) notation += 'x';
            notation += toSquare;
        }
        
        return notation;
    }

    getBoardState() {
        return JSON.parse(JSON.stringify(this.board));
    }

    toFEN() {
        let fen = '';
        
        // 1. Posición de piezas
        for (let row = 0; row < 8; row++) {
            let emptyCount = 0;
            for (let col = 0; col < 8; col++) {
                const piece = this.getPiece(row, col);
                if (!piece) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    const pieceChar = this.getPieceChar(piece);
                    fen += pieceChar;
                }
            }
            if (emptyCount > 0) {
                fen += emptyCount;
            }
            if (row < 7) {
                fen += '/';
            }
        }
        
        // 2. Turno actual
        fen += ' ' + (this.currentTurn === 'white' ? 'w' : 'b');
        
        // 3. Derechos de enroque
        let castling = '';
        if (this.castlingRights.white.kingside) castling += 'K';
        if (this.castlingRights.white.queenside) castling += 'Q';
        if (this.castlingRights.black.kingside) castling += 'k';
        if (this.castlingRights.black.queenside) castling += 'q';
        fen += ' ' + (castling || '-');
        
        // 4. Casilla en passant
        if (this.enPassantTarget) {
            const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            const epSquare = files[this.enPassantTarget.col] + (8 - this.enPassantTarget.row);
            fen += ' ' + epSquare;
        } else {
            fen += ' -';
        }
        
        // 5. Contador de medio movimiento (regla de 50 movimientos) - simplificado a 0
        fen += ' 0';
        
        // 6. Número de movimiento completo
        const fullMoveNumber = Math.floor(this.moveHistory.length / 2) + 1;
        fen += ' ' + fullMoveNumber;
        
        return fen;
    }

    getPieceChar(piece) {
        const chars = {
            'king': 'k', 'queen': 'q', 'rook': 'r',
            'bishop': 'b', 'knight': 'n', 'pawn': 'p'
        };
        const char = chars[piece.type];
        return piece.color === 'white' ? char.toUpperCase() : char;
    }

    saveGameState() {
        this.gameStateHistory.push({
            board: JSON.parse(JSON.stringify(this.board)),
            currentTurn: this.currentTurn,
            capturedPieces: JSON.parse(JSON.stringify(this.capturedPieces)),
            enPassantTarget: this.enPassantTarget ? { ...this.enPassantTarget } : null,
            castlingRights: JSON.parse(JSON.stringify(this.castlingRights)),
            gameOver: this.gameOver
        });
    }

    undoMove() {
        if (this.gameStateHistory.length === 0) return false;

        const previousState = this.gameStateHistory.pop();
        this.board = previousState.board;
        this.currentTurn = previousState.currentTurn;
        this.capturedPieces = previousState.capturedPieces;
        this.enPassantTarget = previousState.enPassantTarget;
        this.castlingRights = previousState.castlingRights;
        this.gameOver = previousState.gameOver;
        this.moveHistory.pop();
        this.moveHistoryUCI.pop();

        return true;
    }

    canUndo() {
        return this.gameStateHistory.length > 0;
    }
}

