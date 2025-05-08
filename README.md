# [WIP] Mealie-Grocy Sync

A TypeScript application that synchronizes data between Mealie and Grocy applications.

## Features

- Sync units from Mealie to Grocy
- Sync product groups from Mealie to Grocy
- Sync products from Mealie to Grocy
- Handle Mealie grocery list webhooks to update Grocy shopping list

## Development

### Using Dev Container (Recommended)

1. Install [Visual Studio Code](https://code.visualstudio.com/) and the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
2. Clone this repository
3. Open the repository in VS Code
4. When prompted, click "Reopen in Container" or run the command `Remote-Containers: Reopen in Container`
5. The container will be built and your development environment will be ready

> Note, you should run `docker network create grocy-mealie-sync` if the container fails to start.

### Local Setup (Alternative)

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and configure your environment variables:
   ```bash
   cp .env.example .env
   ```
4. Edit `.env` file with your Mealie and Grocy URLs and API keys

## Development Commands

```bash
# Start development server with hot-reload
npm run dev

# Type-check and build
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Format code
npm run format

# Run tests
npm test
```

## API Endpoints

### Webhook Endpoints

- POST `/webhook/mealie/grocerylist` - Webhook endpoint for Mealie grocery list changes

### Sync Endpoints

- POST `/sync/units` - Sync units from Mealie to Grocy
- POST `/sync/product-groups` - Sync product groups from Mealie to Grocy
- POST `/sync/products` - Sync products from Mealie to Grocy

### Health Check

- GET `/health` - Check if the service is running

## Setting up Mealie Webhooks

In your Mealie instance, set up the following webhook:

- URL: `http://your-server:3000/webhook/mealie/grocerylist`
- Events: Shopping List Item Created, Shopping List Item Updated, Shopping List Item Deleted
