import { createApp } from './app';

const PORT = Number(process.env.PORT ?? 3000);

const adminPasscode = process.env.ADMIN_PASSCODE;
if (!adminPasscode) {
  console.warn(
    '[server] ADMIN_PASSCODE is not set; the admin passcode is "admin". Set it before sharing the app.',
  );
}

const app = createApp({ dataDir: process.env.DATA_DIR, adminPasscode });

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
});
