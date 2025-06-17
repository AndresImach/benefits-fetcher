# Benefits Fetcher

This project is a Node.js application that fetches benefits and discounts from various Argentine banks and stores them in MongoDB. It also provides a REST API to access the collected data.

## Features

- Fetches benefits from multiple banks:
  - BBVA
  - Banco Ciudad
  - ICBC
  - Banco Santander
  - Supervielle
  - Personal
- Stores data in MongoDB
- Provides REST API endpoints
- Rate limiting and retry mechanism
- CORS enabled

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- pnpm (recommended) or npm

## Installation

1. Clone the repository:

```bash
git clone https://github.com/AndresImach/benefits-fetcher.git
cd benefits-fetcher
```

2. Install dependencies:

```bash
pnpm install
# or using npm
npm install
```

3. Create a `.env` file in the root directory with the following variables:

```
MONGO_URL=your_mongodb_connection_string
PORT=3000
```

## Usage

### Starting the API Server

```bash
npm start
```

The server will start on port 3000 (or the port specified in your .env file).

### Available Endpoints

- `GET /api/benefits` - Get benefits from all banks
- `GET /api/benefits/:bank` - Get benefits from a specific bank (e.g., /api/benefits/bbva)

### Running Individual Bank Fetchers

To fetch benefits from a specific bank:

```bash
node src/[BankName]/fetcher.js
```

Example:

```bash
node src/BBVA/fetcher.js
```

## Project Structure

- `src/server.js` - Main API server
- `src/[BankName]/fetcher.js` - Individual bank fetchers
- `src/[BankName]/test.js` - Test files for bank fetchers

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

ISC
