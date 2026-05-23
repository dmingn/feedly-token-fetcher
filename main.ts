import { Command } from 'commander';
import { writeFile } from 'fs/promises';
import pino from 'pino';
import type { BrowserContext, Page } from 'playwright';
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
  .option('-o, --output <file>', 'Write feedlyToken to this file')
  .option('-v, --verbose', 'Enable verbose logging (debug level)', false)
  .option(
    '-s, --screenshot-dir <dir>',
    'Directory to save screenshots on success and error (default: none)',
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

const debugPage = async (page: Page) => {
  logger.debug(`Page URL: ${page.url()}`);
  logger.debug(`Page title: ${await page.title()}`);
  logger.debug(
    `Local storage keys: ${await page.evaluate(() => Object.keys(localStorage))}`,
  );
  logger.debug(
    `Session storage keys: ${await page.evaluate(() => Object.keys(sessionStorage))}`,
  );

  await takeScreenshot(page, options.screenshotDir, 'error');
};

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

const feedlyTokenFromStorageState = (storageState: StorageState): string => {
  const raw = storageState.origins
    .find((origin) => origin.origin === 'https://feedly.com')
    ?.localStorage.find((item) => item.name === 'feedly.session')?.value;

  if (!raw) {
    throw new Error('feedly.session is missing');
  }

  let session: { feedlyToken?: string } | null;
  try {
    session = JSON.parse(raw);
  } catch {
    throw new Error('feedly.session is not valid JSON');
  }

  if (!session?.feedlyToken) {
    throw new Error('feedlyToken is missing from feedly.session');
  }

  return session.feedlyToken;
};

const loggedInReaderUrl = /https:\/\/feedly\.com\/i\//;

const assertLoggedInOnPage = async (page: Page): Promise<void> => {
  try {
    await page.waitForURL(loggedInReaderUrl, { timeout: 15_000 });
  } catch {
    throw new Error(
      'Timed out waiting for redirect to the Feedly reader after login. Check the storage state you passed is valid.',
    );
  }
};

const takeScreenshot = async (
  page: Page,
  screenshotDir: string | undefined,
  label: 'success' | 'error',
) => {
  if (!screenshotDir) {
    return;
  }

  const screenshotFile = `${screenshotDir}/${label}-${Date.now()}.png`;

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

      await assertLoggedInOnPage(page);
      await takeScreenshot(page, options.screenshotDir, 'success');

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

const writeFeedlyTokenToFile = async (fileName: string, token: string) => {
  try {
    await writeFile(fileName, token, 'utf-8');
    logger.info(`Wrote Feedly token to ${fileName}`);
  } catch (error) {
    logger.error(`Error writing to file: ${error}`);
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
  const feedlyToken = feedlyTokenFromStorageState(newStorageState);

  await writeFile(storageStateJson, JSON.stringify(newStorageState, null, 2));
  logger.info(`Updated storage state in ${storageStateJson}`);

  if (options.output) {
    await writeFeedlyTokenToFile(options.output, feedlyToken);
  }
})();
