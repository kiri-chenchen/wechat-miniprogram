const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function buildNewUser(openid) {
  return {
    openid,
    nickName: '',
    avatarUrl: '',
    phoneNumber: '',
    hasBoundPhone: true,
    gender: 'unknown',
    birthDate: '',
    dnaTags: [],
    buddyTags: [],
    buddyIntent: {
      availability: '',
      buddyType: '',
      acceptCarpool: '',
      groupPreference: '',
    },
    buddyIntentCompleted: false,
    role: 'user',
    profileCompleted: false,
    dnaCompleted: false,
    onboardingCompleted: false,
    locationAuthorized: false,
    locationChoiceMade: false,
    userLocation: null,
    createdAt: db.serverDate(),
    updatedAt: db.serverDate(),
  }
}

async function getUserByOpenid(openid) {
  const res = await db.collection('users').where({ openid }).limit(1).get()
  return res.data[0] || null
}

async function ensureWechatUser(openid) {
  const existingUser = await getUserByOpenid(openid)
  if (existingUser) {
    if (existingUser.hasBoundPhone === false) {
      await db.collection('users').doc(existingUser._id).update({
        data: {
          hasBoundPhone: true,
          updatedAt: db.serverDate(),
        },
      })
      const fresh = await db.collection('users').doc(existingUser._id).get()
      return { success: true, userInfo: fresh.data, isNewUser: false }
    }
    return { success: true, userInfo: existingUser, isNewUser: false }
  }

  const newUser = buildNewUser(openid)
  const addRes = await db.collection('users').add({ data: newUser })
  return {
    success: true,
    userInfo: { _id: addRes._id, ...newUser },
    isNewUser: true,
  }
}

exports.main = async (event = {}) => {
  const { method } = event
  const { OPENID } = cloud.getWXContext()

  try {
    if (method === 'wechat') return await ensureWechatUser(OPENID)
    return { success: false, message: 'UNSUPPORTED_LOGIN_METHOD' }
  } catch (err) {
    console.error('[login cloud] failed', method, err)
    return {
      success: false,
      message: err.code || err.message || 'LOGIN_FAILED',
    }
  }
}
