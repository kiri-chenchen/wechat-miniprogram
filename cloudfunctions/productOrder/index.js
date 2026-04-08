const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const DEFAULT_PLATFORM_MERCHANT_OPENID = 'platform-self-operated'
const DEFAULT_PLATFORM_MERCHANT_NAME = '\u5e73\u53f0\u81ea\u8425'
const DEFAULT_PRODUCT_STOCK = 100
const PAYMENT_EXPIRE_MS = 30 * 60 * 1000
const COLLECTION_NAMES = {
  cart: ['cartItems', 'productCartItems', 'productCart'],
  order: ['productOrders', 'productOrder'],
}
const COLLECTION_MISSING_KEYWORDS = [
  'collection not exists',
  'DATABASE_COLLECTION_NOT_EXIST',
  'Db or Table not exist',
]
const resolvedCollections = {}

const STATUS_TEXT = {
  pending_payment: '\u5f85\u652f\u4ed8',
  paid: '\u5f85\u53d1\u8d27',
  shipped: '\u5f85\u6536\u8d27',
  completed: '\u5df2\u5b8c\u6210',
  cancelled: '\u5df2\u53d6\u6d88',
  closed: '\u5df2\u5173\u95ed',
}

function normalizeText(value = '') {
  return String(value || '').trim()
}

function normalizeInt(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? Math.round(num) : fallback
}

function normalizeAmountUnit(value = '') {
  const normalized = normalizeText(value).toLowerCase()
  if (!normalized) return ''
  if (normalized === '\u5143' || normalized === 'yuan' || normalized === 'cny_yuan') {
    return 'yuan'
  }
  if (normalized === '\u5206' || normalized === 'fen' || normalized === 'cny_fen') {
    return 'fen'
  }
  return normalized
}

function shouldTreatAsYuan(value, unit = '') {
  const normalizedUnit = normalizeAmountUnit(unit)
  if (normalizedUnit === 'yuan') {
    return true
  }
  if (normalizedUnit === 'fen') {
    return false
  }
  return normalizeText(value).includes('.')
}

function normalizeAmountToFen(value, unit = '') {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) {
    return 0
  }

  if (shouldTreatAsYuan(value, unit)) {
    return Math.round(num * 100)
  }

  return Math.round(num)
}

function resolveAmountUnit(raw = {}, field) {
  return normalizeAmountUnit(
    raw[`${field}Unit`] ||
    raw.amountUnit ||
    raw.currencyUnit,
  )
}

function isCollectionMissingError(error) {
  const message = String((error && error.message) || error || '')
  return COLLECTION_MISSING_KEYWORDS.some((keyword) => message.includes(keyword))
}

async function resolveCollectionName(key) {
  if (resolvedCollections[key]) {
    return resolvedCollections[key]
  }

  const candidates = COLLECTION_NAMES[key] || []
  if (!candidates.length) {
    throw new Error(`UNKNOWN_COLLECTION_KEY:${key}`)
  }

  for (const name of candidates) {
    try {
      await db.collection(name).limit(1).get()
      resolvedCollections[key] = name
      return name
    } catch (error) {
      if (!isCollectionMissingError(error)) {
        throw error
      }
    }
  }

  resolvedCollections[key] = candidates[0]
  return resolvedCollections[key]
}

function getOwnerOpenid(record = {}) {
  return normalizeText(record.ownerOpenid || record.openid || record._openid)
}

function normalizeProduct(raw = {}) {
  const price = normalizeAmountToFen(raw.price, resolveAmountUnit(raw, 'price'))
  const shippingFee = normalizeAmountToFen(raw.shippingFee, resolveAmountUnit(raw, 'shippingFee'))
  const soldCount = Math.max(0, normalizeInt(raw.soldCount, normalizeInt(raw.sold, 0)))
  const lockedStock = Math.max(0, normalizeInt(raw.lockedStock, 0))
  const rawStock = normalizeInt(raw.stock, NaN)
  const stock = Number.isFinite(rawStock)
    ? Math.max(0, rawStock)
    : (price > 0 ? DEFAULT_PRODUCT_STOCK : 0)
  const merchantOpenid = normalizeText(raw.merchantOpenid) || DEFAULT_PLATFORM_MERCHANT_OPENID
  const merchantName = normalizeText(raw.merchantName) || DEFAULT_PLATFORM_MERCHANT_NAME

  let status = normalizeText(raw.status)
  if (!status) {
    status = price > 0 && stock > 0 ? 'on_sale' : 'draft'
  }

  return {
    ...raw,
    price,
    priceUnit: 'fen',
    shippingFee,
    shippingFeeUnit: 'fen',
    soldCount,
    lockedStock,
    stock,
    merchantOpenid,
    merchantName,
    status,
    isPurchasable:
      status === 'on_sale' &&
      price > 0 &&
      stock > 0 &&
      !!normalizeText(raw.title) &&
      !!normalizeText(raw.cover),
  }
}

function buildProductPatch(raw = {}) {
  const normalized = normalizeProduct(raw)
  const patch = {}

  if (normalized.price !== Number(raw.price)) {
    patch.price = normalized.price
  }
  if (normalizeAmountUnit(raw.priceUnit) !== 'fen') {
    patch.priceUnit = 'fen'
  }
  if (normalized.shippingFee !== Number(raw.shippingFee || 0)) {
    patch.shippingFee = normalized.shippingFee
  }
  if (normalizeAmountUnit(raw.shippingFeeUnit) !== 'fen') {
    patch.shippingFeeUnit = 'fen'
  }
  if (normalizeText(raw.merchantOpenid) !== normalized.merchantOpenid) {
    patch.merchantOpenid = normalized.merchantOpenid
  }
  if (normalizeText(raw.merchantName) !== normalized.merchantName) {
    patch.merchantName = normalized.merchantName
  }
  if (normalizeInt(raw.stock, NaN) !== normalized.stock) {
    patch.stock = normalized.stock
  }
  if (normalizeInt(raw.lockedStock, 0) !== normalized.lockedStock) {
    patch.lockedStock = normalized.lockedStock
  }
  if (normalizeInt(raw.soldCount, normalizeInt(raw.sold, 0)) !== normalized.soldCount) {
    patch.soldCount = normalized.soldCount
  }
  if (normalizeText(raw.status) !== normalized.status) {
    patch.status = normalized.status
  }

  return patch
}

async function ensureUser(openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get()
  const user = res.data[0] || null
  if (!user) {
    throw Object.assign(new Error('WECHAT_LOGIN_REQUIRED'), { code: 'WECHAT_LOGIN_REQUIRED' })
  }

  if (!normalizeText(user.role)) {
    await db.collection('users').doc(user._id).update({
      data: {
        role: 'user',
        updatedAt: db.serverDate(),
      },
    })
    user.role = 'user'
  }

  return user
}

async function getAddressByOwner(addressId, openid) {
  const id = normalizeText(addressId)
  if (!id) return null
  const res = await db.collection('addresses').doc(id).get()
  const address = res.data || null
  if (!address || getOwnerOpenid(address) !== openid) {
    throw Object.assign(new Error('ADDRESS_NOT_FOUND'), { code: 'ADDRESS_NOT_FOUND' })
  }
  return address
}

async function getPreferredAddress(openid, addressId = '') {
  if (addressId) {
    return getAddressByOwner(addressId, openid)
  }

  const list = await db.collection('addresses')
    .where({ ownerOpenid: openid })
    .orderBy('isDefault', 'desc')
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get()

  return (list.data || [])[0] || null
}

function buildAddressSnapshot(address = null) {
  if (!address) return null
  return {
    _id: address._id,
    receiverName: normalizeText(address.receiverName),
    receiverPhone: normalizeText(address.receiverPhone),
    province: normalizeText(address.province),
    city: normalizeText(address.city),
    district: normalizeText(address.district),
    detailAddress: normalizeText(address.detailAddress),
    postalCode: normalizeText(address.postalCode),
  }
}

async function getCartItemsForOrder(openid, cartItemIds = []) {
  const cartCollectionName = await resolveCollectionName('cart')

  try {
    if (cartItemIds.length) {
      const res = await db.collection(cartCollectionName)
        .where({
          _id: _.in(cartItemIds),
          ownerOpenid: openid,
        })
        .get()
      return res.data || []
    }

    const res = await db.collection(cartCollectionName)
      .where({
        ownerOpenid: openid,
        selected: true,
      })
      .get()
    return res.data || []
  } catch (error) {
    if (isCollectionMissingError(error)) {
      return []
    }
    throw error
  }
}

function buildPendingOrderNo() {
  return `PO${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function buildMockTradeNo(orderNo) {
  return `MOCK_${orderNo}_${Date.now()}`
}

function buildMockTrackingNo(orderNo) {
  return `MOCKSHIP_${orderNo}_${Date.now()}`
}

function buildOrderActions(statusKey) {
  return {
    canPay: statusKey === 'pending_payment',
    canCancel: statusKey === 'pending_payment',
    canShip: statusKey === 'paid',
    canConfirmReceive: statusKey === 'shipped',
  }
}

function presentOrder(order = {}) {
  const statusKey = normalizeText(order.status)
  return {
    ...order,
    displayStatusKey: statusKey,
    displayStatusText: STATUS_TEXT[statusKey] || '\u672a\u77e5\u72b6\u6001',
    actions: buildOrderActions(statusKey),
  }
}

async function closeExpiredOrderById(orderId, options = {}) {
  const { silentMissing = false } = options
  const orderCollectionName = await resolveCollectionName('order')
  const id = normalizeText(orderId)
  if (!id) return null

  let order = null
  try {
    const res = await db.collection(orderCollectionName).doc(id).get()
    order = res.data || null
  } catch (error) {
    if (isCollectionMissingError(error) && silentMissing) {
      return null
    }
    if (isCollectionMissingError(error)) {
      throw Object.assign(new Error('ORDER_COLLECTION_MISSING'), { code: 'ORDER_COLLECTION_MISSING' })
    }
    throw error
  }

  if (!order) return null
  if (normalizeText(order.status) !== 'pending_payment') {
    return order
  }

  const paymentDeadline = normalizeInt(order.paymentDeadline, 0)
  if (!paymentDeadline || Date.now() <= paymentDeadline) {
    return order
  }

  await db.runTransaction(async (transaction) => {
    const live = await transaction.collection(orderCollectionName).doc(id).get()
    const current = live.data || null
    if (!current || normalizeText(current.status) !== 'pending_payment') {
      return
    }
    if (Date.now() <= normalizeInt(current.paymentDeadline, 0)) {
      return
    }

    const items = Array.isArray(current.items) ? current.items : []
    for (const item of items) {
      const productId = normalizeText(item.productId)
      const quantity = Math.max(0, normalizeInt(item.quantity, 0))
      if (!productId || quantity <= 0) continue

      const productRes = await transaction.collection('products').doc(productId).get()
      const product = normalizeProduct(productRes.data || {})
      await transaction.collection('products').doc(productId).update({
        data: {
          stock: product.stock + quantity,
          lockedStock: Math.max(0, product.lockedStock - quantity),
          updatedAt: db.serverDate(),
        },
      })
    }

    await transaction.collection(orderCollectionName).doc(id).update({
      data: {
        status: 'closed',
        closedAt: db.serverDate(),
        cancelReason: 'PAYMENT_TIMEOUT',
        updatedAt: db.serverDate(),
      },
    })
  })

  const fresh = await db.collection(orderCollectionName).doc(id).get()
  return fresh.data
}

async function closeExpiredOrdersForUser(openid, specificId = '') {
  const orderCollectionName = await resolveCollectionName('order')
  const ids = []

  if (specificId) {
    const order = await closeExpiredOrderById(specificId, { silentMissing: true })
    if (order && normalizeText(order.status) === 'closed') {
      ids.push(order._id)
    }
    return { closedCount: ids.length, ids }
  }

  let rows = []
  try {
    const res = await db.collection(orderCollectionName)
      .where({
        ownerOpenid: openid,
        status: 'pending_payment',
      })
      .get()
    rows = res.data || []
  } catch (error) {
    if (!isCollectionMissingError(error)) {
      throw error
    }
  }

  for (const item of rows) {
    const order = await closeExpiredOrderById(item._id, { silentMissing: true })
    if (order && normalizeText(order.status) === 'closed') {
      ids.push(order._id)
    }
  }

  return { closedCount: ids.length, ids }
}

async function getOwnedOrder(id, openid) {
  const orderId = normalizeText(id)
  if (!orderId) {
    throw Object.assign(new Error('ORDER_NOT_FOUND'), { code: 'ORDER_NOT_FOUND' })
  }

  const order = await closeExpiredOrderById(orderId)
  if (!order || getOwnerOpenid(order) !== openid) {
    throw Object.assign(new Error('ORDER_NOT_FOUND'), { code: 'ORDER_NOT_FOUND' })
  }
  return order
}

function assertSameMerchant(items = []) {
  const merchants = Array.from(new Set(items.map((item) => normalizeText(item.merchantOpenid)).filter(Boolean)))
  if (merchants.length > 1) {
    throw Object.assign(new Error('MERCHANT_MIX_NOT_ALLOWED'), { code: 'MERCHANT_MIX_NOT_ALLOWED' })
  }
}

async function loadPreviewItems(event, openid) {
  const source = normalizeText(event.source)
  if (source !== 'buy_now' && source !== 'cart') {
    throw Object.assign(new Error('ORDER_SOURCE_INVALID'), { code: 'ORDER_SOURCE_INVALID' })
  }

  if (source === 'buy_now') {
    const items = Array.isArray(event.items) ? event.items : []
    const normalized = items
      .map((item) => ({
        productId: normalizeText(item.productId),
        quantity: normalizeInt(item.quantity, 0),
      }))
      .filter((item) => item.productId && item.quantity > 0)

    if (!normalized.length) {
      throw Object.assign(new Error('EMPTY_ORDER_ITEMS'), { code: 'EMPTY_ORDER_ITEMS' })
    }

    return normalized.map((item) => ({
      cartItemId: '',
      ...item,
    }))
  }

  const cartItemIds = Array.isArray(event.cartItemIds)
    ? event.cartItemIds.map((item) => normalizeText(item)).filter(Boolean)
    : []
  const cartItems = await getCartItemsForOrder(openid, cartItemIds)
  const normalized = cartItems
    .map((item) => ({
      cartItemId: item._id,
      productId: normalizeText(item.productId),
      quantity: normalizeInt(item.quantity, 0),
      merchantOpenid: normalizeText(item.merchantOpenid),
    }))
    .filter((item) => item.productId && item.quantity > 0)

  if (!normalized.length) {
    throw Object.assign(new Error('EMPTY_ORDER_ITEMS'), { code: 'EMPTY_ORDER_ITEMS' })
  }

  assertSameMerchant(normalized)
  return normalized
}

async function preview(event, openid) {
  await ensureUser(openid)
  const sourceItems = await loadPreviewItems(event, openid)
  const address = await getPreferredAddress(openid, event.addressId || '')

  const detailItems = []
  let merchantOpenid = ''
  let merchantName = ''
  let goodsAmount = 0
  let shippingFee = 0

  for (const item of sourceItems) {
    const productRes = await db.collection('products').doc(item.productId).get()
    const patch = buildProductPatch(productRes.data || {})
    if (Object.keys(patch).length) {
      await db.collection('products').doc(item.productId).update({
        data: {
          ...patch,
          updatedAt: db.serverDate(),
        },
      })
    }

    const product = normalizeProduct({
      ...(productRes.data || {}),
      ...patch,
    })

    if (!product.isPurchasable) {
      throw Object.assign(new Error(product.status === 'on_sale' ? 'PRODUCT_NOT_SETTLED' : 'PRODUCT_OFF_SHELF'), {
        code: product.status === 'on_sale' ? 'PRODUCT_NOT_SETTLED' : 'PRODUCT_OFF_SHELF',
      })
    }
    if (product.stock < item.quantity) {
      throw Object.assign(new Error('PRODUCT_STOCK_INSUFFICIENT'), { code: 'PRODUCT_STOCK_INSUFFICIENT' })
    }

    if (!merchantOpenid) {
      merchantOpenid = product.merchantOpenid
      merchantName = product.merchantName
      shippingFee = product.shippingFee
    }
    if (merchantOpenid !== product.merchantOpenid) {
      throw Object.assign(new Error('MERCHANT_MIX_NOT_ALLOWED'), { code: 'MERCHANT_MIX_NOT_ALLOWED' })
    }

    const subtotal = product.price * item.quantity
    goodsAmount += subtotal
    detailItems.push({
      cartItemId: item.cartItemId,
      productId: product._id,
      title: normalizeText(product.title),
      cover: normalizeText(product.cover),
      unitPrice: product.price,
      priceUnit: 'fen',
      quantity: item.quantity,
      subtotal,
      stock: product.stock,
    })
  }

  return {
    success: true,
    data: {
      merchant: {
        merchantOpenid,
        merchantName,
      },
      source: normalizeText(event.source),
      items: detailItems,
      address: buildAddressSnapshot(address),
      goodsAmount,
      shippingFee,
      payAmount: goodsAmount + shippingFee,
    },
  }
}

async function create(event, openid) {
  await ensureUser(openid)
  const source = normalizeText(event.source)
  const sourceItems = await loadPreviewItems(event, openid)
  const address = await getAddressByOwner(event.addressId, openid)
  if (!address) {
    throw Object.assign(new Error('ADDRESS_NOT_FOUND'), { code: 'ADDRESS_NOT_FOUND' })
  }

  const cartCollectionName = await resolveCollectionName('cart')
  const orderCollectionName = await resolveCollectionName('order')
  const addressSnapshot = buildAddressSnapshot(address)
  const remark = normalizeText(event.remark)
  const orderNo = buildPendingOrderNo()
  const paymentDeadline = Date.now() + PAYMENT_EXPIRE_MS

  const result = await db.runTransaction(async (transaction) => {
    const detailItems = []
    let merchantOpenid = ''
    let merchantName = ''
    let goodsAmount = 0
    let shippingFee = 0

    for (const sourceItem of sourceItems) {
      const productRes = await transaction.collection('products').doc(sourceItem.productId).get()
      const rawProduct = productRes.data || null
      if (!rawProduct) {
        throw Object.assign(new Error('PRODUCT_NOT_FOUND'), { code: 'PRODUCT_NOT_FOUND' })
      }

      const patch = buildProductPatch(rawProduct)
      const product = normalizeProduct({
        ...rawProduct,
        ...patch,
      })

      if (Object.keys(patch).length) {
        await transaction.collection('products').doc(sourceItem.productId).update({
          data: {
            ...patch,
            updatedAt: db.serverDate(),
          },
        })
      }

      if (!product.isPurchasable) {
        throw Object.assign(new Error(product.status === 'on_sale' ? 'PRODUCT_NOT_SETTLED' : 'PRODUCT_OFF_SHELF'), {
          code: product.status === 'on_sale' ? 'PRODUCT_NOT_SETTLED' : 'PRODUCT_OFF_SHELF',
        })
      }
      if (product.stock < sourceItem.quantity) {
        throw Object.assign(new Error('PRODUCT_STOCK_INSUFFICIENT'), { code: 'PRODUCT_STOCK_INSUFFICIENT' })
      }

      if (!merchantOpenid) {
        merchantOpenid = product.merchantOpenid
        merchantName = product.merchantName
        shippingFee = product.shippingFee
      }
      if (merchantOpenid !== product.merchantOpenid) {
        throw Object.assign(new Error('MERCHANT_MIX_NOT_ALLOWED'), { code: 'MERCHANT_MIX_NOT_ALLOWED' })
      }

      const subtotal = product.price * sourceItem.quantity
      goodsAmount += subtotal
      detailItems.push({
        sourceCartItemId: sourceItem.cartItemId || '',
        productId: product._id,
        title: normalizeText(product.title),
        cover: normalizeText(product.cover),
        unitPrice: product.price,
        priceUnit: 'fen',
        quantity: sourceItem.quantity,
        subtotal,
      })

      await transaction.collection('products').doc(product._id).update({
        data: {
          stock: product.stock - sourceItem.quantity,
          lockedStock: product.lockedStock + sourceItem.quantity,
          updatedAt: db.serverDate(),
        },
      })

      if (source === 'cart' && sourceItem.cartItemId) {
        await transaction.collection(cartCollectionName).doc(sourceItem.cartItemId).remove()
      }
    }

    const payAmount = goodsAmount + shippingFee
    const addRes = await transaction.collection(orderCollectionName).add({
      data: {
        orderNo,
        ownerOpenid: openid,
        openid,
        _openid: openid,
        merchantOpenid,
        merchantName,
        source,
        status: 'pending_payment',
        paymentDeadline,
        addressSnapshot,
        items: detailItems,
        goodsAmount,
        shippingFee,
        payAmount,
        remark,
        paymentMode: 'mock',
        outTradeNo: '',
        paidAt: null,
        shippedAt: null,
        receivedAt: null,
        cancelledAt: null,
        closedAt: null,
        cancelReason: '',
        delivery: {
          company: '',
          trackingNo: '',
        },
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    })

    return addRes._id
  })

  const fresh = await db.collection(orderCollectionName).doc(result).get()
  return {
    success: true,
    data: {
      order: presentOrder(fresh.data),
    },
  }
}

async function detail(event, openid) {
  await ensureUser(openid)
  const order = await getOwnedOrder(event.id, openid)
  return {
    success: true,
    data: {
      order: presentOrder(order),
    },
  }
}

async function listMine(event, openid) {
  await ensureUser(openid)
  const orderCollectionName = await resolveCollectionName('order')
  await closeExpiredOrdersForUser(openid)

  const page = Math.max(1, normalizeInt(event.page, 1))
  const pageSize = Math.min(100, Math.max(1, normalizeInt(event.pageSize, 20)))
  const status = normalizeText(event.status)
  const where = {
    ownerOpenid: openid,
  }
  if (status) {
    where.status = status
  }

  try {
    const countRes = await db.collection(orderCollectionName).where(where).count()
    const res = await db.collection(orderCollectionName)
      .where(where)
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    return {
      success: true,
      data: {
        list: (res.data || []).map(presentOrder),
        total: countRes.total || 0,
      },
    }
  } catch (error) {
    if (isCollectionMissingError(error)) {
      return {
        success: true,
        data: {
          list: [],
          total: 0,
        },
      }
    }
    throw error
  }
}

async function cancel(event, openid) {
  await ensureUser(openid)
  const orderCollectionName = await resolveCollectionName('order')
  const order = await getOwnedOrder(event.id, openid)
  if (normalizeText(order.status) !== 'pending_payment') {
    throw Object.assign(new Error('ORDER_CANNOT_CANCEL'), { code: 'ORDER_CANNOT_CANCEL' })
  }

  await db.runTransaction(async (transaction) => {
    const live = await transaction.collection(orderCollectionName).doc(order._id).get()
    const current = live.data || null
    if (!current || getOwnerOpenid(current) !== openid) {
      throw Object.assign(new Error('ORDER_NOT_FOUND'), { code: 'ORDER_NOT_FOUND' })
    }
    if (normalizeText(current.status) !== 'pending_payment') {
      throw Object.assign(new Error('ORDER_CANNOT_CANCEL'), { code: 'ORDER_CANNOT_CANCEL' })
    }

    for (const item of (current.items || [])) {
      const productRes = await transaction.collection('products').doc(item.productId).get()
      const product = normalizeProduct(productRes.data || {})
      const quantity = Math.max(0, normalizeInt(item.quantity, 0))
      await transaction.collection('products').doc(item.productId).update({
        data: {
          stock: product.stock + quantity,
          lockedStock: Math.max(0, product.lockedStock - quantity),
          updatedAt: db.serverDate(),
        },
      })
    }

    await transaction.collection(orderCollectionName).doc(order._id).update({
      data: {
        status: 'cancelled',
        cancelledAt: db.serverDate(),
        cancelReason: 'USER_CANCELLED',
        updatedAt: db.serverDate(),
      },
    })
  })

  const fresh = await db.collection(orderCollectionName).doc(order._id).get()
  return {
    success: true,
    data: {
      order: presentOrder(fresh.data),
    },
  }
}

async function closeExpired(event, openid) {
  await ensureUser(openid)
  const result = await closeExpiredOrdersForUser(openid, event.id || '')
  return {
    success: true,
    data: result,
  }
}

async function createPayment(event, openid) {
  await ensureUser(openid)
  const orderCollectionName = await resolveCollectionName('order')
  const order = await getOwnedOrder(event.id, openid)
  if (normalizeText(order.status) !== 'pending_payment') {
    throw Object.assign(new Error('ORDER_CANNOT_PAY'), { code: 'ORDER_CANNOT_PAY' })
  }

  if (!event.confirmMock) {
    return {
      success: true,
      data: {
        paymentMode: 'mock',
        paymentParams: {
          orderId: order._id,
          orderNo: order.orderNo,
          payAmount: order.payAmount,
        },
        order: presentOrder(order),
      },
    }
  }

  await db.runTransaction(async (transaction) => {
    const live = await transaction.collection(orderCollectionName).doc(order._id).get()
    const current = live.data || null
    if (!current || getOwnerOpenid(current) !== openid) {
      throw Object.assign(new Error('ORDER_NOT_FOUND'), { code: 'ORDER_NOT_FOUND' })
    }
    if (normalizeText(current.status) !== 'pending_payment') {
      throw Object.assign(new Error('ORDER_CANNOT_PAY'), { code: 'ORDER_CANNOT_PAY' })
    }
    if (Date.now() > normalizeInt(current.paymentDeadline, 0)) {
      throw Object.assign(new Error('ORDER_EXPIRED'), { code: 'ORDER_EXPIRED' })
    }

    for (const item of (current.items || [])) {
      const productRes = await transaction.collection('products').doc(item.productId).get()
      const product = normalizeProduct(productRes.data || {})
      const quantity = Math.max(0, normalizeInt(item.quantity, 0))
      await transaction.collection('products').doc(item.productId).update({
        data: {
          lockedStock: Math.max(0, product.lockedStock - quantity),
          soldCount: product.soldCount + quantity,
          updatedAt: db.serverDate(),
        },
      })
    }

    await transaction.collection(orderCollectionName).doc(order._id).update({
      data: {
        status: 'paid',
        paymentMode: 'mock',
        outTradeNo: buildMockTradeNo(current.orderNo),
        paidAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    })
  })

  const fresh = await db.collection(orderCollectionName).doc(order._id).get()
  return {
    success: true,
    data: {
      paymentMode: 'mock',
      paymentParams: {
        orderId: fresh.data._id,
        orderNo: fresh.data.orderNo,
        payAmount: fresh.data.payAmount,
      },
      order: presentOrder(fresh.data),
    },
  }
}

async function ship(event, openid) {
  await ensureUser(openid)
  const orderCollectionName = await resolveCollectionName('order')
  const order = await getOwnedOrder(event.id, openid)
  if (normalizeText(order.status) !== 'paid') {
    throw Object.assign(new Error('ORDER_CANNOT_SHIP'), { code: 'ORDER_CANNOT_SHIP' })
  }

  const deliveryCompany = normalizeText(event.deliveryCompany) || '\u6a21\u62df\u7269\u6d41'
  const trackingNo = normalizeText(event.trackingNo) || buildMockTrackingNo(order.orderNo)

  await db.collection(orderCollectionName).doc(order._id).update({
    data: {
      status: 'shipped',
      shippedAt: db.serverDate(),
      delivery: {
        company: deliveryCompany,
        trackingNo,
      },
      updatedAt: db.serverDate(),
    },
  })

  const fresh = await db.collection(orderCollectionName).doc(order._id).get()
  return {
    success: true,
    data: {
      order: presentOrder(fresh.data),
    },
  }
}

async function confirmReceive(event, openid) {
  await ensureUser(openid)
  const orderCollectionName = await resolveCollectionName('order')
  const order = await getOwnedOrder(event.id, openid)
  if (normalizeText(order.status) !== 'shipped') {
    throw Object.assign(new Error('ORDER_CANNOT_CONFIRM_RECEIVE'), { code: 'ORDER_CANNOT_CONFIRM_RECEIVE' })
  }

  await db.collection(orderCollectionName).doc(order._id).update({
    data: {
      status: 'completed',
      receivedAt: db.serverDate(),
      updatedAt: db.serverDate(),
    },
  })

  const fresh = await db.collection(orderCollectionName).doc(order._id).get()
  return {
    success: true,
    data: {
      order: presentOrder(fresh.data),
    },
  }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const action = normalizeText(event.action)

  try {
    if (action === 'preview') return await preview(event, OPENID)
    if (action === 'create') return await create(event, OPENID)
    if (action === 'detail') return await detail(event, OPENID)
    if (action === 'listMine') return await listMine(event, OPENID)
    if (action === 'cancel') return await cancel(event, OPENID)
    if (action === 'closeExpired') return await closeExpired(event, OPENID)
    if (action === 'createPayment') return await createPayment(event, OPENID)
    if (action === 'ship') return await ship(event, OPENID)
    if (action === 'confirmReceive') return await confirmReceive(event, OPENID)

    return {
      success: false,
      message: 'UNSUPPORTED_ACTION',
    }
  } catch (error) {
    console.error('[productOrder] failed', action, error)
    return {
      success: false,
      message: isCollectionMissingError(error)
        ? 'ORDER_COLLECTION_MISSING'
        : (error.code || error.message || 'PRODUCT_ORDER_FAILED'),
    }
  }
}
