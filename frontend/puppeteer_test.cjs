const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  await page.goto('http://localhost:8080/');
  
  const tokenData = await page.evaluate(async () => {
    const formData = new URLSearchParams();
    formData.append('username', 'hod_mcamcagenai@srm.edu');
    formData.append('password', '123456');
    const response = await fetch('http://localhost:8000/api/auth/login', {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return await response.json();
  });
  
  await page.evaluate((response) => {
    const newSession = {
        token: response.access_token,
        role: response.role,
        name: response.name,
        userId: response.user_id || 0,
        facultyProfileId: response.faculty_profile_id || null,
        context: {
          departmentId: response.department_id || 0,
          departmentName: response.department_name || '',
          institutionId: response.institution_id || 0,
          institutionName: response.institution_name || '',
          designation: response.designation || '',
          erpId: response.erp_id || '',
          programmeId: 0,
          programmeName: '',
          programmeType: '',
          semesterType: 'ODD',
          academicYear: '2026-27',
        },
    };
    localStorage.setItem('auth_token', response.access_token);
    localStorage.setItem('erp_session', JSON.stringify(newSession));
  }, tokenData);

  await page.goto('http://localhost:8080/hod');
  await new Promise(r => setTimeout(r, 2000));
  
  const innerText = await page.evaluate(() => document.body.innerText);
  console.log("TEXT EXTRACT:\n", innerText.substring(0, 500));
  
  await browser.close();
})();
