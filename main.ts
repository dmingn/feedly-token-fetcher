import { Command } from 'commander';
import { writeFile } from 'fs/promises';
import pino from 'pino';
import { Page } from 'playwright';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

const stealthPlugin = stealth();
chromium.use(stealthPlugin);

const program = new Command();
program
  .argument(
    '[storageState]',
    'storage state JSON containing Feedly auth information',
  )
  .option('-o, --output <file>', 'Output file name (default: standard output)')
  .option('-v, --verbose', 'Enable verbose logging (debug level)', false)
  .option(
    '-s, --screenshot-dir <dir>',
    'Directory to save screenshots (default: none)',
  )
  .parse(process.argv);

const args = program.args;
const options = program.opts();

const logger = pino({
  level: options.verbose ? 'debug' : 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

const randomWait = async (minMs: number, maxMs: number) => {
  const delay = Math.random() * (maxMs - minMs) + minMs;
  logger.debug(`Waiting for ${Math.round(delay)} ms`);
  return new Promise((resolve) => setTimeout(resolve, delay));
};

const debugPage = async (page: Page) => {
  logger.debug(`Page URL: ${page.url()}`);
  logger.debug(`Page title: ${await page.title()}`);
  logger.debug(
    `Local storage keys: ${await page.evaluate(() => Object.keys(localStorage))}`,
  );
  logger.debug(
    `Session storage keys: ${await page.evaluate(() => Object.keys(sessionStorage))}`,
  );

  await takeScreenshot(page, options.screenshotDir);
};

const takeScreenshot = async (
  page: Page,
  screenshotDir: string | undefined,
) => {
  if (!screenshotDir) {
    return;
  }

  const screenshotFile = `${screenshotDir}/${Date.now()}.png`;

  await page.screenshot({ path: screenshotFile, fullPage: true });
  logger.debug(`Saved screenshot to ${screenshotFile}`);
};

const fetchNewStorageState = async (storageStateJson: string) => {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      storageState: storageStateJson,
    });
    const page = await context.newPage();

    try {
      await page.goto('https://feedly.com/', {
        waitUntil: 'networkidle',
      });
      logger.debug('Navigated to Feedly');

      await randomWait(3000, 5000);

      return await context.storageState();
    } catch (error) {
      logger.error(error);
      await debugPage(page);
      throw error;
    } finally {
      await page.close();
      logger.debug('Closed page');
    }
  } finally {
    await browser.close();
    logger.debug('Closed browser');
  }
};

const outputFeedlyToken = async (
  fileName: string | undefined,
  token: string,
) => {
  if (fileName) {
    try {
      await writeFile(fileName, token, 'utf-8');
      logger.info(`Wrote Feedly token to ${fileName}`);
    } catch (error) {
      logger.error(`Error writing to file: ${error}`);
    }
  } else {
    console.log(token);
  }
};

(async () => {
  logger.debug(`Arguments: ${args}`);
  logger.debug(`Options: ${JSON.stringify(options)}`);

  const storageStateJson = args[0];
  if (!storageStateJson) {
    throw new Error('argument storageState is required');
  }

  const newStorageState = await fetchNewStorageState(storageStateJson);

  await writeFile(storageStateJson, JSON.stringify(newStorageState, null, 2));

  const feedlySession = newStorageState.origins
    .find((origin) => origin.origin === 'https://feedly.com')
    ?.localStorage.find((item) => item.name === 'feedly.session')?.value;
  const feedlyToken = JSON.parse(feedlySession).feedlyToken;

  await outputFeedlyToken(options.output, feedlyToken);
})();
