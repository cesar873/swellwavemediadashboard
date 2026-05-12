import { SHEET_NAME, SHEET_URL } from "@/lib/data";

export function LiveFooter({ sources }: { sources: string }) {
  return (
    <p className="mt-10 text-[10px] text-muted-foreground">
      Live from{" "}
      <a
        className="underline hover:text-foreground"
        target="_blank"
        rel="noreferrer"
        href={SHEET_URL}
      >
        {SHEET_NAME}
      </a>
      {" — "}
      {sources} · cached 5 minutes
    </p>
  );
}
