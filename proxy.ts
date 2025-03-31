#!/usr/bin/env bun

// Parse command-line arguments
const args = Bun.argv;

// Help function
function showHelp() {
  console.log(`
Ollama HTTPS Proxy

Usage:
  ollama-proxy [options]

Options:
  -p, --port PORT        Port to run the proxy on (default: 3000)
  -u, --url URL          Ollama API URL (default: http://localhost:11434)
  -c, --cert PATH        Path to certificate file (default: ./cert.pem)
  -k, --key PATH         Path to key file (default: ./key.pem)
  -h, --help             Show this help message

Examples:
  ollama-proxy --port 8443
  ollama-proxy --url http://192.168.1.100:11434
  ollama-proxy --cert /path/to/cert.pem --key /path/to/key.pem
`);
  process.exit(0);
}

// Check for help flag
if (args.includes("-h") || args.includes("--help")) {
  showHelp();
}

// Extract port argument (-p or --port)
const portIndex = args.findIndex((arg) => arg === "-p" || arg === "--port");
const port =
  portIndex !== -1 && args[portIndex + 1]
    ? parseInt(args[portIndex + 1], 10)
    : 3000;

if (isNaN(port)) {
  console.error("Invalid port number specified.");
  process.exit(1);
}

// Extract Ollama URL argument (-u or --url)
const urlIndex = args.findIndex((arg) => arg === "-u" || arg === "--url");
const OLLAMA_URL =
  urlIndex !== -1 && args[urlIndex + 1]
    ? args[urlIndex + 1]
    : "http://localhost:11434";

// Extract certificate path
const certIndex = args.findIndex((arg) => arg === "-c" || arg === "--cert");
const certPath =
  certIndex !== -1 && args[certIndex + 1] ? args[certIndex + 1] : "./cert.pem";

// Extract key path
const keyIndex = args.findIndex((arg) => arg === "-k" || arg === "--key");
const keyPath =
  keyIndex !== -1 && args[keyIndex + 1] ? args[keyIndex + 1] : "./key.pem";

console.log(`Using Ollama URL: ${OLLAMA_URL}`);
console.log(`Proxy will run on port: ${port}`);
console.log(`Certificate path: ${certPath}`);
console.log(`Key path: ${keyPath}`);

// Function to load certificates and start the server
async function startServer() {
  try {
    const [cert, key] = await Promise.all([
      Bun.file(certPath).text(),
      Bun.file(keyPath).text(),
    ]);

    Bun.serve({
      port,
      tls: { cert, key },
      async fetch(req) {
        const url = new URL(req.url);
        const targetUrl = new URL(url.pathname + url.search, OLLAMA_URL);
        console.log(`Forwarding request to: ${targetUrl}`);

        if (req.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
              "Access-Control-Allow-Credentials": "true",
              "Access-Control-Max-Age": "86400",
            },
          });
        }

        try {
          const headers = new Headers(req.headers);
          headers.delete("Host");
          headers.delete("Referer");
          headers.delete("Origin");
          headers.set("Accept", "application/json");

          const body =
            req.method === "POST" || req.method === "PUT"
              ? await req.text()
              : undefined;

          const response = await fetch(targetUrl.toString(), {
            method: req.method,
            headers,
            body,
          });
          console.log(`Response from Ollama: ${response.status}`);

          const responseData = await response.json();

          const responseHeaders = new Headers(response.headers);
          responseHeaders.set("Access-Control-Allow-Origin", "*");
          responseHeaders.set(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, DELETE, OPTIONS"
          );
          responseHeaders.set(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization"
          );
          responseHeaders.set("Access-Control-Allow-Credentials", "true");
          responseHeaders.set("Content-Type", "application/json");

          return new Response(JSON.stringify(responseData), {
            status: response.status,
            headers: responseHeaders,
          });
        } catch (error) {
          console.error(`Proxy error: ${error.message}`);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      error(error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    console.log(`HTTPS Ollama proxy running at https://localhost:${port}`);
  } catch (err) {
    console.error("Failed to read SSL certificates:", err);
    console.error(
      `Make sure certificate files exist at:\n- ${certPath}\n- ${keyPath}`
    );
    process.exit(1);
  }
}

// Start the server
startServer();
