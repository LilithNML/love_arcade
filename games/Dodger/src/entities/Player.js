export default class Player {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.size = 20;
        this.color = '#3b82f6'; // Default Blue
        this.glowColor = '#60a5fa';
        
        // Físicas
        this.x = gameWidth / 2 - this.size / 2;
        this.y = gameHeight - this.size - 50;
        this.speed = 0;
        this.maxSpeed = 8;
        this.acceleration = 0.8;
        this.friction = 0.85;
    }

    setColor(palette) {
        this.color = palette.player;
        this.glowColor = palette.glow;
    }

    update(dt, input) {
        // Aceleración
        if (input.keys.left) this.speed -= this.acceleration;
        if (input.keys.right) this.speed += this.acceleration;

        // Fricción
        this.speed *= this.friction;

        // Aplicar movimiento
        this.x += this.speed;

        // Límites y rebote suave
        if (this.x < 0) { 
            this.x = 0; 
            this.speed *= -0.5; 
        }
        if (this.x + this.size > this.gameWidth) { 
            this.x = this.gameWidth - this.size; 
            this.speed *= -0.5; 
        }
    }

    draw(ctx) {
        ctx.save();
        
        // Efecto Neón
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.glowColor;
        ctx.fillStyle = this.color;
        
        // Dibujar nave
        ctx.fillRect(this.x, this.y, this.size, this.size);
        
        // Núcleo blanco (estilo Arcade)
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x + 5, this.y + 5, this.size - 10, this.size - 10);
        
        ctx.restore();
    }
}
