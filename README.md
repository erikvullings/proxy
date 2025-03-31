# Ollama proxy service

When running Ollama on my localhost, I can use it safely using curl or `web-ui`. However, when exposing the local Ollama instance to a SPA (Single Page Application), such as [Spark](https://tno.github.io/scenario-spark/), it will not work, as a HTTPS browser application is not allowed to access unsafe localhost services.

I've tried wrapping my Ollama service using a tunneling service such as `ngrok`, but `ngrok` did not remove the CORS restrictions that the Ollama endpoint imposes, so that failed too.

Finally, I've written a simple proxy service, which can be run using `bun`, which exposes a simple HTTPS endpoint that a webapp can use.

## Prerequisites

You first need to generate a public key and certificate. The most important aspect is to set the fully qualified domain name, as well as the subject's alternate name, to localhost. On a Mac (and on Windows, using [choco](https://community.chocolatey.org/packages/mkcert)), the easiest way to do this is to use `mkcert`.

```bash
brew install mkcert
mkcert -install
mkcert localhost
```

This command, when executed in the current folder, should generate two files: the certificate `cert.pem` and the key `key.pem`, both which are read by the proxy service to setup a https connection. In addition, `mkcert` also installs the new certificate in your key store, so your browser will trust it too.

## Running the proxy service

```bash
bun install # Optionally, to satisfy your IDE by installing the bun types.
bun run proxy.ts
```

## Testing the proxy service

To test it, run the following curl command:

```bash
curl https://localhost:3000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{
        "model": "gemma3",
        "messages": [
            {
                "role": "user",
                "content": "Why is the sky blue?"
            }
        ],
        "stream": false
    }'
```
