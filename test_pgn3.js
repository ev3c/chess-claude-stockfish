const { ChessGame } = require('./chess-logic-test.js');

// Test: ¿La notación generada por getMoveNotation es correcta?
// Especialmente para capturas en passant y desambiguación de piezas

const game = new ChessGame();

// Simular una partida con en passant
const moves = [
    { from: [6,4], to: [4,4] },  // 1. e4
    { from: [1,3], to: [3,3] },  // 1... d5
    { from: [4,4], to: [3,3] },  // 2. exd5
    { from: [1,2], to: [3,2] },  // 2... c5
    { from: [3,3], to: [2,2] },  // 3. dxc6 (en passant? no, d5 takes c6 e.p.)
];

// Actually let's test real en passant
const game2 = new ChessGame();
const enPassantMoves = [
    { from: [6,4], to: [4,4] },  // 1. e4
    { from: [1,0], to: [2,0] },  // 1... a6
    { from: [4,4], to: [3,4] },  // 2. e5
    { from: [1,3], to: [3,3] },  // 2... d5 (double pawn move, sets en passant)
    { from: [3,4], to: [2,3] },  // 3. exd6 (en passant capture!)
];

console.log('--- Test en passant notation ---');
for (const move of enPassantMoves) {
    const piece = game2.getPiece(move.from[0], move.from[1]);
    console.log(`Turn: ${game2.currentTurn}, Moving ${piece?.type} from (${move.from}) to (${move.to})`);
    const result = game2.makeMove(move.from[0], move.from[1], move.to[0], move.to[1]);
    if (result) {
        console.log(`  Notation: "${game2.moveHistory[game2.moveHistory.length - 1]}"`);
    } else {
        console.log(`  FAILED!`);
        // Check valid moves for the piece
        const validMoves = game2.getValidMoves(move.from[0], move.from[1]);
        console.log(`  Valid moves: ${validMoves.map(m => `(${m.row},${m.col})`).join(', ')}`);
    }
}

console.log(`\nFull moveHistory: ${game2.moveHistory}`);

// Now check if the notation can be re-parsed
console.log('\n--- Re-parsing exported notation ---');
const game3 = new ChessGame();
for (let i = 0; i < game2.moveHistory.length; i++) {
    const san = game2.moveHistory[i];
    // Simular parseSANMove
    const color = game3.currentTurn;
    let s = san.replace(/[+#!?]/g, '');
    
    const files = 'abcdefgh';
    const pieceMap = { 'K': 'king', 'Q': 'queen', 'R': 'rook', 'B': 'bishop', 'N': 'knight' };
    let pieceType = 'pawn';
    let disambigFile = -1;
    let disambigRank = -1;
    let promotion = null;
    
    const promoMatch = s.match(/=?([QRBN])$/);
    if (promoMatch) { promotion = promoMatch[1]; s = s.replace(/=?[QRBN]$/, ''); }
    
    if (s === 'O-O' || s === '0-0' || s === 'O-O-O' || s === '0-0-0') {
        console.log(`  Move ${i+1} "${san}": castling OK`);
        const row = color === 'white' ? 7 : 0;
        const toCol = (s === 'O-O' || s === '0-0') ? 6 : 2;
        game3.makeMove(row, 4, row, toCol);
        continue;
    }
    
    if (s[0] && pieceMap[s[0]]) { pieceType = pieceMap[s[0]]; s = s.substring(1); }
    s = s.replace('x', '');
    
    if (s.length < 2) { console.log(`  Move ${i+1} "${san}": TOO SHORT after parse (s="${s}")`); continue; }
    
    const toFile = files.indexOf(s[s.length - 2]);
    const toRank = 8 - parseInt(s[s.length - 1]);
    
    const disambig = s.substring(0, s.length - 2);
    for (const ch of disambig) {
        if (files.includes(ch)) disambigFile = files.indexOf(ch);
        else if (ch >= '1' && ch <= '8') disambigRank = 8 - parseInt(ch);
    }
    
    let found = false;
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = game3.getPiece(row, col);
            if (!piece || piece.color !== color || piece.type !== pieceType) continue;
            if (disambigFile >= 0 && col !== disambigFile) continue;
            if (disambigRank >= 0 && row !== disambigRank) continue;
            const validMoves = game3.getValidMoves(row, col);
            if (validMoves.some(m => m.row === toRank && m.col === toFile)) {
                console.log(`  Move ${i+1} "${san}": found ${piece.type} at (${row},${col}) → (${toRank},${toFile})`);
                const promoMap = { 'Q': 'queen', 'R': 'rook', 'B': 'bishop', 'N': 'knight' };
                game3.makeMove(row, col, toRank, toFile, promotion ? promoMap[promotion] : undefined);
                found = true;
                break;
            }
        }
        if (found) break;
    }
    if (!found) {
        console.log(`  Move ${i+1} "${san}": PARSE FAILED! Looking for ${pieceType} to go to (${toRank},${toFile})`);
        console.log(`  Disambig: file=${disambigFile}, rank=${disambigRank}`);
        // Show all pieces of this type
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = game3.getPiece(row, col);
                if (piece && piece.color === color && piece.type === pieceType) {
                    const vm = game3.getValidMoves(row, col);
                    console.log(`    ${piece.type} at (${row},${col}): moves=${vm.map(m => `(${m.row},${m.col})`).join(',')}`);
                }
            }
        }
        break;
    }
}
