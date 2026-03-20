export default class Spawner {
    constructor(gameWidth, gameHeight, resources) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.resources = resources; 
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
            
            // NUEVO: Actualizar rotación
            obs.rotation += obs.rotSpeed;

            if (obs.y > this.gameHeight) this.obstacles.splice(i, 1);
        }
        return difficultyLevel; 
    }

    spawn(speedBase) {
        const size = Math.random() * 30 + 30;
        this.obstacles.push({
            x: Math.random() * (this.gameWidth - size),
            y: -size,
            w: size,
            h: size,
            speedY: speedBase + (Math.random() * 2),
            // NUEVO: Propiedades de rotación
            rotation: Math.random() * Math.PI * 2, // Ángulo inicial aleatorio
            rotSpeed: (Math.random() - 0.5) * 0.1  // Velocidad de giro aleatoria (izquierda o derecha)
        });
    }

    draw(ctx) {
        const sprite = this.resources.get('asteroid');
        
        for (let obs of this.obstacles) {
            if (sprite) {
                ctx.save();
                
                // 1. Calcular centro del objeto para rotar sobre su eje
                const centerX = obs.x + obs.w / 2;
                const centerY = obs.y + obs.h / 2;

                // 2. Mover contexto al centro
                ctx.translate(centerX, centerY);
                
                // 3. Rotar
                ctx.rotate(obs.rotation);

                // 4. Dibujar ESTELA (Motion Blur simple)
                // Se dibuja el mismo sprite un poco más arriba con transparencia
                // para simular velocidad sin usar partículas costosas.
                ctx.globalAlpha = 0.3;
                ctx.drawImage(sprite, -obs.w / 2, -obs.h / 2 - 10, obs.w, obs.h);
                
                // 5. Dibujar Asteroide Real
                ctx.globalAlpha = 1.0;
                ctx.drawImage(sprite, -obs.w / 2, -obs.h / 2, obs.w, obs.h);

                ctx.restore();
            } else {
                // Fallback si no hay imagen (cuadrados rotando)
                ctx.save();
                ctx.translate(obs.x + obs.w/2, obs.y + obs.h/2);
                ctx.rotate(obs.rotation);
                ctx.fillStyle = this.enemyColor;
                ctx.fillRect(-obs.w/2, -obs.h/2, obs.w, obs.h);
                ctx.restore();
            }
        }
    }

    checkCollision(player) {
        const margin = 8; // Margen ajustado para ser justos con la rotación
        for (let obs of this.obstacles) {
            // Nota: Aunque visualmente rotan, la colisión sigue siendo una caja (AABB)
            // Esto es para mantener el rendimiento alto.
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
