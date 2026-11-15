# Build the complete existing frontend, including its maps and service worker.
FROM node:22-bookworm-slim AS frontend
WORKDIR /work
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NODE_OPTIONS=--max-old-space-size=768
RUN npm run build

# One synthetic-only web service: FastAPI and compiled frontend on one origin.
FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv/sentra
COPY backend/requirements-identity.txt /tmp/requirements-identity.txt
RUN python -m pip install --no-cache-dir -r /tmp/requirements-identity.txt \
    && rm /tmp/requirements-identity.txt \
    && groupadd --system sentra && useradd --system --gid sentra --create-home sentra
COPY --from=frontend /work/dist ./dist
COPY backend/app ./backend/app
WORKDIR /srv/sentra/backend
USER sentra
EXPOSE 10000
CMD ["sh", "-c", "exec uvicorn app.render_entry:app --host 0.0.0.0 --port ${PORT:-10000} --no-access-log"]
