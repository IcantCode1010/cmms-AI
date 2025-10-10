# syntax=docker/dockerfile:1

FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm install
COPY public ./public
COPY src ./src
COPY tsconfig.json ./tsconfig.json
ENV NODE_OPTIONS=--max_old_space_size=4096
ENV DISABLE_ESLINT_PLUGIN=true
RUN npm run build

FROM nginx:1.25-alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx-custom.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/build /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
