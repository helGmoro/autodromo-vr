// Constantes de negocio: modalidades, duraciones y precios

export const EXPERIENCIAS = {
  GRAND_PRIX: {
    id: "GRAND_PRIX",
    nombre: "Grand Prix",
    duracionMin: 60,
    precio: 15000,
  },
  MINI_GRAND_PRIX: {
    id: "MINI_GRAND_PRIX",
    nombre: "Mini Grand Prix",
    duracionMin: 30,
    precio: 10000,
  },
  QUICK_RACE: {
    id: "QUICK_RACE",
    nombre: "Quick Race",
    duracionMin: 15,
    precio: 8000,
  },
};

export const CAPACIDAD_DEFAULT = 6;

export const HORARIOS_DEFAULT = {
  weekday: { open: "16:00", close: "22:00" },
  weekend: { open: "14:00", close: "20:00" },
};

export function experienciaPorId(id) {
  return Object.values(EXPERIENCIAS).find((e) => e.id === id);
}
