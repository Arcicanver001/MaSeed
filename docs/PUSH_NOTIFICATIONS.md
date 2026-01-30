# Push Notifications Setup Guide

This guide explains how to set up and use push notifications for the Smart Greenhouse Dashboard.

## Overview

Push notifications allow you to receive alerts on your mobile device or laptop even when the browser is closed. This is especially useful for critical sensor alerts and system warnings.

## Features

- ✅ Native push notifications (works when browser is closed)
- ✅ Critical sensor alerts
- ✅ Warning notifications
- ✅ Actuator status changes
- ✅ Customizable notification preferences
- ✅ Works on mobile and desktop browsers

## Browser Support

Push notifications work on:
- ✅ Chrome/Edge (Windows, Android, macOS)
- ✅ Firefox (Windows, Android, macOS)
- ✅ Safari (macOS, iOS 16.4+)
- ❌ Internet Explorer (not supported)

## Setup Instructions

### 1. Install Dependencies

The `web-push` package has been added to `server/package.json`. Install it by running:

```bash
cd server
npm install
```

### 2. Generate VAPID Keys (Optional but Recommended)

For production use, you should generate your own VAPID keys. The server will generate temporary keys automatically, but for production:

```bash
cd server
npx web-push generate-vapid-keys
```

This will output:
- Public Key: (copy this)
- Private Key: (copy this)

### 3. Configure Environment Variables

Add these to your `.env` file in the `server` directory:

```env
VAPID_PUBLIC_KEY=your_public_key_here
VAPID_PRIVATE_KEY=your_private_key_here
VAPID_EMAIL=mailto:your-email@example.com
```

**Note:** The `mailto:` prefix is required for the email.

### 4. Enable Push Notifications in the Dashboard

1. Open the dashboard in your browser
2. Navigate to **Settings** page
3. Scroll to **Push Notification Settings** section
4. Click **"Enable Push Notifications"**
5. Allow notifications when prompted by your browser

### 5. Configure Notification Preferences

In the Settings page, you can:
- Enable/disable push notifications
- Choose which types of notifications to receive:
  - Critical Alerts (always enabled)
  - Warning Alerts
  - Success Notifications
  - Info Notifications

## How It Works

1. **Service Worker**: A service worker (`sw.js`) handles incoming push notifications
2. **Subscription**: When you enable push notifications, your browser creates a subscription
3. **Server Storage**: The subscription is stored in Firebase
4. **Notification Sending**: When alerts occur, the server sends push notifications to all subscribed devices

## Notification Types

### Critical Alerts
- Sensor values outside critical ranges
- System errors
- Emergency actuator stops

### Warning Alerts
- Sensor values outside optimal ranges
- System warnings
- Actuator status changes

### Success/Info Notifications
- Optional notifications for successful operations
- General information updates

## Testing

1. Enable push notifications in Settings
2. Click **"Test Notification"** button
3. You should receive a test notification

## Troubleshooting

### Notifications Not Working?

1. **Check Browser Support**: Ensure you're using a supported browser
2. **Check Permissions**: Go to browser settings and ensure notifications are allowed
3. **Check Subscription**: Verify subscription status in Settings page
4. **Check Server Logs**: Look for errors in server console
5. **Check VAPID Keys**: Ensure VAPID keys are properly configured

### Permission Denied?

If you previously denied notifications:
- **Chrome/Edge**: Click the lock icon in address bar → Site settings → Notifications → Allow
- **Firefox**: Click the lock icon → More information → Permissions → Notifications → Allow
- **Safari**: Safari → Settings → Websites → Notifications → Allow

### Service Worker Not Registering?

- Ensure `sw.js` is in the root directory
- Check browser console for errors
- Verify HTTPS (required for service workers, except localhost)

## API Endpoints

The following endpoints are available:

- `GET /api/push/vapid-public-key` - Get VAPID public key
- `POST /api/push/subscribe` - Subscribe to push notifications
- `POST /api/push/unsubscribe` - Unsubscribe from push notifications
- `POST /api/push/verify` - Verify subscription status
- `POST /api/push/send` - Send push notification (requires authentication)

## Security Notes

- VAPID keys should be kept secret (private key)
- Subscriptions are stored in Firebase with user association
- Invalid subscriptions are automatically cleaned up
- Notifications require user permission

## Files Added

- `sw.js` - Service worker for handling push notifications
- `js/push-notifications.js` - Push notification manager
- `js/push-integration.js` - Integration with existing alert system
- Server endpoints in `server/server.js`
- UI controls in `index.html` Settings page

## Next Steps

1. Test push notifications on your device
2. Configure notification preferences
3. Monitor server logs for any issues
4. Consider generating production VAPID keys

For more information, see the main [README.md](../README.md).




