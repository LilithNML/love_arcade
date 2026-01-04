export default class Spawner {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.obstacles = [];
        this.spawnTimer = 0;
        
        // Configuración igual a la Beta
        this.baseSpeed = 3;
    }

    update(dt, score) {
        this.spawnTimer++;
        
        // Cálculo de dificultad idéntico a la Beta
        // Cada 500 puntos sube el nivel
        const difficultyLevel = Math.floor(score / 500) + 1;
        
        const speed = this.baseSpeed + (difficultyLevel * 0.5);
        // Rate: frames entre obstáculos. Mínimo 10 frames, empieza en 60.
        const rate = Math.max(10, 60 - (difficultyLevel * 5));

        if (this.spawnTimer > rate) {
            this.spawn(speed);
            this.spawnTimer = 0;
        }

        // Mover obstáculos
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i];
            obs.y += obs.speedY;

            if (obs.y > this.gameHeight) {
                this.obstacles.splice(i, 1);
            }
        }
        
        // Retornamos el nivel para que Game.js sepa si cambió
        return difficultyLevel; 
    }

    spawn(speedBase) {
        const size = Math.random() * 30 + 20;
        this.obstacles.push({
            x: Math.random() * (this.gameWidth - size),
            y: -size,
            w: size,
            h: size,
            speedY: speedBase + (Math.random() * 2), // Variación aleatoria
            color: '#ef4444'
        });
    }

    draw(ctx) {
        ctx.fillStyle = '#ef4444';
        for (let obs of this.obstacles) {
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        }
    }

    checkCollision(player) {
        const margin = 2; 
        for (let obs of this.obstacles) {
            if (
                player.x + margin < obs.x + obs.w &&
                player.x + player.size - margin > obs.x &&
                player.y + margin < obs.y + obs.h &&
                player.y + player.size - margin > obs.y
            ) {
                return true;
            }
        }
        return false;
    }
}
