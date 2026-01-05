export default class Player {
    constructor(gameWidth, gameHeight, texture) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.size = 40; // Un poco más grande para ver el sprite
        this.sprite = texture;
        
        this.x = gameWidth / 2 - this.size / 2;
        this.y = gameHeight - this.size - 80;
        
        this.speed = 0;
        this.maxSpeed = 8;
        this.acceleration = 1200; // Ajustado para dt
        this.friction = 0.92;
        
        // PowerUp States
        this.hasShield = false;
    }

    setSkin(texture) {
        this.sprite = texture;
    }

    update(dt, input) {
        // Movimiento basado en tiempo (dt) para consistencia con SlowMo
        if (input.keys.left) this.speed -= this.acceleration * dt;
        if (input.keys.right) this.speed += this.acceleration * dt;

        this.speed *= this.friction;
        this.x += this.speed;

        if (this.x < 0) { this.x = 0; this.speed *= -0.5; }
        if (this.x + this.size > this.gameWidth) { 
            this.x = this.gameWidth - this.size; 
            this.speed *= -0.5; 
        }
    }

    draw(ctx) {
        ctx.save();
        
        // Dibujar Sprite
        if (this.sprite) {
            ctx.drawImage(this.sprite, this.x, this.y, this.size, this.size);
        } else {
            // Fallback
            ctx.fillStyle = '#0ff';
            ctx.fillRect(this.x, this.y, this.size, this.size);
        }

        // Dibujar Escudo (Si está activo)
        if (this.hasShield) {
            ctx.strokeStyle = '#06b6d4'; // Cyan
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x + this.size/2, this.y + this.size/2, this.size/2 + 8, 0, Math.PI*2);
            ctx.stroke();
            
            // Brillo intermitente
            ctx.globalAlpha = 0.2;
            ctx.fillStyle = '#06b6d4';
            ctx.fill();
        }

        ctx.restore();
    }
}
