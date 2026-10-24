import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * O `firebase-admin` não deve ser empacotado pelo bundler.
   *
   * Ele carrega dependências nativas e opcionais em tempo de execução; ao ser
   * empacotado, essas importações se perdem ou viram require() de módulos que
   * o bundler transformou. Marcá-lo como externo faz o Node resolvê-lo do
   * node_modules, que é como a biblioteca espera ser carregada.
   */
  serverExternalPackages: ["firebase-admin"],

  /*
   * Cabeçalhos da única rota pública, a pesquisa de satisfação. O token está
   * na URL, então a página não pode ser emoldurada por terceiros (clickjacking
   * sobre o botão de enviar), não pode mandar a URL como Referer a lugar
   * nenhum e não deve ser indexada. As metatags da página dizem o mesmo; os
   * cabeçalhos valem antes de o HTML ser lido.
   */
  async headers() {
    return [
      {
        source: "/pesquisa/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; form-action 'self'",
          },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
