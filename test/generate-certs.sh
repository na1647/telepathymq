#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CA_DIR="$ROOT/test/certs"

mkdir -p "$CA_DIR/newcerts"
: > "$CA_DIR/index.txt"
echo 1000 > "$CA_DIR/serial"

echo "=== Création du certificat TLS valide ==="

openssl req -x509 -newkey rsa:2048 \
  -keyout test.key \
  -out test.crt \
  -sha256 -days 3650 -nodes \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
  -addext "extendedKeyUsage=serverAuth,clientAuth"

echo "=== Création de l'autorité de test ==="

openssl req -x509 -newkey rsa:2048 \
  -keyout "$CA_DIR/ca.key" \
  -out "$CA_DIR/ca.crt" \
  -sha256 -days 3650 -nodes \
  -subj "/CN=TelepathyMQ Test CA"

cat > "$CA_DIR/ca.cnf" <<EOF
[ ca ]
default_ca = CA_default

[ CA_default ]
dir = $CA_DIR
database = \$dir/index.txt
new_certs_dir = \$dir/newcerts
certificate = \$dir/ca.crt
private_key = \$dir/ca.key
serial = \$dir/serial
default_md = sha256
default_days = 365
policy = policy
unique_subject = no
copy_extensions = copy
x509_extensions = server_cert

[ policy ]
commonName = supplied

[ server_cert ]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth,clientAuth
subjectAltName = DNS:localhost,IP:127.0.0.1
EOF

create_certificate() {
  local name="$1"
  local start="$2"
  local end="$3"

  echo "=== Génération de $name ==="

  openssl req -new -newkey rsa:2048 \
    -keyout "$name.key" \
    -out "$CA_DIR/$name.csr" \
    -nodes \
    -subj "/CN=localhost"

  openssl ca -batch \
    -config "$CA_DIR/ca.cnf" \
    -in "$CA_DIR/$name.csr" \
    -out "$name.crt" \
    -startdate "$start" \
    -enddate "$end" \
    -notext

  rm "$CA_DIR/$name.csr"
}

# Certificat futur : valable à partir de 2030.
create_certificate \
  notYet \
  20300101000000Z \
  20310101000000Z

# Certificat expiré depuis 2021.
create_certificate \
  tooLate \
  20200101000000Z \
  20210101000000Z

echo ""
echo "=== Génération terminée ==="
echo "test.crt / test.key"
echo "notYet.crt / notYet.key"
echo "tooLate.crt / tooLate.key"

