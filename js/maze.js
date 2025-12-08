const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');
const cellSize = 20; // Tamaño de cada celda
const cols = Math.floor(canvas.width / cellSize);
const rows = Math.floor(canvas.height / cellSize);

let grid = [];
let player = { x: 0, y: 0 };
let goal = { x: cols - 1, y: rows - 1 };
let timer = 0;
let timerInterval;
let isPlaying = true;

// 1 = Pared, 0 = Camino
// Generación simple aleatoria para ejemplo (puede mejorarse con DFS)
function generateMaze() {
    grid = [];
    for (let y = 0; y < rows; y++) {
        let row = [];
        for (let x = 0; x < cols; x++) {
            // Bordes son paredes
            if (x === 0 || x === cols - 1 || y === 0 || y === rows - 1) {
                row.push(1);
            } else {
                // Paredes aleatorias (densidad 20%)
                row.push(Math.random() > 0.8 ? 1 : 0);
            }
        }
        grid.push(row);
    }
    // Asegurar camino en start y end
    grid[0][0] = 0;
    grid[0][1] = 0; 
    grid[1][0] = 0;
    grid[rows-1][cols-1] = 0;
    grid[rows-1][cols-2] = 0;
    
    player = { x: 1, y: 1 }; // Empezar dentro (offset por borde)
    goal = { x: cols - 2, y: rows - 2 };
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dibujar paredes
    ctx.fillStyle = "#333";
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (grid[y][x] === 1) {
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    // Dibujar Meta
    ctx.fillStyle = "#4caf50";
    ctx.fillRect(goal.x * cellSize, goal.y * cellSize, cellSize, cellSize);

    // Dibujar Jugador
    ctx.fillStyle = "#e91e63";
    ctx.beginPath();
    ctx.arc(player.x * cellSize + cellSize/2, player.y * cellSize + cellSize/2, cellSize/3, 0, Math.PI * 2);
    ctx.fill();
}

function movePlayer(dx, dy) {
    if (!isPlaying) return;
    
    let nextX = player.x + dx;
    let nextY = player.y + dy;

    // Colisión
    if (grid[nextY][nextX] === 0) {
        player.x = nextX;
        player.y = nextY;
        draw();
        checkWin();
    }
}

function checkWin() {
    if (player.x === goal.x && player.y === goal.y) {
        isPlaying = false;
        clearInterval(timerInterval);
        
        // Calcular recompensa base + bonus tiempo
        let reward = 50;
        if (timer < 10) reward += 20; // Bonus rápido
        
        alert(`¡Ganaste! Tiempo: ${timer}s. Recompensa: ${reward} monedas.`);
        addCoins(reward); // Función de app.js
        
        // Reiniciar
        setTimeout(() => {
            initGame();
        }, 1500);
    }
}

function initGame() {
    generateMaze();
    timer = 0;
    isPlaying = true;
    document.getElementById('timer').innerText = "Tiempo: 0s";
    draw();
    
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timer++;
        document.getElementById('timer').innerText = `Tiempo: ${timer}s`;
    }, 1000);
}

// Teclado
document.addEventListener('keydown', (e) => {
    if(e.key === "ArrowUp" || e.key === "w") movePlayer(0, -1);
    if(e.key === "ArrowDown" || e.key === "s") movePlayer(0, 1);
    if(e.key === "ArrowLeft" || e.key === "a") movePlayer(-1, 0);
    if(e.key === "ArrowRight" || e.key === "d") movePlayer(1, 0);
});

initGame();
