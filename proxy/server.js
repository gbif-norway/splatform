const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 8080;

// Allowed Origins (Configure this via ENV in k8s)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const server = http.createServer((req, res) => {
    // CORS Headers
    const requestOrigin = req.headers.origin;

    // Strict Origin Check (if configured)
    if (ALLOWED_ORIGIN !== '*' && requestOrigin) {
        const allowedList = ALLOWED_ORIGIN.split(',').map(o => o.trim());
        if (allowedList.indexOf(requestOrigin) === -1) {
            console.log(`Blocked Origin: ${requestOrigin} vs Allowed: ${ALLOWED_ORIGIN}`);
            res.writeHead(403, {
                'Access-Control-Allow-Origin': allowedList[0],
                'Content-Type': 'text/plain'
            });
            res.end('Origin not allowed');
            return;
        }
    }

    // Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': requestOrigin || '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-api-key, anthropic-version, anthropic-dangerously-allow-browser',
            'Access-Control-Max-Age': '86400'
        });
        res.end();
        return;
    }

    // Proxy Logic
    // Pattern: /http://target-api.com/v1/resource OR /?url=http...
    // We'll support the path-based approach: http://my-proxy/https://api.anthropic.com/...

    const reqUrl = req.url.slice(1); // Remove leading slash
    if (!reqUrl.startsWith('http')) {
        res.writeHead(400);
        res.end('Invalid URL. Usage: https://proxy-url/https://target-url...');
        return;
    }

    const targetUrl = new url.URL(reqUrl);

    const options = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || 443,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: {
            ...req.headers,
            host: targetUrl.hostname
        }
    };

    // Remove hop-by-hop headers
    delete options.headers['host'];
    delete options.headers['origin'];
    delete options.headers['referer'];

    // Forward Request
    const proxyReq = https.request(options, (proxyRes) => {
        // Forward Status
        const headers = { ...proxyRes.headers };

        // Remove upstream CORS headers to avoid duplicates/conflicts
        delete headers['access-control-allow-origin'];
        delete headers['access-control-allow-methods'];
        delete headers['access-control-allow-headers'];
        delete headers['access-control-allow-credentials'];

        // Add CORS to response
        headers['Access-Control-Allow-Origin'] = requestOrigin || '*';
        headers['Access-Control-Allow-Credentials'] = 'true';

        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (e) => {
        console.error(e);
        res.writeHead(502);
        res.end('Bad Gateway: ' + e.message);
    });

    req.pipe(proxyReq, { end: true });
});

server.listen(PORT, () => {
    console.log(`CORS Proxy running on port ${PORT}`);
    console.log(`Allowed Origin: ${ALLOWED_ORIGIN}`);
});
