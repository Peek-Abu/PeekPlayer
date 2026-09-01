import { test, expect } from '@playwright/test';

const FRAME = 1 / 30;

async function openPlayer(page) {
  await page.goto('/tests/fixtures/player.html');
  await expect(page.locator('.controls-row')).toBeVisible();
  await page.waitForFunction(() => Number.isFinite(window.player.video.duration) && window.player.video.duration > 0);
}

async function focusInsidePlayer(page) {
  // The keyboard handler only engages when the wrapper has focus or hover.
  await page.locator('.play-toggle-button').focus();
}

test.describe('rendering', () => {
  test('renders all core controls', async ({ page }) => {
    await openPlayer(page);
    await expect(page.locator('.segmented-scrubber')).toBeVisible();
    await expect(page.locator('.play-toggle-button')).toBeVisible();
    await expect(page.locator('.volume-control')).toBeVisible();
    await expect(page.locator('.time-display')).toBeVisible();
    await expect(page.locator('.fullscreen-button')).toBeVisible();
  });

  test('center play button visible when paused, hidden while playing', async ({ page }) => {
    await openPlayer(page);
    const btn = page.locator('.paused-play-button');
    await expect(btn).toHaveCSS('pointer-events', 'auto');
    await page.locator('.play-toggle-button').click();
    await expect(btn).toHaveCSS('pointer-events', 'none');
    await page.locator('.play-toggle-button').click();
    await expect(btn).toHaveCSS('pointer-events', 'auto');
  });
});

test.describe('volume', () => {
  test('muted video initializes slider to 0 (issue #5)', async ({ page }) => {
    await page.goto('/tests/fixtures/player.html');
    await page.waitForFunction(() => window.player);
    await page.evaluate(() => { window.player.video.muted = true; });
    await expect(page.locator('.volume-slider')).toHaveValue('0');
  });

  test('volume tooltip live-updates while hovering', async ({ page }) => {
    await openPlayer(page);
    // The slider is collapsed (width 0) until the volume control is hovered
    await page.locator('.volume-control').hover();
    const slider = page.locator('.volume-slider');
    await expect(slider).toBeVisible();
    await slider.hover({ position: { x: 5, y: 5 } });
    const tooltip = page.locator('.tooltip.tooltip--visible');
    await expect(tooltip).toBeVisible();
    const first = await tooltip.textContent();
    const box = await slider.boundingBox();
    await page.mouse.move(box.x + box.width - 3, box.y + box.height / 2);
    await expect(tooltip).not.toHaveText(first);
    expect(first).toMatch(/%$/);
  });

  test('wheel over volume control changes volume and updates tooltip', async ({ page }) => {
    await openPlayer(page);
    const control = page.locator('.volume-control');
    await control.hover();
    const slider = page.locator('.volume-slider');
    await expect(slider).toBeVisible();
    await slider.hover();
    await page.mouse.wheel(0, -120);
    await expect(page.locator('.tooltip.tooltip--visible')).toContainText('%');
    const volume = await page.evaluate(() => window.player.video.volume);
    expect(volume).toBeGreaterThan(0);
  });

  test('mute click sets slider to 0 and back', async ({ page }) => {
    await openPlayer(page);
    await page.locator('.mute-button').click();
    await expect(page.locator('.volume-slider')).toHaveValue('0');
    await page.locator('.mute-button').click();
    await expect(page.locator('.volume-slider')).not.toHaveValue('0');
  });
});

test.describe('scrubbing', () => {
  test('time display previews during drag and commits on release', async ({ page }) => {
    await openPlayer(page);
    const scrubber = page.locator('.segmented-scrubber__track');
    const box = await scrubber.boundingBox();
    const y = box.y + box.height / 2;
    const timeEl = page.locator('.time-display .current-time');
    const before = await timeEl.textContent();

    await page.mouse.move(box.x + box.width * 0.7, y);
    await page.mouse.down();
    await expect(timeEl).not.toHaveText(before);
    const midDrag = await timeEl.textContent();

    await page.mouse.move(box.x + box.width * 0.3, y, { steps: 5 });
    await expect(timeEl).not.toHaveText(midDrag);

    await page.mouse.up();
    await page.waitForFunction(() => window.player.video.currentTime > 1);
    const t = await page.evaluate(() => window.player.video.currentTime);
    expect(t).toBeGreaterThan(1);
    expect(t).toBeLessThan(4.5);
  });

  test('video.currentTime is not flooded during drag', async ({ page }) => {
    await openPlayer(page);
    const scrubber = page.locator('.segmented-scrubber__track');
    const box = await scrubber.boundingBox();
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 2, y);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(box.x + (box.width * i) / 6, y);
    }
    const commits = await page.evaluate(() =>
      window.__events.filter(([k]) => k === 'seek').length
    );
    await page.mouse.up();
    // Preview-only during drag: at most the initial tap-to-seek commit.
    expect(commits).toBeLessThanOrEqual(1);
  });
});

test.describe('keyboard', () => {
  test('frame stepping: period advances ~1 frame, comma goes back', async ({ page }) => {
    await openPlayer(page);
    await focusInsidePlayer(page);
    await page.evaluate(() => { window.player.video.pause(); });
    const t0 = await page.evaluate(() => window.player.video.currentTime);
    await page.keyboard.press('.');
    const t1 = await page.evaluate(() => window.player.video.currentTime);
    expect(Math.abs(t1 - t0 - FRAME)).toBeLessThan(0.002);

    await page.keyboard.press(',');
    const t2 = await page.evaluate(() => window.player.video.currentTime);
    expect(Math.abs(t2 - t1 + FRAME)).toBeLessThan(0.002);
  });

  test('frame stepping pauses playback', async ({ page }) => {
    await openPlayer(page);
    await focusInsidePlayer(page);
    await page.evaluate(() => window.player.video.play());
    await page.keyboard.press('.');
    await page.waitForFunction(() => window.player.video.paused);
  });

  test('frame stepping clamps at 0 and duration', async ({ page }) => {
    await openPlayer(page);
    await focusInsidePlayer(page);
    await page.evaluate(() => { window.player.video.currentTime = 0.001; window.player.video.pause(); });
    await page.keyboard.press(',');
    await page.keyboard.press(',');
    expect(await page.evaluate(() => window.player.video.currentTime)).toBe(0);

    await page.evaluate(() => { window.player.video.currentTime = window.player.video.duration; });
    await page.keyboard.press('.');
    const t = await page.evaluate(() => window.player.video.currentTime);
    expect(t).toBeLessThanOrEqual(await page.evaluate(() => window.player.video.duration) + 1e-9);
  });

  test('keys are ignored when the player is not focused or hovered', async ({ page }) => {
    await openPlayer(page);
    await page.evaluate(() => { window.player.video.pause(); });
    const t0 = await page.evaluate(() => window.player.video.currentTime);
    await page.keyboard.press('.');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.player.video.currentTime)).toBe(t0);
  });

  test('arrow keys seek and space toggles when focused', async ({ page }) => {
    await openPlayer(page);
    await focusInsidePlayer(page);
    const t0 = await page.evaluate(() => window.player.video.currentTime);
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction((prev) => window.player.video.currentTime > prev, t0);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.player.video.paused);
  });
});

test.describe('live streams', () => {
  /**
   * Present the loaded fixture as a live stream.
   *
   * A real live source would mean a network dependency, which this suite
   * deliberately avoids. What the player actually reads is `duration` and
   * `seekable`, so overriding those exercises every code path that matters:
   * `Infinity` duration is what marks a stream live, and the seekable range is
   * the DVR window the scrubber and badge are built from.
   */
  async function makeLive(page, { start = 0, end = 600, currentTime = 595 } = {}) {
    await page.evaluate(({ start, end, currentTime }) => {
      const video = window.player.video;
      Object.defineProperty(video, 'duration', { configurable: true, get: () => Infinity });
      Object.defineProperty(video, 'seekable', {
        configurable: true,
        get: () => ({ length: 1, start: () => start, end: () => end })
      });
      let time = currentTime;
      Object.defineProperty(video, 'currentTime', {
        configurable: true,
        get: () => time,
        set: (v) => { time = v; video.dispatchEvent(new Event('seeked')); }
      });
      video.dispatchEvent(new Event('durationchange'));
      video.dispatchEvent(new Event('timeupdate'));
    }, { start, end, currentTime });
  }

  test('falls back to buffered when seekable is empty', async ({ page }) => {
    // Measured against a real MSE live stream, `seekable` stayed empty for the
    // whole session. Relying on it alone reported a zero DVR window and hid
    // the scrubber on a stream that had minutes of rewind.
    await openPlayer(page);
    await page.evaluate(() => {
      const video = window.player.video;
      Object.defineProperty(video, 'duration', { configurable: true, get: () => Infinity });
      Object.defineProperty(video, 'seekable', {
        configurable: true,
        get: () => ({ length: 0, start: () => 0, end: () => 0 })
      });
      Object.defineProperty(video, 'buffered', {
        configurable: true,
        get: () => ({ length: 1, start: () => 100, end: () => 400 })
      });
      video.dispatchEvent(new Event('durationchange'));
    });
    const state = await page.evaluate(() => ({
      dvr: window.PeekPlayerLive.dvrWindow(window.player.video),
      edge: window.PeekPlayerLive.liveEdge(window.player.video)
    }));
    expect(state.dvr).toBe(300);
    expect(state.edge).toBe(400);
    await expect(page.locator('.scrubber-row')).toBeVisible();
  });

  test('badge is hidden for a normal file', async ({ page }) => {
    await openPlayer(page);
    await expect(page.locator('.live-badge')).toBeHidden();
  });

  test('shows LIVE at the edge, and does not offer a jump', async ({ page }) => {
    await openPlayer(page);
    await makeLive(page, { end: 600, currentTime: 597 });
    const badge = page.locator('.live-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/LIVE/);
    await expect(badge).toHaveClass(/is-at-edge/);
    await expect(badge).toBeDisabled();
  });

  test('offers GO LIVE when behind, and clicking returns to the edge', async ({ page }) => {
    await openPlayer(page);
    await makeLive(page, { end: 600, currentTime: 400 });
    const badge = page.locator('.live-badge');
    await expect(badge).toHaveClass(/is-behind/);
    await expect(badge).toHaveText(/GO LIVE/);
    await expect(badge).toBeEnabled();

    await badge.click();

    // Lands just behind the edge on purpose: seeking exactly to it stalls.
    const time = await page.evaluate(() => window.player.video.currentTime);
    expect(time).toBeGreaterThan(595);
    expect(time).toBeLessThanOrEqual(600);
    await expect(badge).toHaveClass(/is-at-edge/);
  });

  test('time display drops the total and reports how far behind', async ({ page }) => {
    await openPlayer(page);
    await makeLive(page, { end: 600, currentTime: 540 });
    await expect(page.locator('.time-display .total-time')).toBeHidden();
    // 60s behind the edge.
    await expect(page.locator('.time-display .current-time')).toHaveText('-1:00');
  });

  test('scrubber is hidden when the stream offers no rewind', async ({ page }) => {
    await openPlayer(page);
    await makeLive(page, { start: 592, end: 600, currentTime: 599 });
    await expect(page.locator('.scrubber-row')).toBeHidden();
  });

  test('scrubber maps position into the DVR window, not absolute time', async ({ page }) => {
    await openPlayer(page);
    // Halfway through a 600s window that starts at 300.
    await makeLive(page, { start: 300, end: 900, currentTime: 600 });
    await expect(page.locator('.scrubber-row')).toBeVisible();
    const percent = await page.evaluate(() => {
      const el = document.querySelector('.segmented-scrubber');
      return Number(el.getAttribute('aria-valuenow'));
    });
    // Absolute time would read 600; window-relative is 300 of 600.
    expect(percent).toBeGreaterThan(250);
    expect(percent).toBeLessThan(350);
  });
});
