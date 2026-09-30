# @latiendita/ui

Componentes **Preact** de LaTiendita, construidos sobre las clases de
[`design/assets/ui.css`](../../design/assets/ui.css) y los tokens de
`@latiendita/tokens`.

## Contrato

- Sólo **tokens semánticos** (`--color-action`, `--color-text-muted`, …) — nunca
  hex ni pasos crudos (`--teal-9`).
- Targets ≥48px, foco 2px + offset 2px, estados nunca sólo con color.
- Copy en español (tú neutro). Ver `design/ACCESSIBILITY.md` (WCAG 2.2 AA).

## Estado (M0)

Esqueleto: existe `Button` (`primary` | `secondary`) como referencia de patrón.
El catálogo completo de componentes (cards, chips, keypad, banner offline… ya
diseñados en `design/preview.html`) se porta aquí durante M1+.

## Uso

```tsx
import { Button } from "@latiendita/ui";

<Button variant="primary" onClick={() => guardar()}>
  Guardar
</Button>;
```

Requiere que la app cargue antes `tokens.css` + `base.css` + `ui.css`.
