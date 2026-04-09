const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const { id } = event
  if (!id) return { ok: false, error: 'missing id' }

  const res = await db.collection('activities').doc(id).get()
  return { ok: true, data: res.data }
}