#!/bin/zsh
# Packages the extension as dist/nocturne-web-<version>.xpi.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')
mkdir -p dist
out="dist/nocturne-web-$version.xpi"
rm -f "$out"
zip -q -r -X "$out" manifest.json LICENSE src popup icons
echo "$out"
