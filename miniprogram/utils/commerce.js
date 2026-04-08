const DEFAULT_PLATFORM_MERCHANT_OPENID = 'platform-self-operated'
const DEFAULT_PLATFORM_MERCHANT_NAME = '\u5e73\u53f0\u81ea\u8425'
const DEFAULT_PRODUCT_STOCK = 100

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

function formatFenToYuan(value, options = {}) {
  const {
    fallback = '\u5f85\u5b9a',
    prefix = '\u00a5',
  } = options
  const fen = normalizeInt(value, 0)
  if (fen <= 0) {
    return fallback
  }

  const yuan = (fen / 100).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
  return `${prefix}${yuan}`
}

function formatCommerceMessage(message, fallback = '\u64cd\u4f5c\u5931\u8d25') {
  const map = {
    WECHAT_LOGIN_REQUIRED: '\u8bf7\u5148\u767b\u5f55',
    PRODUCT_NOT_FOUND: '\u5546\u54c1\u4e0d\u5b58\u5728',
    PRODUCT_OFF_SHELF: '\u5546\u54c1\u5df2\u4e0b\u67b6',
    PRODUCT_NOT_SETTLED: '\u5f53\u524d\u5546\u54c1\u6682\u4e0d\u53ef\u4e0b\u5355',
    PRODUCT_STOCK_INSUFFICIENT: '\u5e93\u5b58\u4e0d\u8db3',
    INVALID_QUANTITY: '\u5546\u54c1\u6570\u91cf\u4e0d\u6b63\u786e',
    EMPTY_ORDER_ITEMS: '\u8bf7\u5148\u9009\u62e9\u5546\u54c1',
    MERCHANT_MIX_NOT_ALLOWED: '\u6682\u4e0d\u652f\u6301\u8de8\u5546\u5bb6\u5408\u5e76\u7ed3\u7b97',
    ADDRESS_NOT_FOUND: '\u8bf7\u5148\u9009\u62e9\u6536\u8d27\u5730\u5740',
    ORDER_NOT_FOUND: '\u8ba2\u5355\u4e0d\u5b58\u5728',
    ORDER_CANNOT_CANCEL: '\u5f53\u524d\u8ba2\u5355\u4e0d\u53ef\u53d6\u6d88',
    ORDER_CANNOT_PAY: '\u5f53\u524d\u8ba2\u5355\u4e0d\u53ef\u652f\u4ed8',
    ORDER_CANNOT_SHIP: '\u5f53\u524d\u8ba2\u5355\u4e0d\u53ef\u53d1\u8d27',
    ORDER_EXPIRED: '\u8ba2\u5355\u5df2\u8d85\u65f6\u5173\u95ed',
    ORDER_CANNOT_CONFIRM_RECEIVE: '\u5f53\u524d\u8ba2\u5355\u4e0d\u53ef\u786e\u8ba4\u6536\u8d27',
    PAYMENT_INIT_FAILED: '\u652f\u4ed8\u53d1\u8d77\u5931\u8d25',
    PAYMENT_CONFIRM_FAILED: '\u652f\u4ed8\u786e\u8ba4\u5931\u8d25',
    PAYMENT_MODE_UNSUPPORTED: '\u5f53\u524d\u73af\u5883\u6682\u4e0d\u652f\u6301\u8be5\u652f\u4ed8\u65b9\u5f0f',
    CART_COLLECTION_MISSING: '\u8d2d\u7269\u8f66\u6570\u636e\u8868\u672a\u5c31\u7eea',
    ORDER_COLLECTION_MISSING: '\u5546\u54c1\u8ba2\u5355\u6570\u636e\u8868\u672a\u5c31\u7eea',
  }

  const normalized = normalizeText(message)
  return map[normalized] || normalized || fallback
}

function normalizeProductCommerce(raw = {}) {
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

  const isPurchasable =
    status === 'on_sale' &&
    price > 0 &&
    stock > 0 &&
    !!normalizeText(raw.title) &&
    !!normalizeText(raw.cover) &&
    !!merchantOpenid &&
    !!merchantName

  return {
    price,
    shippingFee,
    soldCount,
    lockedStock,
    stock,
    merchantOpenid,
    merchantName,
    status,
    isPurchasable,
  }
}

function buildProductCommercePatch(raw = {}) {
  const normalized = normalizeProductCommerce(raw)
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

function mapProductForDisplay(raw = {}) {
  const normalized = normalizeProductCommerce(raw)
  return {
    ...raw,
    ...normalized,
    priceText: formatFenToYuan(normalized.price),
    shippingFeeText: normalized.shippingFee > 0 ? formatFenToYuan(normalized.shippingFee) : '\u5305\u90ae',
    soldText: normalized.soldCount > 0 ? `\u5df2\u552e ${normalized.soldCount} \u4ef6` : '\u65b0\u54c1\u4e0a\u67b6',
    stockText: normalized.stock > 0 ? `\u5269\u4f59 ${normalized.stock} \u4ef6` : '\u5df2\u552e\u7f44',
  }
}

function callProductOrderAction(data = {}) {
  return wx.cloud.callFunction({
    name: 'productOrder',
    data,
  })
}

async function runProductOrderPayment(orderId) {
  const initRes = await callProductOrderAction({
    action: 'createPayment',
    id: orderId,
  })

  if (!initRes.result || !initRes.result.success) {
    return {
      success: false,
      message: (initRes.result && initRes.result.message) || 'PAYMENT_INIT_FAILED',
    }
  }

  const paymentMode = (initRes.result.data && initRes.result.data.paymentMode) || 'mock'
  if (paymentMode !== 'mock') {
    return {
      success: false,
      message: 'PAYMENT_MODE_UNSUPPORTED',
    }
  }

  const confirmed = await new Promise((resolve) => {
    wx.showModal({
      title: '\u6a21\u62df\u652f\u4ed8',
      content: '\u5f53\u524d\u73af\u5883\u672a\u63a5\u5165\u771f\u5b9e\u5fae\u4fe1\u652f\u4ed8\uff0c\u662f\u5426\u786e\u8ba4\u6a21\u62df\u652f\u4ed8\u6210\u529f\uff1f',
      success: (res) => resolve(!!res.confirm),
      fail: () => resolve(false),
    })
  })

  if (!confirmed) {
    return {
      success: true,
      cancelled: true,
      order: (initRes.result.data && initRes.result.data.order) || null,
    }
  }

  const confirmRes = await callProductOrderAction({
    action: 'createPayment',
    id: orderId,
    confirmMock: true,
  })

  if (!confirmRes.result || !confirmRes.result.success) {
    return {
      success: false,
      message: (confirmRes.result && confirmRes.result.message) || 'PAYMENT_CONFIRM_FAILED',
    }
  }

  return {
    success: true,
    cancelled: false,
    order: (confirmRes.result.data && confirmRes.result.data.order) || null,
  }
}

module.exports = {
  DEFAULT_PLATFORM_MERCHANT_OPENID,
  DEFAULT_PLATFORM_MERCHANT_NAME,
  DEFAULT_PRODUCT_STOCK,
  formatCommerceMessage,
  normalizeAmountToFen,
  normalizeInt,
  normalizeProductCommerce,
  buildProductCommercePatch,
  formatFenToYuan,
  mapProductForDisplay,
  runProductOrderPayment,
}
