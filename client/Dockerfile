FROM node:22-alpine
WORKDIR /workspace

# client/tsconfig.app.json extends ../tsconfig.base.json — copy it one level up
COPY tsconfig.base.json ./
COPY client/ ./client/

ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

RUN cd client && npm install && npm run build

WORKDIR /workspace/client
EXPOSE 5173
CMD ["node_modules/.bin/vite", "preview", "--host", "0.0.0.0", "--port", "5173"]
