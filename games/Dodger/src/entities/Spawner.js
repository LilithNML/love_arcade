export default class Spawner {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.obstacles = [];
        this.spawnTimer = 0;
        this.spawnInterval = 1.0; // Segundos entre obstáculos
        this.obstacleSpeed = 250;
    }

    update(dt, difficultyMultiplier) {
        // Generar obstáculo
        this.spawnTimer += dt;
        // A mayor dificultad, menor intervalo (spawn más rápido)
        const currentInterval = Math.max(0.2, this.spawnInterval - (difficultyMultiplier * 0.1));
        
        if (this.spawnTimer > currentInterval) {
            this.spawn();
            this.spawnTimer = 0;
        }

        // Mover obstáculos
        // Aumentamos velocidad ligeramente con el tiempo
        const currentSpeed = this.obstacleSpeed + (difficultyMultiplier * 10);

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            const obs = this.obstacles[i];
            obs.y += currentSpeed * dt;

            // Eliminar si salen de pantalla
            if (obs.y > this.gameHeight) {
                this.obstacles.splice(i, 1);
            }
        }
    }

    spawn() {
        const size = Math.random() * 30 + 20; // Tamaño variable
        const x = Math.random() * (this.gameWidth - size);
        
        this.obstacles.push({
            x: x,
            y: -50,
            width: size,
            height: size,
            type: 'asteroid'
        });
    }

    draw(ctx) {
        ctx.fillStyle = '#ff4444'; // Rojo peligro
        this.obstacles.forEach(obs => {
            ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
            
            // Detalle visual simple
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        });
    }
    
    // Método para detectar colisiones con el jugador
    checkCollision(player) {
        for (let obs of this.obstacles) {
            if (
                player.x < obs.x + obs.width &&
                player.x + player.width > obs.x &&
                player.y < obs.y + obs.height &&
                player.y + player.height > obs.y
            ) {
                return true; // ¡Choque!
            }
        }
        return false;
    }
    
    reset() {
        this.obstacles = [];
        this.spawnTimer = 0;
    }
}
