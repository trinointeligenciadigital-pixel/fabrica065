import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);
import { AdministrationTabs } from "./AdministrationTabs";

describe("AdministrationTabs", () => {
  it("reúne todos os cadastros em uma única navegação", () => {
    render(<MemoryRouter><AdministrationTabs /></MemoryRouter>);
    expect(screen.getByRole("navigation", { name: "Cadastros e configurações" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(9);
    for (const label of ["Produtos", "Sabores", "Câmaras", "Equipe", "Formatos", "Veículos", "Clientes", "Perdas", "Mínimos"]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("mantém a câmara selecionada em uma rota de QR", () => {
    render(<MemoryRouter initialEntries={["/cadastros/camaras/camara-1/qr"]}><AdministrationTabs /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Câmaras" })).toHaveClass("active");
  });
});
