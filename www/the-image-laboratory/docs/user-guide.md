# The Image Laboratory — Guía de Usuario

## Visión general

Suite de procesamiento de imágenes 100% en tu navegador. Sin servidor, sin conexión a internet durante el uso (solo se necesita para cargar la página). Tus imágenes **nunca salen de tu dispositivo**.

---

## Módulo I — Store Manager

**¿Para qué?** Preparar imágenes para una tienda: wallpapers originales + thumbnails 16:9.

**Pasos:**
1. Arrastra tus imágenes (cualquier formato)
2. Escribe el **nombre base** para cada imagen en el campo de texto
3. *(Opcional)* Clic en **"Recorte 16:9"** → ajusta el área → **"Aplicar Recorte"**
4. Clic en **"Procesar y Exportar ZIP"**

**Resultado en el ZIP:**
```
/wallpapers/nombre_abc12345.jpg    ← Original sin modificar
/thumbnails/nombre_abc12345_thumb.webp  ← Recorte 16:9 WebP 640×360
```

**Notas:**
- El wallpaper se copia sin tocar (máxima calidad, extensión original)
- Sin recorte manual → se usa la imagen completa como base del thumbnail
- El hash de 8 chars evita colisiones de nombre

---

## Módulo II — Puzzle Asset Creator

**¿Para qué?** Generar assets 1:1 para niveles de puzzle, con nomenclatura aleatoria.

**Pasos:**
1. Carga tus imágenes
2. Define el **rango de niveles** (ej. Desde: 1, Hasta: 100)
3. *(Opcional)* Ajusta el recorte 1:1 para cada imagen
4. Clic en **"Procesar y Exportar"**

**Resultado en el ZIP:**
```
nivel42.webp        ← 1440×1440px, calidad 0.9
nivel42_thumb.webp  ← 300×300px, calidad 0.3
nivel67.webp
nivel67_thumb.webp
...
```

**Notas:**
- Los números de nivel se asignan de forma **aleatoria** dentro del rango
- Si el rango es insuficiente (menor que el número de imágenes), aparece un aviso en rojo
- Sin recorte manual → se centra el cuadrado automáticamente

---

## Módulo III — Smart Compressor

**¿Para qué?** Reducir el peso de imágenes WebP/JPG/PNG para usarlas como thumbnails.

**Pasos:**
1. Arrastra los archivos a comprimir
2. Clic en **"Comprimir Todo"**
3. Verás el peso original y el resultado con el % ahorrado

**Resultado:**
- `imagen.webp` → `imagen_thumb.webp` (≈70% menos peso)

**Notas:**
- La compresión usa calidad 0.3 en WebP
- Todos los formatos de entrada se convierten a WebP
- El ZIP se descarga automáticamente

---

## Módulo IV — Filename Extractor

**¿Para qué?** Extraer nombres de muchos archivos rápidamente.

**Pasos:**
1. Arrastra cualquier cantidad de archivos (de cualquier tipo)
2. Usa los botones según tu necesidad:
   - **"Copiar nombres"** → copia los nombres exactos al portapapeles
   - **"Copiar normalizados"** → copia los nombres en minúsculas sin espacios ni acentos
   - **"Descargar .txt"** → descarga la lista numerada
   - Toggle **"Ver nombres normalizados"** → previsualiza la normalización en pantalla

---

## El Editor de Recorte

Aparece al hacer clic en cualquier botón de "Recorte":

- **Arrastrar la imagen** → mover el área de la imagen
- **Arrastrar los bordes del marco** → redimensionar el recorte
- **Botón "Resetear"** → vuelve al recorte inicial
- **Botón "Aplicar Recorte"** → guarda el recorte y cierra el modal
- **Tecla Escape o clic fuera** → cancela sin guardar

---

## Solución de problemas

### "La imagen de recorte no aparece"
- Asegúrate de usar Chrome 95+, Firefox 105+ o Safari 17+
- Verifica que el CDN de Cropper.js cargó (necesitas internet al abrir la página)

### "Error al procesar la imagen"
- Algunos formatos RAW (.CR2, .NEF, .ARW) no son compatibles con el navegador
- Convierte a JPEG/PNG/WebP primero

### "El ZIP no se descarga"
- Verifica que tu navegador no está bloqueando las descargas automáticas
- Busca el botón "Re-descargar ZIP" que aparece tras el procesamiento

### "El rango es insuficiente" (Módulo II)
- El rango debe tener tantos números como imágenes. Con 70 imágenes: Desde 1, Hasta 70 (mínimo)

### "Ahorro de compresión menor al esperado"
- Las imágenes ya muy comprimidas ofrecen menos margen de ahorro adicional
- Las imágenes con gradientes y fotografías logran más ahorro que las con texto/líneas finas

### El procesamiento es lento en móvil
- El procesamiento ocurre en un hilo separado para no bloquear la interfaz
- En móviles con poca RAM, considera procesar en lotes de 20-30 imágenes

---

## Formatos compatibles

| Formato | Lectura | Escritura |
|---------|---------|-----------|
| JPEG    | ✅      | WebP      |
| PNG     | ✅      | WebP      |
| WebP    | ✅      | WebP      |
| AVIF    | ✅*     | WebP      |
| GIF     | ✅*     | WebP      |
| BMP     | ✅      | WebP      |
| RAW     | ❌      | —         |

*Soporte variable según navegador
