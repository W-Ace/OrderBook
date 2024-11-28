import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import type { ComponentPublicInstance } from 'vue';
import OrderBook from '@/components/OrderBook.vue';
import { createWebSocketService } from '@/services/websocket';
import type { WebSocketService } from '@/types/websocket';

interface OrderBookInstance extends ComponentPublicInstance {
  ws: WebSocketService;
}

vi.mock('@/services/websocket', () => ({
  createWebSocketService: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    resubscribe: vi.fn(),
  })),
}));

describe('OrderBook.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with initial state', () => {
    const wrapper = mount(OrderBook);

    expect(wrapper.find('.title').text()).toBe('Order Book');
    expect(wrapper.find('.book-header').exists()).toBe(true);
    expect(wrapper.findAll('.header-col')).toHaveLength(3);
  });

  it('formats numbers correctly', async () => {
    const wrapper = mount(OrderBook);
    const vm = wrapper.vm as any;

    expect(vm.formatNumber(1234.5678)).toBe('1,234.57');
    expect(vm.formatNumber(1000000)).toBe('1,000,000');
    expect(vm.formatNumber(0.12345)).toBe('0.12');
  });

  it('renders price arrow correctly', async () => {
    const wrapper = mount(OrderBook);
    const vm = wrapper.vm as any;

    expect(vm.renderPriceArrow('price-up')).toBe('↑');
    expect(vm.renderPriceArrow('price-down')).toBe('↓');
    expect(vm.renderPriceArrow('price-same')).toBe('');
  });

  it('calculates totals correctly for asks', () => {
    const wrapper = mount(OrderBook);
    const vm = wrapper.vm as any;

    const orders: [number, number][] = [
      [100, 10],
      [99, 20],
      [98, 30],
    ];

    const result = vm.calculateTotals(orders, 'ask');

    expect(result[2].total).toBe(30);
    expect(result[1].total).toBe(50);
    expect(result[0].total).toBe(60);
  });

  it('calculates totals correctly for bids', () => {
    const wrapper = mount(OrderBook);
    const vm = wrapper.vm as any;

    const orders: [number, number][] = [
      [100, 10],
      [99, 20],
      [98, 30],
    ];

    const result = vm.calculateTotals(orders, 'bid');

    expect(result[0].total).toBe(10);
    expect(result[1].total).toBe(30);
    expect(result[2].total).toBe(60);
  });

  it('updates last price correctly', () => {
    const wrapper = mount(OrderBook);
    const vm = wrapper.vm as any;

    vm.updateLastPrice(100);
    expect(vm.state.lastPrice).toBe(100);
    expect(vm.state.previousPrice).toBe(0);

    vm.updateLastPrice(200);
    expect(vm.state.lastPrice).toBe(200);
    expect(vm.state.previousPrice).toBe(100);
  });

  it('handles websocket lifecycle correctly', () => {
    const wrapper = mount(OrderBook);

    expect(createWebSocketService).toHaveBeenCalled();

    wrapper.unmount();
    expect((wrapper.vm as OrderBookInstance).ws.disconnect).toHaveBeenCalled();
  });
});

describe('OrderBook animations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle size change class correctly', () => {
    const wrapper = mount(OrderBook);
    const vm = wrapper.vm as any;

    vm.state.asks = [{
      price: 100,
      size: 20,
      total: 20,
      percentage: 100,
    }];

    vm.sizeChanges.set(100, {
      prevSize: 10,
      side: 'ask',
    });

    expect(vm.getSizeChangeClass(100, 'ask')).toBe('size-increase');

    vm.state.asks[0].size = 5;
    vm.sizeChanges.set(100, {
      prevSize: 20,
      side: 'ask',
    });

    expect(vm.getSizeChangeClass(100, 'ask')).toBe('size-decrease');
  });

  it('should clean up animation states for removed prices', () => {
    const wrapper = mount(OrderBook);
    const vm = wrapper.vm as any;

    vm.state.seqNum = 1;

    vm.priceChanges.set(100, { side: 'ask' });
    vm.sizeChanges.set(100, {
      prevSize: 10,
      side: 'ask',
    });

    vm.updateOrderBook({
      type: 'delta',
      data: {
        prevSeqNum: 1,
        seqNum: 2,
        asks: [['101', '10']],
        bids: [['99', '20']],
      },
    });

    console.log(vm.priceChanges);

    expect(vm.priceChanges.has(100)).toBe(false);
    expect(vm.sizeChanges.has(100)).toBe(false);
  });

  it('should handle resubscribe on sequence mismatch', () => {
    const wrapper = mount(OrderBook);
    const vm = wrapper.vm as any;

    vm.state.seqNum = 100;
    vm.updateOrderBook({
      type: 'delta',
      data: {
        seqNum: 102,
        prevSeqNum: 101,
        asks: [['100', '10']],
        bids: [],
      },
    });

    expect(vm.ws.resubscribe).toHaveBeenCalled();
  });

  it('should handle resubscribe on orderbook cross', () => {
    const wrapper = mount(OrderBook);
    const vm = wrapper.vm as any;

    vm.state.asks = [{ price: 100, size: 10 }];
    vm.state.bids = [{ price: 101, size: 10 }];

    vm.updateOrderBook({
      type: 'delta',
      data: {
        seqNum: 101,
        prevSeqNum: 100,
        asks: [['99', '10']],
        bids: [['100', '10']],
      },
    });

    expect(vm.ws.resubscribe).toHaveBeenCalled();
  });
});
