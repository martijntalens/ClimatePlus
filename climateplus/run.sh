#!/usr/bin/with-contenv bashio
# shellcheck shell=bash
set -e

bashio::log.info "Starting ClimatePlus ${CLIMATEPLUS_VERSION:-dev}..."
exec python3 /app/server.py
