FROM oven/bun:1.3.14-alpine AS build

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.3.14-alpine AS production

ENV NODE_ENV=production \
	HOST=0.0.0.0 \
	PORT=3000

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build --chown=bun:bun /app/build ./build

USER bun
EXPOSE 3000
CMD ["bun", "build"]
