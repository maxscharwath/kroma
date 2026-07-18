import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KromaEvents, type ServerEvent } from './events';

// A controllable WebSocket stand-in. Each construction is recorded so tests can
// drive its lifecycle callbacks by hand.
class FakeWS {
  static instances: FakeWS[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeWS.instances.push(this);
  }
  close(): void {
    this.closed = true;
  }
}

const WSImpl = FakeWS as unknown as typeof WebSocket;

beforeEach(() => {
  FakeWS.instances = [];
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('KromaEvents URL', () => {
  it('maps http to ws and appends /api/events', () => {
    new KromaEvents('http://host:4040', { WebSocketImpl: WSImpl }).connect();
    expect(FakeWS.instances[0]?.url).toBe('ws://host:4040/api/events');
  });

  it('maps https to wss and strips a trailing slash', () => {
    new KromaEvents('https://host/', { WebSocketImpl: WSImpl }).connect();
    expect(FakeWS.instances[0]?.url).toBe('wss://host/api/events');
  });
});

describe('KromaEvents messages', () => {
  it('parses a JSON frame and forwards the typed event', () => {
    const onEvent = vi.fn();
    new KromaEvents('http://h', { WebSocketImpl: WSImpl, onEvent }).connect();
    const ws = FakeWS.instances[0];
    ws?.onmessage?.({ data: JSON.stringify({ type: 'hello', version: '9' }) } as MessageEvent);
    expect(onEvent).toHaveBeenCalledWith({ type: 'hello', version: '9' } as ServerEvent);
  });

  it('ignores malformed and non-string frames', () => {
    const onEvent = vi.fn();
    new KromaEvents('http://h', { WebSocketImpl: WSImpl, onEvent }).connect();
    const ws = FakeWS.instances[0];
    ws?.onmessage?.({ data: '{not json' } as MessageEvent);
    ws?.onmessage?.({ data: { some: 'object' } } as unknown as MessageEvent);
    expect(onEvent).not.toHaveBeenCalled();
  });
});

describe('KromaEvents lifecycle', () => {
  it('invokes onOpen when the socket opens', () => {
    const onOpen = vi.fn();
    const ev = new KromaEvents('http://h', { WebSocketImpl: WSImpl, onOpen });
    ev.connect();
    FakeWS.instances[0]?.onopen?.();
    expect(onOpen).toHaveBeenCalledTimes(1);
    ev.close();
  });

  it('onerror closes the socket', () => {
    new KromaEvents('http://h', { WebSocketImpl: WSImpl }).connect();
    const ws = FakeWS.instances[0];
    ws?.onerror?.();
    expect(ws?.closed).toBe(true);
  });

  it('reconnects with backoff after a close and calls onClose', () => {
    const onClose = vi.fn();
    const ev = new KromaEvents('http://h', { WebSocketImpl: WSImpl, onClose });
    ev.connect();
    FakeWS.instances[0]?.onclose?.();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(FakeWS.instances).toHaveLength(1); // reconnect is scheduled, not immediate
    vi.advanceTimersByTime(1000); // first backoff = 1000ms
    expect(FakeWS.instances).toHaveLength(2);
    ev.close();
  });

  it('stops reconnecting once closed', () => {
    const ev = new KromaEvents('http://h', { WebSocketImpl: WSImpl });
    ev.connect();
    const ws = FakeWS.instances[0];
    ev.close();
    expect(ws?.closed).toBe(true);
    ws?.onclose?.(); // a late close event must not schedule another connect
    vi.advanceTimersByTime(60000);
    expect(FakeWS.instances).toHaveLength(1);
  });

  it('schedules a reconnect when the WebSocket constructor throws', () => {
    class ThrowingWS {
      constructor() {
        throw new Error('cannot open');
      }
    }
    const ev = new KromaEvents('http://h', {
      WebSocketImpl: ThrowingWS as unknown as typeof WebSocket,
    });
    expect(() => ev.connect()).not.toThrow();
    ev.close();
  });
});
