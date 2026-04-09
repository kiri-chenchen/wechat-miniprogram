const { resolveActivityCover } = require('../../utils/mediaAssets')
const { buildActivityCoverTags } = require('../../utils/activityCoverTags')

const FUN_TAG_GROUPS = [
  {
    id: 'family',
    title: '亲子采摘',
  },
  {
    id: 'craft',
    title: '非遗手作',
  },
  {
    id: 'food',
    title: '乡味美食',
  },
  {
    id: 'getaway',
    title: '山野度假',
  },
  {
    id: 'study',
    title: '田园研学',
  },
]

const CATEGORY_RULES = {
  family: {
    include: ['亲子', '果园', '草莓', '蓝莓', '樱桃', '鲜桃', '梨园', '百合采挖', '农事', '采摘'],
    exclude: ['美食', '乡味', '风味', '宴', '非遗文化', '乡村文化', '丹霞', '徒步', '玫瑰', '草原', '牧场', '茶乡', '茶园', '民宿', '度假', '慢游', '摄影', '研学', '课堂', '实践'],
  },
  craft: {
    include: ['手作', '工坊', '扎染', '陶艺', '竹编', '剪纸', '香包', '漆扇', '编织', '蒸馏', '制作'],
    exclude: ['亲子', '采摘', '果园', '草莓', '蓝莓', '樱桃', '鲜桃', '梨园', '农事', '草原', '牧场', '茶乡', '茶园', '民宿', '露营', '研学', '课堂'],
  },
  food: {
    include: ['美食', '乡味', '风味', '宴', '小吃', '餐', '茶宴', '烹饪'],
    exclude: ['研学'],
  },
  getaway: {
    include: ['草原', '牧场', '民宿', '露营', '茶乡', '茶园', '古村', '民俗', '乡村文化', '康养', '慢游', '度假', '栖居山野', '微度假'],
    exclude: ['亲子', '果园', '草莓', '蓝莓', '樱桃', '鲜桃', '梨园', '农事', '采摘', '研学'],
  },
  study: {
    include: ['研学', '劳动', '课堂', '实践', '科普', '观察', '农耕'],
    exclude: [],
  },
}

function normalizeText(value = '') {
  return String(value || '').trim()
}

function buildSearchText(activity) {
  return [
    normalizeText(activity.title),
    ...(activity.rawTags || []).map(normalizeText),
    ...(activity.tags || []).map(normalizeText),
    ...(activity.playTags || []).map(normalizeText),
    ...(activity.travelModeTags || []).map(normalizeText),
    ...(activity.highlights || []).map(normalizeText),
  ]
    .filter(Boolean)
    .join(' ')
}

function includesAny(text, keywords = []) {
  return keywords.some((keyword) => text.includes(keyword))
}

function resolveActivityCategories(activity) {
  const text = buildSearchText(activity)

  return FUN_TAG_GROUPS
    .filter((group) => {
      const rule = CATEGORY_RULES[group.id]
      if (!rule) {
        return false
      }

      return includesAny(text, rule.include) && !includesAny(text, rule.exclude)
    })
    .map((group) => group.id)
}

Page({
  data: {
    tagGroups: FUN_TAG_GROUPS,
    activeTagIndex: 0,
    activityList: [],
    showList: [],
  },

  onLoad() {
    this.loadActivities()
  },

  async loadActivities() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'getactivities',
      })

      const list = (res.result && res.result.list) || []
      const mapped = await Promise.all(
        list.map(async (item) => {
          const coverTags = buildActivityCoverTags(item).combinedTags

          return {
            id: item._id,
            sourceType: item.sourceType || 'demo',
            title: item.title || '未命名活动',
            cover: await resolveActivityCover(item),
            tags: coverTags,
            rawTags: item.tags || [],
            categoryIds: resolveActivityCategories({
              title: item.title,
              tags: coverTags,
              rawTags: item.tags || [],
              playTags: item.playTags || [],
              travelModeTags: item.travelModeTags || [],
              highlights: item.highlights || [],
            }),
          }
        })
      )

      this.setData(
        {
          activityList: mapped,
        },
        () => this.applyFilter()
      )
    } catch (err) {
      console.error('[ruralFun] load activities failed', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none',
      })
    }
  },

  applyFilter() {
    const { activityList, tagGroups, activeTagIndex } = this.data
    const currentGroup = tagGroups[activeTagIndex] || tagGroups[0]
    const currentGroupId = currentGroup && currentGroup.id
    const showList = activityList.filter((activity) => (activity.categoryIds || []).includes(currentGroupId))

    this.setData({
      showList,
    })
  },

  changeTag(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    this.setData(
      {
        activeTagIndex: idx,
      },
      () => this.applyFilter()
    )
  },

  goActivityDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) {
      return
    }

    wx.navigateTo({
      url: `/pages/activityDetail/activityDetail?id=${id}`,
    })
  },
})
