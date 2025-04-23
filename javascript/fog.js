const SIZE = 15;
const NUM = { generators: 7, pallets: 7, impassible: 30 };

let board = [];
let playerPos = {}, killerPos = {};
let gensCompleted = 0, playerMoves = 0, killerStops = 0, markedTurns = 0;
let mode = 'chase';

window.onload = () => {
  document.getElementById('enter-btn').onclick = startGame;
  window.addEventListener('keyup', handleKey);
};

function startGame() {
  document.getElementById('splash').classList.add('hidden');
  document.getElementById('game-container').classList.remove('hidden');
  init();
}

function init() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill('empty'));
  placeImpassible();
  placePallets();
  placeGenerators();
  spawnPlayerKiller();
  render();
}

function placeImpassible() {
  let count = 0;
  while (count < NUM.impassible) {
    const x = rand(), y = rand();
    if (board[y][x] === 'empty') {
      board[y][x] = 'impassible';
      count++;
    }
  }
}

function placePallets() {
  const impTiles = [];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (board[y][x] === 'impassible') impTiles.push({ x, y });

  let placed = 0;
  while (placed < NUM.pallets) {
    const imp = impTiles[Math.floor(Math.random() * impTiles.length)];
    const neighbors = [];
    for (let [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = imp.x + dx, ny = imp.y + dy;
      if (inBounds(nx, ny) && board[ny][nx] === 'empty') {
        neighbors.push({ x: nx, y: ny });
      }
    }
    const spot = neighbors.length
      ? neighbors[Math.floor(Math.random() * neighbors.length)]
      : { x: rand(), y: rand() };
    if (board[spot.y][spot.x] === 'empty') {
      board[spot.y][spot.x] = 'pallet';
      placed++;
    }
  }
}

function placeGenerators() {
  let placed = 0;
  while (placed < NUM.generators) {
    const x = rand(), y = rand();
    if (board[y][x] === 'empty') {
      board[y][x] = 'generator';
      placed++;
    }
  }
}

function spawnPlayerKiller() {
  for (let y = 0; y < SIZE; y++) {
    if (board[y][0] === 'empty') {
      board[y][0] = 'player';
      playerPos = { x: 0, y };
      break;
    }
  }
  for (let y = SIZE - 1; y >= 0; y--) {
    if (board[y][SIZE-1] === 'empty') {
      board[y][SIZE-1] = 'killer';
      killerPos = { x: SIZE-1, y };
      break;
    }
  }
}

function render() {
  const container = document.getElementById('board');
  container.innerHTML = '';
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const div = document.createElement('div');
      div.className = 'tile ' + board[y][x];
      const type = board[y][x];
      if (['player','killer','generator','pallet'].includes(type)) {
        const img = document.createElement('img');
        img.src = {
          player: 'images/survivor.png',
          killer: 'images/killer.png',
          generator: 'images/generator.png',
          pallet: 'images/pallet.png'
        }[type];
        div.appendChild(img);
      }
      container.appendChild(div);
    }
  }
}

function handleKey(e) {
  const dirs = { ArrowUp:[0,-1], ArrowDown:[0,1], ArrowLeft:[-1,0], ArrowRight:[1,0] };
  if (!dirs[e.key]) return;
  e.preventDefault();
  movePlayer(...dirs[e.key]);
}

function movePlayer(dx, dy) {
  const nx = playerPos.x + dx, ny = playerPos.y + dy;
  if (!inBounds(nx, ny) || board[ny][nx] === 'impassible') return;
  const targetType = board[ny][nx];

  board[playerPos.y][playerPos.x] = 'empty';
  playerPos = { x: nx, y: ny };
  board[ny][nx] = 'player';
  playerMoves++;
  render();

  if (targetType === 'generator') {
    gensCompleted++;
    if (gensCompleted >= 5) return victory();
  } else if (targetType === 'pallet') {
    mode = 'toPallet';
  }

  killerTurn();
}

function killerTurn() {
  let moves = 0;
  if (gensCompleted < 2) {
    if (playerMoves % 2 === 0) moves = 1;
  } else if (gensCompleted < 4) {
    moves = 1;
  } else {
    moves = 2;
  }
  for (let i = 0; i < moves; i++) killerMove();
  render();
}

function killerMove() {
  if (killerStops > 0) { killerStops--; return; }
  if (mode === 'marked') {
    markedTurns--;
    if (markedTurns <= 0) mode = 'chase';
    return;
  }

  let target = playerPos;
  if (mode === 'toPallet') target = findClosest('pallet');

  const path = bfs(killerPos, target);
  if (path.length < 2) return;
  const next = path[1];
  const nextType = board[next.y][next.x];

  if (mode === 'toPallet' && nextType === 'pallet') {
    board[next.y][next.x] = 'empty'; // remove pallet
    board[killerPos.y][killerPos.x] = 'empty';
    killerPos = { x: next.x, y: next.y };
    board[killerPos.y][killerPos.x] = 'killer';
    mode = 'pallet_stop';
    killerStops = 3;
    return;
  }

  if (next.x === playerPos.x && next.y === playerPos.y) {
    if (mode === 'marked') return death();
    board[killerPos.y][killerPos.x] = 'empty';
    killerPos = { x: next.x, y: next.y };
    board[killerPos.y][killerPos.x] = 'killer';
    mode = 'marked';
    markedTurns = 5;
    return;
  }

  board[killerPos.y][killerPos.x] = 'empty';
  killerPos = { x: next.x, y: next.y };
  board[killerPos.y][killerPos.x] = 'killer';
}

function findClosest(type) {
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++)
      if (board[y][x] === type) return { x, y };
  return playerPos;
}

function bfs(start, goal) {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  const visited = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  const queue = [[start, [start]]];
  visited[start.y][start.x] = true;

  while (queue.length) {
    const [pos, path] = queue.shift();
    if (pos.x === goal.x && pos.y === goal.y) return path;
    for (let [dx, dy] of dirs) {
      const nx = pos.x + dx, ny = pos.y + dy;
      if (inBounds(nx, ny) && !visited[ny][nx] && board[ny][nx] !== 'impassible') {
        visited[ny][nx] = true;
        queue.push([{ x: nx, y: ny }, path.concat({ x: nx, y: ny })]);
      }
    }
  }
  return [start];
}

function victory() {
  alert('You completed 5 generators and escaped the Fog!');
  location.reload();
}

function death() {
  alert('The killer got you... You have been sacrificed');
  location.reload();
}

function inBounds(x, y) {
  return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

function rand() {
  return Math.floor(Math.random() * SIZE);
}