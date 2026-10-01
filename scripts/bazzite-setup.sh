#!/usr/bin/env bash
# Sets up a Distrobox container with everything this project needs, for Bazzite
# (or any Fedora Atomic / immutable distro) without layering packages on the host.
# The dev container in .devcontainer/ is the alternative if your editor supports it.
#
#   bash scripts/bazzite-setup.sh            # create the box and install the toolchain
#   distrobox enter pcf-dev                  # then work inside it: npm ci, npm test, …
#
# Editors: run `code .` or `antigravity .` from inside the box, or export one
# to the host menu with:  distrobox enter pcf-dev -- distrobox-export --app code
set -euo pipefail

BOX="${BOX:-pcf-dev}"
IMAGE="${IMAGE:-registry.fedoraproject.org/fedora-toolbox:42}"

if ! command -v distrobox >/dev/null; then
  echo "distrobox not found. Bazzite ships it; on other systems install it first." >&2
  exit 1
fi

if ! distrobox list | grep -qw "$BOX"; then
  distrobox create --name "$BOX" --image "$IMAGE" --yes
fi

distrobox enter "$BOX" -- bash -euo pipefail -c '
  sudo dnf install -y nodejs20 nodejs20-npm dotnet-sdk-8.0 git \
    nss atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite libXdamage libXrandr mesa-libgbm pango alsa-lib
  # nodejs20 installs as node-20; make it the default node/npm inside the box.
  sudo alternatives --install /usr/bin/node node /usr/bin/node-20 20 2>/dev/null || true
  sudo alternatives --install /usr/bin/npm npm /usr/bin/npm-20 20 2>/dev/null || true
  dotnet tool install --global Microsoft.PowerApps.CLI.Tool || dotnet tool update --global Microsoft.PowerApps.CLI.Tool
  grep -q ".dotnet/tools" ~/.bashrc || echo "export PATH=\"\$PATH:\$HOME/.dotnet/tools\"" >> ~/.bashrc
  node -v && dotnet --version
'

echo
echo "Done. Next:"
echo "  distrobox enter $BOX"
echo "  cd $(pwd) && npm ci && npx playwright install chromium && npm test"
echo "  npm run preview      # http://localhost:5173 (mock data)"
echo "  npm run start:watch  # PCF test harness at http://localhost:8181"
