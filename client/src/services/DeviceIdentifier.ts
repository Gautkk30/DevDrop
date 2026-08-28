export class DeviceIdentifier {
  public static getDeviceDescription(): string {
    if (typeof navigator === 'undefined') return 'Unknown Device';

    const ua = navigator.userAgent;
    let browser = 'Browser';
    let os = 'Unknown OS';

    // Browser detection
    if (/Edg\//i.test(ua)) {
      browser = 'Edge';
    } else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
      browser = 'Chrome';
    } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
      browser = 'Safari';
    } else if (/Firefox\//i.test(ua)) {
      browser = 'Firefox';
    } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
      browser = 'Opera';
    }

    // Operating System detection
    if (/iPhone/i.test(ua)) {
      os = 'iPhone';
    } else if (/iPad/i.test(ua)) {
      os = 'iPad';
    } else if (/Android/i.test(ua)) {
      os = 'Android';
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      os = 'macOS';
    } else if (/Windows NT/i.test(ua)) {
      os = 'Windows';
    } else if (/Linux/i.test(ua)) {
      os = 'Linux';
    } else if (/CrOS/i.test(ua)) {
      os = 'ChromeOS';
    }

    return `${browser} on ${os}`;
  }

  public static getDefaultDeviceName(): string {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (/iPhone/i.test(navigator.userAgent)) return 'iPhone';
    if (/iPad/i.test(navigator.userAgent)) return 'iPad';
    if (/Android/i.test(navigator.userAgent)) return 'Android Device';
    if (/Macintosh/i.test(navigator.userAgent)) return 'MacBook';
    return isMobile ? 'Mobile Phone' : 'Laptop';
  }
}
