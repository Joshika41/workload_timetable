const puppeteer = require('puppeteer');
(async () => {
  try {
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
      page.on('response', async (response) => {
          if (response.url().includes('my-semesters')) {
              console.log('MY-SEMESTERS STATUS:', response.status());
              const text = await response.text();
              console.log('MY-SEMESTERS RESPONSE:', text.substring(0, 100));
          }
      });
      
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
      
      await new Promise(r => setTimeout(r, 2000));
      
      await browser.close();
  } catch(e) {
      console.log('SCRIPT ERROR:', e);
  }
})();
