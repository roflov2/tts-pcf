#!/usr/bin/env bash
# Builds the Power Platform solution zips (unmanaged + managed) that you import
# at make.powerapps.com. Needs the .NET 8 SDK and the Power Platform CLI (pac);
# both are in the dev container (see README).
#
#   npm run solution          → Solution/bin/Release/ScamwatchChatSolution.zip (+ _managed)
#
# Override the publisher with PUBLISHER_NAME / PUBLISHER_PREFIX.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
solution_dir="$root/Solution"
publisher_name="${PUBLISHER_NAME:-Scamwatch}"
publisher_prefix="${PUBLISHER_PREFIX:-scw}"

command -v dotnet >/dev/null || { echo "dotnet not found. Install the .NET 8 SDK or use the dev container." >&2; exit 1; }
command -v pac >/dev/null || { echo "pac not found. Run: dotnet tool install --global Microsoft.PowerApps.CLI.Tool" >&2; exit 1; }

if [[ ! -f "$solution_dir/ScamwatchChatSolution.cdsproj" ]]; then
  echo "Creating the solution project in Solution/ (publisher $publisher_name, prefix $publisher_prefix)…"
  mkdir -p "$solution_dir"
  tmp="$(mktemp -d)"
  (cd "$tmp" && mkdir ScamwatchChatSolution && cd ScamwatchChatSolution \
    && pac solution init --publisher-name "$publisher_name" --publisher-prefix "$publisher_prefix")
  cp -r "$tmp/ScamwatchChatSolution/." "$solution_dir/"
  rm -rf "$tmp"
  (cd "$solution_dir" && pac solution add-reference --path "$root")
  # Build both flavours: unmanaged for dev environments, managed for test/prod.
  sed -i 's#^</Project>#  <PropertyGroup>\n    <SolutionPackageType>Both</SolutionPackageType>\n  </PropertyGroup>\n</Project>#' \
    "$solution_dir/ScamwatchChatSolution.cdsproj"
fi

(cd "$root" && npm run build:prod)
dotnet build "$solution_dir/ScamwatchChatSolution.cdsproj" -c Release
echo
echo "Solution zips:"
ls -1 "$solution_dir"/bin/Release/*.zip
