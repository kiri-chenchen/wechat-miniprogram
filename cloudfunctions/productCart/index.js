const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const DEFAULT_PLATFORM_MERCHANT_OPENID = 'platform-self-operated'
const DEFAULT_PLATFORM_MERCHANT_NAME = '\u5e73\u53f0\u81ea\u8425'
const DEFAULT_PRODUCT_STOCK = 100
const COLLECTION_NAMES = {
  cart: ['cartItems', 'productCartItems', 'productCart'],
}
const COLLECTION_MISSING_KEYWORDS = [
  'collection not exists',
  'DATABASE_COLLECTION_NOT_EXIST',
  'Db or Table not exist',
]
const resolvedCollections = {}

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
    const error = new Error('WECHAT_LOGIN_REQUIRED')
    error.code = 'WECHAT_LOGIN_REQUIRED'
    throw error
  }

  if (!normalizeText(user.role)) {
    await db.collection('users').doc(user._id).update({
      data: {
        role: 'user',
        updatedAt: db.serverDate(),
      },
    })
  }

  return user
}

async function getProductDoc(productId) {
  const res = await db.collection('products').doc(productId).get()
  const raw = res.data || null
  if (!raw) {
    const error = new Error('PRODUCT_NOT_FOUND')
    error.code = 'PRODUCT_NOT_FOUND'
    throw error
  }

  const patch = buildProductPatch(raw)
  if (Object.keys(patch).length) {
    await db.collection('products').doc(productId).update({
      data: {
        ...patch,
        updatedAt: db.serverDate(),
      },
    })
  }

  return normalizeProduct({
    ...raw,
    ...patch,
  })
}

function presentCartItem(item = {}) {
  const snapshot = item.productSnapshot || {}
  const isPurchasable =
    normalizeText(snapshot.status) === 'on_sale' &&
    normalizeInt(snapshot.stock, 0) > 0 &&
    normalizeInt(snapshot.price, 0) > 0

  return {
    ...item,
    selected: !!item.selected,
    isPurchasable,
    productSnapshot: {
      ...snapshot,
      price: normalizeInt(snapshot.price, 0),
      stock: normalizeInt(snapshot.stock, 0),
      status: normalizeText(snapshot.status),
    },
  }
}

function buildCartProductSnapshot(product = {}) {
  return {
    title: normalizeText(product.title),
    cover: normalizeText(product.cover),
    price: product.price,
    priceUnit: 'fen',
    stock: product.stock,
    status: product.status,
  }
}

async function listCart(openid) {
  await ensureUser(openid)
  const cartCollectionName = await resolveCollectionName('cart')

  let rows = []
  try {
    const res = await db.collection(cartCollectionName)
      .where({ ownerOpenid: openid })
      .orderBy('updatedAt', 'desc')
      .get()
    rows = res.data || []
  } catch (error) {
    if (!isCollectionMissingError(error)) {
      throw error
    }
  }

  const items = []
  for (const rawItem of rows) {
    let item = rawItem
    const productId = normalizeText(rawItem.productId)
    if (productId) {
      try {
        const product = await getProductDoc(productId)
        const productSnapshot = buildCartProductSnapshot(product)
        const needsRefresh =
          normalizeText(rawItem.merchantOpenid) !== product.merchantOpenid ||
          normalizeText(rawItem.merchantName) !== product.merchantName ||
          normalizeText((rawItem.productSnapshot || {}).title) !== productSnapshot.title ||
          normalizeText((rawItem.productSnapshot || {}).cover) !== productSnapshot.cover ||
          normalizeInt((rawItem.productSnapshot || {}).price, 0) !== productSnapshot.price ||
          normalizeInt((rawItem.productSnapshot || {}).stock, 0) !== productSnapshot.stock ||
          normalizeText((rawItem.productSnapshot || {}).status) !== productSnapshot.status ||
          getOwnerOpenid(rawItem) !== openid

        item = {
          ...rawItem,
          ownerOpenid: openid,
          openid,
          _openid: openid,
          merchantOpenid: product.merchantOpenid,
          merchantName: product.merchantName,
          productSnapshot,
        }

        if (needsRefresh) {
          await db.collection(cartCollectionName).doc(rawItem._id).update({
            data: {
              ownerOpenid: openid,
              openid,
              _openid: openid,
              merchantOpenid: product.merchantOpenid,
              merchantName: product.merchantName,
              productSnapshot,
              updatedAt: db.serverDate(),
            },
          })
        }
      } catch (error) {
        if (error && error.code === 'PRODUCT_NOT_FOUND') {
          item = rawItem
        } else {
          throw error
        }
      }
    }

    items.push(presentCartItem(item))
  }
  const groupsMap = new Map()
  let totalCount = 0
  let checkedCount = 0

  items.forEach((item) => {
    totalCount += 1
    if (item.selected && item.isPurchasable) {
      checkedCount += 1
    }

    const key = item.merchantOpenid || DEFAULT_PLATFORM_MERCHANT_OPENID
    if (!groupsMap.has(key)) {
      groupsMap.set(key, {
        merchantOpenid: key,
        merchantName: item.merchantName || DEFAULT_PLATFORM_MERCHANT_NAME,
        items: [],
      })
    }
    groupsMap.get(key).items.push(item)
  })

  return {
    success: true,
    data: {
      groups: Array.from(groupsMap.values()),
      totalCount,
      checkedCount,
    },
  }
}

async function addCartItem(event, openid) {
  await ensureUser(openid)
  const cartCollectionName = await resolveCollectionName('cart')
  const productId = normalizeText(event.productId)
  const quantity = normalizeInt(event.quantity, 0)
  const selected = typeof event.selected === 'boolean' ? event.selected : true

  if (!productId) {
    throw Object.assign(new Error('PRODUCT_NOT_FOUND'), { code: 'PRODUCT_NOT_FOUND' })
  }
  if (quantity <= 0) {
    throw Object.assign(new Error('INVALID_QUANTITY'), { code: 'INVALID_QUANTITY' })
  }

  const product = await getProductDoc(productId)
  if (!product.isPurchasable) {
    throw Object.assign(new Error(product.status === 'on_sale' ? 'PRODUCT_NOT_SETTLED' : 'PRODUCT_OFF_SHELF'), {
      code: product.status === 'on_sale' ? 'PRODUCT_NOT_SETTLED' : 'PRODUCT_OFF_SHELF',
    })
  }
  if (product.stock < quantity) {
    throw Object.assign(new Error('PRODUCT_STOCK_INSUFFICIENT'), { code: 'PRODUCT_STOCK_INSUFFICIENT' })
  }

  let existingList = []
  try {
    const existing = await db.collection(cartCollectionName)
      .where({
        ownerOpenid: openid,
        productId,
      })
      .limit(1)
      .get()
    existingList = existing.data || []
  } catch (error) {
    if (!isCollectionMissingError(error)) {
      throw error
    }
  }

  const productSnapshot = {
    title: normalizeText(product.title),
    cover: normalizeText(product.cover),
    price: product.price,
    priceUnit: 'fen',
    stock: product.stock,
    status: product.status,
  }

  if (existingList.length) {
    const item = existingList[0]
    const nextQuantity = normalizeInt(item.quantity, 0) + quantity
    if (product.stock < nextQuantity) {
      throw Object.assign(new Error('PRODUCT_STOCK_INSUFFICIENT'), { code: 'PRODUCT_STOCK_INSUFFICIENT' })
    }

    await db.collection(cartCollectionName).doc(item._id).update({
      data: {
        ownerOpenid: openid,
        openid,
        _openid: openid,
        quantity: nextQuantity,
        selected,
        merchantOpenid: product.merchantOpenid,
        merchantName: product.merchantName,
        productSnapshot,
        updatedAt: db.serverDate(),
      },
    })

    const fresh = await db.collection(cartCollectionName).doc(item._id).get()
    return {
      success: true,
      data: {
        cartItem: presentCartItem(fresh.data),
        cartCount: 1,
      },
    }
  }

  const addRes = await db.collection(cartCollectionName).add({
    data: {
      ownerOpenid: openid,
      openid,
      _openid: openid,
      merchantOpenid: product.merchantOpenid,
      merchantName: product.merchantName,
      productId,
      quantity,
      selected,
      productSnapshot,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    },
  })

  const fresh = await db.collection(cartCollectionName).doc(addRes._id).get()
  return {
    success: true,
    data: {
      cartItem: presentCartItem(fresh.data),
      cartCount: 1,
    },
  }
}

async function getOwnedCartItem(id, openid) {
  const cartCollectionName = await resolveCollectionName('cart')
  const itemId = normalizeText(id)
  if (!itemId) {
    throw Object.assign(new Error('CART_ITEM_NOT_FOUND'), { code: 'CART_ITEM_NOT_FOUND' })
  }

  let item = null
  try {
    const res = await db.collection(cartCollectionName).doc(itemId).get()
    item = res.data || null
  } catch (error) {
    if (isCollectionMissingError(error)) {
      throw Object.assign(new Error('CART_COLLECTION_MISSING'), { code: 'CART_COLLECTION_MISSING' })
    }
    throw error
  }

  if (!item || getOwnerOpenid(item) !== openid) {
    throw Object.assign(new Error('CART_ITEM_NOT_FOUND'), { code: 'CART_ITEM_NOT_FOUND' })
  }

  return item
}

async function updateQty(event, openid) {
  await ensureUser(openid)
  const cartCollectionName = await resolveCollectionName('cart')
  const item = await getOwnedCartItem(event.cartItemId, openid)
  const quantity = normalizeInt(event.quantity, 0)
  if (quantity <= 0) {
    throw Object.assign(new Error('INVALID_QUANTITY'), { code: 'INVALID_QUANTITY' })
  }

  const product = await getProductDoc(item.productId)
  if (product.stock < quantity) {
    throw Object.assign(new Error('PRODUCT_STOCK_INSUFFICIENT'), { code: 'PRODUCT_STOCK_INSUFFICIENT' })
  }

  await db.collection(cartCollectionName).doc(item._id).update({
    data: {
      quantity,
      merchantOpenid: product.merchantOpenid,
      merchantName: product.merchantName,
      productSnapshot: {
        title: normalizeText(product.title),
        cover: normalizeText(product.cover),
        price: product.price,
        priceUnit: 'fen',
        stock: product.stock,
        status: product.status,
      },
      updatedAt: db.serverDate(),
    },
  })

  const fresh = await db.collection(cartCollectionName).doc(item._id).get()
  return {
    success: true,
    data: {
      cartItem: presentCartItem(fresh.data),
    },
  }
}

async function toggleSelect(event, openid) {
  await ensureUser(openid)
  const cartCollectionName = await resolveCollectionName('cart')
  const item = await getOwnedCartItem(event.cartItemId, openid)
  await db.collection(cartCollectionName).doc(item._id).update({
    data: {
      selected: !!event.selected,
      updatedAt: db.serverDate(),
    },
  })
  const fresh = await db.collection(cartCollectionName).doc(item._id).get()
  return {
    success: true,
    data: {
      cartItem: presentCartItem(fresh.data),
    },
  }
}

async function removeItem(event, openid) {
  await ensureUser(openid)
  const cartCollectionName = await resolveCollectionName('cart')
  const item = await getOwnedCartItem(event.cartItemId, openid)
  await db.collection(cartCollectionName).doc(item._id).remove()
  return {
    success: true,
    data: {
      removed: true,
    },
  }
}

async function clearChecked(openid) {
  await ensureUser(openid)
  const cartCollectionName = await resolveCollectionName('cart')

  let list = []
  try {
    const checked = await db.collection(cartCollectionName)
      .where({
        ownerOpenid: openid,
        selected: true,
      })
      .get()
    list = checked.data || []
  } catch (error) {
    if (!isCollectionMissingError(error)) {
      throw error
    }
  }

  for (const item of list) {
    await db.collection(cartCollectionName).doc(item._id).remove()
  }

  return {
    success: true,
    data: {
      cleared: true,
    },
  }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const action = normalizeText(event.action)

  try {
    if (action === 'list') return await listCart(OPENID)
    if (action === 'add') return await addCartItem(event, OPENID)
    if (action === 'updateQty') return await updateQty(event, OPENID)
    if (action === 'toggleSelect') return await toggleSelect(event, OPENID)
    if (action === 'remove') return await removeItem(event, OPENID)
    if (action === 'clearChecked') return await clearChecked(OPENID)

    return {
      success: false,
      message: 'UNSUPPORTED_ACTION',
    }
  } catch (error) {
    console.error('[productCart] failed', action, error)
    return {
      success: false,
      message: isCollectionMissingError(error)
        ? 'CART_COLLECTION_MISSING'
        : (error.code || error.message || 'PRODUCT_CART_FAILED'),
    }
  }
}
