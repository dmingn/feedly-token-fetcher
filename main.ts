import { Command } from 'commander';
import { writeFile } from 'fs/promises';
import pino from 'pino';
import { chromium } from 'playwright';

const program = new Command();
program
  .option('-o, --output <file>', 'Output file name (default: standard output)')
  .option('-v, --verbose', 'Enable verbose logging (debug level)', false)
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

const fetchFeedlySession = async (email: string, password: string) => {
  const browser = await chromium.launch({
    headless: false,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://feedly.com/');
    logger.debug('Navigated to Feedly');

    await page.waitForLoadState('networkidle');
    await randomWait(500, 2000);
    await page.getByRole('link', { name: 'Log in', exact: true }).click();
    logger.debug('Clicked on Log in');

    await page.waitForLoadState('networkidle');
    await randomWait(500, 2000);
    await page.getByRole('link', { name: 'Sign in with Email' }).click();
    logger.debug('Clicked on Sign in with Email');

    await page.waitForLoadState('networkidle');
    await randomWait(500, 2000);
    await page.getByPlaceholder('Enter your email').fill(email);
    logger.debug('Filled in email');

    await randomWait(500, 2000);
    await page.getByRole('button', { name: 'Next' }).click();
    logger.debug('Clicked on Next');

    await page.waitForLoadState('networkidle');
    await randomWait(500, 2000);
    await page.getByPlaceholder('Password').click();
    logger.debug('Clicked on Password');

    await randomWait(500, 2000);
    await page.getByPlaceholder('characters min').fill(password);
    logger.debug('Filled in password');

    await randomWait(500, 2000);
    await page.getByRole('button', { name: 'Login' }).click();
    logger.debug('Clicked on Login');

    await page.waitForLoadState('networkidle');
    const feedlySession = await page.evaluate((key) => {
      return localStorage.getItem(key);
    }, 'feedly.session');
    logger.debug(`Fetched Feedly session: ${feedlySession}`);

    return feedlySession;
  } catch (error) {
    logger.error(error);
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

  const feedlySession = await fetchFeedlySession(email, password);
  if (!feedlySession) {
    logger.error('Error: Failed to fetch Feedly session');
    process.exit(1);
  }

  const feedlyToken = JSON.parse(feedlySession).feedlyToken;

  await outputFeedlyToken(options.output, feedlyToken);
})();
