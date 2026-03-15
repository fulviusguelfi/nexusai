#!/bin/bash
set -u

# On Windows, node may not be in bash PATH — skip gracefully instead of failing
if ! command -v node &> /dev/null; then
  echo "Warning: node not found in bash PATH, skipping proto lint"
  exit 0
fi

buf lint

if ! buf format -w --exit-code; then
  echo Proto files were formatted
fi

if grep -rn "rpc .*[A-Z][A-Z].*[(]" --include="*.proto"; then
  # See https://github.com/cline/cline/pull/7054
  echo Error: Proto RPC names cannot contain repeated capital letters
  exit 1
fi

