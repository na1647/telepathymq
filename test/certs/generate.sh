#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Certificat actuellement valide
openssl req -x509 -newkey rsa:2048 \
  -keyout ../test.key \
  -out ../test.crt \
  -sha256 -days 365 -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

# Préparation d'une autorité de test
openssl req -x509 -newkey rsa:2048 \
  -keyout ca.key \
  -out ca.crt \
  -sha256 -days 3650 -nodes \
  -subj "/CN=TelepathyMQ Test CA"

# Création des certificats avec des périodes de validité spécifiques
create_cert() {
  local name="$1"
  local start="$2"
  local end="$3"

  openssl req -new -newkey rsa:2048 \
    -keyout "${name}.key" \
    -out "${name}.csr" \
    -nodes \
    -subj "/CN=localhost"

  openssl x509 -req \
    -in "${name}.csr" \
    -CA ca.crt \
    -CAkey ca.key \
    -set_serial "$((RANDOM + 1))" \
    -out "${name}.crt" \
    -days 365 \
    -sha256 \
    -extfile <(printf "subjectAltName=DNS:localhost\n") \
    -copy_extensions copy

  rm "${name}.csr"
}

echo "Certificats de test préparés."

