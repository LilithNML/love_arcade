/**
 * LA_CORE_Input - Unified input system (Touch + Keyboard + Mouse)
 * Mobile-first with desktop fallback
 */

export class LA_CORE_Input {
    constructor(game) {
        this.game = game;
        
        // Input state
        this.moveJoystick = { active: false, x: 0, y: 0, angle: 0, distance: 0 };
        this.aimJoystick = { active: false, x: 0, y: 0, angle: 0, distance: 0 };
        this.fireButton = false;
        this.dashButton = false;
        
        // Touch tracking
        this.touches = new Map();
        
        // Keyboard state (desktop fallback)
        this.keys = {};
        this.mousePos = { x: 0, y: 0 };
        this.mouseDown = false;
        
        // Joystick elements
        this.moveJoystickEl = document.getElementById('la-shooter-joystick-move');
        this.aimJoystickEl = document.getElementById('la-shooter-joystick-aim');
        this.moveStick = this.moveJoystickEl.querySelector('.la-shooter-joystick-stick');
        this.aimStick = this.aimJoystickEl.querySelector('.la-shooter-joystick-stick');
        
        // Button elements
        this.fireBtn = document.getElementById('la-shooter-btn-fire');
        this.dashBtn = document.getElementById('la-shooter-btn-dash');
        
        // Joystick config
        this.joystickMaxDistance = 60;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Touch events
        this.moveJoystickEl.addEventListener('touchstart', this.onMoveJoystickStart.bind(this), { passive: false });
        this.aimJoystickEl.addEventListener('touchstart', this.onAimJoystickStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
        document.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });
        
        // Button events
        this.fireBtn.addEventListener('touchstart', this.onFireStart.bind(this), { passive: false });
        this.fireBtn.addEventListener('touchend', this.onFireEnd.bind(this), { passive: false });
        this.dashBtn.addEventListener('touchstart', this.onDashStart.bind(this), { passive: false });
        this.dashBtn.addEventListener('touchend', this.onDashEnd.bind(this), { passive: false });
        
        // Desktop fallback - Keyboard
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Desktop fallback - Mouse
        this.game.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.game.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.game.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    }
    
    // === TOUCH JOYSTICK HANDLERS ===
    
    onMoveJoystickStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.touches.set(touch.identifier, { type: 'move', touch });
        this.moveJoystick.active = true;
        this.moveJoystickEl.classList.add('active');
        this.updateMoveJoystick(touch);
    }
    
    onAimJoystickStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.touches.set(touch.identifier, { type: 'aim', touch });
        this.aimJoystick.active = true;
        this.aimJoystickEl.classList.add('active');
        this.updateAimJoystick(touch);
    }
    
    onTouchMove(e) {
        e.preventDefault();
        
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            const tracked = this.touches.get(touch.identifier);
            
            if (tracked) {
                if (tracked.type === 'move') {
                    this.updateMoveJoystick(touch);
                } else if (tracked.type === 'aim') {
                    this.updateAimJoystick(touch);
                }
            }
        }
    }
    
    onTouchEnd(e) {
        e.preventDefault();
        
        // Find ended touches
        const currentTouches = new Set(Array.from(e.touches).map(t => t.identifier));
        
        for (const [id, tracked] of this.touches.entries()) {
            if (!currentTouches.has(id)) {
                if (tracked.type === 'move') {
                    this.moveJoystick.active = false;
                    this.moveJoystick.x = 0;
                    this.moveJoystick.y = 0;
                    this.moveJoystick.distance = 0;
                    this.moveJoystickEl.classList.remove('active');
                    this.moveStick.style.transform = 'translate(-50%, -50%)';
                } else if (tracked.type === 'aim') {
                    this.aimJoystick.active = false;
                    this.aimJoystick.x = 0;
                    this.aimJoystick.y = 0;
                    this.aimJoystick.distance = 0;
                    this.aimJoystickEl.classList.remove('active');
                    this.aimStick.style.transform = 'translate(-50%, -50%)';
                }
                this.touches.delete(id);
            }
        }
    }
    
    updateMoveJoystick(touch) {
        const rect = this.moveJoystickEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const dx = touch.clientX - centerX;
        const dy = touch.clientY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        // Clamp to max distance
        const clampedDistance = Math.min(distance, this.joystickMaxDistance);
        
        // Update joystick state
        this.moveJoystick.x = Math.cos(angle) * clampedDistance / this.joystickMaxDistance;
        this.moveJoystick.y = Math.sin(angle) * clampedDistance / this.joystickMaxDistance;
        this.moveJoystick.angle = angle;
        this.moveJoystick.distance = clampedDistance / this.joystickMaxDistance;
        
        // Update visual
        const stickX = Math.cos(angle) * clampedDistance;
        const stickY = Math.sin(angle) * clampedDistance;
        this.moveStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
    }
    
    updateAimJoystick(touch) {
        const rect = this.aimJoystickEl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const dx = touch.clientX - centerX;
        const dy = touch.clientY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        
        // Clamp to max distance
        const clampedDistance = Math.min(distance, this.joystickMaxDistance);
        
        // Update joystick state
        this.aimJoystick.x = Math.cos(angle) * clampedDistance / this.joystickMaxDistance;
        this.aimJoystick.y = Math.sin(angle) * clampedDistance / this.joystickMaxDistance;
        this.aimJoystick.angle = angle;
        this.aimJoystick.distance = clampedDistance / this.joystickMaxDistance;
        
        // Update visual
        const stickX = Math.cos(angle) * clampedDistance;
        const stickY = Math.sin(angle) * clampedDistance;
        this.aimStick.style.transform = `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;
    }
    
    // === BUTTON HANDLERS ===
    
    onFireStart(e) {
        e.preventDefault();
        this.fireButton = true;
    }
    
    onFireEnd(e) {
        e.preventDefault();
        this.fireButton = false;
    }
    
    onDashStart(e) {
        e.preventDefault();
        this.dashButton = true;
    }
    
    onDashEnd(e) {
        e.preventDefault();
        this.dashButton = false;
    }
    
    // === DESKTOP FALLBACK ===
    
    onKeyDown(e) {
        this.keys[e.key.toLowerCase()] = true;
        
        // Dash on space or shift
        if (e.key === ' ' || e.key === 'Shift') {
            this.dashButton = true;
        }
    }
    
    onKeyUp(e) {
        this.keys[e.key.toLowerCase()] = false;
        
        if (e.key === ' ' || e.key === 'Shift') {
            this.dashButton = false;
        }
    }
    
    onMouseMove(e) {
        const rect = this.game.canvas.getBoundingClientRect();
        this.mousePos.x = e.clientX - rect.left;
        this.mousePos.y = e.clientY - rect.top;
    }
    
    onMouseDown(e) {
        if (e.button === 0) { // Left click
            this.mouseDown = true;
            this.fireButton = true;
        }
    }
    
    onMouseUp(e) {
        if (e.button === 0) {
            this.mouseDown = false;
            this.fireButton = false;
        }
    }
    
    // === PUBLIC API ===
    
    getMovementInput() {
        // Touch joystick has priority
        if (this.moveJoystick.active) {
            return {
                x: this.moveJoystick.x,
                y: this.moveJoystick.y
            };
        }
        
        // Desktop keyboard fallback
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
    
    getAimInput() {
        // Touch joystick has priority
        if (this.aimJoystick.active && this.aimJoystick.distance > 0.2) {
            return {
                active: true,
                angle: this.aimJoystick.angle,
                x: this.aimJoystick.x,
                y: this.aimJoystick.y
            };
        }
        
        // Desktop mouse fallback
        if (this.game.player) {
            const dx = this.mousePos.x - this.game.player.x;
            const dy = this.mousePos.y - this.game.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 10) {
                const angle = Math.atan2(dy, dx);
                return {
                    active: true,
                    angle: angle,
                    x: Math.cos(angle),
                    y: Math.sin(angle)
                };
            }
        }
        
        return { active: false, angle: 0, x: 0, y: 0 };
    }
    
    isFirePressed() {
        return this.fireButton || this.mouseDown;
    }
    
    isDashPressed() {
        return this.dashButton;
    }
    
    resetDashButton() {
        this.dashButton = false;
    }
}
