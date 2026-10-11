const puppeteer = require('puppeteer');
(async () => {
  try {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      
      await page.goto('http://localhost:8080');
      await page.waitForSelector('button');
      
      const buttons = await page.$$('button');
      await buttons[1].click();
      
      await page.select('select', '2');
      await new Promise(r => setTimeout(r, 1000));
      
      await page.evaluate(() => {
          document.querySelectorAll('select')[1].value = '13';
          document.querySelectorAll('select')[1].dispatchEvent(new Event('change', { bubbles: true }));
      });
      await new Promise(r => setTimeout(r, 1000));
      
      const loginBtns = await page.$$('button');
      await loginBtns[loginBtns.length - 1].click();
      
      await new Promise(r => setTimeout(r, 3000));
      
      const navBtns = await page.$$('button');
      for(let b of navBtns) {
          const txt = await page.evaluate(el => el.textContent, b);
          if (txt.includes('ODD')) await b.click();
      }
      
      await new Promise(r => setTimeout(r, 1000));
      
      const toasts = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('li[data-sonner-toast]')).map(el => el.textContent);
      });
      console.log('TOASTS:', toasts);
      
      const text = await page.evaluate(() => document.body.innerText);
      console.log('BODY HAS FAILED:', text.includes('Failed to load'));
      
      await browser.close();
  } catch(e) {
      console.log('SCRIPT ERROR:', e);
  }
})();
