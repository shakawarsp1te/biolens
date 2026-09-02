# Runs the BioLens API. Built and deployed by Render (see ../render.yaml) --
# also works locally: `docker build -t biolens-api . && docker run -p 8000:8000 --env-file .env biolens-api`
FROM python:3.11-slim

WORKDIR /app

# Layered separately from the app code so a code-only change doesn't bust
# Docker's dependency-install cache layer.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render (and most PaaS hosts) inject the port to bind to via $PORT rather
# than a fixed one -- 8000 is only the local-dev fallback.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
