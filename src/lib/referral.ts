/** Código de indicação: 8 letras/números maiúsculos (default do schema.sql). */
export function normalizeReferralCode(value: unknown) {
  if (typeof value !== "string") return null;
  const v = value.trim().toUpperCase();
  return /^[A-Z0-9]{8}$/.test(v) ? v : null;
}
