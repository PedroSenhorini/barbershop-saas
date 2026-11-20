"use client";

import { useEffect, useRef } from "react";
import { HONEYPOT_FIELD } from "@/lib/turnstile";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export const turnstileEnabled = Boolean(SITE_KEY);

/**
 * Widget do Cloudflare Turnstile. Sem NEXT_PUBLIC_TURNSTILE_SITE_KEY não
 * renderiza nada. Dentro de um <form>, o próprio widget cria o campo oculto
 * `cf-turnstile-response`; fora de form, use `onToken`. Para pedir um token
 * novo depois de um envio (o token vale uma vez só), troque a `key`.
 */
export function Turnstile({ onToken }: { onToken?: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return;
    let widgetId: string | null = null;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          language: "pt-br",
          callback: (token: string) => onTokenRef.current?.(token),
          "expired-callback": () => onTokenRef.current?.(null),
          "error-callback": () => onTokenRef.current?.(null),
        });
      })
      .catch(() => {
        // Script bloqueado: o servidor decide (sem token, a verificação falha).
      });
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={ref} className="min-h-[65px]" />;
}

/**
 * Campo-isca: fora da tela e fora do Tab. Pessoas não veem; robôs que
 * preenchem todo input acabam preenchendo este, e o servidor finge sucesso.
 */
export function Honeypot({ inputRef }: { inputRef?: React.Ref<HTMLInputElement> }) {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Não preencha
        <input ref={inputRef} type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}
