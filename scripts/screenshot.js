import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.argv[2] || 'http://localhost:5173';
  const outputPath = path.resolve(__dirname, '../comparison/current.png');

  console.log(`Launching browser to capture: ${url}`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 974, height: 1000 }
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    // Additional wait for static resources and animations to settle
    await page.waitForTimeout(2000);

    console.log(`Taking full-page screenshot at 974px width...`);
    await page.screenshot({
      path: outputPath,
      fullPage: true
    });
    
    console.log(`Screenshot successfully saved to: ${outputPath}`);
  } catch (error) {
    console.error('Error taking screenshot:', error);
  } finally {
    await browser.close();
  }
}

main();
