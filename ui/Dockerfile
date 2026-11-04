# ============================================
# Wiki MCP Web UI - Vite build served by nginx
# ============================================

# Stage 1: Build the static bundle
FROM node:26-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# The nginx image runs envsubst on /etc/nginx/templates/*.template at startup,
# so ${API_URL} in the template becomes the proxy target for /api/.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

ENV API_URL=http://wiki-api:3000

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
