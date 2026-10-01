# Toolchain for building and testing the PCF control: Node 20, .NET 8 SDK,
# Power Platform CLI (pac) and Chromium for Playwright screenshots.
FROM mcr.microsoft.com/devcontainers/typescript-node:1-20-bookworm

RUN wget -q https://packages.microsoft.com/config/debian/12/packages-microsoft-prod.deb -O /tmp/ms.deb \
    && dpkg -i /tmp/ms.deb && rm /tmp/ms.deb \
    && apt-get update \
    && apt-get install -y --no-install-recommends dotnet-sdk-8.0 \
    && rm -rf /var/lib/apt/lists/*

USER node
RUN dotnet tool install --global Microsoft.PowerApps.CLI.Tool
ENV PATH="${PATH}:/home/node/.dotnet/tools" \
    DOTNET_CLI_TELEMETRY_OPTOUT=1
