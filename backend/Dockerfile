# backend/Dockerfile — untuk deploy ke Back4app Containers (CaaS)
FROM node:20-alpine

WORKDIR /app

# Copy package files dulu supaya Docker cache layer install lebih efisien
COPY package*.json ./
RUN npm install --omit=dev

# Copy sisa source code backend
COPY . .

# Railway/Render/Back4app semuanya set PORT lewat env var — server.js sudah
# pakai process.env.PORT || 5500, jadi tidak perlu ubah kode.
EXPOSE 5500

CMD ["npm", "start"]