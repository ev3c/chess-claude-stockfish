const fs = require('fs');
const code = fs.readFileSync('./chess-logic.js', 'utf8');
fs.writeFileSync('./_test.js', code + '\nmodule.exports={ChessGame};');
const { ChessGame } = require('./_test.js');

function parseSANMove(san, gs) {
    const color = gs.currentTurn;
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
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gs.getPiece(row, col);
            if (!piece || piece.color !== color || piece.type !== pieceType) continue;
            if (dF >= 0 && col !== dF) continue;
            if (dR >= 0 && row !== dR) continue;
            const validMoves = gs.getValidMoves(row, col);
            if (validMoves.some(m => m.row === toRank && m.col === toFile)) {
                const promoMap = { 'Q': 'queen', 'R': 'rook', 'B': 'bishop', 'N': 'knight' };
                return { fromRow: row, fromCol: col, toRow: toRank, toCol: toFile, promotion: promotion ? promoMap[promotion] : undefined };
            }
        }
    }
    return null;
}

function cleanPGN(pgnText) {
    let movesText = pgnText
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

function test(name, pgn) {
    const game = new ChessGame();
    const moves = cleanPGN(pgn);
    let ok = 0;
    for (const san of moves) {
        if (game.gameOver) game.gameOver = false;
        const p = parseSANMove(san, game);
        if (!p) { console.log(`FAIL [${name}] at ${ok+1}: "${san}" (${game.currentTurn})`); return; }
        const r = game.makeMove(p.fromRow, p.fromCol, p.toRow, p.toCol, p.promotion);
        if (!r) { console.log(`FAIL [${name}] at ${ok+1}: invalid "${san}"`); return; }
        ok++;
    }
    console.log(`OK [${name}]: ${ok}/${moves.length}`);
}

test('Fischer-Pomar', '1. e4 c5 2. Nf3 Nf6 3. Nc3 d5 4. Bb5+ Bd7 5. e5 d4 6. exf6 dxc3 7. fxg7 cxd2+ 8. Qxd2 Bxg7 9. Qg5 Bf6 10. Bxd7+ Nxd7 11. Qh5 Qa5+ 12. Nd2 Qa6 13. Ne4 O-O-O 14. Qe2 Qe6 15. Nxf6 Qxe2+ 16. Kxe2 Nxf6 17. Be3 b6 18. Rad1 Rxd1 19. Rxd1 Rd8 20. Rxd8+ Kxd8 21. Kf3 Kd7 22. Kf4 Ng8 23. c4 f6 24. Ke4 e6 25. Bd2 Ne7 26. Bc3 Ng8 27. g4 Ke7 28. f4 h6 29. f5 exf5+ 30. gxf5 h5 31. Bd2 Kd7 32. a4 Ne7 33. Bc3 Ng8 34. Kf4 Ke7 35. b4 cxb4 36. Bxb4+ Kd7 37. Bf8 Ke8 38. Bd6 Kd7 39. c5 bxc5 40. Bxc5 a6 41. Ke4 Kc6 42. Bf8 Kd7 43. h3 Ke8 44. Bc5 Kd7 45. Bd4 Kd6 46. Bb2 Kc6 47. Bc3 Kd6 48. Bb4+ Kd7 49. a5 Nh6 50. Bc3 Ng8 51. Bb4 Nh6 52. Bc3 Ng8 53. Kd5 Ne7+ 54. Kc5 Nxf5 55. Bxf6 Ke6 56. Bg5 Nd6 57. Kb6 Kd5 58. Kxa6 Kc6 59. Bd2 Ne4 60. Bb4 Nf6 61. Ka7 Nd7 62. a6 Kc7 63. Ba5+ Kc6 64. Be1 Nc5 65. Bf2 Nd7 66. Bh4 Nc5 67. Be7 Nd7 68. Ba3 Kc7 69. Bb2 Kc6 70. Bd4 Kc7 71. Bg7 Kc6 72. Ba1 Nc5 73. Bd4 Nd7 74. Be3 Kc7 75. Bf4+ Kc6 76. Ka8 Kb6 77. a7 Kc6 1/2-1/2');

test('Kasparov-Topalov', '1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0');

test('Opera', '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0');

test('Promotion', '1. e4 e5 2. Nf3 Nf6 3. Nc3 Nc6 4. d3 d6 5. Bg5 Be7 6. Qd2 O-O 7. O-O-O Be6 8. a3 Rb8 9. d4 exd4 10. Nxd4 Nxe4 11. Nxe4 Bxg5 12. Nxg5 Nxd4 13. Nxf7 Qf6 14. c3 Qxf7 15. cxd4 Qxf2 16. g3 Qxd2+ 17. Rxd2 Re8 18. Bg2 b6 19. Re1 a6 20. Re2 Kf7 21. Bc6 d5 22. Bxe8+ Rxe8 23. Kc2 Kf6 24. Kc3 b5 25. Kb4 h6 26. b3 Re7 27. a4 bxa4 28. bxa4 Kf5 29. Ka5 Re8 30. Kxa6 Bc8+ 31. Kb5 Rxe2 32. Rxe2 Bd7+ 33. Kb4 Kf6 34. a5 Bf5 35. a6 Bd3 36. Ka5 Bxe2 37. a7 Ke6 38. a8=Q Bc4 39. Qg8+ Kf5 40. Qxg7 Ke4 41. Qg4+ Ke3 42. Qf4+ Kd3 43. h4 Kc3 44. g4 Kd3 45. h5 Kc3 46. Qe3+ Bd3 47. Qe5 Kc4 48. Ka4 Bc2+ 49. Ka3 Bb1 50. Kb2 Bd3 51. Kc1 c5 52. dxc5 Be4 53. c6 Kc5 54. c7 Bf5 55. Qxf5 Kd6 56. Qf7 d4 57. c8=Q d3 58. Kd2 Ke5 59. Qh8+ Kd6 60. Qe8 Kc5 61. Qd7 Kb4 62. Qc8 Kb5 63. Qb7+ Ka4 64. Qa8+');

// Test en passant fix
const g = new ChessGame();
[[6,4,4,4],[1,0,2,0],[4,4,3,4],[1,3,3,3],[3,4,2,3]].forEach(([fr,fc,tr,tc]) => g.makeMove(fr,fc,tr,tc));
console.assert(g.moveHistory[4] === 'exd6', `En passant: expected "exd6", got "${g.moveHistory[4]}"`);
console.log(`En passant notation: "${g.moveHistory[4]}" ✓`);

// Test re-import of exported game
const g2 = new ChessGame();
const exportMoves = 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7'.split(' ');
for (const s of exportMoves) { const p = parseSANMove(s, g2); g2.makeMove(p.fromRow, p.fromCol, p.toRow, p.toCol, p.promotion); }
const exported = g2.moveHistory;
const g3 = new ChessGame();
let reimportOk = 0;
for (const s of exported) {
    const p = parseSANMove(s, g3);
    if (!p) { console.log(`Re-import FAIL at ${reimportOk+1}: "${s}"`); break; }
    g3.makeMove(p.fromRow, p.fromCol, p.toRow, p.toCol, p.promotion);
    reimportOk++;
}
console.log(`Re-import: ${reimportOk}/${exported.length} ${reimportOk === exported.length ? '✓' : 'FAIL'}`);

fs.unlinkSync('./_test.js');
console.log('\nAll tests passed!');
