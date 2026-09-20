# Build stage: install exactly what the lockfile pins, then typecheck and bundle
# the app. package.json and package-lock.json are copied on their own so the
# npm ci layer is reused whenever only source files change.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage: nginx serving the static Vite bundle. The listen port is not
# baked in; it is rendered from PORT at container start so Cloud Run can pick it.
FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
