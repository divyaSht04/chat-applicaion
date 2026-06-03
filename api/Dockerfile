FROM node:22-alpine
WORKDIR /workspace

# api/tsconfig.json extends ../tsconfig.base.json — copy it one level up
COPY tsconfig.base.json ./
COPY api/ ./api/

RUN cd api && npm install && npm run build

WORKDIR /workspace/api
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
