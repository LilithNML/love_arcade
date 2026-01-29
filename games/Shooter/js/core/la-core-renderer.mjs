/**
 * LA_CORE_Renderer - Canvas2D rendering system
 * Optimized for mobile performance
 */

export class LA_CORE_Renderer {
    constructor(game) {
        this.game = game;
        this.ctx = game.ctx;
        
        // Starfield background
        this.stars = [];
        this.initStarfield();
    }
    
    initStarfield() {
        // Create parallax star layers
        const starCount = 100;
        for (let i = 0; i < starCount; i++) {
            this.stars.push({
                x: Math.random() * this.game.viewport.width,
                y: Math.random() * this.game.viewport.height,
                size: Math.random() * 2 + 0.5,
                speed: Math.random() * 20 + 10,
                alpha: Math.random() * 0.5 + 0.3
            });
        }
    }
    
    clear() {
        this.ctx.fillStyle = this.game.config.canvas.backgroundColor;
        this.ctx.fillRect(0, 0, this.game.viewport.width, this.game.viewport.height);
    }
    
    drawStarfield() {
        // Update and draw stars
        for (const star of this.stars) {
            star.y += star.speed * 0.016; // Approximate dt
            
            // Wrap around
            if (star.y > this.game.viewport.height) {
                star.y = 0;
                star.x = Math.random() * this.game.viewport.width;
            }
            
            this.ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
            this.ctx.fillRect(star.x, star.y, star.size, star.size);
        }
    }
    
    drawPlayer(player) {
        const ctx = this.ctx;
        
        // Save context
        ctx.save();
        ctx.translate(player.x, player.y);
        
        // Draw invincibility shield
        if (player.isInvincible) {
            ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, player.config.collisionRadius + 5, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Draw ship body
        ctx.fillStyle = '#00d4ff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(-12, 15);
        ctx.lineTo(0, 10);
        ctx.lineTo(12, 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Draw cockpit
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, -5, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw engines (if moving)
        if (player.vx !== 0 || player.vy !== 0) {
            const flameLength = 8 + Math.random() * 4;
            
            ctx.strokeStyle = '#ff6600';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-6, 12);
            ctx.lineTo(-6, 12 + flameLength);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(6, 12);
            ctx.lineTo(6, 12 + flameLength);
            ctx.stroke();
            
            ctx.strokeStyle = '#ffaa00';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-6, 12);
            ctx.lineTo(-6, 12 + flameLength);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(6, 12);
            ctx.lineTo(6, 12 + flameLength);
            ctx.stroke();
        }
        
        // Draw charging indicator
        if (player.isCharging) {
            const chargeProgress = player.chargeTime / player.config.chargeTime;
            ctx.strokeStyle = `rgba(255, 0, 110, ${chargeProgress})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(0, 0, 25, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * chargeProgress);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    drawEnemy(enemy) {
        const ctx = this.ctx;
        const type = enemy.type;
        
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        
        // Health bar
        const healthPercent = enemy.hp / enemy.maxHp;
        if (healthPercent < 1) {
            const barWidth = 30;
            const barHeight = 4;
            
            ctx.fillStyle = 'rgba(255, 51, 102, 0.8)';
            ctx.fillRect(-barWidth / 2, -enemy.config.collisionRadius - 10, barWidth, barHeight);
            
            ctx.fillStyle = 'rgba(0, 255, 136, 0.8)';
            ctx.fillRect(-barWidth / 2, -enemy.config.collisionRadius - 10, barWidth * healthPercent, barHeight);
        }
        
        // Draw based on type
        switch(type) {
            case 'scout':
                this.drawScoutEnemy(ctx);
                break;
            case 'shooter':
                this.drawShooterEnemy(ctx);
                break;
            case 'tank':
                this.drawTankEnemy(ctx);
                break;
            case 'elite':
                this.drawEliteEnemy(ctx);
                break;
            default:
                this.drawScoutEnemy(ctx);
        }
        
        ctx.restore();
    }
    
    drawScoutEnemy(ctx) {
        // Small, fast enemy
        ctx.fillStyle = '#ff006e';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(-10, -10);
        ctx.lineTo(0, -5);
        ctx.lineTo(10, -10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    
    drawShooterEnemy(ctx) {
        // Medium enemy with guns
        ctx.fillStyle = '#ff3366';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        
        // Body
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(-12, -8);
        ctx.lineTo(0, -12);
        ctx.lineTo(12, -8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Guns
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(-15, 0, 6, 12);
        ctx.fillRect(9, 0, 6, 12);
    }
    
    drawTankEnemy(ctx) {
        // Large, slow enemy
        ctx.fillStyle = '#cc0055';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        
        // Body
        ctx.beginPath();
        ctx.moveTo(0, 20);
        ctx.lineTo(-18, -5);
        ctx.lineTo(-10, -15);
        ctx.lineTo(10, -15);
        ctx.lineTo(18, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Turret
        ctx.fillStyle = '#ff006e';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
    
    drawEliteEnemy(ctx) {
        // Elite enemy with glow
        const time = Date.now() * 0.001;
        const pulse = Math.sin(time * 3) * 0.3 + 0.7;
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = `rgba(255, 0, 170, ${pulse})`;
        
        ctx.fillStyle = '#aa00ff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        
        // Body
        ctx.beginPath();
        ctx.moveTo(0, 18);
        ctx.lineTo(-15, -10);
        ctx.lineTo(0, -15);
        ctx.lineTo(15, -10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Wings
        ctx.fillStyle = 'rgba(170, 0, 255, 0.6)';
        ctx.beginPath();
        ctx.moveTo(-15, -10);
        ctx.lineTo(-25, 5);
        ctx.lineTo(-15, 0);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(15, -10);
        ctx.lineTo(25, 5);
        ctx.lineTo(15, 0);
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
    
    drawPlayerBullet(bullet) {
        const ctx = this.ctx;
        
        if (bullet.isCharged) {
            // Charged shot with glow
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff00aa';
            ctx.fillStyle = '#ff00aa';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.shadowBlur = 0;
        } else {
            // Normal shot
            ctx.fillStyle = '#00d4ff';
            ctx.beginPath();
            ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    drawEnemyBullet(bullet) {
        const ctx = this.ctx;
        
        ctx.fillStyle = '#ff3366';
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 1;
        
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
    
    drawParticle(particle) {
        const ctx = this.ctx;
        
        ctx.fillStyle = particle.color;
        ctx.globalAlpha = particle.alpha;
        
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.globalAlpha = 1;
    }
}
