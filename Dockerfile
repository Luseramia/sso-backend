FROM oven/bun:1.3.5

WORKDIR /app

COPY package.json bun.lockb* ./

# ติดตั้ง dependencies ที่จำเป็น
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# ติดตั้ง dependencies
RUN bun install --frozen-lockfile

# Rebuild libsodium-wrappers
RUN cd node_modules/libsodium-wrappers && bun install --force

COPY . .

EXPOSE 3000

CMD ["bun", "run", "index.ts"]