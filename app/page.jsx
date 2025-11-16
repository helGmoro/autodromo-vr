"use client";
import { useEffect, useState } from "react";
import { EXPERIENCIAS } from "@/lib/constants";

// Página de inicio - Landing page one-page
export default function HomePage() {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    fetch('/api/settings').then(r=>r.json()).then(j=>{
      if (j?.settings) setSettings(j.settings);
    }).catch(()=>{});
  }, []);
  const price = (id, fallback) => {
    const v = settings?.pricing?.[id];
    return typeof v === 'number' ? v : fallback;
  };
  return (
    <div className="min-h-screen -mt-8 -mx-4">
      {/* Hero Section con imagen de fondo */}
      <section className="relative h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Imagen de fondo con overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-[var(--bg)]">
          <img 
            src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1920&h=1080&fit=crop&q=80" 
            alt="F1 Racing Circuit"
            className="w-full h-full object-cover opacity-50"
          />
        </div>
        
        {/* Contenido Hero */}
        <div className="relative z-10 text-center px-4 max-w-4xl">
          <div className="mb-6">
            <div className="inline-block w-16 h-2 bg-[var(--rojo)] mb-4"></div>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6">
            VR AUTÓDROMO
          </h1>
          <p className="text-xl md:text-2xl text-neutral-300 mb-8 max-w-2xl mx-auto">
            Vive la experiencia de pilotar en simuladores profesionales de última generación
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="/reservas" className="btn btn-rojo text-lg px-8 py-3">
              Reservar Ahora
            </a>
            <a href="#experiencias" className="btn bg-neutral-800 hover:bg-neutral-700 text-lg px-8 py-3">
              Ver Experiencias
            </a>
          </div>
        </div>
      </section>

      {/* Por qué elegirnos */}
      <section className="py-20 px-4 bg-gradient-to-b from-[var(--bg)] to-neutral-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-16">¿Por qué elegirnos?</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--rojo)]/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-[var(--rojo)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-bold text-xl mb-2">Simuladores</h3>
              <p className="text-neutral-400 text-sm">Equipos profesionales de última generación</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--naranja)]/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-[var(--naranja)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-xl mb-2">Reserva Online</h3>
              <p className="text-neutral-400 text-sm">Sistema fácil y rápido de reservas</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--rojo)]/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-[var(--rojo)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-xl mb-2">Horarios Flexibles</h3>
              <p className="text-neutral-400 text-sm">Abierto todos los días con múltiples horarios</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--naranja)]/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-[var(--naranja)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <h3 className="font-bold text-xl mb-2">Experiencias Únicas</h3>
              <p className="text-neutral-400 text-sm">Desde 15 minutos hasta 1 hora de carrera</p>
            </div>
          </div>
        </div>
      </section>

      {/* Nuestras Experiencias */}
      <section id="experiencias" className="py-20 px-4 bg-neutral-950">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-4">Nuestras Experiencias</h2>
          <p className="text-center text-neutral-400 mb-16 max-w-2xl mx-auto">
            Elige la modalidad perfecta para ti. Seña del 50% para confirmar tu turno.
          </p>
          
          <div className="grid md:grid-cols-3 gap-6">
            {/* Quick Race */}
            <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border-2 border-[var(--rojo)]/30 rounded-2xl p-8 hover:border-[var(--rojo)] transition-all duration-300 hover:scale-105">
              <div className="text-[var(--rojo)] text-2xl font-bold mb-2">Quick Race</div>
              <div className="text-5xl font-black mb-4">${price(EXPERIENCIAS.QUICK_RACE.id, 8000).toLocaleString('es-AR')}</div>
              <div className="text-neutral-400 mb-6">15 minutos de carrera</div>
              <p className="text-sm text-neutral-500 mb-6">Perfecta para una dosis rápida de adrenalina</p>
              <a href="/reservas" className="block w-full text-center btn bg-[var(--rojo)]/10 hover:bg-[var(--rojo)] border border-[var(--rojo)] transition-colors">
                Reservar
              </a>
            </div>

            {/* Mini Grand Prix */}
            <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border-2 border-[var(--naranja)]/30 rounded-2xl p-8 hover:border-[var(--naranja)] transition-all duration-300 hover:scale-105">
              <div className="text-[var(--naranja)] text-2xl font-bold mb-2">Mini Grand Prix</div>
              <div className="text-5xl font-black mb-4">${price(EXPERIENCIAS.MINI_GRAND_PRIX.id, 10000).toLocaleString('es-AR')}</div>
              <div className="text-neutral-400 mb-6">30 minutos de carrera</div>
              <p className="text-sm text-neutral-500 mb-6">Ideal para conocer los simuladores y la adrenalina de la pista</p>
              <a href="/reservas" className="block w-full text-center btn bg-[var(--naranja)]/10 hover:bg-[var(--naranja)] border border-[var(--naranja)] transition-colors">
                Reservar
              </a>
            </div>

            {/* Grand Prix */}
            <div className="bg-gradient-to-br from-[var(--rojo)]/20 to-neutral-950 border-2 border-[var(--rojo)] rounded-2xl p-8 relative overflow-hidden hover:scale-105 transition-all duration-300">
              <div className="absolute top-4 right-4 bg-[var(--rojo)] text-xs px-3 py-1 rounded-full font-bold">
                DESTACADO
              </div>
              <div className="text-[var(--rojo)] text-2xl font-bold mb-2">Grand Prix</div>
              <div className="text-5xl font-black mb-4">${price(EXPERIENCIAS.GRAND_PRIX.id, 15000).toLocaleString('es-AR')}</div>
              <div className="text-neutral-400 mb-6">1 hora de carrera</div>
              <p className="text-sm text-neutral-500 mb-6">La experiencia completa para verdaderos pilotos</p>
              <a href="/reservas" className="block w-full text-center btn btn-rojo">
                Reservar
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Horarios */}
      <section className="py-20 px-4 bg-gradient-to-b from-neutral-950 to-[var(--bg)]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-8">Horarios</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8">
              <div className="text-[var(--naranja)] text-xl font-bold mb-3">Lunes a Viernes</div>
              <div className="text-4xl font-black">16:00 - 22:00</div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8">
              <div className="text-[var(--naranja)] text-xl font-bold mb-3">Sábados y Domingos</div>
              <div className="text-4xl font-black">14:00 - 20:00</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">¿Listo para la pista?</h2>
          <p className="text-xl text-neutral-400 mb-8">
            Reserva tu simulador ahora y siente la velocidad
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <a href="/reservas" className="btn btn-rojo text-lg px-10 py-4">
              Reservar Ahora
            </a>
            <a href="/login" className="btn bg-neutral-800 hover:bg-neutral-700 text-lg px-10 py-4">
              Crear Cuenta
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
