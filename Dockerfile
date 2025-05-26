# 阶段 1：构建应用程序
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package.json 和锁文件 (package-lock.json*, pnpm-lock.yaml* 或 yarn.lock*)
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./

# 安装依赖
# 根据您的包管理器选择合适的命令
# RUN npm install
# RUN yarn install
RUN if [ -f pnpm-lock.yaml ]; then npm install -g pnpm && pnpm install; \
    elif [ -f yarn.lock ]; then yarn install; \
    else npm install; fi

# 复制应用程序的其余代码
COPY . .

# 构建应用程序
RUN npm run build

# 阶段 2：使用 Nginx 提供应用程序服务
FROM nginx:alpine

# 从构建器阶段复制构建好的静态资源
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露 80 端口
EXPOSE 80

# 容器启动时启动 Nginx
CMD ["nginx", "-g", "daemon off;"]