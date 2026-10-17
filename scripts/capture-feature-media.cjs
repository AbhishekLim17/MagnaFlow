/**
 * Screenshots and GIFs for the Features page (public/features/), taken from the seeded
 * emulator so they always show the current screens with realistic data.
 *
 *   npm run emulators            (JDK 21)        npm run seed
 *   npm run dev:emulated         (app on :5174)
 *   npm install --no-save puppeteer-core
 *   node scripts/capture-feature-media.cjs [only-these-files...]
 *
 * Uses the installed Chrome (CHROME_PATH to override). GIFs are put together by
 * scripts/frames-to-gif.py (Python + Pillow). Emulator only: it moves seeded tasks around.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const puppeteer = require('puppeteer-core');

const BASE = process.env.APP_URL || 'http://localhost:5174';
const OUT = path.join(__dirname, '..', 'public', 'features');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PASSWORD = /const PASSWORD = '([^']+)'/.exec(fs.readFileSync(path.join(__dirname, 'seed-emulator.cjs'), 'utf8'))[1];
const ONLY = process.argv.slice(2);
const want = (file) => !ONLY.length || ONLY.includes(file);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    localStorage.setItem('magnaflow-theme', 'light');
    localStorage.setItem('magnaflow-rail', 'expanded');
  });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('input[type=password]');
  await page.type('input[type=email], input#email', email);
  await page.type('input[type=password]', PASSWORD);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}), page.click('form button[type=submit]')]);
  await pause(2500);
}

/** In-app navigation (keeps the session and the live listeners warm). */
async function go(page, route, settle = 2200) {
  await page.evaluate((r) => { history.pushState({}, '', r); dispatchEvent(new PopStateEvent('popstate')); }, route);
  await pause(settle);
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Choose an option of the Radix select labelled `label`. */
async function pick(page, label, option) {
  await page.evaluate(async (l, o) => {
    const lab = [...document.querySelectorAll('label')].find((x) => x.textContent.trim() === l);
    const trigger = lab && document.getElementById(lab.htmlFor);
    if (!trigger) return;
    trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
    await new Promise((r) => setTimeout(r, 350));
    [...document.querySelectorAll('[role=option]')].find((x) => x.textContent.trim() === o)?.click();
  }, label, option);
  await pause(1800);
}

async function shot(page, file, { element } = {}) {
  if (!want(file)) return;
  // no toasts in the picture (hidden, not removed: React owns those nodes)
  await page.evaluate(() => {
    if (document.getElementById('capture-css')) return;
    const style = Object.assign(document.createElement('style'), { id: 'capture-css' });
    style.textContent = 'ol[tabindex] > li { display: none !important; }';
    document.head.appendChild(style);
  });
  const target = element ? await page.$(element) : page;
  await target.screenshot({ path: path.join(OUT, file), type: 'webp', quality: 72 });
  console.log('  saved', file);
}

/** Drag from one point to another, saving a frame at each step, then make a GIF. */
async function dragGif(page, file, from, to, { steps = 14, hold = 6 } = {}) {
  if (!want(file)) return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frames-'));
  let n = 0;
  const frame = async () => page.screenshot({ path: path.join(dir, `f${String(n++).padStart(3, '0')}.png`) });
  for (let i = 0; i < hold; i += 1) await frame();
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps, { steps: 2 });
    await frame();
  }
  await page.mouse.up();
  await pause(1200);
  for (let i = 0; i < hold * 2; i += 1) await frame();
  execFileSync('python', [path.join(__dirname, 'frames-to-gif.py'), dir, path.join(OUT, file)], { stdio: 'inherit' });
  fs.rmSync(dir, { recursive: true, force: true });
}

const centre = async (page, selector) => page.$eval(selector, (el) => {
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width };
});

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: { width: 1280, height: 800 } });
  try {
    const page = await browser.newPage();
    console.log('Signing in as the org admin…');
    await signIn(page, 'admin@demo.test');

    await shot(page, 'dashboard.webp');
    await page.evaluate(() => localStorage.setItem('taskViewMode', 'list'));
    await go(page, '/admin/tasks');
    await shot(page, 'tasks-list.webp');

    // Task details: open "Instrument the checkout funnel" from the list
    await page.evaluate(() => [...document.querySelectorAll('h2')].find((h) => h.textContent === 'Instrument the checkout funnel')
      ?.closest('.p-5')?.querySelector('button[aria-label^="Comments on"]')?.click());
    await pause(2000);
    await shot(page, 'tasks-details.webp');
    await page.keyboard.press('Escape');

    // Kanban GIF: move "Renew the payment gateway contract" from Todo to In Progress
    await page.evaluate(() => localStorage.setItem('taskViewMode', 'kanban'));
    await page.goto(`${BASE}/admin/tasks`, { waitUntil: 'networkidle2' });
    await pause(2500);
    if (want('tasks-kanban.gif')) {
      const from = await centre(page, '[aria-label="Move Renew the payment gateway contract"]');
      const column = await page.evaluate(() => {
        const head = [...document.querySelectorAll('h2, h3')].find((h) => /^In progress/i.test(h.textContent.trim()));
        const r = (head?.closest('section, [role=region], div') || head).getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + 140 };
      });
      await dragGif(page, 'tasks-kanban.gif', from, column);
    }
    await page.evaluate(() => localStorage.setItem('taskViewMode', 'list'));

    await go(page, '/admin/staff');
    await shot(page, 'people.webp');
    await go(page, '/admin/departments');
    await shot(page, 'projects.webp');
    if (want('email-to-task.webp')) {
      const card = await page.evaluateHandle(() => [...document.querySelectorAll('p')].find((p) => p.textContent.startsWith('Email tasks to'))?.closest('.rounded-xl'));
      if (card.asElement()) {
        await card.asElement().screenshot({ path: path.join(OUT, 'email-to-task.webp'), type: 'webp', quality: 80 });
        console.log('  saved email-to-task.webp');
      }
    }

    await go(page, '/admin/timeline', 3000);
    await shot(page, 'timeline.webp');
    if (want('timeline.gif')) {
      const bar = await centre(page, '[aria-roledescription="task bar"]');
      await dragGif(page, 'timeline.gif', bar, { x: bar.x + 120, y: bar.y }, { steps: 12 });
    }

    for (const [route, file, select] of [
      ['/admin/reports', 'reports.webp'],
      ['/admin/sprints', 'sprints.webp', ['Project', 'Apollo Platform']],
      ['/admin/workload', 'workload.webp'],
      ['/admin/leave', 'leave.webp'],
      ['/admin/goals', 'goals.webp'],
      ['/admin/portfolio', 'portfolio.webp'],
      ['/admin/risks', 'risks.webp', ['Project', 'Apollo Platform']],
      ['/admin/pages', 'pages.webp', ['Project', 'Apollo Platform']],
      ['/admin/activity', 'activity.webp'],
      ['/admin/budget', 'budget.webp'],
      ['/admin/timesheets', 'timesheets.webp', ['Project', 'Apollo Platform']],
      ['/admin/invoices', 'invoices.webp'],
      ['/admin/requests', 'client-requests.webp'],
      ['/admin/fields', 'task-fields.webp'],
      ['/admin/automations', 'automations.webp'],
    ]) {
      if (!want(file)) continue;
      await go(page, route, 2600);
      if (select) await pick(page, ...select);
      await shot(page, file);
    }

    // The monthly report email, rendered by the real mail template
    if (want('monthly-report.webp')) {
      const { renderHtml } = require('./lib/mailer.cjs');
      const { reportRows, reportSummary } = await import('../src/lib/monthlyReport.js');
      const r = { created: 37, completed: 42, onTimePercent: 81, overdueNow: 5, hoursLogged: '612h', topPeople: [{ name: 'Sana Staff', completed: 14 }, { name: 'Vikram Iyer', completed: 11 }], projectRows: [{ name: 'Apollo Platform', completed: 30 }, { name: 'Atlas Finance', completed: 12 }] };
      const mail = { notification_type: 'Monthly report', notification_icon: '📈', title: 'Magnetar Global: October 2026', message: reportSummary(r, 'October 2026'), rows: reportRows(r), button_text: 'Open reports', button_link: '#', footer_text: 'Sent on the 1st of every month to org admins. Turn it off in Email settings.' };
      const mailPage = await browser.newPage();
      await mailPage.setViewport({ width: 760, height: 900 });
      await mailPage.setContent(renderHtml(mail), { waitUntil: 'load' });
      await mailPage.screenshot({ path: path.join(OUT, 'monthly-report.webp'), type: 'webp', quality: 80, fullPage: true });
      console.log('  saved monthly-report.webp');
      await mailPage.close();
    }

    // What the client sees
    if (want('client-portal.webp')) {
      const ctx = await browser.createBrowserContext();
      const client = await ctx.newPage();
      await signIn(client, 'client@demo.test');
      await pause(1500);
      await shot(client, 'client-portal.webp');
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
