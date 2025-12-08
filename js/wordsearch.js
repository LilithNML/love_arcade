const words = ["AMOR", "BESO", "CENA", "VIDA"];
const gridSize = 8;
const gridContainer = document.getElementById('word-grid');
let selectedCells = [];
let foundWords = 0;

// Grid predefinido simple para asegurar que las palabras existen (se puede hacer generador dinámico)
// Rellenaremos con letras random y colocaremos las palabras manualmente para este ejemplo estático.
const gridData = [
    ['A','M','O','R','X','Y','Z','A'],
    ['B','J','K','L','M','N','O','P'],
    ['E','Q','C','E','N','A','R','S'],
    ['S','T','U','V','W','X','Y','Z'],
    ['O','A','B','V','I','D','A','C'],
    ['D','E','F','G','H','I','J','K'],
    ['L','M','N','O','P','Q','R','S'],
    ['T','U','V','W','X','Y','Z','A']
];

function initBoard() {
    gridContainer.innerHTML = '';
    for(let r=0; r<gridSize; r++) {
        for(let c=0; c<gridSize; c++) {
            const cell = document.createElement('div');
            cell.textContent = gridData[r][c];
            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.style.width = '40px';
            cell.style.height = '40px';
            cell.style.border = '1px solid #ccc';
            cell.style.display = 'flex';
            cell.style.alignItems = 'center';
            cell.style.justifyContent = 'center';
            cell.style.cursor = 'pointer';
            cell.style.background = '#fff';
            
            cell.addEventListener('click', () => toggleSelect(cell));
            gridContainer.appendChild(cell);
        }
    }
}

function toggleSelect(cell) {
    if (cell.classList.contains('found')) return;

    if (cell.classList.contains('selected')) {
        cell.classList.remove('selected');
        cell.style.background = '#fff';
        selectedCells = selectedCells.filter(c => c !== cell);
    } else {
        cell.classList.add('selected');
        cell.style.background = '#ffc1e3'; // Rosa claro
        selectedCells.push(cell);
    }
}

function resetSelection() {
    selectedCells.forEach(cell => {
        cell.classList.remove('selected');
        if(!cell.classList.contains('found')) cell.style.background = '#fff';
    });
    selectedCells = [];
}

window.checkWord = function() {
    // Ordenar celdas seleccionadas para formar palabra
    // Esta es una validación simple, en un juego real se checa adyacencia
    const word = selectedCells.map(c => c.textContent).join('');
    const reverseWord = selectedCells.map(c => c.textContent).reverse().join('');
    
    if (words.includes(word) || words.includes(reverseWord)) {
        selectedCells.forEach(cell => {
            cell.classList.add('found');
            cell.classList.remove('selected');
            cell.style.background = '#4caf50'; // Verde
            cell.style.color = '#fff';
        });
        foundWords++;
        selectedCells = [];
        
        if (foundWords === words.length) {
            alert("¡Completado! +40 monedas");
            addCoins(40);
        }
    } else {
        alert("Palabra incorrecta");
        resetSelection();
    }
};

initBoard();
