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

class ChessGame {
    constructor() {
        this.board = this.initializeBoard();
        this.currentTurn = 'white';
        this.selectedSquare = null;
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.gameOver = false;
        this.enPassantTarget = null;
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
    }

    initializeBoard() {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Piezas negras
        board[0] = [
            { piece: PIECES.BLACK_ROOK, color: 'black', type: 'rook' },
            { piece: PIECES.BLACK_KNIGHT, color: 'black', type: 'knight' },
            { piece: PIECES.BLACK_BISHOP, color: 'black', type: 'bishop' },
            { piece: PIECES.BLACK_QUEEN, color: 'black', type: 'queen' },
            { piece: PIECES.BLACK_KING, color: 'black', type: 'king' },
            { piece: PIECES.BLACK_BISHOP, color: 'black', type: 'bishop' },
            { piece: PIECES.BLACK_KNIGHT, color: 'black', type: 'knight' },
            { piece: PIECES.BLACK_ROOK, color: 'black', type: 'rook' }
        ];
        board[1] = Array(8).fill(null).map(() => ({ 
            piece: PIECES.BLACK_PAWN, 
            color: 'black', 
            type: 'pawn' 
        }));
        
        // Piezas blancas
        board[6] = Array(8).fill(null).map(() => ({ 
            piece: PIECES.WHITE_PAWN, 
            color: 'white', 
            type: 'pawn' 
        }));
        board[7] = [
            { piece: PIECES.WHITE_ROOK, color: 'white', type: 'rook' },
            { piece: PIECES.WHITE_KNIGHT, color: 'white', type: 'knight' },
            { piece: PIECES.WHITE_BISHOP, color: 'white', type: 'bishop' },
            { piece: PIECES.WHITE_QUEEN, color: 'white', type: 'queen' },
            { piece: PIECES.WHITE_KING, color: 'white', type: 'king' },
            { piece: PIECES.WHITE_BISHOP, color: 'white', type: 'bishop' },
            { piece: PIECES.WHITE_KNIGHT, color: 'white', type: 'knight' },
            { piece: PIECES.WHITE_ROOK, color: 'white', type: 'rook' }
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
        if (!this.castlingRights[piece.color][side]) return false;
        if (this.isInCheck(piece.color)) return false;

        const direction = side === 'kingside' ? 1 : -1;
        const squares = side === 'kingside' ? 2 : 3;

        // Verificar que los cuadrados estén vacíos
        for (let i = 1; i <= squares; i++) {
            if (this.getPiece(row, col + i * direction)) return false;
        }

        // Verificar que el rey no pase por jaque
        for (let i = 1; i <= 2; i++) {
            if (this.wouldBeInCheck(row, col, row, col + i * direction)) return false;
        }

        return true;
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

        // Guardar en historial
        const notation = this.getMoveNotation(fromRow, fromCol, toRow, toCol, piece, capturedPiece);
        this.moveHistory.push(notation);

        // Actualizar en passant
        this.enPassantTarget = null;
        if (piece.type === 'pawn' && Math.abs(fromRow - toRow) === 2) {
            this.enPassantTarget = {
                row: (fromRow + toRow) / 2,
                col: fromCol
            };
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

        // Manejar enroque
        if (move.castling) {
            const rookCol = move.castling === 'kingside' ? 7 : 0;
            const newRookCol = move.castling === 'kingside' ? toCol - 1 : toCol + 1;
            this.board[toRow][newRookCol] = this.board[toRow][rookCol];
            this.board[toRow][rookCol] = null;
        }

        // Actualizar derechos de enroque
        if (piece.type === 'king') {
            this.castlingRights[piece.color].kingside = false;
            this.castlingRights[piece.color].queenside = false;
        }
        if (piece.type === 'rook') {
            if (fromCol === 0) this.castlingRights[piece.color].queenside = false;
            if (fromCol === 7) this.castlingRights[piece.color].kingside = false;
        }

        // Realizar el movimiento
        if (capturedPiece) {
            this.capturedPieces[this.currentTurn].push(capturedPiece.piece);
        }

        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        // Promoción de peón
        if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
            this.promotePawn(toRow, toCol);
        }

        // Cambiar turno
        this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';

        // Verificar fin del juego
        if (this.isCheckmate()) {
            this.gameOver = true;
            return { status: 'checkmate', winner: piece.color };
        }
        if (this.isStalemate()) {
            this.gameOver = true;
            return { status: 'stalemate' };
        }
        if (this.isInCheck(this.currentTurn)) {
            return { status: 'check' };
        }

        return { status: 'normal' };
    }

    promotePawn(row, col) {
        const piece = this.getPiece(row, col);
        // Por defecto, promover a reina
        piece.type = 'queen';
        piece.piece = piece.color === 'white' ? PIECES.WHITE_QUEEN : PIECES.BLACK_QUEEN;
    }

    getMoveNotation(fromRow, fromCol, toRow, toCol, piece, capturedPiece) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const fromSquare = files[fromCol] + (8 - fromRow);
        const toSquare = files[toCol] + (8 - toRow);
        
        let notation = '';
        if (piece.type !== 'pawn') {
            notation += piece.type[0].toUpperCase();
        }
        notation += fromSquare;
        notation += capturedPiece ? 'x' : '-';
        notation += toSquare;
        
        return notation;
    }

    getBoardState() {
        return JSON.parse(JSON.stringify(this.board));
    }

    toFEN() {
        let fen = '';
        
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
        
        fen += ' ' + (this.currentTurn === 'white' ? 'w' : 'b');
        
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
}

