/**
 * LA_CORE_Input - Unified input system (Touch + Keyboard + Mouse)
 * Direct touch control - ship follows finger position
 */

export class LA_CORE_Input {
    constructor(game) {
        this.game = game;
        
        // Touch state
        this.touchActive = false;
        this.touchX = 0;
        this.touchY = 0;
        this.currentTouchId = null;
        
        // Keyboard state (desktop fallback)
        this.keys = {};
        this.mousePos = { x: 0, y: 0 };
        this.mouseDown = false;
        
        // Touch area element
        this.touchArea = document.getElementById('la-shooter-touch-area');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Touch events on the entire canvas area
        this.touchArea.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.touchArea.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.touchArea.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
        this.touchArea.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });
        
        // Desktop fallback - Keyboard
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Desktop fallback - Mouse
        this.game.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.game.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.game.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    }
    
    // === TOUCH HANDLERS ===
    
    onTouchStart(e) {
        e.preventDefault();
        
        // Only track first touch
        if (this.currentTouchId === null && e.touches.length > 0) {
            const touch = e.touches[0];
            this.currentTouchId = touch.identifier;
            this.updateTouchPosition(touch);
            this.touchActive = true;
        }
    }
    
    onTouchMove(e) {
        e.preventDefault();
        
        // Find the touch we're tracking
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            if (touch.identifier === this.currentTouchId) {
                this.updateTouchPosition(touch);
                break;
            }
        }
    }
    
    onTouchEnd(e) {
        e.preventDefault();
        
        // Check if our tracked touch ended
        let touchStillActive = false;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === this.currentTouchId) {
                touchStillActive = true;
                break;
            }
        }
        
        if (!touchStillActive) {
            this.touchActive = false;
            this.currentTouchId = null;
        }
    }
    
    updateTouchPosition(touch) {
        const rect = this.game.canvas.getBoundingClientRect();
        this.touchX = touch.clientX - rect.left;
        this.touchY = touch.clientY - rect.top;
    }
    
    // === DESKTOP FALLBACK ===
    
    onKeyDown(e) {
        this.keys[e.key.toLowerCase()] = true;
    }
    
    onKeyUp(e) {
        this.keys[e.key.toLowerCase()] = false;
    }
    
    onMouseMove(e) {
        const rect = this.game.canvas.getBoundingClientRect();
        this.mousePos.x = e.clientX - rect.left;
        this.mousePos.y = e.clientY - rect.top;
    }
    
    onMouseDown(e) {
        if (e.button === 0) { // Left click
            this.mouseDown = true;
        }
    }
    
    onMouseUp(e) {
        if (e.button === 0) {
            this.mouseDown = false;
        }
    }
    
    // === PUBLIC API ===
    
    getTargetPosition() {
        // Touch has priority
        if (this.touchActive) {
            return {
                active: true,
                x: this.touchX,
                y: this.touchY
            };
        }
        
        // Desktop mouse
        if (this.mouseDown) {
            return {
                active: true,
                x: this.mousePos.x,
                y: this.mousePos.y
            };
        }
        
        // Keyboard movement (WASD)
        if (this.keys['w'] || this.keys['a'] || this.keys['s'] || this.keys['d'] ||
            this.keys['arrowup'] || this.keys['arrowleft'] || this.keys['arrowdown'] || this.keys['arrowright']) {
            
            // Return current player position modified by keys (handled in player)
            return {
                active: false,
                keyboard: true
            };
        }
        
        return {
            active: false,
            keyboard: false
        };
    }
    
    getKeyboardInput() {
        let x = 0;
        let y = 0;
        
        if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
        if (this.keys['d'] || this.keys['arrowright']) x += 1;
        if (this.keys['w'] || this.keys['arrowup']) y -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) y += 1;
        
        // Normalize diagonal movement
        if (x !== 0 && y !== 0) {
            const length = Math.sqrt(x * x + y * y);
            x /= length;
            y /= length;
        }
        
        return { x, y };
    }
}
