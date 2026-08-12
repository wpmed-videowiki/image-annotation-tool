FROM node:22.21.1-slim
WORKDIR /app

# copy package.json and package-lock.json
COPY package*.json ./
RUN npm install --omit=dev

# copy the rest of the files
COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
