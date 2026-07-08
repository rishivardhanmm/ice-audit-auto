import { cn } from "@/lib/utils";

export function ScoreGauge({ score, className }: { score: number; className?: string }) {
  const color = score < 50 ? "#dc2626" : score < 70 ? "#ea580c" : score < 86 ? "#ca8a04" : "#059669";

  return (
    <div className={cn("relative grid size-28 place-items-center", className)}>
      <svg className="absolute inset-0 size-28 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="51" fill="none" stroke="#e4e4e7" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="51"
          fill="none"
          stroke={color}
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={`${Math.max(0, Math.min(100, score)) * 3.204} 320.4`}
        />
      </svg>
      <div className="text-center">
        <div className="text-3xl font-bold text-zinc-950">{score}</div>
        <div className="text-xs font-medium text-zinc-500">/100</div>
      </div>
    </div>
  );
}
