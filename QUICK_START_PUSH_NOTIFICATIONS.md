# Quick Start: Push Notifications

## Step 1: Install Dependencies

Open PowerShell or Command Prompt in the project root and run:

```powershell
# Install root dependencies
npm install

# Install server dependencies (including web-push)
cd server
npm install
cd ..
```

## Step 2: Start the Server

You have two options:

### Option A: Use the Batch File (Easiest)
Double-click `start_remote_dashboard.bat` - this will:
- Start the API server on port 8080
- Open the dashboard in your browser

### Option B: Manual Start
```powershell
# Terminal 1: Start the API server
cd server
node server.js

# Terminal 2: Start the dashboard (optional - you can also open index.html directly)
npm run serve:dashboard
```

## Step 3: Open the Dashboard

1. Open your browser and go to:
   - `http://localhost:8000/login.html` (if using npm serve)
   - OR just open `login.html` directly from the file system

2. Log in to your account

## Step 4: Enable Push Notifications

1. Navigate to the **Settings** page (click Settings in the navigation)
2. Scroll down to **"Push Notification Settings"** section
3. Click **"Enable Push Notifications"** button
4. When your browser asks for permission, click **"Allow"**
5. You should see a success message: "✅ Push notifications enabled!"

## Step 5: Test Push Notifications

1. In the Settings page, click **"Test Notification"** button
2. You should receive a test notification on your device
3. If the browser is closed, the notification will still appear!

## Step 6: Configure Preferences

In the Settings page, you can customize:
- ✅ Enable/Disable push notifications
- ✅ Critical Alerts (always enabled)
- ✅ Warning Alerts
- ✅ Success Notifications
- ✅ Info Notifications

Click **"Save Notification Preferences"** when done.

## Troubleshooting

### "Push notifications not supported"
- Make sure you're using Chrome, Firefox, or Edge
- Safari requires iOS 16.4+ or macOS

### "Permission denied"
- Click the lock icon in your browser's address bar
- Go to Site Settings → Notifications → Allow

### "Service Worker not registering"
- Make sure you're accessing via `http://localhost` or HTTPS
- Check browser console (F12) for errors
- Ensure `sw.js` file exists in the root directory

### Server not starting?
- Check if port 8080 is already in use
- Make sure Node.js is installed: `node --version`
- Check server console for error messages

## What Happens Next?

Once enabled, you'll automatically receive push notifications for:
- 🚨 Critical sensor alerts (temperature, humidity, etc. out of range)
- ⚠️ Warning alerts
- 🎛️ Actuator status changes (if configured)
- 🔴 Emergency stops

Notifications work even when:
- Browser is closed
- Device is locked
- You're on a different tab

## Need Help?

Check `docs/PUSH_NOTIFICATIONS.md` for detailed documentation.




