import { SPFFlattener } from './spf-flattener.js';

/**
 * Cloudflare Worker to handle SPF flattening requests
 */

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // SPF flattening endpoint
    if (url.pathname === '/flatten') {
      try {
        let domain, spfRecord;

        if (request.method === 'GET') {
          domain = url.searchParams.get('domain');
          spfRecord = url.searchParams.get('spf');
        } else if (request.method === 'POST') {
          const body = await request.json();
          domain = body.domain;
          spfRecord = body.spf;
        } else {
          return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        // Validate that we have either domain or spf record
        if (!domain && !spfRecord) {
          return new Response(JSON.stringify({ 
            error: 'Either domain or spf parameter is required',
            usage: 'GET /flatten?domain=example.com or GET /flatten?spf=v=spf1... or POST /flatten with {"domain": "example.com"} or {"spf": "v=spf1..."}'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        // If domain is provided, validate format
        if (domain) {
          const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
          if (!domainRegex.test(domain)) {
            return new Response(JSON.stringify({ error: 'Invalid domain format' }), {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            });
          }
        }

        const flattener = new SPFFlattener();
        let flattenedSPF, originalSPF;

        if (spfRecord) {
          // Direct SPF record input
          originalSPF = spfRecord;
          flattenedSPF = await flattener.flatten(spfRecord, true);
        } else {
          // Domain-based lookup
          originalSPF = await flattener.resolveTXT(domain);
          flattenedSPF = await flattener.flatten(domain, false);
        }

        const response = {
          lookups_performed: flattener.lookupCount,
          void_lookups: flattener.voidLookupCount,
          timestamp: new Date().toISOString()
        };

        if (domain) {
          response.domain = domain;
          response.original_spf = originalSPF;
          response.flattened_spf = flattenedSPF;
          // Create _spf1 subdomain format
          response.spf1_record = {
            name: `_spf1.${domain}`,
            value: flattenedSPF
          };
        } else {
          response.original_spf = originalSPF;
          response.flattened_spf = flattenedSPF;
        }

        return new Response(JSON.stringify(response), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });

      } catch (error) {
        console.error('SPF flattening error:', error);
        
        return new Response(JSON.stringify({ 
          error: error.message,
          timestamp: new Date().toISOString()
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // Root endpoint with documentation
    if (url.pathname === '/') {
      const documentation = `
<!DOCTYPE html>
<html>
<head>
    <title>SPF Flattening Service</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
        .endpoint { margin: 20px 0; }
        .method { color: #0066cc; font-weight: bold; }
    </style>
</head>
<body>
    <h1>SPF Flattening Service</h1>
    <p>This service flattens SPF records by resolving include directives and consolidating them into a single record.</p>
    
    <h2>Endpoints</h2>
    
    <div class="endpoint">
        <h3><span class="method">GET</span> /health</h3>
        <p>Health check endpoint</p>
    </div>
    
    <div class="endpoint">
        <h3><span class="method">GET</span> /flatten?domain=example.com</h3>
        <p>Flatten SPF record for the specified domain</p>
    </div>
    
    <div class="endpoint">
        <h3><span class="method">GET</span> /flatten?spf=v=spf1...</h3>
        <p>Flatten a direct SPF record input</p>
    </div>
    
    <div class="endpoint">
        <h3><span class="method">POST</span> /flatten</h3>
        <p>Flatten SPF record using JSON payload:</p>
        <pre>{"domain": "example.com"} or {"spf": "v=spf1 include:_spf.google.com ~all"}</pre>
    </div>
    
    <h2>Example Usage</h2>
    <pre>curl "https://your-worker.your-subdomain.workers.dev/flatten?domain=google.com"</pre>
    <pre>curl "https://your-worker.your-subdomain.workers.dev/flatten?spf=v%3Dspf1%20include%3A_spf.google.com%20~all"</pre>
    
    <h2>Response Format</h2>
    <p>For domain-based queries:</p>
    <pre>{
  "domain": "google.com",
  "original_spf": "v=spf1 include:_spf.google.com ~all",
  "flattened_spf": "v=spf1 ip4:64.233.160.0/19 ip4:66.102.0.0/20 ip4:66.249.80.0/20 ip4:72.14.192.0/18 ip4:74.125.0.0/16 ip4:108.177.8.0/21 ip4:173.194.0.0/16 ip4:207.126.144.0/20 ip4:209.85.128.0/17 ip4:216.58.192.0/19 ip4:216.239.32.0/19 ip6:2001:4860:4000::/36 ip6:2404:6800:4000::/36 ip6:2607:f8b0:4000::/36 ip6:2800:3f0:4000::/36 ip6:2a00:1450:4000::/36 ip6:2c0f:fb50:4000::/36 ~all",
  "spf1_record": {
    "name": "_spf1.google.com",
    "value": "v=spf1 ip4:64.233.160.0/19 ip4:66.102.0.0/20 ip4:66.249.80.0/20 ip4:72.14.192.0/18 ip4:74.125.0.0/16 ip4:108.177.8.0/21 ip4:173.194.0.0/16 ip4:207.126.144.0/20 ip4:209.85.128.0/17 ip4:216.58.192.0/19 ip4:216.239.32.0/19 ip6:2001:4860:4000::/36 ip6:2404:6800:4000::/36 ip6:2607:f8b0:4000::/36 ip6:2800:3f0:4000::/36 ip6:2a00:1450:4000::/36 ip6:2c0f:fb50:4000::/36 ~all"
  },
  "lookups_performed": 2,
  "void_lookups": 0,
  "timestamp": "2024-08-15T12:00:00.000Z"
}</pre>
</body>
</html>`;

      return new Response(documentation, {
        headers: {
          'Content-Type': 'text/html',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 404 for unknown endpoints
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};