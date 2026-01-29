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
        if (this.dashTimer > 0) this.dashTimer -= dt;
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
        if (this.invincibilityTimer > 0) this.invincibilityTimer -= dt;
        
        // Update invincibility
        if (this.invincibilityTimer <= 0) {
            this.isInvincible = false;
        }
        
        // Update dash cooldown UI
        const cooldownPercent = Math.max(0, this.dashCooldownTimer / this.config.dashCooldown);
        this.game.ui.setDashCooldown(cooldownPercent);
        
        // Handle input
        this.handleMovement(dt);
        this.handleDash(dt);
        this.handleShooting(dt);
        
        // Apply movement
        this.applyMovement(dt);
        
        // Clamp to screen bounds
        this.clampToScreen();
    }
    
    handleMovement(dt) {
        if (this.isDashing) return; // No movement control during dash
        
        const input = this.game.input.getMovementInput();
        const sensitivity = this.game.config.settings.sensitivity;
        
        // Set target velocity
        this.targetVx = input.x * this.config.speed * sensitivity;
        this.targetVy = input.y * this.config.speed * sensitivity;
        
        // Smooth acceleration
        const accel = 15; // Higher = more responsive
        this.vx += (this.targetVx - this.vx) * accel * dt;
        this.vy += (this.targetVy - this.vy) * accel * dt;
    }
    
    handleDash(dt) {
        if (this.isDashing) {
            // Continue dash movement
            const dashSpeed = this.config.dashSpeed;
            this.vx = Math.cos(this.dashAngle) * dashSpeed;
            this.vy = Math.sin(this.dashAngle) * dashSpeed;
            
            if (this.dashTimer <= 0) {
                this.isDashing = false;
                this.vx = 0;
                this.vy = 0;
            }
        } else {
            // Check for dash input
            if (this.game.input.isDashPressed() && this.dashCooldownTimer <= 0) {
                const input = this.game.input.getMovementInput();
                
                // Only dash if there's movement input
                if (input.x !== 0 || input.y !== 0) {
                    this.isDashing = true;
                    this.dashTimer = this.config.dashDuration;
                    this.dashCooldownTimer = this.config.dashCooldown;
                    this.dashAngle = Math.atan2(input.y, input.x);
                    
                    // Temporary invincibility during dash
                    this.isInvincible = true;
                    this.invincibilityTimer = this.config.dashDuration;
                    
                    // Play sound
                    this.game.sound.play('dash');
                    
                    // Reset dash button to prevent continuous dashing
                    this.game.input.resetDashButton();
                }
            }
        }
    }
    
    handleShooting(dt) {
        const aimInput = this.game.input.getAimInput();
        const firePressed = this.game.input.isFirePressed();
        const autoFire = this.game.config.settings.autoFire;
        
        // Charged shot mechanic
        if (firePressed && !autoFire) {
            this.isCharging = true;
            this.chargeTime += dt;
            
            // Fire charged shot when released
            if (this.chargeTime >= this.config.chargeTime) {
                this.chargeTime = this.config.chargeTime; // Cap charge time
            }
        } else {
            if (this.isCharging) {
                // Release charged shot
                if (aimInput.active && this.chargeTime >= this.config.chargeTime) {
                    this.shootChargedBullet(aimInput.angle);
                } else if (aimInput.active) {
                    // Released too early, fire normal shot
                    this.shootBullet(aimInput.angle);
                }
                this.isCharging = false;
                this.chargeTime = 0;
            } else {
                // Auto-fire mode
                if (autoFire && firePressed && aimInput.active && this.fireTimer <= 0) {
                    this.shootBullet(aimInput.angle);
                }
            }
        }
    }
    
    shootBullet(angle) {
        if (this.fireTimer > 0) return;
        
        const bullet = this.game.pool.getBullet();
        if (!bullet) return;
        
        const bulletConfig = this.game.config.bullet;
        
        bullet.x = this.x + Math.cos(angle) * 20;
        bullet.y = this.y + Math.sin(angle) * 20;
        bullet.vx = Math.cos(angle) * bulletConfig.speed;
        bullet.vy = Math.sin(angle) * bulletConfig.speed;
        bullet.damage = bulletConfig.damage;
        bullet.size = bulletConfig.size;
        bullet.isCharged = false;
        
        this.game.playerBullets.push(bullet);
        this.fireTimer = this.config.fireRate;
        
        // Play sound
        this.game.sound.play('shoot');
    }
    
    shootChargedBullet(angle) {
        const bullet = this.game.pool.getBullet();
        if (!bullet) return;
        
        const bulletConfig = this.game.config.bullet;
        
        bullet.x = this.x + Math.cos(angle) * 25;
        bullet.y = this.y + Math.sin(angle) * 25;
        bullet.vx = Math.cos(angle) * bulletConfig.speed * 0.8; // Slightly slower
        bullet.vy = Math.sin(angle) * bulletConfig.speed * 0.8;
        bullet.damage = bulletConfig.chargedDamage;
        bullet.size = bulletConfig.chargedSize;
        bullet.isCharged = true;
        
        this.game.playerBullets.push(bullet);
        this.fireTimer = this.config.fireRate * 1.5; // Longer cooldown
        
        // Play sound
        this.game.sound.play('chargedShoot');
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
