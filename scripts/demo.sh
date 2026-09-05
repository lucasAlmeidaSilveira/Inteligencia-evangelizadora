#!/usr/bin/env bash
#
# Banco de demonstração local, em Docker.
#
#   ./scripts/demo.sh subir      cria o container, aplica o schema e semeia
#   ./scripts/demo.sh derrubar   remove o container e tudo que há nele
#   ./scripts/demo.sh resemear   recria só os dados fictícios
#
# Nada aqui toca o banco de produção: as URLs abaixo são fixas e apontam para
# localhost. O semeador ainda recusa rodar contra qualquer outro host.
set -euo pipefail

CONTAINER=ie-demo
PORTA=5433
ADMIN_URL="postgresql://postgres:demo@localhost:${PORTA}/ie_demo"
APP_URL="postgresql://ie_app:demo@localhost:${PORTA}/ie_demo"

export DATABASE_URL_ADMIN="$ADMIN_URL"
export DATABASE_URL="$ADMIN_URL"

papel_da_aplicacao() {
  # Papel sem BYPASSRLS: é com ele que a aplicação conecta, e é o que faz as
  # políticas de RLS valerem também aqui.
  docker exec "$CONTAINER" psql -U postgres -d ie_demo -h 127.0.0.1 -q -v ON_ERROR_STOP=1 -c "
    drop role if exists ie_app;
    create role ie_app with login password 'demo' nobypassrls;
    grant usage on schema ie, public to ie_app;
    grant select, insert, update, delete on all tables in schema ie to ie_app;
    grant execute on all functions in schema ie to ie_app;
    alter default privileges in schema ie grant select, insert, update, delete on tables to ie_app;
    alter default privileges in schema ie grant execute on functions to ie_app;
  " > /dev/null
}

# Reaproveita o administrador do banco real, para que você entre na demonstração
# com o mesmo login do Firebase que já usa.
admin_do_ambiente() {
  local saida="${TMPDIR:-/tmp}/ie-admin-demo.json"
  if DATABASE_URL_ADMIN="" DATABASE_URL="" SAIDA="$saida" npx tsx scripts/admin-atual.ts > /dev/null 2>&1; then
    DEMO_ADMIN_UID=$(node -e "process.stdout.write(require('$saida').firebase_uid || '')")
    DEMO_ADMIN_NOME=$(node -e "process.stdout.write(require('$saida').nome || '')")
    DEMO_ADMIN_EMAIL=$(node -e "process.stdout.write(require('$saida').email || '')")
    export DEMO_ADMIN_UID DEMO_ADMIN_NOME DEMO_ADMIN_EMAIL
    echo "→ Administrador da demonstração: ${DEMO_ADMIN_NOME} <${DEMO_ADMIN_EMAIL}>"
  else
    echo "→ Sem administrador no banco real; usando um fictício."
  fi
}

case "${1:-}" in
  subir)
    docker rm -f "$CONTAINER" > /dev/null 2>&1 || true
    echo "→ Subindo Postgres em localhost:${PORTA}…"
    docker run -d --name "$CONTAINER" \
      -e POSTGRES_PASSWORD=demo -e POSTGRES_USER=postgres -e POSTGRES_DB=ie_demo \
      -p "${PORTA}:5432" postgres:18-alpine > /dev/null

    for _ in $(seq 1 60); do
      docker exec "$CONTAINER" pg_isready -U postgres -d ie_demo -h 127.0.0.1 > /dev/null 2>&1 && break
    done

    echo "→ Aplicando schema e políticas…"
    pnpm db:migrate > /dev/null
    papel_da_aplicacao
    echo "→ Semeando configuração…"
    pnpm db:seed > /dev/null
    admin_do_ambiente
    echo "→ Gerando dados fictícios…"
    pnpm demo:semear

    echo "Agora rode:  pnpm dev:demo"
    ;;

  resemear)
    admin_do_ambiente
    pnpm demo:semear
    ;;

  derrubar)
    docker rm -f "$CONTAINER" > /dev/null 2>&1 && echo "✓ container removido" || echo "nada a remover"
    ;;

  *)
    echo "uso: ./scripts/demo.sh {subir|resemear|derrubar}"
    exit 1
    ;;
esac
