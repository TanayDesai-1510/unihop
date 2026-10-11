#!/bin/bash
set -e
docker compose -f .devcontainer/docker-compose.yml up -d db
until docker compose -f .devcontainer/docker-compose.yml exec -T db pg_isready -U unihop >/dev/null 2>&1; do sleep 1; done
(cd backend && ./mvnw spring-boot:run) &
(cd frontend && npm run dev -- -H 0.0.0.0) &
wait
