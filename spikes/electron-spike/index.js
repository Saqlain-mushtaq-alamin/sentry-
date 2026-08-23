const { app, BrowserWindow, BrowserView } = require('electron');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

// Allow CDP on a specific port
app.commandLine.appendSwitch('remote-debugging-port', '8315');

let mainWindow;

app.whenReady().then(async () => {
  const startTime = Date.now();

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Create a BrowserView (like a tab)
  const view = new BrowserView();
  mainWindow.setBrowserView(view);
  view.setBounds({ x: 0, y: 50, width: 1024, height: 718 });

  await view.webContents.loadURL('https://example.com');
  const loadTime = Date.now() - startTime;
  
  console.log(`[Metrics] App startup & page load time: ${loadTime}ms`);

  // Connect Puppeteer via CDP
  try {
    const browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:8315'
    });

    const pages = await browser.pages();
    // Find the page that matches example.com
    const page = pages.find(p => p.url().includes('example.com'));
    
    if (page) {
      console.log('[CDP] Successfully connected to the tab.');
      
      // Inject overlay
      const overlayStart = Date.now();
      await page.evaluate(() => {
        const overlay = document.createElement('div');
        overlay.id = 'agent-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '10px';
        overlay.style.right = '10px';
        overlay.style.width = '300px';
        overlay.style.height = '100px';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.8)';
        overlay.style.color = 'white';
        overlay.style.zIndex = '999999';
        overlay.innerHTML = '<h3>Sentry Agent</h3><button id="agent-btn">Test Action</button>';
        document.body.appendChild(overlay);
      });
      console.log(`[Metrics] Overlay injection latency: ${Date.now() - overlayStart}ms`);

      // Extract DOM
      const domStart = Date.now();
      const html = await page.content();
      console.log(`[Metrics] DOM extraction latency: ${Date.now() - domStart}ms. DOM length: ${html.length}`);

      // Extract Accessibility Tree
      const a11yStart = Date.now();
      const snapshot = await page.accessibility.snapshot();
      console.log(`[Metrics] Accessibility tree latency: ${Date.now() - a11yStart}ms.`);
      
      // Programmatic click
      const clickStart = Date.now();
      await page.click('h1');
      console.log(`[Metrics] Programmatic click latency: ${Date.now() - clickStart}ms.`);
      
      // Write results to a file to indicate success
      fs.writeFileSync('spike-results.txt', 'SUCCESS: Electron CDP spike completed.\nDOM length: ' + html.length + '\n');
    } else {
      console.error('[CDP] Could not find the example.com page.');
    }

    await browser.disconnect();
  } catch (err) {
    console.error('CDP Error:', err);
  }

  // Close app after a few seconds
  setTimeout(() => {
    app.quit();
  }, 3000);
});

app.on('window-all-closed', () => {
  app.quit();
});
