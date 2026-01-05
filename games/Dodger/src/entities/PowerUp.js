export default class PowerUp {
    constructor(gameWidth, type, textures) {
        this.type = type; // 'shield', 'time', 'magnet', 'orb'
        this.size = (type === 'orb') ? 15 : 25;
        this.x = Math.random() * (gameWidth - this.size);
        this.y = -50;
        this.speed = (type === 'orb') ? 150 : 200; // Caen un poco más lento que los enemigos
        
        // Asignar textura
        let texKey = 'orb';
        if (type === 'shield') texKey = 'pw_shield';
        if (type === 'time') texKey = 'pw_time';
        if (type === 'magnet') texKey = 'pw_magnet';
        
        this.sprite = textures.get(texKey);
        
        // Estado
        this.markedForDeletion = false;
    }

    update(dt, player, isMagnetActive) {
        // Lógica del Imán
        if ((this.type === 'orb') && isMagnetActive) {
            const dx = player.x + player.size/2 - (this.x + this.size/2);
            const dy = player.y + player.size/2 - (this.y + this.size/2);
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < 300) { // Radio de atracción
                this.x += (dx / dist) * 600 * dt; // Velocidad de atracción
                this.y += (dy / dist) * 600 * dt;
            } else {
                this.y += this.speed * dt;
            }
        } else {
            // Caída normal
            this.y += this.speed * dt;
        }
    }

    draw(ctx) {
        if (this.sprite) {
            ctx.drawImage(this.sprite, this.x, this.y, this.size, this.size);
        }
    }

    checkCollision(player) {
        return (
            player.x < this.x + this.size &&
            player.x + player.size > this.x &&
            player.y < this.y + this.size &&
            player.y + player.size > this.y
        );
    }
}
