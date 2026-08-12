# Builds the static SPA and serves it via Cloud Run (docs/10-OPEN-DECISIONS.md §F1 — Public
# Access Prevention on the real GCP project rules out the docs' Cloud Storage + CDN Default).
# MUST be built with the monorepo ROOT as context, same reason as apps/api/Dockerfile:
#   docker build -f apps/web/Dockerfile --build-arg VITE_API_BASE_URL=https://<api-url> -t <tag> .

FROM node:20-slim AS deps
WORKDIR /repo
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm ci

FROM deps AS build
# Vite bakes import.meta.env.VITE_* in at build time, not runtime — this must be the real
# deployed API URL (apps/web/src/lib/api-client/client.ts falls back to a relative "" path,
# which only works when Vite's dev-server proxy exists; there's no such proxy in production).
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY . .
RUN npx turbo run build --filter=@taskapp/web

FROM node:20-slim AS runtime
WORKDIR /app
RUN npm install -g serve
COPY --from=build /repo/apps/web/dist ./dist
EXPOSE 8080
# -s: SPA fallback (serves index.html for unmatched routes, needed for React Router's
# client-side routing). $PORT is Cloud Run's injected port; defaults to 8080 for local runs.
CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
