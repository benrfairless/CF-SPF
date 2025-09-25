# Copilot Instructions for CF-SPF

## Project Overview
CF-SPF is a Cloudflare Workers service that flattens SPF (Sender Policy Framework) records by resolving include directives and consolidating them into a single, simplified SPF record. This helps reduce DNS lookups during email delivery and avoid hitting RFC 7208 limits.

## Technology Stack
- **Runtime**: Cloudflare Workers (JavaScript ES modules)
- **Testing**: Vitest with Node.js environment
- **Deployment**: Wrangler CLI
- **DNS Resolution**: Cloudflare DNS-over-HTTPS API
- **Standards**: RFC 7208 (SPF specification)

## Project Structure
```
src/
├── index.js           # Main Cloudflare Worker entry point
└── spf-flattener.js   # Core SPF parsing and flattening logic
test/
└── spf-flattener.test.js  # Unit tests for SPF flattener
wrangler.toml          # Cloudflare Workers configuration
vitest.config.js       # Test configuration
```

## Architecture & Patterns

### Core Components
1. **Worker Handler** (`src/index.js`): HTTP request handling, CORS, routing
2. **SPF Flattener** (`src/spf-flattener.js`): SPF parsing, DNS resolution, flattening logic

### API Endpoints
- `GET /health` - Health check endpoint
- `GET /flatten?domain=example.com` - Flatten SPF via query parameter
- `POST /flatten` - Flatten SPF via JSON body `{"domain": "example.com"}`
- `GET /` - HTML documentation

### Key Classes & Methods
- `SPFFlattener`: Main class for SPF processing
  - `parseSPF(spfRecord)`: Parse SPF record into mechanisms
  - `resolveTXT(domain)`: DNS TXT record resolution via Cloudflare DoH
  - `flatten(domain)`: Main flattening logic with RFC 7208 compliance

## Development Guidelines

### Code Style
- Use ES modules (`import`/`export`)
- JSDoc comments for public methods
- Clear error messages with context
- Async/await for asynchronous operations
- Class-based architecture for core logic

### Error Handling
- Validate input domains and SPF records
- Respect RFC 7208 limits (max 10 DNS lookups, max 2 void lookups)
- Return meaningful HTTP status codes (400, 404, 429, 500)
- Include error details in JSON responses

### Testing
- Use Vitest for unit testing
- Mock `fetch` for DNS resolution tests
- Test both success and error scenarios
- Include edge cases (malformed SPF, DNS failures, RFC limits)

### Security Considerations
- CORS enabled for cross-origin requests
- Input validation for domain parameters
- No sensitive data logging
- DNS-over-HTTPS for secure DNS resolution

## Development Workflow

### Local Development
```bash
npm install          # Install dependencies
npm run dev         # Start Wrangler dev server
npm test            # Run tests
```

### Testing
- Run `npm test` before committing changes
- Ensure all tests pass and maintain good coverage
- Add tests for new functionality

### Deployment
- Staging: `wrangler deploy --env staging`
- Production: `wrangler deploy --env production`

## RFC 7208 Compliance
This service strictly follows SPF specification RFC 7208:
- Maximum 10 DNS lookups per SPF evaluation
- Maximum 2 void lookups (failed/empty responses)
- Proper SPF mechanism parsing and validation
- Standard error handling for limit violations

## Common Tasks

### Adding New SPF Mechanisms
1. Update `parseSPF()` method to handle new mechanism syntax
2. Add resolution logic in `flatten()` method if needed
3. Add comprehensive tests for the new mechanism
4. Update API documentation

### Modifying DNS Resolution
- All DNS queries use Cloudflare DNS-over-HTTPS API
- Maintain proper error counting for void lookups
- Handle network timeouts and DNS errors gracefully

### Performance Optimization
- Consider caching DNS responses (respecting TTL)
- Monitor Worker execution time and memory usage
- Optimize SPF parsing for large records

## Dependencies & Versions
- Node.js 18+ for development
- Cloudflare Workers runtime (latest)
- Vitest for testing framework
- Wrangler 3.x for deployment

## Troubleshooting
- DNS resolution issues: Check Cloudflare DNS API status
- RFC limit violations: Review SPF record complexity
- Worker timeout: Consider SPF record size and include depth
- CORS issues: Verify Access-Control headers in responses

## When Making Changes
1. Always run tests locally before committing
2. Ensure RFC 7208 compliance is maintained
3. Update tests for any new functionality
4. Consider performance impact on Worker execution time
5. Validate error handling for edge cases
6. Test both GET and POST API endpoints
7. Verify CORS headers work correctly