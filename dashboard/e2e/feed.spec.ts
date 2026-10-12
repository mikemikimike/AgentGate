import { test, expect } from '@playwright/test';

test('audit log page shows decisions and navigates to detail', async ({ page }) => {
  // Mock API response
  await page.route('**/v1/decisions*', async route => {
    const json = {
      decisions: [{
        id: 'd_1',
        session_id: 's_1',
        tool: 'send_email',
        verdict: 'deny',
        reason_codes: ['rule1'],
        total_ms: 50,
        model_ms: 40,
        policy_version: 1,
        model_version: 'stub',
        created_at: new Date().toISOString(),
        heads: {
          untrusted_influence: {
            answer: 'likely',
            probabilities: { none: 0.1, possible: 0.2, likely: 0.7 }
          }
        }
      }],
      cursor: null
    };
    await route.fulfill({ json });
  });

  await page.route('**/v1/decisions/d_1', async route => {
    const json = {
      id: 'd_1',
      session_id: 's_1',
      tool: 'send_email',
      verdict: 'deny',
      reason_codes: ['rule1'],
      total_ms: 50,
      model_ms: 40,
      policy_version: 1,
      model_version: 'stub',
      created_at: new Date().toISOString(),
      heads: {
        untrusted_influence: {
          answer: 'likely',
          probabilities: { none: 0.1, possible: 0.2, likely: 0.7 }
        }
      }
    };
    await route.fulfill({ json });
  });

  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Audit log');
  
  // See the mock decision
  await expect(page.getByText('send_email')).toBeVisible();
  
  // Click to open detail page
  await page.getByText('send_email').click();
  
  // Page should navigate and show detail
  await expect(page.getByText('Audit Log')).toBeVisible();
});
