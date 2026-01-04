export default class Player {
    constructor(gameWidth, gameHeight) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.size = 20;
        this.color = '#3b82f6'; // Azul Tailwind
        
        // Físicas de la beta
        this.x = gameWidth / 2 - this.size / 2;
        this.y = gameHeight - this.size - 50;
        this.speed = 0;
        this.maxSpeed = 8;
        this.acceleration = 0.8;
        this.friction = 0.85;
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
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}
