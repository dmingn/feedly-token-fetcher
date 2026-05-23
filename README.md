# feedly-token-fetcher

CLI tool that opens Feedly with Playwright, refreshes the Playwright storage state, and prints `feedlyToken`.

## Setup: `state.json`

Create `state.json` by logging in to Feedly in a normal browser, copying `feedly.session` from DevTools, and saving it in a minimal Playwright storage state file.

### Steps

1. Log in to [Feedly](https://feedly.com/) in Chrome or another browser
2. Open DevTools → **Application** → **Local Storage** → `https://feedly.com`
3. Copy the **Value** of `feedly.session`
4. Create `state.json` (for example in the repo root) and paste it into the template below (`cookies` can stay empty)

```json
{
  "cookies": [],
  "origins": [
    {
      "origin": "https://feedly.com",
      "localStorage": [
        {
          "name": "feedly.session",
          "value": "paste the Value copied from DevTools here"
        }
      ]
    }
  ]
}
```

### Notes

- `value` must be a **string**, not a JSON object. In Local Storage it is one string whose contents look like JSON; in `state.json` write it the same way, for example `"value": "{ \"plan\": ... }"` with quotes escaped
- Do not commit `state.json` (it contains secrets; already listed in `.gitignore`)

### Verify

```bash
npm install
npx playwright install chromium
npx tsx main.ts state.json
```

If the session is valid, the tool navigates to the reader (`/i/`), updates `state.json`, and prints `feedlyToken` to stdout.

## Usage

```bash
# Print token to stdout and update state.json
npx tsx main.ts state.json

# Write token to a file
npx tsx main.ts state.json -o token.txt

# Debug (verbose logs and success/error screenshots)
npm run dev
```

### Options

| Option                       | Description                                |
| ---------------------------- | ------------------------------------------ |
| `-o, --output <file>`        | Write token to this file (default: stdout) |
| `-v, --verbose`              | Enable debug logging                       |
| `-s, --screenshot-dir <dir>` | Save screenshots on success and on error   |

```bash
make clean   # Remove screenshots/*.png
```

## Docker

```bash
docker build -t feedly-token-fetcher .
docker run --rm -v "$(pwd)/state.json:/workdir/state.json" feedly-token-fetcher state.json
```
