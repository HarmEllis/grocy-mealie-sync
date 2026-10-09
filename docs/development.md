# Development

Run all commands from the repository root unless stated otherwise. For deployment and first-run configuration, see the [main README](../README.md#setup).

**Development with a VS Code devcontainer:**

A ready-to-use devcontainer is included at [`.devcontainer/devcontainer.json`](../.devcontainer/devcontainer.json). It provides Node.js 24, forwards port `3000`, forwards the bundled Mealie and Grocy services on `9000` and `9001`, and includes Docker CLI access so you can use the local development services from `compose-dev.yml`.

Typical flow:

1. Copy `.env.example` to `.env`.
2. If you want to use the bundled Grocy and Mealie services, set `POSTGRES_PASSWORD` in `.env`, then set `GROCY_URL=http://host.docker.internal:9001` and `MEALIE_URL=http://host.docker.internal:9000`.
3. In VS Code, run `Dev Containers: Reopen in Container`.
4. Inside the devcontainer, start the support services with `docker compose -f compose-dev.yml up -d`.
5. Run `npm run dev`.

If you already use external Grocy and Mealie instances, keep your existing URLs and skip `compose-dev.yml`.

Note on port forwarding:

- The devcontainer keeps `host.docker.internal` available inside the container for app-to-service traffic.
- VS Code's devcontainer schema currently rejects `forwardPorts` entries like `host.docker.internal:9000` because the hostname contains dots, even though the docs describe a `host:port` format.
- To avoid that schema error, the devcontainer also defines the alias `host-docker-internal`, and the forwarding rules use `host-docker-internal:9000` and `host-docker-internal:9001`.
- You do not need to use that alias in `.env`; it is only there to satisfy the devcontainer port-forwarding schema.

## Updating `compose-dev.yml` and OpenAPI artifacts

When you want to refresh the bundled Grocy and Mealie versions and then pull the latest OpenAPI specs plus regenerated clients, run:

```bash
npm run dev:update-upstreams
```

This does three things in order:

- updates the pinned Grocy and Mealie image tags in `compose-dev.yml` to the latest GitHub releases
- starts or refreshes the local compose services with those images
- downloads the latest OpenAPI specs into `docs/` and regenerates the clients in `src/lib/grocy/client` and `src/lib/mealie/client`

You can also run the steps separately with `npm run compose-dev:update` and `npm run openapi:refresh`.

## Docs screenshot workflow

Generate a screenshot locally with:

```bash
npm ci
npm run docs:screenshot
```

This writes `docs/images/app-dashboard.png`.
The command fails fast if Grocy or Mealie cannot be reached with the current env configuration, so start those services first.

How the screenshot script works:

- Probes Grocy and Mealie with the configured credentials before building, and exits with a clear error if either service is unavailable.
- If `GROCY_URL` or `MEALIE_URL` uses `host.docker.internal` or `host-docker-internal`, the script also tries the same port on `localhost` and `127.0.0.1`, then reuses the working URL for the build and preview server.
- Builds the app, then starts a production preview server on a free local port.
- Captures the real app at `/` with a narrower fixed viewport.
- If redirected to the app login screen, signs in using the configured `AUTH_SECRET` without disabling authentication.
- Verifies that the dashboard is visible before saving and fails without overwriting the image if the app remains locked. Open the generated image and visually check that it shows the loaded dashboard before committing it.
- Opens Chromium in headless mode with a fixed viewport.
- Forces a dark color scheme and reduced motion.
- Waits for the app to hydrate and the settings UI to settle, then disables animations and transitions before taking the screenshot.

### Devcontainer notes

- The devcontainer image installs Debian `chromium`, so `npm run docs:screenshot` works headlessly without X11 forwarding.
- After pulling these changes, rebuild the devcontainer so the new Chromium package is included.
- The devcontainer also sets `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium` for the screenshot script.

### VS Code Remote SSH notes

- Run the screenshot command on the remote Linux host, not on your local machine.
- If the remote host already has `chromium`, `chromium-browser`, or `google-chrome` installed, the script will use it automatically.
- If no system browser is available, install one on the host or run `npx playwright install chromium` once in the repo.

