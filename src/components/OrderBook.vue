<template>
  <div
    v-if="state.seqNum"
    class="order-book"
  >
    <h1 class="title">
      Order Book
    </h1>
    <div class="book-header">
      <div class="header-col header-price">
        Price (USD)
      </div>
      <div class="header-col header-size">
        Size
      </div>
      <div class="header-col header-total">
        Total
      </div>
    </div>

    <div class="sells">
      <div
        v-for="order in asks"
        :key="order.price"
        class="order-row"
        :class="{ 'new-order': isNewOrder(order.price, 'ask') }"
      >
        <div class="body-col price sell">
          {{ formatNumber(order.price) }}
        </div>
        <div
          class="body-col size"
          :key="`size-${order.price}-${order.size}`"
          :class="getSizeChangeClass(order.price, 'ask')"
        >
          {{ formatNumber(order.size) }}
        </div>
        <div class="body-col total">
          <div
            class="total-bar sell"
            :style="{ width: `${order.percentage}%` }"
          />
          <span>{{ formatNumber(order.total) }}</span>
        </div>
      </div>
    </div>

    <div
      class="last-price"
      :class="priceClass"
    >
      {{ formatNumber(state.lastPrice) }}
      <span class="price-arrow">
        {{ renderPriceArrow(priceClass) }}
      </span>
    </div>

    <div class="buys">
      <div
        v-for="order in bids"
        :key="order.price"
        class="order-row"
        :class="{ 'new-order': isNewOrder(order.price, 'bid') }"
      >
        <div class="body-col price buy">
          {{ formatNumber(order.price) }}
        </div>
        <div
          class="body-col size"
          :key="`size-${order.price}-${order.size}`"
          :class="getSizeChangeClass(order.price, 'bid')"
        >
          {{ formatNumber(order.size) }}
        </div>
        <div class="body-col total">
          <div
            class="total-bar buy"
            :style="{ width: `${order.percentage}%` }"
          />
          <span>{{ formatNumber(order.total) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ref, computed, onMounted, onUnmounted,
} from 'vue';
import { createWebSocketService } from '@/services/websocket';
import type { WebSocketService } from '@/types/websocket';
import type {
  Order,
  OrderBookState,
  OrderBookData,
  OrderSide,
  PriceChangeMap,
  SizeChangeMap,
} from '@/types/orderbook';

const DEPTH_LEVELS = 50;
const MAX_DISPLAY = 8;

let ws: WebSocketService;

const state = ref<OrderBookState>({
  asks: [],
  bids: [],
  lastPrice: 0,
  previousPrice: 0,
  seqNum: 0,
});

const priceChanges = ref<PriceChangeMap>(new Map());
const sizeChanges = ref<SizeChangeMap>(new Map());

const asks = computed(() => state.value.asks.slice(0, MAX_DISPLAY));
const bids = computed(() => state.value.bids.slice(0, MAX_DISPLAY));
const priceClass = computed(() => {
  const { lastPrice, previousPrice } = state.value;
  if (lastPrice > previousPrice) return 'price-up';
  if (lastPrice < previousPrice) return 'price-down';
  return 'price-same';
});

const formatNumber = (num: number): string => num?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const calculateTotals = (
  orders: [number, number][],
  side: OrderSide,
): Order[] => {
  const sortedOrders = [...orders]
    .sort((a, b) => b[0] - a[0])
    .slice(0, DEPTH_LEVELS);

  const processed = sortedOrders.map(([price, size]) => ({
    price,
    size,
    total: 0,
    percentage: 0,
  }));

  const len = processed.length > MAX_DISPLAY ? MAX_DISPLAY : processed.length;
  let total = 0;
  if (side === 'ask') {
    for (let i = len - 1; i >= 0; i--) {
      total += processed[i].size;
      processed[i].total = total;
    }
  } else {
    for (let i = 0; i < len; i++) {
      total += processed[i].size;
      processed[i].total = total;
    }
  }

  const maxTotal = total;
  return processed.map((order) => ({
    ...order,
    percentage: (order.total / maxTotal) * 100,
  }));
};

const updateOrderBook = (wsData: OrderBookData): void => {
  const { data } = wsData;

  if (data.type === 'snapshot') {
    const newAsks = calculateTotals(
      data.asks
        .map(([price, size]) => [parseFloat(price), parseFloat(size)] as [number, number])
        .filter(([, size]) => size > 0),
      'ask',
    );
    const newBids = calculateTotals(
      data.bids
        .map(([price, size]) => [parseFloat(price), parseFloat(size)] as [number, number])
        .filter(([, size]) => size > 0),
      'bid',
    );

    state.value = {
      ...state.value,
      asks: newAsks,
      bids: newBids,
      seqNum: data.seqNum,
    };
    return;
  }

  if (data.prevSeqNum !== state.value.seqNum) {
    console.warn('Sequence number mismatch, resubscribing...');
    ws.resubscribe();
    return;
  }

  const bestBid = state.value.bids[0]?.price ?? 0;
  const bestAsk = state.value.asks[0]?.price ?? Infinity;

  if (bestBid >= bestAsk) {
    console.warn('Orderbook crossed, resubscribing...');
    ws.resubscribe();
    return;
  }

  const currentPrices = new Set([
    ...state.value.asks.map((order) => order.price),
    ...state.value.bids.map((order) => order.price),
  ]);

  const asksMap = new Map(state.value.asks.map((order) => [order.price, order.size]));
  const bidsMap = new Map(state.value.bids.map((order) => [order.price, order.size]));

  data.asks.forEach(([priceStr, sizeStr]) => {
    const price = parseFloat(priceStr);
    const size = parseFloat(sizeStr);

    if (size === 0) {
      asksMap.delete(price);
    } else {
      if (!currentPrices.has(price)) {
        priceChanges.value.set(price, { side: 'ask' });
      } else if (asksMap.get(price) !== size) {
        sizeChanges.value.set(price, {
          prevSize: asksMap.get(price) ?? 0,
          side: 'ask',
        });
      }
      asksMap.set(price, size);
    }
  });

  data.bids.forEach(([priceStr, sizeStr]) => {
    const price = parseFloat(priceStr);
    const size = parseFloat(sizeStr);

    if (size === 0) {
      bidsMap.delete(price);
    } else {
      if (!currentPrices.has(price)) {
        priceChanges.value.set(price, { side: 'bid' });
      } else if (bidsMap.get(price) !== size) {
        sizeChanges.value.set(price, {
          prevSize: bidsMap.get(price) ?? 0,
          side: 'bid',
        });
      }
      bidsMap.set(price, size);
    }
  });

  state.value.asks = calculateTotals(
    Array.from(asksMap.entries()).map(([price, size]) => [price, size]),
    'ask',
  );

  state.value.bids = calculateTotals(
    Array.from(bidsMap.entries()).map(([price, size]) => [price, size]),
    'bid',
  );

  state.value.seqNum = data.seqNum;

  const newPrices = new Set([
    ...Array.from(asksMap.keys()),
    ...Array.from(bidsMap.keys()),
  ]);

  priceChanges.value.forEach((_, price) => {
    if (!newPrices.has(price)) {
      priceChanges.value.delete(price);
    }
  });

  sizeChanges.value.forEach((_, price) => {
    if (!newPrices.has(price)) {
      sizeChanges.value.delete(price);
    }
  });
};

const isNewOrder = (price: number, side: OrderSide): boolean => {
  const change = priceChanges.value.get(price);
  if (!change) return false;

  return change.side === side;
};

const getSizeChangeClass = (price: number, side: OrderSide): string => {
  const change = sizeChanges.value.get(price);
  if (!change || change.side !== side) return '';

  const order = side === 'ask'
    ? state.value.asks.find((o) => o.price === price)
    : state.value.bids.find((o) => o.price === price);

  if (!order) return '';

  return order.size > change.prevSize ? 'size-increase' : 'size-decrease';
};

const updateLastPrice = (newPrice: number): void => {
  state.value.previousPrice = state.value.lastPrice;
  state.value.lastPrice = newPrice;
};

const initWebSocket = (): void => {
  ws = createWebSocketService({
    orderBookCallback: updateOrderBook,
    tradeCallback: updateLastPrice,
  });
};

const wsConnect = (): void => {
  ws.connect();
};

const wsDisconnect = (): void => {
  ws.disconnect();
};

const renderPriceArrow = (direction: 'price-up' | 'price-down' | 'price-same'): string => {
  switch (direction) {
  case 'price-up':
    return '↑';
  case 'price-down':
    return '↓';
  default:
    return '';
  }
};

onMounted(() => {
  initWebSocket();
  wsConnect();
});

onUnmounted(() => {
  wsDisconnect();
});
</script>

<style lang="scss" scoped>
$color-text: #f0f4f8;
$color-text-secondary: #8698aa;
$color-buy: #00b15d;
$color-sell: #ff5b5a;
$color-hover: #1e3059;
$color-buy-bg: rgba(16, 186, 104, 0.12);
$color-sell-bg: rgba(255, 90, 90, 0.12);
$color-neutral-bg: rgba(134, 152, 170, 0.12);
$color-flash-buy: rgba(0, 177, 93, 0.5);
$color-flash-sell: rgba(255, 91, 90, 0.5);

.order-book {
  width: 300px;
  font-size: 14px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08);
}

.title {
  margin: 0;
  padding: 8px;
  border-bottom: 1px solid rgba(134, 152, 170, 0.2);
  color: $color-text;
  font-weight: 600;
  font-size: 20px;
  text-align: left;
}

.book-header {
  display: flex;
  padding: 8px;
  color: $color-text-secondary;
  font-weight: bold;
}

.header-col {
  flex: 1;
  text-align: right;
}

.header-price {
  text-align: left;
}

.header-total {
  flex: 0 0 40%;
}

.order-row {
  position: relative;
  display: flex;
  padding: 2px 8px;
  cursor: pointer;

  &:hover {
    background-color: $color-hover !important;
  }
}

.body-col {
  padding: 6px 0;
}

.price,
.size, {
  flex: 1;
  text-align: right;
}

.price {
  color: $color-text;
  text-align: left;

  &.buy {
    color: $color-buy;
  }

  &.sell {
    color: $color-sell;
  }
}

.total {
  position: relative;
  flex: 0 0 40%;
  margin-left: 4px;
  text-align: right;
}

.total-bar {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  height: 100%;

  &.buy {
    background-color: $color-buy-bg;
  }

  &.sell {
    background-color: $color-sell-bg;
  }
}

.last-price {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 8px 0;
  padding: 8px;
  font-weight: bold;
  font-size: 16px;

  .price-arrow {
    margin-left: 4px;
    font-weight: bold;
    font-size: 16px;
    animation: bounce 0.5s ease;
  }
}

.price-up {
  color: $color-buy;
  background-color: $color-buy-bg;
}

.price-down {
  color: $color-sell;
  background-color: $color-sell-bg;
}

.price-same {
  color: $color-text;
  background-color: $color-neutral-bg;
}

@keyframes flash-green {
  0% { background-color: transparent; }
  50% { background-color: $color-flash-buy; }
  100% { background-color: transparent; }
}

@keyframes flash-red {
  0% { background-color: transparent; }
  50% { background-color: $color-flash-sell; }
  100% { background-color: transparent; }
}

.new-order.order-row {
  animation: flash-red 1s ease-out;
}

.buys .new-order.order-row {
  animation: flash-green 1s ease-out;
}

.size-increase {
  animation: flash-green 1s ease-out;
}

.size-decrease {
  animation: flash-red 1s ease-out;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
</style>
