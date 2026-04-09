const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { status, page = 1, pageSize = 20 } = event || {}

  const where = { _openid: OPENID }

  const allowed = new Set(['reserved', 'ongoing', 'cancelled', 'finished'])
  if (status && allowed.has(status)) where.status = status

  const skip = (Number(page) - 1) * Number(pageSize)

  const res = await db.collection('activityOrders')
    .where(where)
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(Number(pageSize))
    .get()

  return { data: res.data }
}