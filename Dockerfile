# ============================================
# Stage 1: Install dependencies
# ============================================
FROM node:22-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

# ============================================
# Stage 2: Build the Vite app
# ============================================
FROM node:22-slim AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

RUN npm run build

# ============================================
# Stage 3: Serve static build with nginx
# ============================================
FROM nginx:alpine AS runner

COPY --from=builder /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template

ENV AIOT_GATEWAY_URL=http://35.252.210.77:9080

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
