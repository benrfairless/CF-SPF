# CF-SPF - SPF Flattening Service

A Cloudflare Worker service that flattens SPF (Sender Policy Framework) records by resolving include directives and consolidating them into a single, simplified SPF record.

## What is SPF Flattening?

SPF flattening is the process of taking an SPF record that contains `include:` directives and resolving all of those includes into their constituent IP addresses and mechanisms, creating a single SPF record without includes. This helps:

- Reduce DNS lookups during email delivery
- Avoid hitting the 10 DNS lookup limit imposed by RFC 7208
- Simplify SPF record management
- Improve email delivery performance

## Features

- ✅ Parse and validate SPF records
- ✅ Resolve `include:` directives recursively
- ✅ Respect RFC 7208 DNS lookup limits
- ✅ Handle errors gracefully
- ✅ CORS-enabled API
- ✅ Health check endpoint
- ✅ Comprehensive error handling

## API Endpoints

### GET /flatten?domain=example.com

Flatten the SPF record for a specific domain.

**Example:**
```bash
curl "https://your-worker.your-subdomain.workers.dev/flatten?domain=google.com"
```

### POST /flatten

Flatten SPF record using JSON payload.

**Example:**
```bash
curl -X POST "https://your-worker.your-subdomain.workers.dev/flatten" \
  -H "Content-Type: application/json" \
  -d '{"domain": "google.com"}'
```

### GET /health

Health check endpoint that returns service status.

### GET /

Returns HTML documentation for the service.

## Response Format

```json
{
  "domain": "google.com",
  "original_spf": "v=spf1 include:_spf.google.com ~all",
  "flattened_spf": "v=spf1 ip4:64.233.160.0/19 ip4:66.102.0.0/20 ... ~all",
  "lookups_performed": 2,
  "void_lookups": 0,
  "timestamp": "2024-08-15T12:00:00.000Z"
}
```

## Development

### Prerequisites

- Node.js 18+ 
- Cloudflare account with Workers enabled

### Setup

1. Clone the repository:
```bash
git clone https://github.com/benrfairless/CF-SPF.git
cd CF-SPF
```

2. Install dependencies:
```bash
npm install
```

3. Run tests:
```bash
npm test
```

4. Start development server:
```bash
npm run dev
```

### Deployment

1. Configure Wrangler with your Cloudflare credentials:
```bash
npx wrangler login
```

2. Deploy to Cloudflare Workers:
```bash
npm run deploy
```

## Configuration

Edit `wrangler.toml` to configure your worker:

```toml
name = "cf-spf-flattener"
main = "src/index.js"
compatibility_date = "2024-08-15"

[env.production]
name = "cf-spf-flattener"

[env.staging]
name = "cf-spf-flattener-staging"
```

## Limitations

- Follows RFC 7208 limits (max 10 DNS lookups, max 2 void lookups)
- Does not handle nested includes deeply (simplified flattening)
- Uses Cloudflare DNS over HTTPS for DNS resolution
- Response size limited by Cloudflare Workers response size limits

## Error Handling

The service handles various error conditions:

- Invalid domain format
- Missing SPF records  
- DNS resolution failures
- RFC 7208 limit violations
- Network timeouts

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run tests and ensure they pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details.