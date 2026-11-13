FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci --include=dev
COPY client ./client
COPY server ./server
RUN npm run build --workspace server

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY client/package.json ./client/package.json
COPY server/package.json ./server/package.json
RUN npm ci --omit=dev --workspace server --include-workspace-root=false && npm cache clean --force
COPY --from=build /workspace/server/dist ./server/dist
EXPOSE 4000
CMD ["npm", "run", "start", "--workspace", "server"]
