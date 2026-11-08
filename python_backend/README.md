# ATLAS Python backend

FastAPI implements all five APIs consumed by the existing Next.js frontend. The research coordinator starts from mapped candidates, restricts model actions, grounds findings in exact quotes, reviews conclusions and returns useful partial reports within bounded calls and time.

## Run

From the repository root, install with `python -m pip install -e ./python_backend`, then run `npm run dev` to start both services. The existing root `.env` is loaded automatically. Keep provider credentials there, server-side.

The APIs are `/api/analyze`, `/api/research`, `/api/suggest`, `/api/locations` and `/api/location-advice`. Research accepts the original frontend geographic `scope` and confirmed `osmRequest`, not the former prototype's incompatible `city` field. `GET /health` identifies the Python backend without exposing secrets.

## Agent boundaries

The coordinator owns network calls, output schemas, source/quote identifiers, deadline and call budget. Models cannot run code or choose arbitrary URLs. Retrieved pages are untrusted data. Unreviewed generated claims are withheld. See [the integration guide](../docs/PYTHON_BACKEND.md) and [measured results](../docs/MEASURED_RESULTS.md) for setup, architecture, validation and limitations.
