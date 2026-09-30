import { render } from "preact";
import sprite from "../../../design/assets/icons.svg?raw";
import { solicitarPersistencia } from "@latiendita/core";
import "@latiendita/tokens/tokens.css";
import "../../../design/assets/base.css";
import "../../../design/assets/ui.css";
import "./shell.css";
import { App } from "./app";

// Pide almacenamiento persistente (C8.5): protege IndexedDB de la evicción.
// `solicitarPersistencia` ya guarda el entorno (no-op fuera del navegador).
void solicitarPersistencia();

// Sprite Lucide (design/assets/icons.svg) una sola vez en el documento.
const spriteHost = document.createElement("div");
spriteHost.className = "icon-sprite";
spriteHost.setAttribute("aria-hidden", "true");
spriteHost.innerHTML = sprite;
document.body.prepend(spriteHost);

const root = document.getElementById("app");
if (root) {
  render(<App />, root);
}
