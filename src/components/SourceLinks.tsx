type Props = {
  filingUrl?: string | null;
  transcriptUrl?: string | null;
};

export function SourceLinks({ filingUrl, transcriptUrl }: Props) {
  return (
    <div className="flex gap-3">
      {filingUrl ? (
        <a href={filingUrl} className="text-sm underline underline-offset-4 hover:opacity-80" target="_blank" rel="noreferrer">
          Open 8‑K
        </a>
      ) : null}
      {transcriptUrl ? (
        <a href={transcriptUrl} className="text-sm underline underline-offset-4 hover:opacity-80" target="_blank" rel="noreferrer">
          Open Transcript
        </a>
      ) : null}
    </div>
  );
}


