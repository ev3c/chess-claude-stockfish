// Test de importación PGN usando el motor de ajedrez real
const { ChessGame } = require('./chess-logic-test.js');

function parseSANMove(san, gameState) {
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

function testPGN(name, pgnMoves) {
    const game = new ChessGame();
    const moves = cleanPGN(pgnMoves);

    let played = 0;
    for (const san of moves) {
        if (game.gameOver) game.gameOver = false;
        const parsed = parseSANMove(san, game);
        if (!parsed) {
            console.log(`FAIL [${name}] at move ${played + 1}: cannot parse "${san}" (turn: ${game.currentTurn})`);
            return played;
        }
        const result = game.makeMove(parsed.fromRow, parsed.fromCol, parsed.toRow, parsed.toCol, parsed.promotion);
        if (!result) {
            console.log(`FAIL [${name}] at move ${played + 1}: invalid move "${san}" (${parsed.fromRow},${parsed.fromCol}->${parsed.toRow},${parsed.toCol}, turn: ${game.currentTurn})`);
            return played;
        }
        played++;
    }
    console.log(`OK [${name}]: ${played}/${moves.length} moves played`);
    return played;
}

// Test 1: Ruy Lopez simple
testPGN('Ruy Lopez', '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7');

// Test 2: Fischer game (from 365chess)
testPGN('Fischer-Pomar', '1. e4 c5 2. Nf3 Nf6 3. Nc3 d5 4. Bb5+ Bd7 5. e5 d4 6. exf6 dxc3 7. fxg7 cxd2+ 8. Qxd2 Bxg7 9. Qg5 Bf6 10. Bxd7+ Nxd7 11. Qh5 Qa5+ 12. Nd2 Qa6 13. Ne4 O-O-O 14. Qe2 Qe6 15. Nxf6 Qxe2+ 16. Kxe2 Nxf6 17. Be3 b6 18. Rad1 Rxd1 19. Rxd1 Rd8 20. Rxd8+ Kxd8 21. Kf3 Kd7 22. Kf4 Ng8 23. c4 f6 24. Ke4 e6 25. Bd2 Ne7 26. Bc3 Ng8 27. g4 Ke7 28. f4 h6 29. f5 exf5+ 30. gxf5 h5 31. Bd2 Kd7 32. a4 Ne7 33. Bc3 Ng8 34. Kf4 Ke7 35. b4 cxb4 36. Bxb4+ Kd7 37. Bf8 Ke8 38. Bd6 Kd7 39. c5 bxc5 40. Bxc5 a6 41. Ke4 Kc6 42. Bf8 Kd7 43. h3 Ke8 44. Bc5 Kd7 45. Bd4 Kd6 46. Bb2 Kc6 47. Bc3 Kd6 48. Bb4+ Kd7 49. a5 Nh6 50. Bc3 Ng8 51. Bb4 Nh6 52. Bc3 Ng8 53. Kd5 Ne7+ 54. Kc5 Nxf5 55. Bxf6 Ke6 56. Bg5 Nd6 57. Kb6 Kd5 58. Kxa6 Kc6 59. Bd2 Ne4 60. Bb4 Nf6 61. Ka7 Nd7 62. a6 Kc7 63. Ba5+ Kc6 64. Be1 Nc5 65. Bf2 Nd7 66. Bh4 Nc5 67. Be7 Nd7 68. Ba3 Kc7 69. Bb2 Kc6 70. Bd4 Kc7 71. Bg7 Kc6 72. Ba1 Nc5 73. Bd4 Nd7 74. Be3 Kc7 75. Bf4+ Kc6 76. Ka8 Kb6 77. a7 Kc6 1/2-1/2');

// Test 3: Game with promotion
testPGN('Promotion', '1. e4 e5 2. Nf3 Nf6 3. Nc3 Nc6 4. d3 d6 5. Bg5 Be7 6. Qd2 O-O 7. O-O-O Be6 8. a3 Rb8 9. d4 exd4 10. Nxd4 Nxe4 11. Nxe4 Bxg5 12. Nxg5 Nxd4 13. Nxf7 Qf6 14. c3 Qxf7 15. cxd4 Qxf2 16. g3 Qxd2+ 17. Rxd2 Re8 18. Bg2 b6 19. Re1 a6 20. Re2 Kf7 21. Bc6 d5 22. Bxe8+ Rxe8 23. Kc2 Kf6 24. Kc3 b5 25. Kb4 h6 26. b3 Re7 27. a4 bxa4 28. bxa4 Kf5 29. Ka5 Re8 30. Kxa6 Bc8+ 31. Kb5 Rxe2 32. Rxe2 Bd7+ 33. Kb4 Kf6 34. a5 Bf5 35. a6 Bd3 36. Ka5 Bxe2 37. a7 Ke6 38. a8=Q Bc4 39. Qg8+ Kf5 40. Qxg7 Ke4 41. Qg4+ Ke3 42. Qf4+ Kd3 43. h4 Kc3 44. g4 Kd3 45. h5 Kc3 46. Qe3+ Bd3 47. Qe5 Kc4 48. Ka4 Bc2+ 49. Ka3 Bb1 50. Kb2 Bd3 51. Kc1 c5 52. dxc5 Be4 53. c6 Kc5 54. c7 Bf5 55. Qxf5 Kd6 56. Qf7 d4 57. c8=Q d3 58. Kd2 Ke5 59. Qh8+ Kd6 60. Qe8 Kc5 61. Qd7 Kb4 62. Qc8 Kb5 63. Qb7+ Ka4 64. Qa8+');

// Test 4: Kasparov - Deep Blue (Game 6, 1997) - complex game
testPGN('Kasparov-DeepBlue', '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nd7 5. Ng5 Ngf6 6. Bd3 e6 7. N1f3 h6 8. Nxe6 Qe7 9. O-O fxe6 10. Bg6+ Kd8 11. Bf4 b5 12. a4 Bb7 13. Re1 Nd5 14. Bg3 Kc8 15. axb5 cxb5 16. Qd3 Bc6 17. Bf5 exf5 18. Rxe7 Bxe7 19. c4 1-0');

// Test 5: Immortal Game
testPGN('Immortal', '1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0');

// Test 6: PGN with annotations and comments
testPGN('Annotated', '1. e4 {Best by test} e5 2. Nf3 Nc6 3. Bb5 {Ruy Lopez} a6 4. Ba4 Nf6 5. O-O Be7');

// Test 7: Multi-line PGN with line breaks
testPGN('MultiLine', `1. e4 e5
2. Nf3 Nc6
3. Bb5 a6
4. Ba4 Nf6
5. O-O Be7
6. Re1 b5
7. Bb3 d6`);

// Test 8: PGN with NAG annotations
testPGN('NAG', '1. e4 $1 e5 $2 2. Nf3 $14 Nc6 3. Bb5 a6 $10 4. Ba4 Nf6 5. O-O Be7');

// Test 9: PGN with variations (nested parens)
testPGN('Variations', '1. e4 e5 (1... c5 2. Nf3 (2. c3 d5) 2... d6) 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6');

// Test 10: PGN with continuation dots
testPGN('Continuation', '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d6 9. h3 Na5 10. Bc2 c5 11. d4 Qc7 12. Nbd2 cxd4 13. cxd4 Nc6');

// Test 11: Game that was previously failing (exported from app)
testPGN('AppExport', '1. e4 e6 2. Nf3 Nf6 3. Nc3 Nc6 4. Bc4 d5 5. exd5 exd5 6. Bb3 Be7 7. d4 g6 8. O-O O-O 9. Re1 Re8 10. Bh6 Be6 11. Ng5 Bd6 12. f3 Qd7 13. Nb5 Rd8 14. c3 a6 15. Nxd6 Qxd6 16. Bc2 Re7 17. Bd3 Re8 18. Qb3 Na5 19. Qb4 Qxb4 20. cxb4 c5 21. bxa5 cxd4 22. Nxe6 Rxe6 23. Rxe6 fxe6 24. Bg5 Kf7');

// Test 12: PGN con enroque largo y capturas complejas
testPGN('Complex', '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2 O-O 5. a3 Bxc3+ 6. Qxc3 b6 7. Bg5 Bb7 8. f3 h6 9. Bh4 d5 10. e3 Nbd7 11. cxd5 Nxd5 12. Bxd8 Nxc3 13. Bh4 Nd5 14. Bf2 c5 15. dxc5 Nxc5');

// Test 13: Full PGN file format with headers
testPGN('FullFormat', `[Event "Example"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nc3 Bb4 6. Nxc6 bxc6 7. Bd3 d5 8. exd5 cxd5 9. O-O O-O 10. Bg5 Be6 1-0`);

// Test 14: Opera Game (Morphy)
testPGN('OperaGame', '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7 14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0');

console.log('\nDone.');
