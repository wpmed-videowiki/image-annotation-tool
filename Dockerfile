FROM node:22.21.1-slim
WORKDIR /app

# copy package.json, package-lock.json and .npmrc
# .npmrc skips the ~230 MB CUDA/TensorRT download that onnxruntime-node's
# postinstall would otherwise pull in; the CPU runtime is bundled
COPY package*.json .npmrc ./
ENV ONNXRUNTIME_NODE_INSTALL=skip
RUN npm install --omit=dev

# copy the rest of the files
COPY . .
# the background-removal model is not committed; fetch it (MD5-verified)
RUN npm run models:download
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
