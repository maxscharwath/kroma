// The ServiceWorkerGlobalScope surface this worker touches.
//
// Declared here rather than pulled in with `/// <reference lib="webworker" />`:
// that lib collides with the DOM lib the rest of clients/web compiles against
// (both declare `self`, `Client`, `fetch`, ...), and splitting the package into
// two TypeScript programs to gain types on one 140-line file is a worse trade
// than naming the dozen members it actually uses.

interface SwClient {
  url: string;
  focus(): Promise<SwClient>;
  navigate(url: string): Promise<SwClient | null>;
  postMessage(message: unknown): void;
}

interface SwPushEvent {
  data: { json(): unknown } | null;
  waitUntil(promise: Promise<unknown>): void;
  newSubscription?: PushSubscription | null;
}

interface SwNotificationEvent {
  notification: { close(): void; data: unknown };
  action: string;
  waitUntil(promise: Promise<unknown>): void;
}

interface SwGlobalScope {
  location: { origin: string };
  registration: {
    showNotification(title: string, options?: unknown): Promise<void>;
    pushManager: {
      subscribe(options: unknown): Promise<PushSubscription>;
      getSubscription(): Promise<PushSubscription | null>;
    };
  };
  clients: {
    claim(): Promise<void>;
    matchAll(options?: { type?: string; includeUncontrolled?: boolean }): Promise<SwClient[]>;
    openWindow?(url: string): Promise<SwClient | null>;
  };
  skipWaiting(): Promise<void>;
  addEventListener(type: 'install' | 'activate', listener: (event: SwPushEvent) => void): void;
  addEventListener(
    type: 'push' | 'pushsubscriptionchange',
    listener: (event: SwPushEvent) => void,
  ): void;
  addEventListener(type: 'notificationclick', listener: (event: SwNotificationEvent) => void): void;
}

// Deliberately NOT `declare const self`: the DOM lib the rest of clients/web
// compiles against already declares `self` as a Window, and a second
// declaration loses. sw.ts casts `self` to this once, at the top of the file,
// and every reference goes through that binding.
