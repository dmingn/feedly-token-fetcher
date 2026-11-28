# feedly-token-fetcher

CLI tool that opens Feedly with Playwright and refreshes the Playwright storage state. Optionally writes `feedlyToken` to a file with `-o`.

## Release

The git tag is the source of truth for the version. `package.json` stays at `0.0.0-dev` in the repository.

1. Merge the changes you want to ship into `main`.
2. Create and push a tag:

```bash
git switch main
git pull --ff-only
git tag v0.3.1
git push origin v0.3.1
```

3. The CI/CD workflow runs on the tag, pushes the Docker image to GHCR, and creates a GitHub Release.

Use a pre-release identifier in the tag when needed (for example `v0.3.1-rc.1`). Those releases are marked as GitHub pre-releases.

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

If the session is valid, the tool navigates to the reader (`/i/`) and updates `state.json`.

## Usage

```bash
# Update state.json
npx tsx main.ts state.json

# Also write feedlyToken to a file
npx tsx main.ts state.json -o token.txt

# Debug (verbose logs and success/error screenshots)
npm run dev
```

### Options

| Option                       | Description                              |
| ---------------------------- | ---------------------------------------- |
| `-o, --output <file>`        | Write `feedlyToken` to this file         |
| `-v, --verbose`              | Enable debug logging                     |
| `-s, --screenshot-dir <dir>` | Save screenshots on success and on error |

```bash
make clean   # Remove screenshots/*.png
```

## Docker

```bash
docker build -t feedly-token-fetcher .
docker run --rm -v "$(pwd)/state.json:/workdir/state.json" feedly-token-fetcher state.json
```
