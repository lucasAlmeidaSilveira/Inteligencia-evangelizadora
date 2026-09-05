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
};

export default nextConfig;
