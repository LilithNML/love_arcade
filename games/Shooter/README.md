# Space Shooter - Love Arcade

## Descripción

Space Shooter es un juego arcade de acción rápida donde debes sobrevivir oleadas infinitas de enemigos espaciales. La dificultad aumenta progresivamente mientras acumulas puntos y ganas monedas para usar en Love Arcade.

## Características

- **Modo Infinito**: Oleadas interminables con dificultad progresiva
- **Controles Touch**: Optimizado para móviles con joysticks duales
- **Sistema de Dash**: Esquiva enemigos con el dash invulnerable
- **Disparos Cargados**: Mantén presionado para cargar un disparo potente
- **4 Tipos de Enemigos**: Scout, Shooter, Tank y Elite, cada uno con patrones únicos
- **Sistema de Multiplicadores**: Encadena kills para multiplicar tu puntuación
- **Recompensas por Hitos**: Gana monedas al alcanzar puntuaciones específicas
- **Soporte Desktop**: Juega con teclado y mouse

## Cómo Jugar

### Móvil
- **Joystick Izquierdo**: Movimiento del jugador
- **Joystick Derecho**: Apuntar dirección de disparo
- **Botón de Fuego**: Disparar (auto-fire disponible en ajustes)
- **Botón de Dash**: Realizar dash evasivo (cooldown de 1.5s)
- **Swipe Rápido**: Dash alternativo en cualquier dirección

### Escritorio
- **WASD / Flechas**: Movimiento
- **Mouse**: Apuntar
- **Click Izquierdo**: Disparar
- **Mantener Click**: Cargar disparo
- **Espacio / Shift**: Dash
- **ESC / P**: Pausa

## Enemigos

### Scout (Rojo)
- Rápido y ágil
- Movimiento en zigzag
- Dispara ocasionalmente hacia abajo
- **Recompensa**: 10 puntos + 1 moneda

### Shooter (Rojo Oscuro)
- Velocidad media
- Dispara ráfagas apuntadas al jugador
- Patrón de 3 balas en spread
- **Recompensa**: 25 puntos + 2 monedas

### Tank (Marrón Rojizo)
- Lento pero resistente
- Dispara patrón de 5 balas en abanico
- Mucha vida
- **Recompensa**: 50 puntos + 5 monedas

### Elite (Púrpura)
- Inteligente y peligroso
- Rastrea al jugador horizontalmente
- Dispara proyectiles que buscan
- Brilla con efecto visual
- **Recompensa**: 100 puntos + 10 monedas

## Sistema de Puntuación

- **Multiplicador**: Encadena enemigos destruidos para aumentar tu multiplicador (hasta x8)
- **Duración del Multiplicador**: 3 segundos después de cada kill
- **Reinicio**: El multiplicador se reinicia si recibes daño

### Hitos de Monedas
- 1,000 puntos → 10 monedas
- 2,500 puntos → 25 monedas
- 5,000 puntos → 50 monedas
- 10,000 puntos → 100 monedas
- 25,000 puntos → 250 monedas
- 50,000 puntos → 500 monedas

## Ajustes

Accede al menú de ajustes durante la pausa para personalizar:
- **Disparo Automático**: Activa/desactiva auto-fire
- **Efectos de Sonido**: Control de audio
- **Vibración**: Feedback háptico en móviles
- **Sensibilidad**: Ajusta la respuesta de los controles (0.5x - 2x)

## Consejos y Estrategias

1. **Usa el Dash Sabiamente**: El dash te hace invulnerable brevemente. Úsalo para atravesar enemigos o esquivar ráfagas de balas.

2. **Mantén el Multiplicador**: Intenta mantener el multiplicador alto encadenando kills rápidamente para maximizar puntos.

3. **Prioriza Amenazas**: Los Shooters y Elites son más peligrosos que los Scouts. Elimínalos primero.

4. **Disparo Cargado**: Usa el disparo cargado (mantener presionado) contra Tanks y Elites para eliminarlos rápido.

5. **Posicionamiento**: Mantente en la parte inferior de la pantalla para tener más tiempo de reacción.

6. **Movimiento Constante**: Nunca te quedes quieto. El movimiento constante dificulta que te alcancen.

## Integración con Love Arcade

Este juego está completamente integrado con el sistema de monedas de Love Arcade:

- Las monedas ganadas se acumulan automáticamente en tu cuenta de Love Arcade
- Los hitos se guardan para evitar duplicados
- Funciona en modo standalone si Love Arcade no está disponible
- Todas las recompensas se otorgan al final de la partida

## Compatibilidad

- **Navegadores**: Chrome, Firefox, Safari, Edge (versiones modernas)
- **Dispositivos**: Móviles (iOS/Android), Tablets, Desktop
- **Orientación**: Soporta tanto vertical como horizontal
- **Performance**: Optimizado para 60 FPS en dispositivos modernos

## Audio

El juego utiliza Web Audio API para generar sonidos procedurales:
- Efectos de disparo
- Explosiones de enemigos
- Impactos del jugador
- Sonidos de dash
- Notificaciones de hitos
- Música de game over

Todos los sonidos se generan en tiempo real, sin necesidad de archivos de audio externos.

## Arquitectura Técnica

### Módulos Core
- **la-core-loop.mjs**: Game loop con timestep fijo (60 FPS)
- **la-core-renderer.mjs**: Sistema de renderizado Canvas2D
- **la-core-input.mjs**: Sistema unificado de input (touch/keyboard/mouse)
- **la-core-pool.mjs**: Object pooling para performance

### Sistemas
- **la-ui.mjs**: Gestión de HUD y overlays
- **la-sound.mjs**: Sistema de audio procedural

### Entidades
- **la-player.mjs**: Lógica del jugador
- **la-enemy-factory.mjs**: Creación y comportamiento de enemigos

### Modos
- **la-mode-infinite.mjs**: Modo infinito con oleadas

## Configuración

Toda la configuración del juego se encuentra en `js/config/la-config.json`:
- Propiedades del jugador
- Configuración de balas
- Stats de enemigos
- Sistema de oleadas
- Recompensas y hitos
- Configuración de partículas

## Solución de Problemas

**El juego no carga:**
- Verifica que todos los archivos estén en las rutas correctas
- Comprueba la consola del navegador para errores
- Asegúrate de que el navegador soporta ES6 modules

**Los controles no responden:**
- En móvil: asegúrate de tocar dentro de los joysticks
- En desktop: verifica que el canvas tenga el foco

**Bajo rendimiento:**
- Reduce el número máximo de balas en la config
- Desactiva partículas o reduce su cantidad
- Cierra otras pestañas del navegador

**Sin sonido:**
- Verifica que los efectos de sonido estén activados en ajustes
- Algunos navegadores requieren interacción del usuario antes de reproducir audio
- Comprueba el volumen del sistema
