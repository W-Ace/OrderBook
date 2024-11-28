import type { OrderBookData } from './orderbook';

export type WebSocketHandlers = {
  orderBookCallback: (data: OrderBookData) => void
  tradeCallback: (price: number) => void
  onError?: (error: unknown) => void
}

export type WebSocketConnections = {
  orderBook: WebSocket | null
  trade: WebSocket | null
}

export type WebSocketService = {
  connect: () => void
  disconnect: () => void
  resubscribe: () => void
}
