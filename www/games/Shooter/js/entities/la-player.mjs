/**
 * LA_Player - Player entity with movement, shooting, and dash
 */

export class LA_Player {
    constructor(game) {
        this.game = game;
        this.config = game.config.player;
        
        // Position and velocity
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        
        // State
        this.health = this.config.maxHealth;
        this.isInvincible = false;
        this.invincibilityTimer = 0;
        
        // Dash
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashCooldownTimer = 0;
        this.dashAngle = 0;
        
        // Shooting
        this.fireTimer = 0;
        this.isCharging = false;
        this.chargeTime = 0;
        
        // Movement input smoothing
        this.targetVx = 0;
        this.targetVy = 0;
        
        this.reset();
    }
    
    reset() {
        // Spawn in center-bottom
        this.x = this.game.viewport.width / 2;
        this.y = this.game.viewport.height - 100;
        this.vx = 0;
        this.vy = 0;
        
        // Reset state
        this.health = this.config.maxHealth;
        this.isInvincible = false;
        this.invincibilityTimer = 0;
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashCooldownTimer = 0;
        this.fireTimer = 0;
        this.isCharging = false;
        this.chargeTime = 0;
    }
    
    update(dt) {
        // Update timers
        if (this.fireTimer > 0) this.fireTimer -= dt;
        if (this.invincibilityTimer > 0) this.invincibilityTimer -= dt;
        
        // Update invincibility
        if (this.invincibilityTimer <= 0) {
            this.isInvincible = false;
        }
        
        // Handle input
        this.handleMovement(dt);
        this.handleShooting(dt);
        
        // Apply movement
        this.applyMovement(dt);
        
        // Clamp to screen bounds
        this.clampToScreen();
    }
    
    handleMovement(dt) {
        const targetPos = this.game.input.getTargetPosition();
        
        if (targetPos.active) {
            // Direct touch/mouse control - move towards target position
            const dx = targetPos.x - this.x;
            const dy = targetPos.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 5) { // Dead zone reducido para mejor respuesta
                const speed = this.config.speed;
                const targetVx = (dx / distance) * speed;
                const targetVy = (dy / distance) * speed;
                
                // Interpolación suave para eliminar temblor
                const smoothing = 25; // Factor de suavizado (más alto = más suave)
                this.vx += (targetVx - this.vx) * smoothing * dt;
                this.vy += (targetVy - this.vy) * smoothing * dt;
            } else {
                // Close enough, slow down
                this.vx *= 0.7;
                this.vy *= 0.7;
            }
        } else if (targetPos.keyboard) {
            // Keyboard fallback
            const input = this.game.input.getKeyboardInput();
            const sensitivity = this.game.config.settings.sensitivity;
            
            this.vx = input.x * this.config.speed * sensitivity;
            this.vy = input.y * this.config.speed * sensitivity;
        } else {
            // No input, decelerate smoothly
            this.vx *= 0.85;
            this.vy *= 0.85;
            
            if (Math.abs(this.vx) < 1) this.vx = 0;
            if (Math.abs(this.vy) < 1) this.vy = 0;
        }
    }
    
    handleShooting(dt) {
        // Auto-fire straight up
        if (this.fireTimer <= 0) {
            this.shootBullet();
        }
    }
    
    shootBullet() {
        const bullet = this.game.pool.getBullet();
        if (!bullet) return;
        
        const bulletConfig = this.game.config.bullet;
        
        // Shoot straight up
        bullet.x = this.x;
        bullet.y = this.y - 20;
        bullet.vx = 0;
        bullet.vy = -bulletConfig.speed; // Negative = upward
        bullet.damage = bulletConfig.damage;
        bullet.size = bulletConfig.size;
        bullet.isCharged = false;
        
        this.game.playerBullets.push(bullet);
        this.fireTimer = this.config.fireRate;
        
        // Play sound
        this.game.sound.play('shoot');
    }
    
    applyMovement(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }
    
    clampToScreen() {
        const margin = this.config.collisionRadius;
        this.x = Math.max(margin, Math.min(this.game.viewport.width - margin, this.x));
        this.y = Math.max(margin, Math.min(this.game.viewport.height - margin, this.y));
    }
    
    takeDamage(amount) {
        if (this.isInvincible) return;
        
        this.health -= amount;
        this.game.ui.updateHealth(this.health);
        
        // Become invincible briefly
        this.isInvincible = true;
        this.invincibilityTimer = this.config.invincibilityDuration;
        
        // Play sound
        this.game.sound.play('playerHit');
        
        // Reset multiplier on hit
        this.game.resetMultiplier();
        
        // Check for game over
        if (this.health <= 0) {
            this.game.gameOver();
        }
    }
}
