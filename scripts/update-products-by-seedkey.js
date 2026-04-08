/**
 * 一次性批量更新 products collection 的脚本
 *
 * 执行方式（PowerShell）：
 * 1. 先安装依赖：npm install wx-server-sdk
 * 2. 先试跑：$env:DRY_RUN='true'; node scripts/update-products-by-seedkey.js
 * 3. 真更新：$env:DRY_RUN='false'; node scripts/update-products-by-seedkey.js
 *
 * 可选环境变量：
 * - CLOUD_ENV：默认使用 miniprogram/app.js 中当前云环境
 * - DRY_RUN：默认 true；只有显式设为 false 才会真的 update
 */

const fs = require('fs')
const path = require('path')
const cloud = require('wx-server-sdk')

const CLOUD_ENV = process.env.CLOUD_ENV || 'cloud1-3ghmr5ki7b1172fe'
const DRY_RUN = process.env.DRY_RUN !== 'false'
const COLLECTION_NAME = 'products'
const PAYLOAD_PATH = path.join(__dirname, 'data', 'products_update_payload.json')
const OLD_TO_NEW_SEEDKEY_MAP = {
  'huangshan-free-range-eggs': 'huangshan-native-eggs-50',
  'lz-rose-jam': 'kushui-rose-80g',
  'linxia-handmade-noodle-gift': 'songpan-songbei-premium',
  'tianshui-apple-gift': 'wild-cordyceps-tiered',
  'lz-baihe-gift-box': 'lanzhou-fresh-baihe-giftbox',
  'zhangye-coarse-grain-box': 'hongxin-hotel-twin-room',
  'gannan-yak-yogurt': 'kushui-rose-seedling',
}

cloud.init({ env: CLOUD_ENV })
const db = cloud.database()

function loadPayload() {
  const raw = fs.readFileSync(PAYLOAD_PATH, 'utf8')
  const list = JSON.parse(raw)

  if (!Array.isArray(list)) {
    throw new Error('Payload must be an array')
  }

  return list
}

function buildUpdateData(item = {}) {
  const next = { ...item }
  delete next._id
  return next
}

function summarizeFields(item = {}) {
  return {
    seedKey: item.seedKey,
    title: item.title,
    merchantName: item.merchantName,
    merchantOpenid: item.merchantOpenid,
    price: item.price,
    shippingFee: item.shippingFee,
    stock: item.stock,
    lockedStock: item.lockedStock,
    soldCount: item.soldCount,
    status: item.status,
    cover: item.cover,
    banner: item.banner,
    galleryCount: Array.isArray(item.gallery) ? item.gallery.length : 0,
  }
}

function findOldSeedKeyByNewSeedKey(newSeedKey) {
  const normalized = String(newSeedKey || '').trim()
  return Object.keys(OLD_TO_NEW_SEEDKEY_MAP).find(
    (oldSeedKey) => OLD_TO_NEW_SEEDKEY_MAP[oldSeedKey] === normalized
  ) || ''
}

async function updateOne(item, stats) {
  const newSeedKey = String(item.seedKey || '').trim()
  if (!newSeedKey) {
    stats.error += 1
    console.log(`[error] seedKey missing`, item)
    return
  }

  const oldSeedKey = findOldSeedKeyByNewSeedKey(newSeedKey)
  if (!oldSeedKey) {
    stats.skipped += 1
    console.log(`[skipped] seedKey=${newSeedKey} reason=mapping_not_found`)
    return
  }

  const res = await db.collection(COLLECTION_NAME).where({ seedKey: oldSeedKey }).limit(2).get()
  const docs = res.data || []

  if (docs.length === 0) {
    stats.skipped += 1
    console.log(`[skipped] seedKey=${newSeedKey} oldSeedKey=${oldSeedKey} reason=not_found`)
    return
  }

  if (docs.length > 1) {
    stats.error += 1
    console.log(`[error] seedKey=${newSeedKey} oldSeedKey=${oldSeedKey} reason=duplicate_documents count=${docs.length}`)
    return
  }

  stats.found += 1
  const target = docs[0]
  const updateData = buildUpdateData(item)

  if (DRY_RUN) {
    console.log(`[found] seedKey=${newSeedKey} oldSeedKey=${oldSeedKey} _id=${target._id} dryRun=true payload=${JSON.stringify(summarizeFields(updateData))}`)
    return
  }

  await db.collection(COLLECTION_NAME).doc(target._id).update({
    data: updateData,
  })

  stats.updated += 1
  console.log(`[updated] seedKey=${newSeedKey} oldSeedKey=${oldSeedKey} _id=${target._id}`)
}

async function main() {
  const payload = loadPayload()
  const stats = {
    total: payload.length,
    found: 0,
    updated: 0,
    skipped: 0,
    error: 0,
  }

  console.log(`Starting update for collection=${COLLECTION_NAME} env=${CLOUD_ENV} dryRun=${DRY_RUN}`)

  for (const item of payload) {
    try {
      await updateOne(item, stats)
    } catch (error) {
      stats.error += 1
      console.log(`[error] seedKey=${item && item.seedKey ? item.seedKey : 'UNKNOWN'} message=${error.message}`)
    }
  }

  console.log('--- summary ---')
  console.log(JSON.stringify(stats, null, 2))
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exitCode = 1
})
