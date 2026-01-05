export default class Spawner {
    constructor(gameWidth, gameHeight, resources) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.resources = resources; // Recibe el gestor
        this.obstacles = [];
        this.spawnTimer = 0;
        this.baseSpeed = 3;
        this.enemyColor = '#ef4444'; 
    }

    setColor(palette) {
        this.enemyColor = palette.enemy;
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
            if (obs.y > this.gameHeight) this.obstacles.splice(i, 1);
        }
        return difficultyLevel; 
    }

    spawn(speedBase) {
        const size = Math.random() * 30 + 30; // Un poco más grandes para ver la textura
        this.obstacles.push({
            x: Math.random() * (this.gameWidth - size),
            y: -size,
            w: size,
            h: size,
            speedY: speedBase + (Math.random() * 2),
        });
    }

    draw(ctx) {
        const sprite = this.resources.get('asteroid');
        
        for (let obs of this.obstacles) {
            if (sprite) {
                ctx.drawImage(sprite, obs.x, obs.y, obs.w, obs.h);
                // Si quieres aplicar el color del tema encima:
                // ctx.globalCompositeOperation = 'source-atop';
                // pero por rendimiento y claridad, mejor dejar el sprite tal cual o tintarlo
            } else {
                ctx.fillStyle = this.enemyColor;
                ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            }
        }
    }

    checkCollision(player) {
        const margin = 5; // Margen más indulgente por las formas irregulares
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
