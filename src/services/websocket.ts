import { OrderBookData, TradeSchema, OrderBookDataSchema } from '@/types/orderbook';
import { WebSocketHandlers, WebSocketConnections, WebSocketService } from '@/types/websocket';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const createWebSocketConnection = (
  url: string,
  onClose: () => void,
): WebSocket => {
  const ws = new WebSocket(url);
  ws.onclose = onClose;
  return ws;
};

const subscribeToTopic = (ws: WebSocket, topic: string): void => {
  ws.send(JSON.stringify({ op: 'subscribe', args: [topic] }));
};

const handleZodError = (error: unknown, context: string): void => {
  if (error instanceof Error && 'issues' in error) {
    console.warn(`[${context}] Data validation error:`, {
      issues: (error as { issues: { path: string[]; message: string }[] }).issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
      })),
    });
  } else {
    console.error(`[${context}] Unexpected error:`, error);
  }
};

const handleOrderBookMessage = (
  event: MessageEvent,
  callback: (data: OrderBookData) => void,
  onError?: (error: unknown) => void,
): void => {
  try {
    const rawData = JSON.parse(event.data);
    if (rawData && typeof rawData === 'object') {
      const parsed = OrderBookDataSchema.parse(rawData);
      callback(parsed);
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      handleZodError(error, 'OrderBook');
    }
    onError?.(error);
  }
};

const handleTradeMessage = (
  event: MessageEvent,
  callback: (price: number) => void,
  onError?: (error: unknown) => void,
): void => {
  try {
    const data = JSON.parse(event?.data);
    const priceData = data?.data;
    if (Array.isArray(priceData) && priceData.length > 0) {
      const trade = TradeSchema.parse(priceData[0]);
      callback(trade.price);
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      handleZodError(error, 'Trade');
    }
    onError?.(error);
  }
};

export const createWebSocketService = (handlers: WebSocketHandlers): WebSocketService => {
  const connections: WebSocketConnections = {
    orderBook: null,
    trade: null,
  };

  let orderBookRetries = 0;
  let tradeRetries = 0;
  let isManualDisconnect = false;

  const handleOrderBookClose = () => {
    if (isManualDisconnect) return;

    if (orderBookRetries < MAX_RETRIES) {
      orderBookRetries += 1;
      console.warn(`OrderBook WebSocket disconnected. Retrying (${orderBookRetries}/${MAX_RETRIES})...`);
      setTimeout(() => {
        connections.orderBook = createWebSocketConnection(
          'wss://ws.btse.com/ws/oss/futures',
          handleOrderBookClose,
        );
        connections.orderBook.onopen = () => {
          subscribeToTopic(connections.orderBook!, 'update:BTCPFC');
          orderBookRetries = 0;
        };
        connections.orderBook.onmessage = (event) => {
          handleOrderBookMessage(event, handlers.orderBookCallback, handlers.onError);
        };
      }, RETRY_DELAY);
    } else {
      console.error('Max retries reached for OrderBook WebSocket');
      handlers.onError?.(new Error('Max retries reached for OrderBook WebSocket'));
    }
  };

  const handleTradeClose = () => {
    if (isManualDisconnect) return;

    if (tradeRetries < MAX_RETRIES) {
      tradeRetries += 1;
      console.warn(`Trade WebSocket disconnected. Retrying (${tradeRetries}/${MAX_RETRIES})...`);
      setTimeout(() => {
        connections.trade = createWebSocketConnection(
          'wss://ws.btse.com/ws/futures',
          handleTradeClose,
        );
        connections.trade.onopen = () => {
          subscribeToTopic(connections.trade!, 'tradeHistoryApi:BTCPFC');
          tradeRetries = 0;
        };
        connections.trade.onmessage = (event) => {
          handleTradeMessage(event, handlers.tradeCallback, handlers.onError);
        };
      }, RETRY_DELAY);
    } else {
      console.error('Max retries reached for Trade WebSocket');
      handlers.onError?.(new Error('Max retries reached for Trade WebSocket'));
    }
  };

  const connect = (): void => {
    isManualDisconnect = false;
    orderBookRetries = 0;
    tradeRetries = 0;

    connections.orderBook = createWebSocketConnection(
      'wss://ws.btse.com/ws/oss/futures',
      handleOrderBookClose,
    );
    connections.trade = createWebSocketConnection(
      'wss://ws.btse.com/ws/futures',
      handleTradeClose,
    );

    connections.orderBook.onopen = () => {
      subscribeToTopic(connections.orderBook!, 'update:BTCPFC');
    };

    connections.trade.onopen = () => {
      subscribeToTopic(connections.trade!, 'tradeHistoryApi:BTCPFC');
    };

    connections.orderBook.onmessage = (event) => {
      handleOrderBookMessage(event, handlers.orderBookCallback, handlers.onError);
    };

    connections.trade.onmessage = (event) => {
      handleTradeMessage(event, handlers.tradeCallback, handlers.onError);
    };
  };

  const disconnect = (): void => {
    isManualDisconnect = true;
    connections.orderBook?.close();
    connections.trade?.close();
    connections.orderBook = null;
    connections.trade = null;
  };

  const resubscribe = (): void => {
    console.warn('Resubscribing to order book...');
    if (connections.orderBook?.readyState === WebSocket.OPEN) {
      // 先取消订阅
      connections.orderBook.send(JSON.stringify({
        op: 'unsubscribe',
        args: ['update:BTCPFC'],
      }));
      // 然后重新订阅
      subscribeToTopic(connections.orderBook, 'update:BTCPFC');
    }
  };

  return {
    connect,
    disconnect,
    resubscribe,
  };
};
