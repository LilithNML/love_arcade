/**
 * LA_CORE_Loop - Game Loop with fixed timestep
 * Handles requestAnimationFrame and game update/render cycle
 */

export class LA_CORE_Loop {
    constructor(game) {
        this.game = game;
        this.lastTime = 0;
        this.accumulator = 0;
        this.fixedDt = 1 / 60; // 60 FPS fixed timestep
        this.rafId = null;
        this.fpsCounter = 0;
        this.fpsTimer = 0;
        this.currentFPS = 60;
    }
    
    start() {
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.tick();
    }
    
    stop() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }
    
    tick = (currentTime = performance.now()) => {
        if (!this.game.isRunning) {
            this.stop();
            return;
        }
        
        // Calculate delta time
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
        this.lastTime = currentTime;
        
        // Update FPS counter
        this.fpsCounter++;
        this.fpsTimer += dt;
        if (this.fpsTimer >= 1.0) {
            this.currentFPS = this.fpsCounter;
            this.fpsCounter = 0;
            this.fpsTimer = 0;
        }
        
        // Fixed timestep update
        this.accumulator += dt;
        
        while (this.accumulator >= this.fixedDt) {
            this.game.update(this.fixedDt);
            this.accumulator -= this.fixedDt;
        }
        
        // Render
        this.game.draw();
        
        // Request next frame
        this.rafId = requestAnimationFrame(this.tick);
    }
    
    getFPS() {
        return this.currentFPS;
    }
}
