export default class PowerUp {
    constructor(gameWidth, type, textures) {
        this.type = type; // 'shield', 'time', 'magnet', 'orb'
        
        // CORRECCIÓN 1: Tamaño aumentado para visibilidad
        this.size = (type === 'orb') ? 25 : 40; 
        
        this.x = Math.random() * (gameWidth - this.size);
        this.y = -60;
        this.speed = (type === 'orb') ? 150 : 200; 
        
        // Texturas
        let texKey = 'orb';
        if (type === 'shield') texKey = 'pw_shield';
        if (type === 'time') texKey = 'pw_time';
        if (type === 'magnet') texKey = 'pw_magnet';
        
        this.sprite = textures.get(texKey);
        
        // Animación
        this.bobTimer = Math.random() * Math.PI; // Inicio aleatorio
        this.baseColor = '#fff';
        if (type === 'shield') this.baseColor = '#06b6d4';
        if (type === 'time') this.baseColor = '#a855f7';
        if (type === 'magnet') this.baseColor = '#f59e0b';
        if (type === 'orb') this.baseColor = '#facc15';
    }

    update(dt, player, isMagnetActive) {
        this.bobTimer += dt * 5; // Velocidad de flotación

        // Lógica del Imán (Ahora mucho más agresiva)
        if ((this.type === 'orb') && isMagnetActive) {
            const centerX = this.x + this.size/2;
            const centerY = this.y + this.size/2;
            const playerX = player.x + player.size/2;
            const playerY = player.y + player.size/2;

            const dx = playerX - centerX;
            const dy = playerY - centerY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // Rango infinito si el imán es potente, o muy largo (600px)
            if (dist < 600) { 
                // Aceleración hacia el jugador
                this.x += (dx / dist) * 800 * dt; 
                this.y += (dy / dist) * 800 * dt;
            } else {
                this.y += this.speed * dt;
            }
        } else {
            // Caída normal
            this.y += this.speed * dt;
        }
    }

    draw(ctx) {
        ctx.save();
        
        // Animación de flotación (Bobbing)
        // El sprite sube y baja suavemente visualmente (sin afectar hitbox)
        const visualOffsetY = Math.sin(this.bobTimer) * 5;

        // CORRECCIÓN 2: Glow (Resplandor) detrás del item
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.baseColor;
        
        // Dibujar aura circular suave
        ctx.fillStyle = this.baseColor;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(this.x + this.size/2, this.y + this.size/2 + visualOffsetY, this.size/2 + 5, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Dibujar Sprite
        if (this.sprite) {
            ctx.drawImage(this.sprite, this.x, this.y + visualOffsetY, this.size, this.size);
        } else {
            // Fallback
            ctx.fillStyle = this.baseColor;
            ctx.fillRect(this.x, this.y + visualOffsetY, this.size, this.size);
        }
        
        ctx.restore();
    }

    checkCollision(player) {
        // Hitbox un poco más permisiva
        const margin = 5;
        return (
            player.x < this.x + this.size - margin &&
            player.x + player.size > this.x + margin &&
            player.y < this.y + this.size - margin &&
            player.y + player.size > this.y + margin
        );
    }
}
