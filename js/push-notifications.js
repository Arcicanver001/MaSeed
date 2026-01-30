// Push Notification Manager
// Handles Web Push API subscription and notification management

class PushNotificationManager {
  constructor() {
    this.registration = null;
    this.subscription = null;
    this.apiBase = window.getApiBase ? window.getApiBase() : 'https://api.maseed.farm/api';
    this.isSupported = this.checkSupport();
    this.init();
  }

  checkSupport() {
    if (!('serviceWorker' in navigator)) {
      console.warn('[Push] Service Workers not supported');
      return false;
    }
    if (!('PushManager' in window)) {
      console.warn('[Push] Push API not supported');
      return false;
    }
    if (!('Notification' in window)) {
      console.warn('[Push] Notifications not supported');
      return false;
    }
    return true;
  }

  async init() {
    if (!this.isSupported) {
      console.log('[Push] Push notifications not supported in this browser');
      return;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('[Push] Service Worker registered:', this.registration.scope);

      // Check for existing subscription
      this.subscription = await this.registration.pushManager.getSubscription();
      
      if (this.subscription) {
        console.log('[Push] Existing subscription found');
        // Verify subscription is still valid on server
        await this.verifySubscription();
      } else {
        console.log('[Push] No existing subscription');
      }

      // Listen for service worker updates
      this.registration.addEventListener('updatefound', () => {
        console.log('[Push] Service Worker update found');
      });

    } catch (error) {
      console.error('[Push] Initialization error:', error);
    }
  }

  async requestPermission() {
    if (!this.isSupported) {
      throw new Error('Push notifications are not supported in this browser');
    }

    // Check current permission
    if (Notification.permission === 'granted') {
      console.log('[Push] Permission already granted');
      return true;
    }

    if (Notification.permission === 'denied') {
      throw new Error('Notification permission was previously denied. Please enable it in browser settings.');
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('[Push] Permission granted');
      return true;
    } else {
      throw new Error('Notification permission denied');
    }
  }

  async subscribe() {
    if (!this.isSupported) {
      throw new Error('Push notifications are not supported');
    }

    // Request permission first
    await this.requestPermission();

    if (!this.registration) {
      await this.init();
    }

    try {
      // Get VAPID public key from server
      const vapidKeyResponse = await fetch(`${this.apiBase}/push/vapid-public-key`);
      if (!vapidKeyResponse.ok) {
        throw new Error('Failed to get VAPID public key from server');
      }
      const { publicKey } = await vapidKeyResponse.json();

      // Convert VAPID key to Uint8Array
      const applicationServerKey = this.urlBase64ToUint8Array(publicKey);

      // Subscribe to push notifications
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      console.log('[Push] Subscribed to push notifications');

      // Send subscription to server
      await this.sendSubscriptionToServer(this.subscription);

      return this.subscription;
    } catch (error) {
      console.error('[Push] Subscription error:', error);
      throw error;
    }
  }

  async unsubscribe() {
    if (!this.subscription) {
      console.log('[Push] No subscription to unsubscribe');
      return;
    }

    try {
      // Remove subscription from server
      await this.removeSubscriptionFromServer(this.subscription);

      // Unsubscribe from push service
      const successful = await this.subscription.unsubscribe();
      
      if (successful) {
        console.log('[Push] Unsubscribed from push notifications');
        this.subscription = null;
      } else {
        throw new Error('Failed to unsubscribe');
      }
    } catch (error) {
      console.error('[Push] Unsubscribe error:', error);
      throw error;
    }
  }

  async sendSubscriptionToServer(subscription) {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${this.apiBase}/push/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
          endpoint: subscription.endpoint
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription to server');
      }

      const result = await response.json();
      console.log('[Push] Subscription saved to server:', result);
      return result;
    } catch (error) {
      console.error('[Push] Error saving subscription:', error);
      throw error;
    }
  }

  async removeSubscriptionFromServer(subscription) {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${this.apiBase}/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint
        })
      });

      if (!response.ok) {
        console.warn('[Push] Failed to remove subscription from server (may not exist)');
      } else {
        console.log('[Push] Subscription removed from server');
      }
    } catch (error) {
      console.error('[Push] Error removing subscription:', error);
      // Don't throw - we still want to unsubscribe locally
    }
  }

  async verifySubscription() {
    if (!this.subscription) return;

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${this.apiBase}/push/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify({
          endpoint: this.subscription.endpoint
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (!result.valid) {
          // Subscription invalid, remove it
          console.log('[Push] Subscription invalid, removing...');
          await this.unsubscribe();
        }
      }
    } catch (error) {
      console.error('[Push] Error verifying subscription:', error);
    }
  }

  async isSubscribed() {
    if (!this.isSupported || !this.registration) {
      return false;
    }

    try {
      this.subscription = await this.registration.pushManager.getSubscription();
      return !!this.subscription;
    } catch (error) {
      console.error('[Push] Error checking subscription:', error);
      return false;
    }
  }

  getPermissionStatus() {
    if (!('Notification' in window)) {
      return 'not-supported';
    }
    return Notification.permission; // 'default', 'granted', or 'denied'
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Test notification (for debugging)
  async testNotification() {
    if (!this.isSupported) {
      throw new Error('Push notifications not supported');
    }

    if (Notification.permission !== 'granted') {
      await this.requestPermission();
    }

    if (this.registration) {
      await this.registration.showNotification('Test Notification', {
        body: 'This is a test push notification from the Greenhouse Dashboard',
        icon: '/assets/icon-192x192.png',
        badge: '/assets/badge-72x72.png',
        tag: 'test-notification',
        vibrate: [200, 100, 200]
      });
    }
  }
}

// Initialize global push notification manager
let pushNotificationManager = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    pushNotificationManager = new PushNotificationManager();
    window.pushNotificationManager = pushNotificationManager;
  });
} else {
  pushNotificationManager = new PushNotificationManager();
  window.pushNotificationManager = pushNotificationManager;
}

// Export for use in other modules
window.PushNotificationManager = PushNotificationManager;




