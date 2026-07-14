import { Box, Building2, Candy, PackageOpen, Scale, Tag, Truck, UsersRound, Warehouse } from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { label: "Produtos", icon: Box, to: "/cadastros/produtos" },
  { label: "Sabores", icon: Candy, to: "/cadastros/sabores" },
  { label: "Câmaras", icon: Warehouse, to: "/cadastros/camaras" },
  { label: "Equipe", icon: UsersRound, to: "/cadastros/equipe" },
  { label: "Formatos", icon: PackageOpen, to: "/cadastros/formatos" },
  { label: "Veículos", icon: Truck, to: "/cadastros/veiculos" },
  { label: "Clientes", icon: Building2, to: "/cadastros/clientes" },
  { label: "Perdas", icon: Tag, to: "/cadastros/perdas" },
  { label: "Mínimos", icon: Scale, to: "/cadastros/minimos" },
];

export function AdministrationTabs() {
  return (
    <nav className="administration-tabs" aria-label="Cadastros e configurações">
      {items.map(({ label, icon: Icon, to }) => (
        <NavLink key={to} to={to}>
          <Icon size={16} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
