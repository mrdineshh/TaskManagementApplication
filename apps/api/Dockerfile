# Multi-stage build for the NestJS API. MUST be built with the monorepo ROOT as context (not
# apps/api) since npm workspaces need every workspace's package.json to resolve @taskapp/*
# deps — see docs/08-INFRA-DEPLOYMENT.md §4/§8:
#   docker build -f apps/api/Dockerfile -t <tag> .

FROM node:20-slim AS deps
WORKDIR /repo
# node:20-slim ships no OpenSSL at all, so Prisma's engine binaries can't detect which version
# to link against ("Prisma failed to detect the libssl/openssl version ... Defaulting to
# openssl-1.1.x") and the schema engine fails outright at runtime — hit live as `prisma migrate
# deploy` erroring out before the app ever starts listening, which Cloud Run then reports as a
# generic startup timeout. Installing it explicitly, as Prisma's own warning recommends.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm ci

FROM deps AS build
COPY . .
# Must run BEFORE the build below: `nest build` (tsc) imports @prisma/client's generated types
# (enums, Prisma.InputJsonValue, WhereInput types, etc.), which don't exist until this runs.
# Hit this live as 54 TS errors ("no exported member ...") — the reverse order compiles fine
# only in environments where node_modules/.prisma/client was already populated by some earlier
# `prisma migrate dev` side effect, which is why this never surfaced in local dev.
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
RUN npx turbo run build --filter=@taskapp/api

FROM node:20-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production
# Same reason as the deps stage above — this is a separate base image layer, so it needs its
# own OpenSSL install for the engine binaries copied in below to actually run.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# Keeps devDependencies (prisma CLI, needed at startup below) rather than a --omit=dev prune —
# correctness over image size for this first working deploy; a pruned multi-stage copy is a
# reasonable later optimization once the app is actually running.
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
WORKDIR /repo/apps/api

EXPOSE 8080
# Applies pending migrations before serving traffic. `prisma migrate deploy` takes its own
# advisory lock, so this is safe under concurrent cold starts across multiple instances —
# acceptable at this scale rather than standing up a separate one-off migration job/step.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
