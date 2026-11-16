import { z } from "zod";

/** Caminhos do próprio app que não podem virar o link de uma barbearia. */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "login", "cadastro", "entrar", "sair", "app", "painel",
  "demo", "termos", "privacidade", "precos", "ajuda", "suporte",
]);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use só letras minúsculas, números e hífen.")
  .min(3, "O link precisa ter pelo menos 3 caracteres.")
  .max(40, "O link pode ter no máximo 40 caracteres.")
  .refine((s) => !RESERVED_SLUGS.has(s), "Esse link é reservado. Escolha outro.");
