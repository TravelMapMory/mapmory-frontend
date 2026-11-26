# Build stage: install exactly what the lockfile pins, then typecheck and bundle
# the app. package.json and package-lock.json are copied on their own so the
# npm ci layer is reused whenever only source files change.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Build-time settings that Vite inlines, all optional: the Geoapify basemap key,
# the backend switch and the Firebase web config (public, not secrets). Left
# empty, the image serves the mock data with the demo sign-in.
ARG VITE_GEOAPIFY_KEY=
ARG VITE_API_URL=
ARG VITE_FIREBASE_API_KEY=
ARG VITE_FIREBASE_AUTH_DOMAIN=
ARG VITE_FIREBASE_PROJECT_ID=
ARG VITE_FIREBASE_APP_ID=
ENV VITE_GEOAPIFY_KEY=$VITE_GEOAPIFY_KEY \
    VITE_API_URL=$VITE_API_URL \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID
RUN npm run build

# Serve stage: nginx serving the static Vite bundle. The listen port is not
# baked in; it is rendered from PORT at container start so Cloud Run can pick it.
FROM nginx:stable-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
