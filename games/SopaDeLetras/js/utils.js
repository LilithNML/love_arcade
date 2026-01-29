const la_ws_utils = {
    // Prefijo único para evitar colisiones [Brief]
    prefix: 'la_ws_',
    
    getRandomChar: () => {
        const chars = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
        return chars.charAt(Math.floor(Math.random() * chars.length));
    },

    // Genera una matriz vacía
    createEmptyGrid: (size) => {
        return Array(size).fill(null).map(() => Array(size).fill(''));
    }
};
