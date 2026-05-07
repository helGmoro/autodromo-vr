# VR Autódromo — Reservas de simuladores

Sitio web full stack (Next.js + Supabase + Mercado Pago) para gestionar reservas de un autódromo virtual con hasta 6 simuladores.

## Tecnologías
- Frontend: Next.js (App Router) + React + Tailwind CSS
- Backend: Rutas API en Next.js (serverless, ideal para Vercel)
- Base de datos: PostgreSQL gestionada por Supabase
- Pagos: Mercado Pago (Checkout Pro)

## Funcionalidades
- Registro/Login de usuarios (correo y contraseña) + perfil: DNI, nombre, apellido, teléfono, edad y altura.
  - Validación: edad >= 13, altura > 140 cm.
- Modalidades: Grand Prix (60m, $15.000), Mini Grand Prix (30m, $10.000), Quick Race (15m, $8.000).
- Disponibilidad por fecha/hora según:
  - Capacidad configurable (por defecto 6 simuladores)
  - Horarios de apertura (L-V: 16–22, S-D: 14–20) ajustables en panel admin
  - Solapamiento con otras reservas
- **Gestión de pagos pendientes**:
  - Reservas sin pago quedan en estado "pending" con 24 horas para completar
  - Cancelación automática de reservas pendientes >24h (cron cada 2 horas)
  - Vista de reservas pendientes en página de reservas con botones para pagar o cancelar
- Reserva con seña del 50% a través de Mercado Pago.
- Panel Admin:
  - Listado de reservas con detalles
  - Ingresos (seña cobrada) por semana/mes/año
  - **Analytics** (métricas avanzadas): conversión, uso de promociones, ingresos potenciales vs confirmados, heatmap de ocupación por hora
  - Configurar capacidad y horarios
  - Crear/eliminar promociones con reglas genéricas (2x1, descuentos por porcentaje, días específicos, cantidad mínima)
- **Perfil de usuario avanzado**:
  - Página "Mi cuenta" con datos personales editables (nombre, DNI, teléfono, edad, altura, avatar)
  - Cambio de email con re-verificación
  - Cambio de contraseña
  - Historial de reservas con filtros por estado y rango de fechas
  - Exportar historial a CSV
  - Cancelación de reservas pendientes (>24h antes)
  - Vista de pagos aprobados y saldo restante
  - Badge de promociones aplicadas
- **Verificación de email obligatoria**: usuarios deben confirmar su correo antes de poder iniciar sesión
- **Preview de descuentos en tiempo real** al reservar

## Requisitos
- Node.js 18+
- Cuenta de Supabase (proyecto, URL y keys)
- Cuenta de Mercado Pago con token de acceso y webhook configurado
