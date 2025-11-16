"use client";
export function Skeleton({ className="", lines=1 }) {
  return (
    <div className={`animate-pulse ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_,i)=>(
        <div key={i} className="h-4 bg-neutral-800 rounded mb-2 last:mb-0" />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="p-4 border border-neutral-800 rounded-xl bg-neutral-900 animate-pulse">
      <div className="h-5 bg-neutral-800 rounded w-1/3 mb-3" />
      <div className="space-y-2">
        <div className="h-4 bg-neutral-800 rounded w-full" />
        <div className="h-4 bg-neutral-800 rounded w-5/6" />
        <div className="h-4 bg-neutral-800 rounded w-2/3" />
      </div>
    </div>
  );
}