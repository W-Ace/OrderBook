import { vi } from 'vitest';
import { config } from '@vue/test-utils';

// 全局 Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;

  onclose: (() => void) | null = null;

  onmessage: ((event: MessageEvent) => void) | null = null;

  readyState = WebSocket.OPEN;

  close(): void {
    this.onclose?.();
  }
}

global.WebSocket = MockWebSocket as any;

config.global.stubs = {
  transition: false,
  'transition-group': false,
};

console.warn = vi.fn();
console.error = vi.fn();
