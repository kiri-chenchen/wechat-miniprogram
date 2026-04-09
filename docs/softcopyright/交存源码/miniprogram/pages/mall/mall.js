const db = wx.cloud.database()
const { resolveMediaSource } = require('../../utils/mediaAssets')

const SAFE_PRODUCT_COVER = '/images/default-goods-image.png'

async function normalizeProduct(item = {}) {
  const cover = await resolveMediaSource(item.cover, SAFE_PRODUCT_COVER)
  return {
    id: item._id || item.id || '',
    title: item.title || item.name || '未命名商品',
    cover,
    priceText: item.price ? `￥${item.price}` : '价格待定',
    soldText: item.sold ? `${item.sold}人已购` : '新品上线',
    sourceType: item.sourceType || 'demo',
  }
}

Page({
  data: {
    goodsList: [
      {
        id: '1',
        title: '高原土豆礼盒',
        cover: SAFE_PRODUCT_COVER,
        priceText: '￥39.9',
        soldText: '126人已购',
        sourceType: 'demo',
      },
      {
        id: '2',
        title: '农家小米 5斤装',
        cover: SAFE_PRODUCT_COVER,
        priceText: '￥56',
        soldText: '89人已购',
        sourceType: 'demo',
      },
      {
        id: '3',
        title: '手工枣夹核桃',
        cover: SAFE_PRODUCT_COVER,
        priceText: '￥29.9',
        soldText: '203人已购',
        sourceType: 'demo',
      },
      {
        id: '4',
        title: '乡味杂粮组合',
        cover: SAFE_PRODUCT_COVER,
        priceText: '￥68',
        soldText: '75人已购',
        sourceType: 'demo',
      },
    ],
  },

  onLoad() {
    this.loadRealProducts()
  },

  async loadRealProducts() {
    try {
      const res = await db.collection('products').limit(50).get()
      const productList = await Promise.all((res.data || []).map((item) => normalizeProduct(item)))
      this.setData({
        goodsList: [
          ...productList,
          ...this.data.goodsList,
        ],
      })
    } catch (error) {
      console.error('[mall] load real products failed', error)
      wx.showToast({
        title: '商品加载失败',
        icon: 'none',
      })
    }
  },

  goProductDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) {
      wx.showToast({
        title: '演示商品暂无详情',
        icon: 'none',
      })
      return
    }

    wx.navigateTo({
      url: `/pages/productDetail/productDetail?id=${id}`,
    })
  },
})
