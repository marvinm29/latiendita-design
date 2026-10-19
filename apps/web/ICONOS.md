# Iconos de la PWA (C9)

Los PNG de `public/` se generaron a partir del icono de marca del sistema de
diseño (`public/icon.svg`: cuadrado Teal 9 `#12a594` con la “L” en Sand 1
`#fdfdfc`), **sin artefacto gráfico nuevo**:

```bash
cd apps/web/public
magick -background none icon.svg -resize 192x192 icon-192.png
magick -background none icon.svg -resize 512x512 icon-512.png
magick -background none icon.svg -resize 180x180 icon-180.png   # apple-touch-icon
```

- `icon-192.png` / `icon-512.png` → manifest (`purpose: "any"`).
- `icon-180.png` → `apple-touch-icon` de iOS (C9.1).
- `icon.svg` → favicon y variante vectorial del manifest (`sizes: "any"`).

El manifest lo genera `vite-plugin-pwa` desde `vite.config.ts` en el **build**
(`dist/manifest.webmanifest`). En `vite dev` no hay service worker ni manifest:
para probar instalación/A2HS usa `pnpm build && pnpm preview`.
