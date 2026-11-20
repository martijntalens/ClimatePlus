ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:3.21
FROM ${BUILD_FROM}

ARG BUILD_VERSION=dev
ENV CLIMATEPLUS_VERSION=${BUILD_VERSION} \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Python runtime + aiohttp from the Alpine repositories (no pip, no compilers)
RUN apk add --no-cache python3 py3-aiohttp

COPY app /app
COPY run.sh /run.sh
RUN chmod a+x /run.sh

WORKDIR /app
CMD [ "/run.sh" ]
