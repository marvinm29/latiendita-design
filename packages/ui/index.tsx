import type { ComponentChildren, JSX } from "preact";

/**
 * @latiendita/ui — componentes Preact sobre las clases de `design/assets/ui.css`.
 *
 * Contrato (DESIGN.md): sólo tokens semánticos, targets ≥48px, foco 2px+2px,
 * nunca color solo, copy en español (tú neutro). M0: esqueleto con `Button`;
 * el resto de componentes se porta desde el gallery/preview en M1+.
 */

export type ButtonVariant = "primary" | "secondary";

export interface ButtonProps {
  variant?: ButtonVariant;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: JSX.MouseEventHandler<HTMLButtonElement>;
  children?: ComponentChildren;
}

export function Button({
  variant = "primary",
  type = "button",
  fullWidth = false,
  children,
  ...rest
}: ButtonProps) {
  const classes = ["btn", `btn-${variant}`].filter(Boolean).join(" ");
  const style = fullWidth ? "width: 100%;" : undefined;
  return (
    <button type={type} class={classes} style={style} {...rest}>
      {children}
    </button>
  );
}
