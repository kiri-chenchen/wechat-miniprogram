const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const STATUS_TEXT = {
  pending_payment: '\u5f85\u652f\u4ed8',
  upcoming: '\u5f85\u51fa\u884c',
  pending_review: '\u5f85\u8bc4\u4ef7',
  refunding: '\u9000\u6b3e\u4e2d',
  cancelled: '\u5df2\u53d6\u6d88',
  completed: '\u4ea4\u6613\u6210\u529f',
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function normalizePhone(value) {
  return normalizeText(value).replace(/\s+/g, '')
}

function toDateStart(dateText) {
  const normalized = normalizeText(dateText)
  if (!normalized) return null
  const timestamp = new Date(`${normalized} 00:00:00`).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function buildOrderStatus(order, now = Date.now()) {
  const rawStatus = normalizeText(order.status)
  const travelTs = toDateStart(order.travelDate)
  const activityDays = Math.max(1, normalizeNumber(order.activityDays || order.days, 1))
  const endTs = travelTs ? travelTs + activityDays * 24 * 60 * 60 * 1000 : null
  const after7Days = endTs ? endTs + 7 * 24 * 60 * 60 * 1000 : null
  const paymentDeadline = normalizeNumber(order.paymentDeadline, 0)
  const reviewed = !!order.reviewed

  if (rawStatus === 'pending_payment') {
    if (paymentDeadline && now > paymentDeadline) {
      return { key: 'cancelled', text: STATUS_TEXT.cancelled }
    }
    return { key: 'pending_payment', text: STATUS_TEXT.pending_payment }
  }

  if (rawStatus === 'refunding') {
    return { key: 'refunding', text: STATUS_TEXT.refunding }
  }

  if (rawStatus === 'cancelled') {
    return { key: 'cancelled', text: STATUS_TEXT.cancelled }
  }

  if (rawStatus === 'completed') {
    return { key: 'completed', text: STATUS_TEXT.completed }
  }

  if (rawStatus === 'upcoming') {
    if (endTs && now < endTs) {
      return { key: 'upcoming', text: STATUS_TEXT.upcoming }
    }
    if (after7Days && now <= after7Days && !reviewed) {
      return { key: 'pending_review', text: STATUS_TEXT.pending_review }
    }
    return { key: 'completed', text: STATUS_TEXT.completed }
  }

  if (rawStatus === 'pending_review') {
    if (after7Days && now <= after7Days && !reviewed) {
      return { key: 'pending_review', text: STATUS_TEXT.pending_review }
    }
    return { key: 'completed', text: STATUS_TEXT.completed }
  }

  return { key: 'completed', text: STATUS_TEXT.completed }
}

function buildActions(statusKey, order) {
  return {
    canPay: statusKey === 'pending_payment',
    canCancel: statusKey === 'pending_payment',
    canRefund: statusKey === 'upcoming' || statusKey === 'pending_review',
    canReview: statusKey === 'pending_review' && !order.reviewed,
  }
}

async function expirePendingOrderIfNeeded(order) {
  if (!order || order.status !== 'pending_payment') {
    return order
  }

  const paymentDeadline = normalizeNumber(order.paymentDeadline, 0)
  if (!paymentDeadline || Date.now() <= paymentDeadline) {
    return order
  }

  await db.collection('activityOrders').doc(order._id).update({
    data: {
      status: 'cancelled',
      cancelReason: '\u8d85\u65f6\u672a\u652f\u4ed8\u81ea\u52a8\u53d6\u6d88',
      cancelledAt: db.serverDate(),
      updatedAt: db.serverDate(),
    },
  })

  const fresh = await db.collection('activityOrders').doc(order._id).get()
  return fresh.data
}

function normalizeTraveler(item) {
  return {
    _id: item._id,
    name: normalizeText(item.name),
    idType: normalizeText(item.idType),
    idNo: normalizeText(item.idNo),
  }
}

function presentOrder(order) {
  const status = buildOrderStatus(order)
  const actions = buildActions(status.key, order)
  const totalPrice = normalizeNumber(order.unitPrice, 0) * normalizeNumber(order.totalCount, 0)

  return {
    ...order,
    displayStatusKey: status.key,
    displayStatusText: status.text,
    totalPrice,
    actions,
    canRefundAfterTrip: status.key === 'pending_review',
  }
}

async function getCurrentUser(openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get()
  return res.data[0] || null
}

async function requireCurrentUser(openid, options = {}) {
  const user = await getCurrentUser(openid)
  if (!user) {
    const error = new Error('WECHAT_LOGIN_REQUIRED')
    error.code = 'WECHAT_LOGIN_REQUIRED'
    throw error
  }

  return user
}

async function getOrderOwnedByUser(orderId, openid) {
  const id = normalizeText(orderId)
  if (!id) {
    const error = new Error('ORDER_ID_REQUIRED')
    error.code = 'ORDER_ID_REQUIRED'
    throw error
  }

  const res = await db.collection('activityOrders').doc(id).get()
  const order = res.data || null
  if (!order) {
    const error = new Error('ORDER_NOT_FOUND')
    error.code = 'ORDER_NOT_FOUND'
    throw error
  }

  const ownerOpenid = normalizeText(order.ownerOpenid || order.openid || order._openid)
  if (ownerOpenid !== openid) {
    const error = new Error('ORDER_NOT_FOUND')
    error.code = 'ORDER_NOT_FOUND'
    throw error
  }

  return expirePendingOrderIfNeeded(order)
}

async function createOrder(event, openid) {
  await requireCurrentUser(openid)

  const activityId = normalizeText(event.activityId)
  const travelDate = normalizeText(event.travelDate)
  const adultCount = normalizeNumber(event.adultCount, 0)
  const childCount = normalizeNumber(event.childCount, 0)
  const totalCount = adultCount + childCount
  const contact = event.contact || {}
  const specialRequest = normalizeText(event.specialRequest)
  const emergency = event.emergency || {}
  const travelerIds = Array.isArray(event.travelerIds)
    ? Array.from(new Set(event.travelerIds.map((item) => normalizeText(item)).filter(Boolean)))
    : []

  if (!activityId) {
    throw Object.assign(new Error('ACTIVITY_ID_REQUIRED'), { code: 'ACTIVITY_ID_REQUIRED' })
  }
  if (!travelDate || !toDateStart(travelDate)) {
    throw Object.assign(new Error('INVALID_TRAVEL_DATE'), { code: 'INVALID_TRAVEL_DATE' })
  }
  if (adultCount < 0 || childCount < 0 || totalCount <= 0) {
    throw Object.assign(new Error('INVALID_TRAVELER_COUNT'), { code: 'INVALID_TRAVELER_COUNT' })
  }
  if (travelerIds.length !== totalCount) {
    throw Object.assign(new Error('TRAVELER_COUNT_MISMATCH'), { code: 'TRAVELER_COUNT_MISMATCH' })
  }

  const contactName = normalizeText(contact.name)
  const contactPhone = normalizePhone(contact.phone)
  if (!contactName) {
    throw Object.assign(new Error('CONTACT_NAME_REQUIRED'), { code: 'CONTACT_NAME_REQUIRED' })
  }
  if (!/^1[3-9]\d{9}$/.test(contactPhone)) {
    throw Object.assign(new Error('INVALID_CONTACT_PHONE'), { code: 'INVALID_CONTACT_PHONE' })
  }

  const emergencyEnabled = !!emergency.enabled
  const emergencyName = normalizeText(emergency.name)
  const emergencyPhone = normalizePhone(emergency.phone)
  if (emergencyEnabled) {
    if (!emergencyName) {
      throw Object.assign(new Error('EMERGENCY_NAME_REQUIRED'), { code: 'EMERGENCY_NAME_REQUIRED' })
    }
    if (!/^1[3-9]\d{9}$/.test(emergencyPhone)) {
      throw Object.assign(new Error('INVALID_EMERGENCY_PHONE'), { code: 'INVALID_EMERGENCY_PHONE' })
    }
  }

  const activityRes = await db.collection('activities').doc(activityId).get()
  const activity = activityRes.data || null
  if (!activity || normalizeText(activity.status) !== 'published') {
    throw Object.assign(new Error('ACTIVITY_NOT_AVAILABLE'), { code: 'ACTIVITY_NOT_AVAILABLE' })
  }

  const travelerRes = await db.collection('travelers').where({
    _id: _.in(travelerIds),
  }).get()
  const travelers = (travelerRes.data || []).filter((item) => {
    const ownerOpenid = normalizeText(item.ownerOpenid || item.openid || item._openid)
    return ownerOpenid === openid
  })

  if (travelers.length !== travelerIds.length) {
    throw Object.assign(new Error('TRAVELER_NOT_FOUND'), { code: 'TRAVELER_NOT_FOUND' })
  }

  const travelersById = new Map(travelers.map((item) => [item._id, item]))
  const orderedTravelers = travelerIds.map((id) => normalizeTraveler(travelersById.get(id)))

  const now = Date.now()
  const paymentDeadline = now + 30 * 60 * 1000

  const payload = {
    ownerOpenid: openid,
    openid,
    _openid: openid,
    activityId,
    activityTitle: normalizeText(activity.title) || '\u672a\u547d\u540d\u6d3b\u52a8',
    activityDays: Math.max(1, normalizeNumber(activity.days, 1)),
    activityCover: normalizeText(activity.cover),
    unitPrice: normalizeNumber(activity.price, 0),
    travelDate,
    adultCount,
    childCount,
    totalCount,
    contact: {
      name: contactName,
      phone: contactPhone,
      qq: normalizeText(contact.qq),
      wechat: normalizeText(contact.wechat),
    },
    travelerIds,
    travelers: orderedTravelers,
    specialRequest,
    emergency: {
      enabled: emergencyEnabled,
      name: emergencyName,
      phone: emergencyEnabled ? emergencyPhone : '',
    },
    status: 'pending_payment',
    paymentDeadline,
    paidAt: null,
    reviewed: false,
    reviewedAt: null,
    review: null,
    refundStatus: '',
    cancelledAt: null,
    cancelReason: '',
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
  }

  const addRes = await db.collection('activityOrders').add({ data: payload })
  const fresh = await db.collection('activityOrders').doc(addRes._id).get()

  return {
    success: true,
    order: presentOrder(fresh.data),
  }
}

async function listMine(event, openid) {
  await requireCurrentUser(openid)

  const page = Math.max(1, normalizeNumber(event.page, 1))
  const pageSize = Math.min(100, Math.max(1, normalizeNumber(event.pageSize, 20)))
  const skip = (page - 1) * pageSize

  const res = await db.collection('activityOrders')
    .where({ ownerOpenid: openid })
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get()

  const normalized = []
  for (const item of (res.data || [])) {
    const fresh = await expirePendingOrderIfNeeded(item)
    normalized.push(presentOrder(fresh))
  }

  return {
    success: true,
    data: normalized,
  }
}

async function detail(event, openid) {
  await requireCurrentUser(openid)
  const order = await getOrderOwnedByUser(event.id, openid)
  return {
    success: true,
    data: presentOrder(order),
  }
}

async function mockPay(event, openid) {
  await requireCurrentUser(openid)
  const order = await getOrderOwnedByUser(event.id, openid)
  const status = buildOrderStatus(order)

  if (status.key !== 'pending_payment') {
    throw Object.assign(new Error('ORDER_CANNOT_PAY'), { code: 'ORDER_CANNOT_PAY' })
  }

  await db.collection('activityOrders').doc(order._id).update({
    data: {
      status: 'upcoming',
      paidAt: db.serverDate(),
      updatedAt: db.serverDate(),
    },
  })

  const fresh = await db.collection('activityOrders').doc(order._id).get()
  return {
    success: true,
    data: presentOrder(fresh.data),
  }
}

async function cancel(event, openid) {
  await requireCurrentUser(openid)
  const order = await getOrderOwnedByUser(event.id, openid)
  const status = buildOrderStatus(order)

  if (status.key !== 'pending_payment') {
    throw Object.assign(new Error('ORDER_CANNOT_CANCEL'), { code: 'ORDER_CANNOT_CANCEL' })
  }

  await db.collection('activityOrders').doc(order._id).update({
    data: {
      status: 'cancelled',
      cancelReason: '\u7528\u6237\u624b\u52a8\u53d6\u6d88',
      cancelledAt: db.serverDate(),
      updatedAt: db.serverDate(),
    },
  })

  const fresh = await db.collection('activityOrders').doc(order._id).get()
  return {
    success: true,
    data: presentOrder(fresh.data),
  }
}

async function requestRefund(event, openid) {
  await requireCurrentUser(openid)
  const order = await getOrderOwnedByUser(event.id, openid)
  const status = buildOrderStatus(order)

  if (!(status.key === 'upcoming' || status.key === 'pending_review')) {
    throw Object.assign(new Error('ORDER_CANNOT_REFUND'), { code: 'ORDER_CANNOT_REFUND' })
  }

  await db.collection('activityOrders').doc(order._id).update({
    data: {
      status: 'refunding',
      refundStatus: 'refunding',
      updatedAt: db.serverDate(),
    },
  })

  const fresh = await db.collection('activityOrders').doc(order._id).get()
  return {
    success: true,
    data: presentOrder(fresh.data),
  }
}

async function submitReview(event, openid) {
  await requireCurrentUser(openid)
  const order = await getOrderOwnedByUser(event.id, openid)
  const status = buildOrderStatus(order)
  const score = Math.min(5, Math.max(1, normalizeNumber(event.score, 5)))
  const content = normalizeText(event.content)

  if (status.key !== 'pending_review') {
    throw Object.assign(new Error('ORDER_CANNOT_REVIEW'), { code: 'ORDER_CANNOT_REVIEW' })
  }
  if (!content) {
    throw Object.assign(new Error('REVIEW_CONTENT_REQUIRED'), { code: 'REVIEW_CONTENT_REQUIRED' })
  }

  await db.collection('activityOrders').doc(order._id).update({
    data: {
      reviewed: true,
      reviewedAt: db.serverDate(),
      review: {
        score,
        content,
      },
      status: 'completed',
      updatedAt: db.serverDate(),
    },
  })

  const fresh = await db.collection('activityOrders').doc(order._id).get()
  return {
    success: true,
    data: presentOrder(fresh.data),
  }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const action = normalizeText(event.action)

  try {
    if (action === 'create') return await createOrder(event, OPENID)
    if (action === 'listMine') return await listMine(event, OPENID)
    if (action === 'detail') return await detail(event, OPENID)
    if (action === 'mockPay') return await mockPay(event, OPENID)
    if (action === 'cancel') return await cancel(event, OPENID)
    if (action === 'requestRefund') return await requestRefund(event, OPENID)
    if (action === 'submitReview') return await submitReview(event, OPENID)

    return {
      success: false,
      message: 'UNSUPPORTED_ACTION',
    }
  } catch (error) {
    console.error('[activityOrder] failed', action, error)
    return {
      success: false,
      message: error.code || error.message || 'ACTIVITY_ORDER_FAILED',
    }
  }
}
