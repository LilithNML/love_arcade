export default class InputHandler {
    constructor() {
        this.keys = { left: false, right: false };

        // Teclado
        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = true;
            if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = true;
        });
        window.addEventListener('keyup', (e) => {
            if (e.key === 'ArrowLeft' || e.key === 'a') this.keys.left = false;
            if (e.key === 'ArrowRight' || e.key === 'd') this.keys.right = false;
        });

        // Touch Areas (Extraídos del HTML por ID)
        const leftZone = document.getElementById('touchLeft');
        const rightZone = document.getElementById('touchRight');
        const touchControls = document.getElementById('touchControls');

        // Mostrar controles si es móvil
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            touchControls.classList.remove('hidden');
            touchControls.style.display = 'flex'; // Tailwind fix
        }

        const handleStart = (dir) => (e) => { e.preventDefault(); this.keys[dir] = true; };
        const handleEnd = (dir) => (e) => { e.preventDefault(); this.keys[dir] = false; };

        leftZone.addEventListener('touchstart', handleStart('left'), {passive: false});
        leftZone.addEventListener('touchend', handleEnd('left'), {passive: false});
        
        rightZone.addEventListener('touchstart', handleStart('right'), {passive: false});
        rightZone.addEventListener('touchend', handleEnd('right'), {passive: false});
    }
}
