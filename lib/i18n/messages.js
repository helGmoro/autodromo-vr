// Mensajes centralizados (i18n futuro)
export const MESSAGES = {
  es: {
    perfil: 'Mi Perfil',
    historialReservas: 'Historial de reservas',
    cancelar: 'Cancelar',
    exportarCsv: 'Exportar CSV',
    aplicarFiltros: 'Filtrar',
    limpiarFiltros: 'Limpiar',
    nuevoEmail: 'Nuevo email',
    nuevaPassword: 'Nueva contraseña',
  }
};

export function t(key, locale='es') {
  return MESSAGES[locale]?.[key] || key;
}