# Production image for the worker. The build context is this folder:
#   docker build -t synthesis-worker worker
# Two stages, after uv's Docker guide: uv installs the locked dependencies in the first,
# and the final image keeps only Python and the virtual environment.
# No BuildKit cache mounts: Railway rejects them unless they hard-code its service id.

FROM python:3.13-slim-trixie AS builder
COPY --from=ghcr.io/astral-sh/uv:0.13.6 /uv /bin/uv

# The image's Python in both stages, so the virtual environment's links stay valid.
ENV UV_PYTHON_DOWNLOADS=0 \
    UV_COMPILE_BYTECODE=1

WORKDIR /app

# Dependencies first: this layer is reused until pyproject.toml or uv.lock changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project --no-editable

# Non-editable, so the final stage needs the environment but not the source.
COPY README.md ./
COPY src ./src
RUN uv sync --locked --no-dev --no-editable

FROM python:3.13-slim-trixie

RUN groupadd --system --gid 999 worker \
 && useradd --system --gid 999 --uid 999 --no-create-home worker

COPY --from=builder /app/.venv /app/.venv

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

WORKDIR /app
USER worker

# Exec form, so Python is PID 1 and receives the host's SIGTERM: the worker finishes the
# sources it already started, then exits.
CMD ["python", "-m", "worker"]
