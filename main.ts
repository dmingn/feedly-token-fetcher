import { Command } from 'commander';
import { writeFile } from 'fs/promises';
import pino from 'pino';
import { chromium, Page } from 'playwright';

const program = new Command();
program
  .option('-o, --output <file>', 'Output file name (default: standard output)')
  .option('-v, --verbose', 'Enable verbose logging (debug level)', false)
  .option(
    '-s, --screenshot-dir <dir>',
    'Directory to save screenshots (default: none)',
  )
  .parse(process.argv);

const options = program.opts();

const logger = pino({
  level: options.verbose ? 'debug' : 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

const getEmailPassword = () => {
  const email = process.env.EMAIL;
  if (!email) {
    logger.error('Error: EMAIL environment variable is required');
    process.exit(1);
  }

  const password = process.env.PASSWORD;
  if (!password) {
    logger.error('Error: PASSWORD environment variable is required');
    process.exit(1);
  }

  return { email, password };
};

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

const fetchFeedlySession = async (
  email: string,
  password: string,
  screenshotDir: string | undefined,
) => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://feedly.com/', {
      waitUntil: 'networkidle',
    });
    await takeScreenshot(page, screenshotDir);
    logger.debug('Navigated to Feedly');

    await randomWait(3000, 5000);
    await page.getByRole('link', { name: 'Log in', exact: true }).click();
    logger.debug('Clicked on Log in');

    await page.waitForURL('**/auth/auth**', {
      waitUntil: 'networkidle',
    });
    await takeScreenshot(page, screenshotDir);

    await randomWait(3000, 5000);
    await page.getByRole('link', { name: 'Sign in with Email' }).click();
    logger.debug('Clicked on Sign in with Email');

    await page.waitForURL('**/auth/login/checkEmail**', {
      waitUntil: 'networkidle',
    });
    await takeScreenshot(page, screenshotDir);

    await randomWait(3000, 5000);
    await page.getByPlaceholder('Enter your email').fill(email);
    logger.debug('Filled in email');

    await randomWait(3000, 5000);
    await page.getByRole('button', { name: 'Next' }).click();
    logger.debug('Clicked on Next');

    await page.waitForURL('**/auth/login/checkPassword**', {
      waitUntil: 'networkidle',
    });
    await takeScreenshot(page, screenshotDir);

    await randomWait(3000, 5000);
    await page.getByPlaceholder('Password').click();
    logger.debug('Clicked on Password');

    await randomWait(3000, 5000);
    await page.getByPlaceholder('characters min').fill(password);
    logger.debug('Filled in password');

    await randomWait(3000, 5000);
    await page.getByRole('button', { name: 'Login' }).click();
    logger.debug('Clicked on Login');

    const key = 'feedly.session';
    await page.waitForFunction((key) => localStorage.getItem(key), key);
    const feedlySession = await page.evaluate(
      (key) => localStorage.getItem(key),
      key,
    );

    if (!feedlySession) {
      throw new Error(`Failed to fetch Feedly session: ${feedlySession}`);
    }

    logger.debug(`Fetched Feedly session: ${feedlySession}`);

    return feedlySession;
  } catch (error) {
    logger.error(error);
    await debugPage(page);
    throw error;
  } finally {
    await page.close();
    logger.debug('Closed page');
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
  const { email, password } = getEmailPassword();

  const feedlySession = await fetchFeedlySession(
    email,
    password,
    options.screenshotDir,
  );

  const feedlyToken = JSON.parse(feedlySession).feedlyToken;

  await outputFeedlyToken(options.output, feedlyToken);
})();
