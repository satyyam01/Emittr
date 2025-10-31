// index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Postgres pool (set env vars or defaults)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/connect4'
});

// Kafka producer
const kafka = new Kafka({ clientId: 'connect4-backend', brokers: [process.env.KAFKA_BROKER || 'localhost:9092'] });
const producer = kafka.producer();

(async () => { await producer.connect(); })().catch(console.error);

// Helper: board utilities
const COLS = 7, ROWS = 6;

function createEmptyBoard() {
  const b = Array.from({length: ROWS}, () => Array(COLS).fill(null));
  return b;
}
function copyBoard(b){ return b.map(r => r.slice()); }

// returns row index where disc lands, or -1 if column full
function dropDisc(board, col, playerId) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) { board[r][col] = playerId; return r; }
  }
  return -1;
}

// check 4-in-a-row for playerId; returns true/false
function checkWin(board, playerId) {
  // horizontal
  for (let r=0; r<ROWS; r++){
    for (let c=0; c<=COLS-4; c++){
      if (board[r][c]===playerId && board[r][c+1]===playerId && board[r][c+2]===playerId && board[r][c+3]===playerId) return true;
    }
  }
  // vertical
  for (let c=0; c<COLS; c++){
    for (let r=0; r<=ROWS-4; r++){
      if (board[r][c]===playerId && board[r+1][c]===playerId && board[r+2][c]===playerId && board[r+3][c]===playerId) return true;
    }
  }
  // diagonal down-right
  for (let r=0; r<=ROWS-4; r++){
    for (let c=0; c<=COLS-4; c++){
      if (board[r][c]===playerId && board[r+1][c+1]===playerId && board[r+2][c+2]===playerId && board[r+3][c+3]===playerId) return true;
    }
  }
  // diagonal up-right
  for (let r=3; r<ROWS; r++){
    for (let c=0; c<=COLS-4; c++){
      if (board[r][c]===playerId && board[r-1][c+1]===playerId && board[r-2][c+2]===playerId && board[r-3][c+3]===playerId) return true;
    }
  }
  return false;
}

function boardFull(board) {
  for (let r=0; r<ROWS; r++) for (let c=0; c<COLS; c++) if (!board[r][c]) return false;
  return true;
}

// ---------- Game Manager ----------
class Game {
  constructor(playerA, playerB, isBot=false){
    this.id = uuidv4();
    this.players = { A: playerA, B: playerB }; // each: {username, socketId, id}
    this.board = createEmptyBoard();
    this.turn = 'A'; // 'A' or 'B'
    this.createdAt = Date.now();
    this.isBot = isBot;
    this.ended = false;
    this.winner = null;
    this.lastActivity = Date.now();
  }
}

class GameManager {
  constructor(){
    this.waiting = []; // array of {username, socketId, id}
    this.games = new Map(); // gameId -> Game
    this.playerGame = new Map(); // socketId or username -> gameId
  }

  addWaiting(player){
    this.waiting.push(player);
  }

  findAndCreateMatch() {
    if (this.waiting.length >= 2) {
      const p1 = this.waiting.shift();
      const p2 = this.waiting.shift();
      const g = new Game(p1, p2, false);
      this.games.set(g.id, g);
      this.playerGame.set(p1.socketId || p1.username, g.id);
      this.playerGame.set(p2.socketId || p2.username, g.id);
      return g;
    }
    return null;
  }

  createGameWithBot(player){
    const bot = { username: 'BOT', socketId: null, id: 'BOT' };
    const g = new Game(player, bot, true);
    this.games.set(g.id, g);
    this.playerGame.set(player.socketId || player.username, g.id);
    return g;
  }

  getGameById(id){ return this.games.get(id); }

  removeGame(gameId){ 
    const g = this.games.get(gameId);
    if (!g) return;
    for (const p of Object.values(g.players)) {
      if (p && p.socketId) this.playerGame.delete(p.socketId);
      if (p && p.username) this.playerGame.delete(p.username);
    }
    this.games.delete(gameId);
  }

  getGameForSocket(socketId){
    const id = this.playerGame.get(socketId) || null;
    if (!id) return null;
    return this.games.get(id) || null;
  }
}

const GM = new GameManager();

// ---------- socket.io flow ----------
io.on('connection', (socket) => {
  console.log('socket connected', socket.id);

  socket.on('join', async ({username})=>{
    const player = { username, socketId: socket.id, id: username };
    // add to waiting
    GM.addWaiting(player);
    socket.emit('waiting');
    // try match
    const match = GM.findAndCreateMatch();
    if (match) {
      // notify both
      const pA = match.players.A;
      const pB = match.players.B;
      io.to(pA.socketId).emit('game_start', { gameId: match.id, side: 'A', opponent: pB.username, board: match.board });
      io.to(pB.socketId).emit('game_start', { gameId: match.id, side: 'B', opponent: pA.username, board: match.board });
      // produce analytics
      await produceEvent('game_start', { gameId: match.id, players: [pA.username, pB.username], ts: Date.now() });
    } else {
      // schedule bot fallback in 10s if still waiting
      setTimeout(async () => {
        // if player still waiting (not matched)
        const idx = GM.waiting.findIndex(p => p.socketId === player.socketId);
        if (idx !== -1) {
          GM.waiting.splice(idx,1);
          const g = GM.createGameWithBot(player);
          // notify player
          io.to(player.socketId).emit('game_start', { gameId: g.id, side: 'A', opponent: 'BOT', board: g.board, isBot: true });
          // produce event
          await produceEvent('game_start', { gameId: g.id, players: [player.username, 'BOT'], ts: Date.now(), bot: true });
          // if bot starts and bot moves first (we make player always A, bot B) => A starts, so player starts
        }
      }, 10000);
    }
  });

  socket.on('make_move', async ({ gameId, col }) => {
    const g = GM.getGameById(gameId);
    if (!g || g.ended) { socket.emit('error_msg','invalid game'); return; }
    // determine which side is this socket
    const side = (g.players.A.socketId === socket.id) ? 'A' : (g.players.B.socketId === socket.id ? 'B' : null);
    if (!side) { socket.emit('error_msg','not part of game'); return; }
    if (g.turn !== side) { socket.emit('error_msg','not your turn'); return; }

    const playerId = side; // store 'A'/'B' as marks in board
    const row = dropDisc(g.board, col, playerId);
    if (row === -1) { socket.emit('invalid_move', 'column full'); return; }

    g.lastActivity = Date.now();
    // broadcast board update
    io.to(g.players.A.socketId).emit('board_update', { board: g.board, lastMove: {row, col, side} });
    if (g.players.B.socketId) io.to(g.players.B.socketId).emit('board_update', { board: g.board, lastMove: {row, col, side} });

    // analytics
    await produceEvent('move_made', { gameId: g.id, by: g.players[side].username, col, ts: Date.now() });

    // check win
    if (checkWin(g.board, playerId)) {
      g.ended = true;
      g.winner = g.players[side].username;
      await finishGame(g, 'win', g.players[side].username);
      return;
    }
    if (boardFull(g.board)) {
      g.ended = true;
      g.winner = null;
      await finishGame(g, 'draw', null);
      return;
    }

    // switch turn
    g.turn = (g.turn === 'A') ? 'B' : 'A';

    // If opponent is bot and it's bot's turn, call bot move
    if (g.isBot && g.turn === 'B') {
      // quick bot move
      setTimeout(async () => {
        await doBotMove(g);
      }, 300); // respond quickly
    }
  });

  socket.on('reconnect_join', async ({ username, gameId }) => {
    // allow rejoin by username or gameId
    const g = GM.getGameById(gameId);
    if (!g) {
      socket.emit('error_msg','game not found');
      return;
    }
    // find which side matches username
    const side = (g.players.A.username === username) ? 'A' : ((g.players.B.username === username) ? 'B' : null);
    if (!side) { socket.emit('error_msg','not a player'); return; }
    // reassign socketId
    g.players[side].socketId = socket.id;
    GM.playerGame.set(socket.id, g.id);
    socket.emit('rejoined', { gameId: g.id, board: g.board, side, turn: g.turn });
    // notify other
    const other = (side==='A')? g.players.B : g.players.A;
    if (other.socketId) io.to(other.socketId).emit('opponent_reconnected', { username });
  });

  socket.on('disconnect', async () => {
    console.log('disconnect', socket.id);
    // find game
    const g = GM.getGameForSocket(socket.id);
    if (!g) return;
    // mark lastActivity
    g.lastActivity = Date.now();
    // start 30s timer for reconnect
    setTimeout(async () => {
      // if still disconnected (player's socketId differs) and not rejoined
      const pA = g.players.A, pB = g.players.B;
      const checkA = pA.socketId && io.sockets.sockets.get(pA.socketId);
      const checkB = pB.socketId && io.sockets.sockets.get(pB.socketId);
      if (!checkA || !checkB) {
        // if either missing and not rejoined within 30s -> forfeit
        if (g.ended) return;
        g.ended = true;
        let winner = null;
        if (!checkA && checkB) winner = pB.username;
        else if (!checkB && checkA) winner = pA.username;
        else winner = (g.isBot ? (pA.socketId ? pA.username : 'BOT') : null);
        g.winner = winner;
        await finishGame(g, 'forfeit', winner);
      }
    }, 30000);
  });
});

// ---------- Bot logic ----------
async function doBotMove(g) {
  if (g.ended) return;
  const botSide = 'B';
  const humanSide = 'A';
  // 1) If bot can win immediately -> play winning move
  for (let c=0;c<COLS;c++){
    const copy = copyBoard(g.board);
    const r = dropDisc(copy, c, botSide);
    if (r !== -1 && checkWin(copy, botSide)) {
      // apply move
      dropDisc(g.board, c, botSide);
      await broadcastAfterBotMove(g, c, botSide);
      return;
    }
  }
  // 2) Block opponent immediate win
  for (let c=0;c<COLS;c++){
    const copy = copyBoard(g.board);
    const r = dropDisc(copy, c, humanSide);
    if (r !== -1 && checkWin(copy, humanSide)) {
      // block by playing this column
      dropDisc(g.board, c, botSide);
      await broadcastAfterBotMove(g, c, botSide);
      return;
    }
  }
  // 3) Heuristic: choose column with highest score by simple lookahead / center preference
  const scores = Array(COLS).fill(-Infinity);
  for (let c=0;c<COLS;c++){
    const copy = copyBoard(g.board);
    const r = dropDisc(copy, c, botSide);
    if (r === -1) { scores[c] = -9999; continue; }
    // score: prefer center columns and moves creating 2/3 in row
    let score = 0;
    // center preference
    score += (3 - Math.abs(3 - c)) * 2;
    // count adjacent bot pieces
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr,dc] of dirs){
      let chain = 1;
      // forward
      let rr=r+dr, cc=c+dc;
      while(rr>=0 && rr<ROWS && cc>=0 && cc<COLS && copy[rr][cc]===botSide){ chain++; rr+=dr; cc+=dc; }
      // backward
      rr=r-dr; cc=c-dc;
      while(rr>=0 && rr<ROWS && cc>=0 && cc<COLS && copy[rr][cc]===botSide){ chain++; rr-=dr; cc-=dc; }
      score += chain*2;
    }
    scores[c] = score;
  }
  // pick best available column (highest score)
  let bestCol = scores.indexOf(Math.max(...scores));
  if (scores[bestCol] <= -9000) {
    // all full -> shouldn't happen
    for (let c=0;c<COLS;c++){ if (g.board[0][c] === null) { bestCol = c; break; } }
  }
  dropDisc(g.board, bestCol, botSide);
  await broadcastAfterBotMove(g, bestCol, botSide);
}

async function broadcastAfterBotMove(g, col, side) {
  // find row
  let row = -1;
  for (let r=0; r<ROWS; r++) if (g.board[r][col] === side) row = r;
  // broadcast
  if (g.players.A.socketId) io.to(g.players.A.socketId).emit('board_update', { board: g.board, lastMove: {row, col, side} });
  if (g.players.B.socketId) io.to(g.players.B.socketId).emit('board_update', { board: g.board, lastMove: {row, col, side} });

  await produceEvent('move_made', { gameId: g.id, by: 'BOT', col, ts: Date.now() });

  // check win/draw
  if (checkWin(g.board, side)) {
    g.ended = true;
    g.winner = g.players.B.username; // bot name
    await finishGame(g, 'win', g.winner);
    return;
  }
  if (boardFull(g.board)) {
    g.ended = true;
    g.winner = null;
    await finishGame(g, 'draw', null);
    return;
  }
  // switch turn back to human
  g.turn = 'A';
}

// ---------- finish game: persist + analytics ----------
async function finishGame(g, result, winner) {
  // persist to Postgres
  try {
    const res = await pool.query(
      `INSERT INTO games(id, player_a, player_b, winner, result, created_at, ended_at, moves)
       VALUES($1,$2,$3,$4,$5,to_timestamp($6/1000.0),to_timestamp($7/1000.0),$8)`,
      [g.id, g.players.A.username, g.players.B.username, winner, result, g.createdAt, Date.now(), JSON.stringify(g.board)]
    );
  } catch (e) { console.error('db save error', e); }

  // update leaderboard: simple upsert
  if (winner) {
    try {
      await pool.query(`INSERT INTO leaderboard(username, wins) VALUES($1,1) ON CONFLICT (username) DO UPDATE SET wins = leaderboard.wins + 1`, [winner]);
    } catch(e){ console.error('leaderboard update error', e) }
  }

  // notify players
  if (g.players.A.socketId) io.to(g.players.A.socketId).emit('game_end', { result, winner });
  if (g.players.B.socketId) io.to(g.players.B.socketId).emit('game_end', { result, winner });

  // produce analytics event
  await produceEvent('game_end', { gameId: g.id, result, winner, durationMs: Date.now()-g.createdAt, ts: Date.now() });

  // cleanup game after short timeout
  setTimeout(()=> GM.removeGame(g.id), 15_000);
}

// kafka produce helper
async function produceEvent(type, payload) {
  try {
    await producer.send({
      topic: 'connect4-events',
      messages: [{ key: type, value: JSON.stringify({ type, payload }) }]
    });
  } catch (e) { console.error('kafka produce error', e); }
}

// ------------- HTTP endpoints -------------
app.get('/leaderboard', async (req, res) => {
  const { rows } = await pool.query('SELECT username, wins FROM leaderboard ORDER BY wins DESC LIMIT 50');
  res.json(rows);
});

app.get('/health', (req, res) => res.send('ok'));

const PORT=process.env.PORT || 4000;
server.listen(PORT, () => console.log('listening', PORT));
