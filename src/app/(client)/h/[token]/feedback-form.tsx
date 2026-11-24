"use client";

import { useState, useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { submitFeedback } from "./feedback-actions";

export function FeedbackForm({
  token,
  existing,
  googleUrl,
}: {
  token: string;
  existing: number | null;
  googleUrl: string | null;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<{ googleUrl: string | null } | null>(
    existing ? { googleUrl: existing >= 4 ? googleUrl : null } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="space-y-3 rounded-xl border bg-card p-4 text-center">
        <p className="font-medium">Obrigado pela avaliação! 💈</p>
        {done.googleUrl && (
          <>
            <p className="text-sm text-muted-foreground">Que bom que gostou! Pode contar no Google? Ajuda muito a barbearia.</p>
            <a href={done.googleUrl} target="_blank" rel="noreferrer" className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}>
              Avaliar no Google
            </a>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <p className="font-medium">Como foi o atendimento?</p>
      <div className="flex justify-center gap-1" role="radiogroup" aria-label="Nota">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)}
            className="p-1"
          >
            <Star className={cn("size-9", n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder={rating >= 4 ? "Quer deixar um elogio? (opcional)" : "O que podemos melhorar? (opcional)"}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="button"
        size="lg"
        className="h-12 w-full gap-2 text-base"
        disabled={rating === 0 || pending}
        onClick={() =>
          start(async () => {
            const r = await submitFeedback(token, rating, comment);
            if ("error" in r) setError(r.error);
            else setDone({ googleUrl: r.googleUrl });
          })
        }
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        Enviar avaliação
      </Button>
    </div>
  );
}
