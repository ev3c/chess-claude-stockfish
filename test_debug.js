const fs = require('fs');
const code = fs.readFileSync('./chess-logic.js', 'utf8');
fs.writeFileSync('./_test.js', code + '\nmodule.exports={ChessGame};');
const { ChessGame } = require('./_test.js');

function parseSANMove(san, gameState, allCandidates) {
    const color = gameState.currentTurn;
    san = san.replace(/[+#!?]/g, '');
    if (san === 'O-O' || san === '0-0') { const row = color === 'white' ? 7 : 0; return { fromRow: row, fromCol: 4, toRow: row, toCol: 6 }; }
    if (san === 'O-O-O' || san === '0-0-0') { const row = color === 'white' ? 7 : 0; return { fromRow: row, fromCol: 4, toRow: row, toCol: 2 }; }
    const files = 'abcdefgh';
    const pieceMap = { 'K': 'king', 'Q': 'queen', 'R': 'rook', 'B': 'bishop', 'N': 'knight' };
    let pieceType = 'pawn'; let dF = -1; let dR = -1; let promotion = null;
    let s = san;
    const pm = s.match(/=?([QRBN])$/);
    if (pm) { promotion = pm[1]; s = s.replace(/=?[QRBN]$/, ''); }
    if (s[0] && pieceMap[s[0]]) { pieceType = pieceMap[s[0]]; s = s.substring(1); }
    s = s.replace('x', '');
    if (s.length < 2) return null;
    const toFile = files.indexOf(s[s.length - 2]); const toRank = 8 - parseInt(s[s.length - 1]);
    if (toFile < 0 || toRank < 0 || toRank > 7) return null;
    const disambig = s.substring(0, s.length - 2);
    for (const ch of disambig) { if (files.includes(ch)) dF = files.indexOf(ch); else if (ch >= '1' && ch <= '8') dR = 8 - parseInt(ch); }
    const promoMap = { 'Q': 'queen', 'R': 'rook', 'B': 'bishop', 'N': 'knight' };
    const candidates = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameState.getPiece(row, col);
            if (!piece || piece.color !== color || piece.type !== pieceType) continue;
            if (dF >= 0 && col !== dF) continue;
            if (dR >= 0 && row !== dR) continue;
            const validMoves = gameState.getValidMoves(row, col);
            if (validMoves.some(m => m.row === toRank && m.col === toFile)) {
                candidates.push({ fromRow: row, fromCol: col, toRow: toRank, toCol: toFile, promotion: promotion ? promoMap[promotion] : undefined });
            }
        }
    }
    if (allCandidates) allCandidates.push(...candidates);
    return candidates[0] || null;
}

function cleanPGN(pgnText) {
    let movesText = pgnText
        .replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        .replace(/\[.*?\]\s*/g, '')
        .replace(/\{[^}]*\}/g, '')
        .replace(/;.*$/gm, '')
        .replace(/\$\d+/g, '');
    let prev;
    do { prev = movesText; movesText = movesText.replace(/\([^()]*\)/g, ''); } while (movesText !== prev);
    movesText = movesText.replace(/\d+\.\.\./g, '').trim();
    movesText = movesText.replace(/\s*(1-0|0-1|1\/2-1\/2|\*)\s*$/, '').trim();
    return movesText
        .split(/\s+/)
        .filter(token => token && !token.match(/^\d+\.?$/) && !token.match(/^\$/) && !token.match(/^(1-0|0-1|1\/2-1\/2|\*)$/))
        .map(m => m.replace(/^\d+\./, ''))
        .filter(m => m.length > 0 && m.match(/^[a-hKQRBNO0]/));
}

function testWithBacktracking(name, pgnText) {
    const game = new ChessGame();
    const moves = cleanPGN(pgnText);
    let movesPlayed = 0;
    const ambiguousHistory = [];

    for (let mi = 0; mi < moves.length; mi++) {
        const sanMove = moves[mi];
        if (game.gameOver) game.gameOver = false;

        const candidates = [];
        const parsed = parseSANMove(sanMove, game, candidates);

        if (!parsed) {
            let recovered = false;
            for (let bi = ambiguousHistory.length - 1; bi >= 0 && !recovered; bi--) {
                const entry = ambiguousHistory[bi];
                if (entry.triedIndex >= entry.candidates.length - 1) continue;

                const undoCount = movesPlayed - entry.moveIndex;
                for (let u = 0; u < undoCount; u++) {
                    game.undoMove();
                    movesPlayed--;
                }

                entry.triedIndex++;
                const altParsed = entry.candidates[entry.triedIndex];
                if (game.gameOver) game.gameOver = false;
                const altResult = game.makeMove(altParsed.fromRow, altParsed.fromCol, altParsed.toRow, altParsed.toCol, altParsed.promotion);
                if (altResult) {
                    movesPlayed++;
                    ambiguousHistory.length = bi + 1;
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
                        console.log(`  [backtrack at move ${entry.moveIndex + 1}, tried candidate ${entry.triedIndex + 1}/${entry.candidates.length}]`);
                        recovered = true;
                    }
                }
            }
            if (!recovered) {
                console.log(`FAIL [${name}] at ${movesPlayed + 1}: "${sanMove}"`);
                return movesPlayed;
            }
            continue;
        }

        const result = game.makeMove(parsed.fromRow, parsed.fromCol, parsed.toRow, parsed.toCol, parsed.promotion);
        if (!result) {
            console.log(`FAIL [${name}] at ${movesPlayed + 1}: invalid "${sanMove}"`);
            return movesPlayed;
        }
        movesPlayed++;

        if (candidates.length > 1) {
            ambiguousHistory.push({ moveIndex: movesPlayed - 1, tokenIndex: mi, candidates, triedIndex: 0 });
        }
    }

    console.log(`OK [${name}]: ${movesPlayed}/${moves.length}`);
    return movesPlayed;
}

// Test with the problematic file
const pgn = fs.readFileSync('./pgn/partida_2026-03-21_2139-intermedio.pgn', 'utf8');
testWithBacktracking('intermedio', pgn);

// Test other files
const files = fs.readdirSync('./pgn').filter(f => f.endsWith('.pgn'));
for (const f of files) {
    if (f.includes('2139')) continue;
    const content = fs.readFileSync(`./pgn/${f}`, 'utf8');
    testWithBacktracking(f, content);
}

// Also test known games
testWithBacktracking('Fischer-Pomar', '1. e4 c5 2. Nf3 Nf6 3. Nc3 d5 4. Bb5+ Bd7 5. e5 d4 6. exf6 dxc3 7. fxg7 cxd2+ 8. Qxd2 Bxg7 9. Qg5 Bf6 10. Bxd7+ Nxd7 11. Qh5 Qa5+ 12. Nd2 Qa6 13. Ne4 O-O-O 14. Qe2 Qe6 15. Nxf6 Qxe2+ 16. Kxe2 Nxf6 17. Be3 b6 18. Rad1 Rxd1 19. Rxd1 Rd8 20. Rxd8+ Kxd8 21. Kf3 Kd7 1/2-1/2');
testWithBacktracking('Opera', '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0');

fs.unlinkSync('./_test.js');
console.log('\nDone!');
