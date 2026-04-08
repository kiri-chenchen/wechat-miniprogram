/**
 * Read-only export for products collection.
 *
 * Output file:
 * scripts/data/products_existing_index.json
 *
 * Run (PowerShell):
 * & 'D:\Program Files (x86)\微信web开发者工具\node.exe' .\scripts\export-products-existing-index.js
 *
 * Optional env vars:
 * - CLOUD_ENV
 * - WX_SERVER_SDK_PATH
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const OUTPUT_DIR = path.join(ROOT, 'scripts', 'data')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'products_existing_index.json')
const CLOUD_ENV = process.env.CLOUD_ENV || 'cloud1-3ghmr5ki7b1172fe'

function resolveWxServerSdk() {
  const manualPath = process.env.WX_SERVER_SDK_PATH
  const candidates = [
    manualPath,
    path.join(ROOT, 'node_modules', 'wx-server-sdk'),
    path.join(ROOT, 'cloudfunctions', 'productOrder', 'node_modules', 'wx-server-sdk'),
    path.join(ROOT, 'cloudfunctions', 'seedProducts', 'node_modules', 'wx-server-sdk'),
    'wx-server-sdk',
  ].filter(Boolean)

  const tried = []
  for (const candidate of candidates) {
    try {
      const mod = require(candidate)
      return { cloud: mod, resolvedFrom: candidate }
    } catch (error) {
      tried.push(`${candidate}: ${error.message}`)
    }
  }

  const err = new Error(`Cannot find wx-server-sdk.\nTried:\n- ${tried.join('\n- ')}`)
  err.code = 'WX_SERVER_SDK_MISSING'
  throw err
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

function formatRow(item = {}) {
  return {
    _id: item._id || '',
    seedKey: item.seedKey || '',
    title: item.title || '',
    merchantName: item.merchantName || '',
    status: item.status || '',
  }
}

function printList(rows = []) {
  console.log('products existing index:')
  rows.forEach((item, index) => {
    console.log(`${String(index + 1).padStart(2, '0')}. ${item._id} | ${item.seedKey || '-'} | ${item.title || '-'} | ${item.merchantName || '-'} | ${item.status || '-'}`)
  })
}

async function main() {
  const { cloud, resolvedFrom } = resolveWxServerSdk()
  cloud.init({ env: CLOUD_ENV })
  const db = cloud.database()

  console.log(`Using wx-server-sdk from: ${resolvedFrom}`)
  console.log('Reading collection: products')
  console.log(`Cloud env: ${CLOUD_ENV}`)

  const res = await db.collection('products')
    .orderBy('title', 'asc')
    .get()

  const rows = (res.data || []).map(formatRow)
  ensureOutputDir()
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(rows, null, 2), 'utf8')

  console.log(`Wrote ${rows.length} rows to: ${OUTPUT_FILE}`)
  printList(rows)
}

main().catch((error) => {
  console.error('Export failed:')
  console.error(error.message || error)
  process.exitCode = 1
})
