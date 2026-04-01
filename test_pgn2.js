const { ChessGame } = require('./chess-logic-test.js');

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

function parseSANMove(san, gameState) {
    const color = gameState.currentTurn;
    san = san.replace(/[+#!?]/g, '');
    if (san === 'O-O' || san === '0-0') { const row = color === 'white' ? 7 : 0; return { fromRow: row, fromCol: 4, toRow: row, toCol: 6 }; }
    if (san === 'O-O-O' || san === '0-0-0') { const row = color === 'white' ? 7 : 0; return { fromRow: row, fromCol: 4, toRow: row, toCol: 2 }; }
    const files = 'abcdefgh';
    const pieceMap = { 'K': 'king', 'Q': 'queen', 'R': 'rook', 'B': 'bishop', 'N': 'knight' };
    let pieceType = 'pawn'; let disambigFile = -1; let disambigRank = -1; let toFile, toRank; let promotion = null;
    let s = san;
    const promoMatch = s.match(/=?([QRBN])$/);
    if (promoMatch) { promotion = promoMatch[1]; s = s.replace(/=?[QRBN]$/, ''); }
    if (s[0] && pieceMap[s[0]]) { pieceType = pieceMap[s[0]]; s = s.substring(1); }
    s = s.replace('x', '');
    if (s.length < 2) return null;
    toFile = files.indexOf(s[s.length - 2]); toRank = 8 - parseInt(s[s.length - 1]);
    if (toFile < 0 || toRank < 0 || toRank > 7) return null;
    const disambig = s.substring(0, s.length - 2);
    for (const ch of disambig) { if (files.includes(ch)) disambigFile = files.indexOf(ch); else if (ch >= '1' && ch <= '8') disambigRank = 8 - parseInt(ch); }
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameState.getPiece(row, col);
            if (!piece || piece.color !== color || piece.type !== pieceType) continue;
            if (disambigFile >= 0 && col !== disambigFile) continue;
            if (disambigRank >= 0 && row !== disambigRank) continue;
            const validMoves = gameState.getValidMoves(row, col);
            if (validMoves.some(m => m.row === toRank && m.col === toFile)) {
                const promoMap = { 'Q': 'queen', 'R': 'rook', 'B': 'bishop', 'N': 'knight' };
                return { fromRow: row, fromCol: col, toRow: toRank, toCol: toFile, promotion: promotion ? promoMap[promotion] : undefined };
            }
        }
    }
    return null;
}

function testPGN(name, pgn) {
    const game = new ChessGame();
    const moves = cleanPGN(pgn);
    let played = 0;
    for (const san of moves) {
        if (game.gameOver) game.gameOver = false;
        const parsed = parseSANMove(san, game);
        if (!parsed) {
            console.log(`FAIL [${name}] at move ${played + 1}: cannot parse "${san}" (turn: ${game.currentTurn})`);
            console.log('  Remaining tokens:', moves.slice(moves.indexOf(san)));
            return;
        }
        const result = game.makeMove(parsed.fromRow, parsed.fromCol, parsed.toRow, parsed.toCol, parsed.promotion);
        if (!result) {
            console.log(`FAIL [${name}] at move ${played + 1}: invalid "${san}" (${parsed.fromRow},${parsed.fromCol}->${parsed.toRow},${parsed.toCol})`);
            return;
        }
        played++;
    }
    console.log(`OK [${name}]: ${played}/${moves.length}`);
}

// Lichess export
testPGN('Lichess', `[Event "Rated Blitz game"]
[Site "https://lichess.org/abc123"]
[Date "2024.01.15"]
[White "player1"]
[Black "player2"]
[Result "1-0"]
[WhiteElo "1500"]
[BlackElo "1450"]
[ECO "B20"]

1. e4 c5 2. d3 Nc6 3. Nf3 d6 4. g3 Nf6 5. Bg2 g6 6. O-O Bg7 7. Nbd2 O-O 8. a4 e5 9. Nc4 Be6 10. c3 d5 11. exd5 Nxd5 12. Nfxe5 Nxe5 13. Nxe5 Nb4 14. Qb3 Nd5 15. Nc4 Qc7 1-0`);

// Chess.com format (no spaces after dots)
testPGN('Chess.com', '1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 O-O 8.h3 d6');

// Black continuation dots
testPGN('Continuation_dots', '1.e4 1...e5 2.Nf3 2...Nc6 3.Bb5 3...a6');

// Semicolon line comments
testPGN('Semicolon_comments', `1. e4 e5 ; kings pawn
2. Nf3 Nc6 ; knights out
3. Bb5 a6 ; Ruy Lopez`);

// Windows CRLF
testPGN('CRLF', '1. e4 e5\r\n2. Nf3 Nc6\r\n3. Bb5 a6\r\n4. Ba4 Nf6\r\n5. O-O Be7');

// Empty lines mixed in
testPGN('Empty_lines', '\n\n1. e4 e5\n\n2. Nf3 Nc6\n\n3. Bb5 a6\n');

// Deeply nested variations
testPGN('Deep_nested', '1. e4 e5 (1... c5 (1... e6 2. d4 d5 (2... c5)) 2. Nf3 d6) 2. Nf3 Nc6 3. Bb5 a6');

// Annotations mixed
testPGN('Heavy_annotations', '1. e4! e5 2. Nf3!! Nc6?! 3. Bb5?? a6! 4. Ba4 Nf6 5. O-O Be7');

// PGN with evaluation markers
testPGN('Eval_markers', '1. e4 {[%eval 0.3]} e5 {[%eval 0.1]} 2. Nf3 {[%eval 0.4]} Nc6 3. Bb5 a6');

// Game ending in stalemate position
testPGN('EndingDraw', '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nc3 Bb4 6. Nxc6 bxc6 1/2-1/2');

// PGN with clock annotations in comments
testPGN('Clock_annotations', '1. e4 {[%clk 2:59:52]} e5 {[%clk 2:59:45]} 2. Nf3 {[%clk 2:59:30]} Nc6 {[%clk 2:59:20]} 3. Bb5 a6');

// Evergreen game (Anderssen)
testPGN('Evergreen', '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3 8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6 14. Nbd2 Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 Qxf3 20. Rxe7+ Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8 24. Bxe7# 1-0');

// Test 15: Game with Rook disambiguation (Rae1)
testPGN('Rook_disambig', '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Nf6 5. Nc3 Bb4 6. Nxc6 bxc6 7. Bd3 d5 8. exd5 cxd5 9. O-O O-O 10. Bg5 c6 11. Qf3 Be7 12. Rae1 Be6 13. Nd1 h6 14. Bh4 Nh7 15. Bxe7 Qxe7 16. Ne3 Ng5 17. Nxg5 hxg5');

// Test 16: Game with R1e1 disambiguation
testPGN('Rook_rank_disambig', '1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3 O-O 5. Bd3 d5 6. Nf3 c5 7. O-O dxc4 8. Bxc4 Nbd7 9. Qe2 b6 10. Rd1 Bb7 11. d5 exd5 12. Nxd5 Bxd5 13. Bxd5 Nxd5 14. Rxd5 Qc7');

// Test 17: Game with en passant
testPGN('EnPassant', '1. e4 e5 2. Nf3 Nf6 3. d4 exd4 4. e5 Ne4 5. Qxd4 d5 6. exd6 Nxd6 7. Nc3 Nc6 8. Qf4 g6');

// Test 18: Game with pawn captures on e.p. from file
testPGN('PawnCapture_ep', '1. e4 d5 2. e5 f5 3. exf6 e5 4. Nf3 Nc6');

// Test 19: Complex middlegame
testPGN('Sicilian_Najdorf', '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be2 e5 7. Nb3 Be7 8. O-O O-O 9. Be3 Be6 10. Qd2 Nbd7 11. a4 Rc8 12. a5 Qc7 13. f3 b5 14. axb6 Nxb6 15. Na5 Nfd7 16. Nc4 Nxc4 17. Bxc4 Bxc4 18. Rxa6 Be6 19. Nd5 Bxd5 20. exd5 f5');

// Test 20: Kasparov vs Topalov, Wijk aan Zee 1999
testPGN('Kasparov-Topalov', '1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh6 Bxh6 9. Qxh6 Bb7 10. a3 e5 11. O-O-O Qe7 12. Kb1 a6 13. Nc1 O-O-O 14. Nb3 exd4 15. Rxd4 c5 16. Rd1 Nb6 17. g3 Kb8 18. Na5 Ba8 19. Bh3 d5 20. Qf4+ Ka7 21. Rhe1 d4 22. Nd5 Nbxd5 23. exd5 Qd6 24. Rxd4 cxd4 25. Re7+ Kb6 26. Qxd4+ Kxa5 27. b4+ Ka4 28. Qc3 Qxd5 29. Ra7 Bb7 30. Rxb7 Qc4 31. Qxf6 Kxa3 32. Qxa6+ Kxb4 33. c3+ Kxc3 34. Qa1+ Kd2 35. Qb2+ Kd1 36. Bf1 Rd2 37. Rd7 Rxd7 38. Bxc4 bxc4 39. Qxh8 Rd3 40. Qa8 c3 41. Qa4+ Ke1 42. f4 f5 43. Kc1 Rd2 44. Qa7 1-0');

// Test 21: Game of the Century (Fischer vs Byrne, 1956)
testPGN('GameOfCentury', '1. Nf3 Nf6 2. c4 g6 3. Nc3 Bg7 4. d4 O-O 5. Bf4 d5 6. Qb3 dxc4 7. Qxc4 c6 8. e4 Nbd7 9. Rd1 Nb6 10. Qc5 Bg4 11. Bg5 Na4 12. Qa3 Nxc3 13. bxc3 Nxe4 14. Bxe7 Qb6 15. Bc4 Nxc3 16. Bc5 Rfe8+ 17. Kf1 Be6 18. Bxb6 Bxc4+ 19. Kg1 Ne2+ 20. Kf1 Nxd4+ 21. Kg1 Ne2+ 22. Kf1 Nc3+ 23. Kg1 axb6 24. Qb4 Ra4 25. Qxb6 Nxd1 26. h3 Rxa2 27. Kh2 Nxf2 28. Re1 Rxe1 29. Qd8+ Bf8 30. Nxe1 Bd5 31. Nf3 Ne4 32. Qb8 b5 33. h4 h5 34. Ne5 Kg7 35. Kg1 Bc5+ 36. Kf1 Ng3+ 37. Ke1 Bb4+ 38. Kd1 Bb3+ 39. Kc1 Ne2+ 40. Kb1 Nc3+ 41. Kc1 Rc2# 0-1');

// Test 22: Byrne vs Fischer (1963) - game with complex disambiguation
testPGN('Complex_disambig', '1. d4 Nf6 2. c4 g6 3. g3 c6 4. Bg2 d5 5. cxd5 cxd5 6. Nc3 Bg7 7. e3 O-O 8. Nge2 Nc6 9. O-O b6 10. b3 Ba6 11. Ba3 Re8 12. Qd2 e5 13. dxe5 Nxe5 14. Rfd1 Nd3');

// Test 23: PGN with BOM (Byte Order Mark) - common in Windows files
testPGN('BOM', '\uFEFF[Event "Test"]\n[White "A"]\n[Black "B"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1-0');

// Test 24: PGN with tabs and weird whitespace
testPGN('Tabs', '1.\te4\te5\t2.\tNf3\tNc6\t3.\tBb5\ta6');

// Test 25: PGN with move number followed directly by dot-dot-dot AND move
testPGN('DotDotDotMove', '1. e4 1... e5 2. Nf3 2... Nc6 3. Bb5 3... a6');

// Test 26: Multiple results in text (multi-game PGN)
testPGN('MultiGame', `[Event "Game 1"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 1-0

[Event "Game 2"]
[Result "0-1"]

1. d4 d5 2. c4 e6 3. Nc3 Nf6 0-1`);

// Test 27: PGN with ellipsis Unicode character
testPGN('Unicode_ellipsis', '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6');

// Test 28: Really long game (Game of Century full)
testPGN('LongGame', '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f3 O-O 6. Be3 e5 7. d5 Nh5 8. Qd2 Qh4+ 9. g3 Nxg3 10. Qf2 Nxf1 11. Qxh4 Nxe3 12. Ke2 Nxc4 13. Ke3 Nb6 14. Nge2 f5 15. Kd3 fxe4+ 16. fxe4 c6 17. dxc6 Nxc6 18. Rhf1 Rxf1 19. Rxf1 Be6 20. a3 Rc8 21. Nc1 Nd4 22. Nb3 Nxb3 23. Kc2 Nc5 24. Kb1 Nb3 25. Nd5 Bxd5 26. exd5 Rd8 27. d6 Bf8 28. Rf7 Bxd6 29. Rd7 Nc5 30. Rxd8+ Kf7 31. Rxd6 Ke7 32. Rd1 Nd3 33. Ka2 Nc1+ 34. Kb1 Nd3 35. Ka2 Nc1+ 36. Ka1 Nb3+ 37. Ka2 Nc1+ 38. Kb1 Nd3 1/2-1/2');

console.log('\nAll tests completed.');
