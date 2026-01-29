# 🎮 WORD HUNT - LoveArcade

## Descripción
Word Hunt es un juego de sopa de letras (WordSearch) arcade con estética neo-retro oscura, completamente integrado con el sistema de monedas de LoveArcade.

## ✨ Características

### 🎨 Diseño
- **Estética Neo-Arcade Oscura**: Paleta oscura con acentos neón (rosa/cyan)
- **Tipografía**: Orbitron + Chakra Petch para look futurista
- **Animaciones fluidas**: CSS transitions y canvas rendering
- **Responsive**: Mobile-first design (móvil → tablet → desktop)
- **Partículas animadas** en el fondo

### 🎯 Gameplay
- **25+ niveles** configurables
- Grids desde 10×10 hasta 25×25
- Sistema de progreso persistente
- Palabras en múltiples direcciones (horizontal, vertical, diagonal)
- Detección de selección en tiempo real
- Visual feedback inmediato

### 💰 Integración LoveArcade
- ✅ Uso correcto de `window.GameCenter.completeLevel()`
- ✅ Prefijos únicos (`la_ws_`) en todo el código
- ✅ Prevención de doble pago por nivel
- ✅ Validación de tipos antes de enviar recompensas
- ✅ Modo standalone si GameCenter no existe
- ✅ Progreso guardado en `localStorage` con clave prefijada

## 📁 Estructura de Archivos

```
wordsearch/
├── index.html          # HTML principal con SVG inline
├── styles.css          # Estilos arcade completos
├── config.levels.js    # 25 niveles configurables
├── game.js            # Lógica principal del juego
└── README.md          # Esta documentación
```

## 🔧 Configuración

### Agregar/Modificar Niveles
Edita `config.levels.js`:

```javascript
{
    id: "lvl_XX",              // ID único
    title: "Nombre del Nivel", // Título descriptivo
    gridSize: 15,              // Tamaño de grid (min 10)
    words: ["PALABRA1", ...],  // Palabras a encontrar
    rewardCoins: 100           // Monedas de recompensa
}
```

### Validaciones Automáticas
El sistema valida automáticamente:
- IDs únicos
- `gridSize >= 10`
- `rewardCoins` entero positivo
- Array de palabras no vacío

## 🎮 Controles

### Escritorio
- **Click + Arrastrar**: Seleccionar palabra
- **Mouse**: Navegar menús

### Móvil
- **Touch + Arrastrar**: Seleccionar palabra
- **Tap**: Navegación
- **Panel de palabras colapsable** para ahorrar espacio

## 🔒 Cumplimiento Técnico

### ✅ Integración GameCenter
- [x] Uso de `window.GameCenter.completeLevel(gameId, levelId, coins)`
- [x] Verificación de existencia antes de llamar
- [x] No sobrescribe `window.GameCenter`
- [x] No toca claves reservadas del sistema
- [x] Validación de tipos (coins siempre entero positivo)
- [x] Manejo de errores graceful
- [x] Modo standalone funcional

### ✅ Seguridad
- [x] No modifica localStorage del sistema global
- [x] Usa clave prefijada `la_ws_completedLevels`
- [x] Validación de datos antes de enviar
- [x] No permite valores negativos o decimales

## 🚀 Instalación

1. Colocar la carpeta `wordsearch/` en `LoveArcade/games/`
2. Asegurar que existe `../../js/app.js` (relativo)
3. Abrir `index.html` en navegador

## 🎯 Flujo de Juego

1. **Pantalla Principal**: Mostrar stats y botones
2. **Selección de Nivel**: Grid con todos los niveles
3. **Gameplay**: Encontrar palabras en el grid
4. **Victoria**: Modal con recompensa → Siguiente nivel automático
5. **Progreso**: Guardado local + sync con GameCenter

## 🎨 Paleta de Colores

```css
--la-ws-bg-deep: #0a0e1a         /* Fondo principal */
--la-ws-bg-dark: #12172a         /* Fondo secundario */
--la-ws-bg-card: #1a2035         /* Cards/Panels */
--la-ws-accent-primary: #ff0080  /* Accent principal (rosa) */
--la-ws-accent-secondary: #00ffff /* Accent secundario (cyan) */
--la-ws-success: #00ff88         /* Palabras encontradas */
--la-ws-warning: #ffaa00         /* Recompensas */
```

## 📊 Rendimiento

### Optimizaciones
- Canvas rendering (evita miles de DOM nodes)
- `requestAnimationFrame` para partículas
- Evento delegation donde es posible
- Lazy rendering de listas largas
- CSS transforms para animaciones

### Target
- 60fps en interacciones principales
- Carga instantánea (<100ms)
- Soporte para grids hasta 25×25 sin lag

## 🔍 Debugging

### Console Logs
```javascript
[WordSearch] Inicializando...
[WordSearch] Progreso cargado: X niveles completados
[WordSearch] ✓ X niveles cargados correctamente
[WordSearch] GameCenter.completeLevel resultado: {...}
```

### Errores Comunes
- **"No se pudo colocar la palabra"**: Grid muy pequeño para las palabras
- **"GameCenter no disponible"**: Archivo `app.js` no cargado
- **"ID duplicado"**: Revisar `config.levels.js`

## 📝 Licencia
Parte del ecosistema LoveArcade.

---

**Desarrollado con ❤️ para LoveArcade**
