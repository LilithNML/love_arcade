class LA_WS_WordFinder {
    constructor(grid, words) {
        this.grid = grid;
        this.wordsToFind = words.map(w => w.toUpperCase());
        this.foundWords = [];
    }

    // Comprueba si una selección de celdas forma una palabra válida
    checkSelection(coords) {
        // coords: [{r, c}, {r, c}...]
        const selection = coords.map(p => this.grid[p.r][p.c]).join('');
        const reversed = selection.split('').reverse().join('');

        const match = this.wordsToFind.find(w => 
            (w === selection || w === reversed) && !this.foundWords.includes(w)
        );

        if (match) {
            this.foundWords.push(match);
            return match;
        }
        return null;
    }

    isLevelComplete() {
        return this.foundWords.length === this.wordsToFind.length;
    }
}
