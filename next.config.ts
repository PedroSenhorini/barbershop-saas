import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Só vale em `next dev`: sem isto, abrir o app pelo IP da rede (ex.: testar
  // no celular) carrega a página mas bloqueia os scripts, e nada responde ao
  // toque. Libera as faixas de rede local e o IP atual desta máquina.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "177.101.5.52"],
};

export default nextConfig;
