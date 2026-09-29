# syntax=docker/dockerfile:1
# Single image: the API serves the Angular build from wwwroot (same origin,
# so the SameSite=Strict refresh cookie and relative api/ + hubs/ URLs work).

# ── 1. Angular client → backend/wwwroot ───────────────────────────────────────
FROM node:24-slim AS client
WORKDIR /src/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY client/ ./
# angular.json writes to ../backend/wwwroot, i.e. /src/backend/wwwroot
RUN npm run build

# ── 2. .NET publish ───────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src/backend
COPY backend/Khanara.API.csproj ./
RUN dotnet restore Khanara.API.csproj
COPY backend/ ./
COPY --from=client /src/backend/wwwroot ./wwwroot
RUN dotnet publish Khanara.API.csproj -c Release -o /app/publish --no-restore /p:UseAppHost=false

# ── 3. Runtime ────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./
# Non-root user built into the .NET images; Cloud Run sends traffic to 8080.
USER $APP_UID
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Khanara.API.dll"]
