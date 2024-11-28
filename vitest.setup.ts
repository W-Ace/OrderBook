import { vi } from 'vitest';
import { config } from '@vue/test-utils';

// 全局 Mock WebSocket
class MockWebSocket {
  onopen: (() => void) | null = null;

  onclose: (() => void) | null = null;

  onmessage: ((event: MessageEvent) => void) | null = null;

  readyState = WebSocket.OPEN;

  constructor(public url: string) {}

  send(data: string): void {
    // 实现空方法
  }

  close(): void {
    this.onclose?.();
  }
}

// 替换全局 WebSocket
global.WebSocket = MockWebSocket as any;

// 设置 Vue Test Utils 的全局配置
config.global.stubs = {
  transition: false,
  'transition-group': false,
};

// Mock console methods
console.warn = vi.fn();
console.error = vi.fn();
