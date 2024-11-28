import {
  describe, it, expect, beforeEach, vi,
} from 'vitest';
import { mount } from '@vue/test-utils';
import OrderBook from '@/components/OrderBook.vue';
import { createWebSocketService } from '@/services/websocket';

// Mock WebSocket Service
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
    expect(wrapper.vm.ws.disconnect).toHaveBeenCalled();
  });
});

describe('OrderBook resubscribe', () => {
  it('should resubscribe when sequence number mismatch', async () => {
    const wrapper = mount(OrderBook);
    const vm = wrapper.vm as any;

    vm.updateOrderBook({
      type: 'snapshot',
      data: {
        seqNum: 100,
        asks: [['100', '10']],
        bids: [['99', '20']],
      },
    });

    vm.updateOrderBook({
      type: 'delta',
      data: {
        seqNum: 102,
        prevSeqNum: 101,
        asks: [['101', '15']],
        bids: [['98', '25']],
      },
    });

    expect(vm.ws.resubscribe).toHaveBeenCalled();
  });

  it('should resubscribe when orderbook crosses', async () => {
    const wrapper = mount(OrderBook);
    const vm = wrapper.vm as any;

    vm.updateOrderBook({
      type: 'delta',
      data: {
        seqNum: 101,
        prevSeqNum: 100,
        asks: [['100', '10']],
        bids: [['101', '20']],
      },
    });

    expect(vm.ws.resubscribe).toHaveBeenCalled();
  });

  it('should handle multiple resubscribe calls', async () => {
    const wrapper = mount(OrderBook);
    const vm = wrapper.vm as any;

    vm.updateOrderBook({
      type: 'delta',
      data: {
        seqNum: 102,
        prevSeqNum: 100,
        asks: [['100', '10']],
        bids: [['99', '20']],
      },
    });

    vm.updateOrderBook({
      type: 'delta',
      data: {
        seqNum: 103,
        prevSeqNum: 102,
        asks: [['99', '10']],
        bids: [['100', '20']],
      },
    });

    expect(vm.ws.resubscribe).toHaveBeenCalledTimes(2);
  });
});
