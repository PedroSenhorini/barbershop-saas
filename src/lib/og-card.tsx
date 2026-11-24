/**
 * Cartão 1200x630 das prévias de link (WhatsApp, Instagram, etc.), desenhado
 * com ImageResponse (next/og). Mesmo visual do app: fundo escuro, tesoura.
 * Só estilos inline e flexbox: é o que o renderizador do next/og entende.
 */

export const OG_SIZE = { width: 1200, height: 630 };

export function OgCard({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string | null;
  badge: string;
}) {
  // Nomes longos encolhem para não estourar o cartão.
  const titleSize = title.length > 34 ? 64 : title.length > 22 ? 78 : 92;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#171717",
        color: "#ffffff",
      }}
    >
      <div
        style={{
          width: 104,
          height: 104,
          borderRadius: 52,
          background: "rgba(255,255,255,0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="6" cy="6" r="3" />
          <path d="M8.12 8.12 12 12" />
          <path d="M20 4 8.12 15.88" />
          <circle cx="6" cy="18" r="3" />
          <path d="M14.8 14.8 20 20" />
        </svg>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 34, color: "rgba(255,255,255,0.72)", lineHeight: 1.3 }}>{subtitle}</div>
        )}
      </div>

      <div style={{ display: "flex" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "#ffffff",
            color: "#171717",
            borderRadius: 999,
            padding: "18px 36px",
            fontSize: 34,
            fontWeight: 600,
          }}
        >
          {badge}
        </div>
      </div>
    </div>
  );
}
