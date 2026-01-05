export default class Player {
    constructor(gameWidth, gameHeight, texture) {
        this.gameWidth = gameWidth;
        this.gameHeight = gameHeight;
        this.size = 40; 
        this.sprite = texture;
        
        this.x = gameWidth / 2 - this.size / 2;
        this.y = gameHeight - this.size - 80;
        
        this.speed = 0;
        
        // FÍSICAS BETA (Restauradas)
        this.maxSpeed = 8;
        this.acceleration = 0.8;
        this.friction = 0.85;    
        
        // ESTADOS (Flags visuales)
        this.hasShield = false;
        this.isMagnetActive = false; // Nuevo
        this.isSlowActive = false;   // Nuevo
        
        this.pulseTimer = 0; // Para animar los escudos
    }

    setSkin(texture) {
        this.sprite = texture;
    }

    update(dt, input) {
        this.pulseTimer += dt * 5; // Velocidad de pulsación

        // Movimiento (Lógica Beta)
        if (input.keys.left) this.speed -= this.acceleration;
        if (input.keys.right) this.speed += this.acceleration;

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
        const centerX = this.x + this.size / 2;
        const centerY = this.y + this.size / 2;

        // 1. EFECTO IMÁN (Campo Dorado Grande)
        if (this.isMagnetActive) {
            const radius = 100 + Math.sin(this.pulseTimer) * 5; // Pulsa
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(250, 204, 21, 0.3)'; // Amarillo transparente
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.fillStyle = 'rgba(250, 204, 21, 0.05)';
            ctx.fill();
        }

        // 2. EFECTO SLOW MO (Aura Púrpura)
        if (this.isSlowActive) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#a855f7'; // Purple glow
            // Dibujamos un "fantasma" detrás si se mueve rápido (opcional, simplificado aquí con glow)
        }

        // 3. DIBUJAR NAVE
        if (this.sprite) {
            ctx.drawImage(this.sprite, this.x, this.y, this.size, this.size);
        } else {
            ctx.fillStyle = '#0ff';
            ctx.fillRect(this.x, this.y, this.size, this.size);
        }
        ctx.shadowBlur = 0; // Reset glow

        // 4. EFECTO ESCUDO (Campo de Fuerza Cian)
        if (this.hasShield) {
            const shieldRadius = (this.size / 2) + 8;
            
            ctx.strokeStyle = '#06b6d4'; // Cyan
            ctx.lineWidth = 3;
            
            // Anillo externo rotatorio (efecto visual)
            ctx.setLineDash([10, 5]); // Línea punteada
            ctx.beginPath();
            ctx.arc(centerX, centerY, shieldRadius, this.pulseTimer, this.pulseTimer + Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]); // Reset
            
            // Relleno suave
            ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
            ctx.fill();
        }

        ctx.restore();
    }
}
