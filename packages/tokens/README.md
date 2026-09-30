# @latiendita/tokens

Design tokens de LaTiendita (colores, tipografía, espaciado, motion) para la app.

## Fuente

- **Origen único:** [`design/tokens/tokens.css`](../../design/tokens/tokens.css)
  (generado por `design/tokens/generate.py` desde Radix Colors v3 vendorizado).
- Este paquete lleva una **copia** del archivo para que pnpm/Vite lo resuelva
  como dependencia normal (`workspace:*`).

## Uso

```ts
import "@latiendita/tokens/tokens.css";
```

Luego usa **sólo variables semánticas** (`--color-action`, `--color-text`, …),
nunca pasos crudos (`--teal-9`) ni hex (contrato `design/DESIGN.md` §0).

## Sincronizar

Tras cambiar tokens en `design/`:

```bash
python3 design/tokens/generate.py   # regenera design/tokens/tokens.css
pnpm tokens:sync                    # copia al paquete
python3 design/tokens/verify_contrast.py  # matriz WCAG 2.2 AA → 0 fallos
```
