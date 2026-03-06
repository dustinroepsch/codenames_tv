FROM node:lts-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM alpine
COPY --from=builder /app/dist /dist
CMD ["sh", "-c", "cp -rf /dist/. /www/"]
