const GENERIC_TAGS = new Set([
  '\u4e61\u6751',
  '\u519c\u65c5',
  '\u6587\u65c5',
  '\u4f53\u9a8c',
  '\u6d3b\u52a8',
  '\u7f8e\u98df',
  '\u73a9\u6cd5',
  '\u65b9\u5f0f',
  '\u51fa\u884c',
  '\u51fa\u6e38',
  '\u5fae\u5ea6\u5047',
  '\u5468\u672b\u77ed\u9014',
  '\u6444\u5f71',
  '\u89c2\u5149',
  '\u624b\u4f5c',
  '\u975e\u9057',
  '\u91c7\u6458',
  '\u82b1\u6d77',
  '\u7530\u56ed',
  '\u7267\u573a',
  '\u6c11\u5bbf',
  '\u9152\u5e97',
  '\u5065\u5eb7\u517b\u751f',
  '\u4eb2\u5b50\u7814\u5b66',
  '\u51fa\u7247\u6253\u5361',
])

const NOISE_WORDS = [
  '\u4f53\u9a8c',
  '\u4e4b\u65c5',
  '\u4e4b\u884c',
  '\u4e3b\u9898',
  '\u6587\u5316',
  '\u98ce\u60c5',
  '\u9650\u5b9a',
  '\u6d3b\u52a8',
  '\u7ebf\u8def',
  '\u5fae\u5ea6\u5047',
  '\u6162\u6e38',
  '\u89c2\u5149',
  '\u6253\u5361',
  '\u73a9\u6cd5',
  '\u65b9\u5f0f',
  '\u9002\u5408',
  '\u53ef\u9009',
  '\u4f18\u5148',
  '\u53ef\u62fc\u8f66',
  '\u62fc\u8f66',
  '\u8f7b\u677e',
]

const NONE_STAY_PATTERNS = [
  '\u4e0d\u542b\u4f4f\u5bbf',
  '\u65e0\u4f4f\u5bbf',
  '\u4e0d\u542b\u4f4f',
  '\u65e0\u4f4f',
]

function normalizeText(value = '') {
  return String(value || '').trim()
}

function normalizeList(value) {
  return Array.isArray(value) ? value.map(normalizeText).filter(Boolean) : []
}

function containsAny(text, patterns) {
  return patterns.some((pattern) => text.includes(pattern))
}

function normalizeCompareText(value) {
  let text = normalizeText(value)
  text = text.replace(/\u534a\u65e5/gu, '\u534a\u5929')
  text = text.replace(/\u4e00\u65e5/gu, '1\u5929')
  text = text.replace(/\u519c\u5bb6\u5348\u9910/gu, '\u519c\u5bb6\u98ce\u5473\u9910')
  text = text.replace(/\u519c\u5bb6\u665a\u9910/gu, '\u519c\u5bb6\u98ce\u5473\u9910')
  text = text.replace(/\u519c\u5bb6\u996d/gu, '\u519c\u5bb6\u98ce\u5473\u9910')
  text = text.replace(/\u4e61\u6751\u5348\u9910/gu, '\u519c\u5bb6\u98ce\u5473\u9910')
  text = text.replace(/\u5de5\u574a/gu, '\u624b\u4f5c')
  text = text.replace(/(\u624b\u4f5c)+/gu, '\u624b\u4f5c')
  text = text.replace(/[\u00b7\u30fb\u3001\uff0c,\s\/|｜-]+/gu, '')
  NOISE_WORDS.forEach((word) => {
    text = text.split(word).join('')
  })
  return text
}

function isSimilarTag(candidate, existingList) {
  const normalizedCandidate = normalizeCompareText(candidate)
  if (!normalizedCandidate) {
    return false
  }

  return existingList.some((item) => {
    const normalizedItem = normalizeCompareText(item)
    if (!normalizedItem) {
      return false
    }

    return (
      normalizedItem === normalizedCandidate ||
      normalizedItem.includes(normalizedCandidate) ||
      normalizedCandidate.includes(normalizedItem)
    )
  })
}

function pushCandidate(target, candidate, excludedList = [], max = 5) {
  const text = normalizeText(candidate)
  if (!text || target.length >= max || GENERIC_TAGS.has(text)) {
    return
  }

  if (isSimilarTag(text, excludedList) || isSimilarTag(text, target)) {
    return
  }

  target.push(text)
}

function appendCandidates(target, candidates, excludedList, max, limit) {
  const local = []
  candidates.forEach((candidate) => {
    pushCandidate(local, candidate, excludedList, limit)
  })
  local.forEach((candidate) => {
    pushCandidate(target, candidate, excludedList, max)
  })
}

function buildDurationTag(days, durationText) {
  if (typeof days === 'number' && days >= 2) {
    return `${days}\u5929${days - 1}\u665a`
  }

  if (typeof days === 'number' && days > 0 && days < 1) {
    return normalizeText(durationText) || '\u534a\u5929'
  }

  if (typeof days === 'number' && days > 0) {
    return `${days}\u5929`
  }

  return normalizeText(durationText) || '1\u5929'
}

function collectServiceTags(activity, target, excludedList, max) {
  const transportText = normalizeText(activity.transport)
  const pickupPoint = normalizeText(activity.pickupPoint)
  const candidates = []

  if (transportText) {
    if (transportText.includes('\u4fdd\u59c6\u8f66')) {
      candidates.push('\u4fdd\u59c6\u8f66')
    }
    if (transportText.includes('\u4e00\u5355\u4e00\u56e2')) {
      candidates.push('\u4e00\u5355\u4e00\u56e2')
    }
    if (containsAny(transportText, ['\u4e13\u8f66', '\u5305\u8f66'])) {
      candidates.push('\u4e13\u8f66\u670d\u52a1')
    }
    if (containsAny(transportText, ['\u5546\u52a1\u8f66'])) {
      candidates.push('\u5546\u52a1\u8f66\u63a5\u9001')
    }
    if (containsAny(transportText, ['\u5c0f\u5df4', '\u5927\u5df4', '\u5df4\u58eb', '\u65c5\u6e38\u5df4\u58eb', '\u56e2\u961f\u5df4\u58eb'])) {
      candidates.push('\u5df4\u58eb\u63a5\u9001')
    }
    if (containsAny(transportText, ['\u81ea\u9a7e'])) {
      candidates.push('\u81ea\u9a7e\u53ef\u9009')
    }
  }

  if (activity.pickup) {
    if (containsAny(pickupPoint, ['\u9ad8\u94c1', '\u706b\u8f66\u7ad9', '\u8f66\u7ad9', '\u7ad9'])) {
      candidates.push('\u7ad9\u70b9\u63a5\u9001')
    } else if (containsAny(pickupPoint, ['\u9152\u5e97', '\u6c11\u5bbf'])) {
      candidates.push('\u4f4f\u5bbf\u63a5\u9001')
    } else if (containsAny(pickupPoint, ['\u5546\u5708', '\u5730\u94c1', '\u57ce\u5173', '\u65b0\u533a'])) {
      candidates.push('\u5546\u5708\u63a5\u9001')
    } else {
      candidates.push('\u5b9a\u70b9\u63a5\u9001')
    }
  }

  appendCandidates(target, candidates, excludedList, max, 2)
}

function collectStayTags(activity, target, excludedList, max) {
  const stayText = normalizeText(activity.stay)
  if (!stayText || containsAny(stayText, NONE_STAY_PATTERNS)) {
    return
  }
  const candidates = []

  if (containsAny(stayText, ['\u7cbe\u54c1\u6c11\u5bbf', '\u7279\u8272\u6c11\u5bbf'])) {
    candidates.push('\u7279\u8272\u6c11\u5bbf')
  } else if (stayText.includes('\u6c11\u5bbf')) {
    candidates.push('\u6c11\u5bbf\u53ef\u9009')
  }

  if (containsAny(stayText, ['\u9152\u5e97', '\u53cc\u5e8a', '\u5927\u5e8a'])) {
    candidates.push('\u9152\u5e97\u53ef\u9009')
  }

  if (containsAny(stayText, ['\u5e10\u7bf7', '\u9732\u8425'])) {
    candidates.push('\u5e10\u7bf7\u9732\u8425')
  }

  if (containsAny(stayText, ['\u6728\u5c4b', '\u5c0f\u9662'])) {
    candidates.push('\u4e61\u91ce\u6728\u5c4b')
  }

  appendCandidates(target, candidates, excludedList, max, 1)
}

function collectFoodTags(textPool, target, excludedList, max) {
  const joined = textPool.join(' ')
  const candidates = []

  if (joined.includes('\u6cb3\u5dde') && containsAny(joined, ['\u4e61\u5473\u5bb4', '\u98ce\u5473\u5bb4'])) {
    candidates.push('\u6cb3\u5dde\u4e61\u5473\u5bb4')
  }

  if (joined.includes('\u767e\u5408') && containsAny(joined, ['\u5168\u5e2d', '\u5bb4'])) {
    candidates.push('\u767e\u5408\u5168\u5e2d\u5bb4')
  } else if (joined.includes('\u767e\u5408') && containsAny(joined, ['\u7f8e\u98df', '\u98ce\u5473', '\u751c\u54c1', '\u624b\u4f5c'])) {
    candidates.push('\u767e\u5408\u98ce\u5473')
  }

  if (joined.includes('\u73ab\u7470') && containsAny(joined, ['\u5bb4', '\u665a\u9910', '\u5348\u9910', '\u98ce\u5473'])) {
    candidates.push('\u73ab\u7470\u98ce\u5473\u5bb4')
  }

  if (containsAny(joined, ['\u519c\u5bb6\u5348\u9910', '\u519c\u5bb6\u996d', '\u519c\u5bb6\u9910', '\u4e61\u6751\u665a\u9910'])) {
    candidates.push('\u519c\u5bb6\u98ce\u5473\u9910')
  }

  if (containsAny(joined, ['\u8017\u725b\u9178\u5976', '\u9178\u5976'])) {
    candidates.push('\u8017\u725b\u9178\u5976')
  }

  if (containsAny(joined, ['\u85cf\u5f0f\u5976\u8336', '\u5976\u8336'])) {
    candidates.push('\u85cf\u5f0f\u5976\u8336')
  }

  appendCandidates(target, candidates, excludedList, max, 1)
}

function normalizeHighlightTag(value) {
  let text = normalizeText(value)
  if (!text) {
    return ''
  }

  if (text.includes('\u767e\u5408') && text.includes('\u5c0f\u5361')) {
    return '\u767e\u5408\u5c0f\u5361'
  }

  text = text.replace(/^[0-9]+\.\s*/u, '')
  text = text
    .replace(/^\u8d60\u9001/u, '')
    .replace(/^\u9644\u8d60/u, '')
    .replace(/^\u5b9a\u5236/u, '')
    .replace(/\u4f53\u9a8c$/u, '')
    .replace(/\u6253\u5361$/u, '')
    .replace(/\u89c2\u5149$/u, '')
    .replace(/\u6162\u6e38$/u, '')
    .replace(/\u5165\u4f4f$/u, '')
    .replace(/\u4f11\u95f2$/u, '')
    .replace(/\u8bb2\u89e3$/u, '')
    .replace(/\u540c\u6846$/u, '')
    .trim()

  if (!text || text.length > 8 || GENERIC_TAGS.has(text)) {
    return ''
  }

  return text
}

function mapSpecificTag(text) {
  const value = normalizeText(text)
  if (!value) {
    return ''
  }

  if (value.includes('\u590f\u6cb3') && value.includes('\u7267\u573a')) return '\u590f\u6cb3\u7267\u573a'
  if (value.includes('\u9647\u5357') && containsAny(value, ['\u8336\u4e61', '\u8336\u5c71', '\u8336\u56ed'])) return '\u9647\u5357\u8336\u4e61'
  if (value.includes('\u82e6\u6c34') && value.includes('\u73ab\u7470')) return '\u82e6\u6c34\u73ab\u7470'
  if (value.includes('\u6c38\u767b') && value.includes('\u73ab\u7470')) return '\u6c38\u767b\u73ab\u7470'
  if (value.includes('\u767e\u5408') && containsAny(value, ['\u91c7\u6316', '\u91c7\u6458', '\u79cd\u690d'])) return '\u767e\u5408\u91c7\u6316'
  if (value.includes('\u8349\u8393') && containsAny(value, ['\u91c7\u6458', '\u679c\u56ed', '\u6e29\u5ba4'])) return '\u8349\u8393\u91c7\u6458'
  if (value.includes('\u68a8\u56ed')) return '\u68a8\u56ed\u91c7\u6458'
  if (value.includes('\u679c\u56ed') && value.includes('\u91c7\u6458')) return '\u679c\u56ed\u91c7\u6458'
  if (value.includes('\u4e39\u971e') && value.includes('\u5f92\u6b65')) return '\u4e39\u971e\u5f92\u6b65'
  if (value.includes('\u4e39\u971e')) return '\u4e39\u971e\u89c2\u666f'
  if (value.includes('\u82b1\u7530')) return '\u82b1\u7530\u6253\u5361'
  if (value.includes('\u82b1\u6d77')) return '\u82b1\u6d77\u6444\u5f71'
  if (containsAny(value, ['\u8336\u4e61', '\u8336\u5c71'])) return '\u8336\u4e61\u6162\u6e38'
  if (value.includes('\u8336\u56ed')) return '\u8336\u56ed\u624b\u4f5c'
  if (value.includes('\u975e\u9057') && value.includes('\u5de5\u574a')) return '\u975e\u9057\u5de5\u574a'
  if (value.includes('\u53e4\u6751')) return '\u53e4\u6751\u6f2b\u6e38'
  if (value.includes('\u7530\u56ed') && containsAny(value, ['\u6444\u5f71', '\u98ce\u5149', '\u89c2\u666f'])) return '\u7530\u56ed\u89c2\u666f'
  if (value.includes('\u7530\u56ed') && value.includes('\u82b1')) return '\u7530\u56ed\u82b1\u6d77'
  if (value.includes('\u9732\u8425')) return '\u5c71\u91ce\u9732\u8425'
  if (value.includes('\u6c11\u5bbf')) return '\u4e61\u91ce\u6c11\u5bbf'
  if (value.includes('\u624b\u4f5c')) return normalizeHighlightTag(value) || '\u624b\u4f5c\u5de5\u574a'
  if (value.includes('\u91c7\u6458')) return normalizeHighlightTag(value)

  return normalizeHighlightTag(value)
}

function collectSpecificTags(activity, target, excludedList, max) {
  const candidates = normalizeList(activity.highlights)
    .concat([
      normalizeText(activity.title),
      normalizeText(activity.summary),
    ])
    .map(mapSpecificTag)
    .filter(Boolean)

  candidates.forEach((item) => pushCandidate(target, item, excludedList, max))
}

function collectFallbackTags(activity, target, excludedList, max) {
  normalizeList(activity.tags)
    .map(normalizeHighlightTag)
    .filter(Boolean)
    .forEach((item) => pushCandidate(target, item, excludedList, max))
}

function buildActivityCoverTags(activity = {}, options = {}) {
  const maxTotal = options.maxTotal || 6
  const maxExtra = Math.max(0, maxTotal - 1)
  const durationTag = buildDurationTag(activity.days, activity.durationText)
  const excludedList = [durationTag]
    .concat(normalizeList(activity.travelModeTags))
    .concat(normalizeList(activity.playTags))
  const textPool = normalizeList(activity.highlights).concat([
    normalizeText(activity.locationName),
    normalizeText(activity.title),
    normalizeText(activity.summary),
    normalizeText(activity.content),
    normalizeText(activity.detail),
  ])
  const coverTags = []

  collectServiceTags(activity, coverTags, excludedList, maxExtra)
  collectStayTags(activity, coverTags, excludedList, maxExtra)
  collectFoodTags(textPool, coverTags, excludedList, maxExtra)
  collectSpecificTags(activity, coverTags, excludedList, maxExtra)
  collectFallbackTags(activity, coverTags, excludedList, maxExtra)

  return {
    durationTag,
    tags: coverTags.slice(0, maxExtra),
    combinedTags: [durationTag].concat(coverTags.slice(0, maxExtra)),
  }
}

module.exports = {
  buildActivityCoverTags,
}
