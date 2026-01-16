// Empty service worker to suppress 404 errors
// This file exists only to prevent browser/extension requests from generating 404s
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
