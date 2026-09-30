import { describe, expect, it } from "vitest";
import { CORE_VERSION, type Rol } from "./index";

describe("@latiendita/core (esqueleto)", () => {
  it("expone una versión semántica", () => {
    expect(CORE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("el tipo Rol admite dueña y empleado", () => {
    const roles: Rol[] = ["dueña", "empleado"];
    expect(roles).toHaveLength(2);
  });
});
