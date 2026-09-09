#!/usr/bin/env bash
# Edge Function は supabase/functions 配下しかバンドルしないため、エンジンのソースをコピーする
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
dest="$root/supabase/functions/_shared/engine"
rm -rf "$dest"
mkdir -p "$dest"
cp "$root"/packages/engine/src/*.ts "$dest"/
echo "synced engine -> $dest"
