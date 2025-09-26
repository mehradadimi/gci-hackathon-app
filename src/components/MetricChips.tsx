type Props = {
  flags: string[];
};

export function MetricChips({ flags }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {flags.map((f) => (
        <span key={f} className="inline-flex items-center rounded-full px-2 py-1 text-xs ring-1 ring-neutral-200 text-neutral-700 before:mr-2 before:inline-block before:size-2 before:rounded-full before:bg-neutral-400">
          {f}
        </span>
      ))}
    </div>
  );
}


