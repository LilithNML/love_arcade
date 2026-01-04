export default class Spawner {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.obstacles = [];
        this.spawnTimer = 0;
        this.currentSpawnRate = 60; // Frames (aprox 1s)
        this.baseSpeed = 3;
    }

    update(dt, score) {
        // Aumentar dificultad
        this.spawnTimer++;
        
        // Dificultad basada en score (igual que beta)
        const difficultyLevel = Math.floor(score / 500) + 1;
        const speed = this.baseSpeed + (difficultyLevel * 0.5);
        const rate = Math.max(10, 60 - (difficultyLevel * 5));

        if (this.spawnTimer > rate) {
            this.spawn(speed);
            this.spawnTimer = 0;
        }

        // Mover y limpiar
        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i];
            obs.y += obs.speedY;

            if (obs.y > this.gameHeight) {
                this.obstacles.splice(i, 1);
            }
        }
        
        return difficultyLevel; // Retornamos para actualizar UI si es necesario
    }

    spawn(speedBase) {
        const size = Math.random() * 30 + 20;
        this.obstacles.push({
            x: Math.random() * (this.gameWidth - size),
            y: -size,
            w: size,
            h: size,
            speedY: speedBase + (Math.random() * 2),
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
        const margin = 2; // Margen indulgente de la beta
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
