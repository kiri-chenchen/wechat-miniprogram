const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const res = await db.collection('activities')
    .where({ status: 'published' })
    .orderBy('updatedAt', 'desc')
    .limit(20)
    .get()

  return { list: res.data }
}
