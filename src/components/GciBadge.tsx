type Props = {
  score: number;
};

export function GciBadge({ score }: Props) {
  const variant = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
  const classes =
    variant === 'high'
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
      : variant === 'medium'
      ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
      : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
  const label = variant === 'high' ? 'High' : variant === 'medium' ? 'Medium' : 'Low';
  return (
    <span aria-label={`Credibility: ${label}`} className={`inline-flex items-center rounded px-2 py-1 text-sm ${classes}`}>
      GCI {Math.round(score)}
    </span>
  );
}


