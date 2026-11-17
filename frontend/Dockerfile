FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
# Public build-time settings (baked into the bundle; never put server secrets here).
ARG VITE_MAPMAP_STYLE_LIGHT=
ARG VITE_MAPMAP_STYLE_DARK=
ARG VITE_MAPMAP_KEY=
ARG VITE_PUBLIC_APP_URL=
ENV VITE_MAPMAP_STYLE_LIGHT=$VITE_MAPMAP_STYLE_LIGHT VITE_MAPMAP_STYLE_DARK=$VITE_MAPMAP_STYLE_DARK VITE_MAPMAP_KEY=$VITE_MAPMAP_KEY VITE_PUBLIC_APP_URL=$VITE_PUBLIC_APP_URL
RUN npm run build:dev

# Storybook stage for interactive development/review
FROM node:20-alpine AS storybook
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
EXPOSE 6006
CMD ["npm", "run", "storybook"]

# Production stage with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
