/* Sends the nightly planning push. Run by .github/workflows/nightly-push.yml. */
import webpush from 'web-push';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_SUBSCRIPTION } = process.env;
const missing = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'PUSH_SUBSCRIPTION']
  .filter((k) => !process.env[k]);
if (missing.length) {
  console.error('Missing secrets: ' + missing.join(', '));
  console.error('All four are made in the app under Settings -> Nightly Push.');
  process.exit(1);
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// One subscription, or several, if the app is installed on more than one device.
const raw = JSON.parse(PUSH_SUBSCRIPTION);
const subs = Array.isArray(raw) ? raw : [raw];

const payload = JSON.stringify({
  title: 'Set Tomorrow',
  body: 'One focus. Takes a minute.',
  tag: 'nightly-plan',
  url: './index.html#plan'
});

let failed = 0;
for (const sub of subs) {
  try {
    await webpush.sendNotification(sub, payload);
    console.log('Sent to', String(sub.endpoint).slice(0, 48) + '…');
  } catch (err) {
    failed++;
    console.error('Failed:', err.statusCode, err.body || err.message);
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.error('That subscription is gone — re-subscribe in the app and update PUSH_SUBSCRIPTION.');
    }
  }
}
process.exit(failed === subs.length ? 1 : 0);
