const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function ymd(date) {
  const d = new Date(date)
  const pad = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

function classify(order) {
  if (order.status === 'cancelled' || order.cancelled === true) return 'cancelled'
  const td = order.travelDate
  if (!td) return 'comfirmed'
  const today = ymd(new Date())
  if (td > today) return 'comfirmed'
  if (td === today) return 'ongoing'
  return 'completed'
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()

  const res = await db.collection('activityOrders')
    .where({ _openid: OPENID })
    .get()

  const counts = { comfirmed: 0, ongoing: 0, cancelled: 0, completed: 0 }
  for (const o of (res.data || [])) {
    const s = classify(o)
    counts[s] = (counts[s] || 0) + 1
  }
  return counts
}