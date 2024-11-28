import { z } from 'zod';

export const OrderSchema = z.object({
  price: z.number(),
  size: z.number(),
  total: z.number(),
  percentage: z.number(),
});

export const OrderDataSchema = z.tuple([z.string(), z.string()]);

export const OrderBookDataSchema = z.object({
  topic: z.string(),
  data: z.object({
    bids: z.array(OrderDataSchema),
    asks: z.array(OrderDataSchema),
    seqNum: z.number(),
    prevSeqNum: z.number(),
    type: z.enum(['snapshot', 'delta']),
    symbol: z.string(),
    timestamp: z.number(),
  }),
});

export const TradeSchema = z.object({
  price: z.number(),
  size: z.number(),
  timestamp: z.number(),
});

export type Order = z.infer<typeof OrderSchema>
export type OrderBookData = z.infer<typeof OrderBookDataSchema>
export type Trade = z.infer<typeof TradeSchema>

export type OrderBookState = {
  asks: Order[]
  bids: Order[]
  lastPrice: number
  previousPrice: number
  seqNum: number
}

export type OrderSide = 'ask' | 'bid'
export type PriceChangeMap = Map<number, { side: OrderSide }>
export type SizeChangeMap = Map<number, {
  prevSize: number
  side: OrderSide
}>
