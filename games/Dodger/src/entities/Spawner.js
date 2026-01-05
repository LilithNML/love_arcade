export default class Spawner {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.obstacles = [];
        this.spawnTimer = 0;
        this.baseSpeed = 3;
        
        // Tema actual
        this.enemyColor = '#ef4444'; // Rojo default
        this.needsStroke = false; // Para temas oscuros
    }

    setColor(palette) {
        this.enemyColor = palette.enemy;
        // Si el enemigo es negro, necesita borde
        this.needsStroke = (palette.enemy === '#000000');
    }

    update(dt, score) {
        this.spawnTimer++;
        
        const difficultyLevel = Math.floor(score / 500) + 1;
        const speed = this.baseSpeed + (difficultyLevel * 0.5);
        const rate = Math.max(10, 60 - (difficultyLevel * 5));

        if (this.spawnTimer > rate) {
            this.spawn(speed);
            this.spawnTimer = 0;
        }

        for (let i = this.obstacles.length - 1; i >= 0; i--) {
            let obs = this.obstacles[i];
            obs.y += obs.speedY;

            if (obs.y > this.gameHeight) {
                this.obstacles.splice(i, 1);
            }
        }
        
        return difficultyLevel; 
    }

    spawn(speedBase) {
        const size = Math.random() * 30 + 20;
        this.obstacles.push({
            x: Math.random() * (this.gameWidth - size),
            y: -size,
            w: size,
            h: size,
            speedY: speedBase + (Math.random() * 2),
            color: this.enemyColor, // Usar color actual
            stroke: this.needsStroke
        });
    }

    draw(ctx) {
        for (let obs of this.obstacles) {
            ctx.fillStyle = obs.color || this.enemyColor;
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            
            // Borde si es necesario (modo Void)
            if (obs.stroke) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
            }
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
