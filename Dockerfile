# 使用 node:lts-alpine 作为前端构建的基础镜像，并命名为 frontend-builder
FROM node:lts-alpine as frontend-builder
# 设置工作目录
WORKDIR /app/frontend
# 复制前端项目的 package.json 和 pnpm-lock.yaml 文件到工作目录
COPY package.json pnpm-lock.yaml ./
# 安装前端项目依赖
RUN pnpm install
# 复制前端项目的 src 目录到工作目录
COPY src/ ./src/
# 复制前端项目的 index.html 文件到工作目录
COPY index.html ./
# 复制前端项目的 vite.config.js 文件到工作目录
COPY vite.config.js ./
# 复制前端项目的 .prettierrc 文件到工作目录
COPY .prettierrc ./
# 复制前端项目的 babel.config.cjs 文件到工作目录
COPY babel.config.cjs ./
# 复制前端项目的 vitest.config.js 文件到工作目录
COPY vitest.config.js ./
# 复制前端项目的 public 目录到工作目录
COPY public/ ./public/
# 运行前端项目的构建命令
RUN pnpm run build

# 使用 node:lts-alpine 作为后端构建的基础镜像，并命名为 backend-builder
FROM node:lts-alpine as backend-builder
# 设置工作目录
WORKDIR /app/backend
# 复制后端项目的 package.json 和 pnpm-lock.yaml 文件到工作目录
COPY server/package.json server/pnpm-lock.yaml ./
# 安装后端项目生产环境依赖
RUN pnpm install --prod
# 复制后端项目的 index.js 文件到工作目录
COPY server/index.js ./

# 使用 nginx:alpine 作为最终镜像的基础镜像
FROM nginx:alpine
# 复制自定义的 nginx 配置文件到 Nginx 配置目录
COPY nginx/nginx.conf /etc/nginx/nginx.conf
# 删除 Nginx 默认的 html 目录内容
RUN rm -rf /usr/share/nginx/html/*
# 从 frontend-builder 阶段复制构建好的前端静态文件到 Nginx 的 html 目录
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html
# 从 backend-builder 阶段复制后端代码到最终镜像的 /app/backend 目录
COPY --from=backend-builder /app/backend /app/backend
# 复制启动脚本到最终镜像的 /app 目录
COPY server/start.sh /app/start.sh
# 赋予启动脚本执行权限
RUN chmod +x /app/start.sh
# 暴露 80 端口 (Nginx)
EXPOSE 80
# 暴露 3000 端口 (后端服务)
EXPOSE 3000
# 定义容器启动时执行的命令
CMD ["/app/start.sh"]