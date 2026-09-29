import * as remote from "./db-firestore";
import * as local from "./db-offline";
import { isOfflineMode } from "./db-offline";

/**
 * 資料層入口：預設走 Firebase（Firestore）；當「離線模式」開啟時（連不上、
 * 需要先下單）改用這台電腦的暫存資料。函式介面完全相同，頁面不用改。
 */
export type { ItemInsert, NewOrderPayload } from "./types";
export type { OfflineExport } from "./db-offline";
export { isOfflineMode } from "./db-offline";

export const fetchVendors: typeof remote.fetchVendors = (...a) =>
  isOfflineMode() ? local.fetchVendors(...a) : remote.fetchVendors(...a);

export const fetchPrices: typeof remote.fetchPrices = (...a) =>
  isOfflineMode() ? local.fetchPrices(...a) : remote.fetchPrices(...a);

export const fetchAllPrices: typeof remote.fetchAllPrices = (...a) =>
  isOfflineMode() ? local.fetchAllPrices(...a) : remote.fetchAllPrices(...a);

export const fetchOrders: typeof remote.fetchOrders = (...a) =>
  isOfflineMode() ? local.fetchOrders(...a) : remote.fetchOrders(...a);

export const fetchOrder: typeof remote.fetchOrder = (...a) =>
  isOfflineMode() ? local.fetchOrder(...a) : remote.fetchOrder(...a);

export const fetchOrderItemsByOrder: typeof remote.fetchOrderItemsByOrder = (...a) =>
  isOfflineMode() ? local.fetchOrderItemsByOrder(...a) : remote.fetchOrderItemsByOrder(...a);

export const fetchOrderItemsByOrderIds: typeof remote.fetchOrderItemsByOrderIds = (...a) =>
  isOfflineMode()
    ? local.fetchOrderItemsByOrderIds(...a)
    : remote.fetchOrderItemsByOrderIds(...a);

export const fetchAllOrderItems: typeof remote.fetchAllOrderItems = (...a) =>
  isOfflineMode() ? local.fetchAllOrderItems(...a) : remote.fetchAllOrderItems(...a);

export const createOrder: typeof remote.createOrder = (...a) =>
  isOfflineMode() ? local.createOrder(...a) : remote.createOrder(...a);

export const updateOrder: typeof remote.updateOrder = (...a) =>
  isOfflineMode() ? local.updateOrder(...a) : remote.updateOrder(...a);

export const replaceOrderItems: typeof remote.replaceOrderItems = (...a) =>
  isOfflineMode() ? local.replaceOrderItems(...a) : remote.replaceOrderItems(...a);

export const deleteOrder: typeof remote.deleteOrder = (...a) =>
  isOfflineMode() ? local.deleteOrder(...a) : remote.deleteOrder(...a);

export const updateOrderStatus: typeof remote.updateOrderStatus = (...a) =>
  isOfflineMode() ? local.updateOrderStatus(...a) : remote.updateOrderStatus(...a);

export const nextOrderNo: typeof remote.nextOrderNo = (...a) =>
  isOfflineMode() ? local.nextOrderNo(...a) : remote.nextOrderNo(...a);

export const upsertPrices: typeof remote.upsertPrices = (...a) =>
  isOfflineMode() ? local.upsertPrices(...a) : remote.upsertPrices(...a);

export const createVendor: typeof remote.createVendor = (...a) =>
  isOfflineMode() ? local.createVendor(...a) : remote.createVendor(...a);

export const updateVendor: typeof remote.updateVendor = (...a) =>
  isOfflineMode() ? local.updateVendor(...a) : remote.updateVendor(...a);

export const deleteVendor: typeof remote.deleteVendor = (...a) =>
  isOfflineMode() ? local.deleteVendor(...a) : remote.deleteVendor(...a);

export const createPrice: typeof remote.createPrice = (...a) =>
  isOfflineMode() ? local.createPrice(...a) : remote.createPrice(...a);

export const updatePrice: typeof remote.updatePrice = (...a) =>
  isOfflineMode() ? local.updatePrice(...a) : remote.updatePrice(...a);

export const deletePrice: typeof remote.deletePrice = (...a) =>
  isOfflineMode() ? local.deletePrice(...a) : remote.deletePrice(...a);
