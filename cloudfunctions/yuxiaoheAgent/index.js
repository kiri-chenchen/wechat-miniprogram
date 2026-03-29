// Legacy transitional implementation.
// The only formal mainline for YuXiaoHe is cloudfunctions/agent-yuxiaohe-1grmumm967563411.
// Keep this file only for migration reference or temporary compatibility. Do not continue feature expansion here.

const OpenAI = require("openai")
const cloud = require("wx-server-sdk")
const basePersonaPrompt = require("./prompts/basePersonaPrompt")
const buildGenericPrompt = require("./prompts/genericPrompt")
const outputSchemaPrompt = require("./prompts/outputSchemaPrompt")
const getContentCandidates = require("./utils/getContentCandidates")
const routeIntent = require("./utils/intentRouter")
const weatherTool = require("./utils/weatherTool")
const { reverseGeocoder, ipLocation } = require("./utils/tencentMapTool")

const ENV_ID = "cloud1-3ghmr5ki7b1172fe"
const AI_PROVIDER = process.env.AI_PROVIDER || "deepseek"
const AI_MODEL = process.env.AI_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v3"
const AI_API_KEY = process.env.CLOUDBASE_API_KEY || process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || ""
const AI_BASE_URL =
  process.env.AI_BASE_URL || process.env.DEEPSEEK_BASE_URL || `https://${ENV_ID}.api.tcloudbasegateway.com/v1/ai/${AI_PROVIDER}/v1`

cloud.init({ env: ENV_ID })
const db = cloud.database()

let openaiClient = null

function normalizeText(value) {
  return String(value || "").trim()
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function parsePayload(event) {
  const payload = event && typeof event === "object" ? event : {}
  return {
    question: normalizeText(payload.question),
    location: payload.location || {},
    userProfile: payload.userProfile || {},
    preferences: payload.preferences || {},
    history: normalizeArray(payload.history)
      .map((item) => ({
        role: normalizeText(item && item.role),
        text: normalizeText(item && item.text)
      }))
      .filter((item) => item.role && item.text)
      .slice(-8)
  }
}

function buildFallbackResult(input, fallbackCards) {
  const cards = (fallbackCards || []).slice(0, 3)
  const locationText = [input.location.city, input.location.district].filter(Boolean).join(" ")
  const targetText = locationText || "你现在想找的方向"
  const askForPlatformContent = /(活动|景点|玩|住|民宿|酒店|买|特产|礼盒|乡味|路线|攻略|周边|附近|打卡|采摘)/.test(input.question)

  return {
    answer: cards.length
      ? `小禾先围绕${targetText}帮你筛了几条更贴近的问题结果，里面会混合活动、景点、商品或民宿。你可以先看看哪类更对路，如果你愿意，也可以继续告诉小禾预算、距离或同行人群，小禾再帮你收一轮。`
      : askForPlatformContent
        ? "小禾先按你当前提供的信息看了一圈，暂时还没有筛出特别贴合的平台内容。你可以再告诉小禾地区、预算、出行人群或想找的类型，小禾继续帮你缩小范围。"
        : "这个问题小禾可以继续陪你聊，但我现在还没有接到实时查询能力，所以涉及天气、时效信息或外部知识时，回答可能不够准。你也可以换个更具体的问法，或者继续问平台里的活动、景点、商品和民宿。",
    cards,
    tips: cards.length
      ? "如果你已经有大概预算、同行人群或更明确的玩法偏好，也可以继续告诉小禾。"
      : "你可以继续补充地区、预算、同行人群，或者直接说明想问平台内容还是通用问题。",
    guessQuestions: cards.length
      ? ["还有更近一点的吗", "有没有更适合周末的", "能换成民宿或景点吗"]
      : ["附近还有别的玩法吗", "有适合亲子的内容吗", "能按预算再缩小一点吗"],
    followUp: cards.length ? "如果你愿意，小禾还可以继续按距离、预算、玩法或内容类型帮你再缩小范围。" : ""
  }
}

function buildWeatherFallbackResult(input) {
  return {
    answer:
      "天气属于实时信息，小禾已经优先走了天气查询这条能力。如果这会儿没查成功，你可以直接说城市名再试一次，比如“兰州今天天气怎么样”。",
    cards: [],
    tips: "如果开启定位，小禾后面查天气会更方便一些。",
    guessQuestions: ["兰州今天天气怎么样？", "附近今天会下雨吗？", "这周末适合出去玩吗？"],
    followUp: ""
  }
}

function isWeatherRecommendationQuestion(question) {
  const text = normalizeText(question)
  return /(推荐|活动|景点|民宿|酒店|去哪|去哪里|安排|玩|适合这个天气|适合当前天气|适合今天|周边)/.test(text)
}

function buildCardLeadText(cards) {
  const titles = normalizeArray(cards).map((card) => normalizeText(card.title)).filter(Boolean).slice(0, 3)
  if (!titles.length) return ""
  if (titles.length === 1) return titles[0]
  if (titles.length === 2) return `${titles[0]}和${titles[1]}`
  return `${titles[0]}、${titles[1]}和${titles[2]}`
}

function pickWeatherFriendlyCards(cards, weatherAnswer) {
  const text = normalizeText(weatherAnswer)
  const isRainy = /(下雨|小雨|中雨|大雨|降水|雨天)/.test(text)
  const isCold = /(气温偏低|当前约\s*\d+°C|体感约\s*\d+°C)/.test(text) && /-?\d+°C/.test(text)
  const isSunny = /(晴|大体晴朗)/.test(text)

  const scored = normalizeArray(cards).map((card) => {
    const haystack = [
      normalizeText(card.title),
      normalizeText(card.summary),
      normalizeArray(card.tags).join(" ")
    ].join(" ")

    let score = 0
    if (isRainy) {
      if (/(手作|民宿|古镇|室内|慢逛|体验|美食|摄影)/.test(haystack)) score += 4
      if (/(徒步|采摘|草原|露营)/.test(haystack)) score -= 3
    }
    if (isCold) {
      if (/(民宿|手作|古镇|体验|美食)/.test(haystack)) score += 3
      if (/(草莓|采摘|徒步|草原|摄影)/.test(haystack)) score -= 1
    }
    if (isSunny) {
      if (/(采摘|摄影|徒步|草原|田园|观景)/.test(haystack)) score += 3
    }
    return { card, score }
  })

  return scored
    .sort((a, b) => b.score - a.score)
    .map((item) => item.card)
    .slice(0, 3)
}

function buildWeatherRecommendationResult(input, weatherResult, fallbackCards) {
  const cards = pickWeatherFriendlyCards(fallbackCards, weatherResult.answer)
  const weatherAnswer = normalizeText(weatherResult.answer)
  const tipsList = [normalizeText(weatherResult.tips)].filter(Boolean)

  if (!cards.length) {
    return {
      ok: true,
      answer: `${weatherAnswer} 如果你愿意，小禾也可以继续按你想去的类型，比如亲子、拍照、室内或轻徒步，再帮你缩小范围。`,
      cards: [],
      tips: tipsList[0] || "",
      guessQuestions: normalizeGuessQuestions(
        [
          "兰州周边还有什么适合当前天气的活动？",
          "兰州有没有更适合室内安排的去处？",
          "这种天气出门要准备什么？"
        ],
        weatherResult.guessQuestions
      ),
      followUp: ""
    }
  }

  const leadText = buildCardLeadText(cards)
  const firstCard = cards[0]
  const summary = normalizeText(firstCard && firstCard.summary)
  const question = normalizeText(input.question)
  const indoorHint = /(下雨|小雨|中雨|大雨|降水|雨天)/.test(weatherAnswer)
  const activityHint = /(活动|推荐|去哪|安排|玩)/.test(question)

  let recommendationText = `结合现在这个天气，小禾先给你推荐${leadText}。`
  if (summary) {
    recommendationText += `${firstCard.title}比较适合，${summary}`
  } else if (indoorHint) {
    recommendationText += "如果你想避雨，优先看室内体验、古镇慢逛或者节奏轻一点的安排会更稳妥。"
  } else if (activityHint) {
    recommendationText += "这种天气安排近郊慢游、轻体验或者拍照打卡都比较合适。"
  }

  if (indoorHint) {
    tipsList.unshift("下雨天出行记得带伞，尽量优先安排室内或路况更稳的路线。")
  }

  return {
    ok: true,
    answer: `${weatherAnswer} ${recommendationText}`.trim(),
    cards,
    tips: tipsList[0] || "",
    guessQuestions: normalizeGuessQuestions(
      [
        `${normalizeText(firstCard && firstCard.title) || "这个活动"}的具体内容是什么？`,
        "兰州还有哪些更适合当前天气的活动？",
        "这些安排需要提前预约吗？"
      ],
      weatherResult.guessQuestions
    ),
    followUp: ""
  }
}

async function buildWhereAmIResult(input) {
  let resolved = null

  if (input.location.latitude && input.location.longitude) {
    try {
      resolved = await reverseGeocoder({
        latitude: input.location.latitude,
        longitude: input.location.longitude
      })
    } catch (error) {
      console.error("[yuxiaoheAgent] reverseGeocoder failed", error)
    }
  }

  if (!resolved && (input.location.province || input.location.city || input.location.district)) {
    resolved = {
      province: input.location.province || "",
      city: input.location.city || "",
      district: input.location.district || "",
      locationText: ""
    }
  }

  if (!resolved) {
    try {
      resolved = await ipLocation("")
    } catch (error) {
      console.error("[yuxiaoheAgent] ipLocation failed", error)
    }
  }

  if (!resolved) {
    return {
      answer: "小禾这会儿还没拿到你的定位信息。你可以先开启定位权限，或者直接告诉我你所在的城市，小禾就能更准确地帮你看附近内容。",
      cards: [],
      tips: "开启定位后，小禾能更稳定地帮你识别当前位置和附近推荐。",
      guessQuestions: ["我附近有什么适合周末的活动？", "附近今天天气怎么样？", "兰州周边有什么适合拍照的地方？"],
      followUp: ""
    }
  }

  const locationLabel =
    [resolved.province, resolved.city, resolved.district].filter(Boolean).join("") ||
    resolved.locationText ||
    "你当前所在地区"

  return {
    answer: `小禾目前判断你大致在${locationLabel}。如果你愿意，我可以继续按这个位置帮你看附近活动、景点、民宿，或者顺便查一下天气。`,
    cards: [],
    tips: "定位结果可能会有少量误差，如果你想更准，也可以直接告诉我具体区县。",
    guessQuestions: ["附近今天天气怎么样？", "我附近有什么适合周末的活动？", "附近有没有适合拍照的景点？"],
    followUp: ""
  }
}

function formatLocationText(location) {
  return [location.province, location.city, location.district].filter(Boolean).join(" / ") || "none"
}

function formatUserProfileText(userProfile) {
  const nickname = normalizeText(userProfile.nickname)
  const dnaTags = normalizeArray(userProfile.dnaTags)
  const lines = []

  if (nickname) lines.push(`nickname: ${nickname}`)
  if (dnaTags.length) lines.push(`dnaTags: ${dnaTags.join(", ")}`)

  return lines.join("\n") || "none"
}

function formatPreferencesText(preferences) {
  const entries = Object.entries(preferences || {}).filter(([, value]) => normalizeText(value))
  if (!entries.length) return "none"
  return entries.map(([key, value]) => `${key}: ${value}`).join("\n")
}

function formatHistoryText(history) {
  if (!Array.isArray(history) || !history.length) return "none"
  return history.map((item) => `${item.role}: ${item.text}`).join("\n")
}

function formatCandidatesText(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return "none"

  return candidates.slice(0, 8).map((candidate, index) => {
    const card = candidate.card
    const lines = [
      `${index + 1}. [${card.type}] ${card.title || "内容"}`,
      `id: ${card.id || ""}`,
      `summary: ${card.summary || ""}`,
      `priceText: ${card.priceText || "none"}`,
      `regionText: ${card.regionText || "none"}`,
      `tags: ${normalizeArray(card.tags).slice(0, 5).join(", ")}`,
      `cover: ${card.cover || "/images/activities/lz-yuzhong-strawberry-family-day.jpg"}`
    ]

    return lines.join("\n")
  }).join("\n\n")
}

function formatWeatherContext(weatherResult) {
  if (!weatherResult || !weatherResult.ok) return ""

  return [
    `weather_answer: ${normalizeText(weatherResult.answer) || "none"}`,
    `weather_tips: ${normalizeText(weatherResult.tips) || "none"}`,
    `weather_follow_up: ${normalizeText(weatherResult.followUp) || "none"}`
  ].join("\n")
}

function getOpenAIClient() {
  if (!AI_API_KEY) {
    return null
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: AI_API_KEY,
      baseURL: AI_BASE_URL
    })
  }

  return openaiClient
}

function stripMarkdownFence(text) {
  return String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
}

function extractJsonObject(text) {
  const raw = stripMarkdownFence(text)
  const firstBrace = raw.indexOf("{")
  const lastBrace = raw.lastIndexOf("}")

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("model output does not contain a valid JSON object")
  }

  return raw.slice(firstBrace, lastBrace + 1)
}

function normalizeModelCards(cards, fallbackCards) {
  const allowedIds = new Set((fallbackCards || []).map((item) => item.id).filter(Boolean))
  const fallbackMap = new Map((fallbackCards || []).map((item) => [item.id, item]))

  return normalizeArray(cards)
    .map((item) => {
      const normalizedId = normalizeText(item && item.id)
      if (normalizedId && allowedIds.has(normalizedId)) {
        return fallbackMap.get(normalizedId)
      }
      return null
    })
    .filter(Boolean)
    .slice(0, 3)
}

function toUserQuestionStyle(text) {
  let normalized = normalizeText(text)
  if (!normalized) return ""

  normalized = normalized
    .replace(/^小禾[，,:：]?\s*/g, "")
    .replace(/^如果你愿意[，,:：]?\s*/g, "")
    .replace(/^要不要/g, "需要")
    .replace(/^是否/g, "要不要")
    .replace(/^能不能/g, "可以")
    .replace(/^可以帮你/g, "帮我")
    .replace(/^可以再帮你/g, "帮我再")
    .replace(/^需要帮你/g, "帮我")
    .replace(/^给你/g, "给我")
    .replace(/^为你/g, "为我")
    .replace(/^推荐你们/g, "给我们推荐")
    .replace(/^推荐你/g, "给我推荐")
    .replace(/^你们计划/g, "我们计划")
    .replace(/^你们想/g, "我们想")
    .replace(/^你想/g, "我想")
    .replace(/^对民宿的设施有什么特别要求吗$/, "民宿设施方面有什么值得重点看的吗")
    .replace(/^对美食体验感兴趣吗$/, "附近有没有适合顺便体验的美食")
    .replace(/^需要了解周边的游玩项目吗$/, "周边还有哪些适合一起安排的游玩项目")
    .replace(/^需要帮你们规划路线吗$/, "帮我们顺便规划一下路线吧")

  if (!/[？?]$/.test(normalized)) {
    const statementLike = /^(帮我|给我|我想|我们想|附近有|周边有|哪里有|哪种|哪个|哪些|有没有|要不要|可以|适合|民宿设施|周边还有)/
    if (statementLike.test(normalized)) {
      normalized = `${normalized}？`
    }
  }

  return normalized
}

function normalizeGuessQuestions(list, fallbackList) {
  const source = normalizeArray(list).length ? list : normalizeArray(fallbackList)
  return normalizeArray(source)
    .map((item) => toUserQuestionStyle(item))
    .filter(Boolean)
    .slice(0, 3)
}

function normalizeModelResult(raw, fallbackCards, fallbackResult) {
  return {
    answer: normalizeText(raw.answer) || fallbackResult.answer,
    cards: normalizeModelCards(raw.cards, fallbackCards),
    tips: normalizeText(raw.tips),
    guessQuestions: normalizeGuessQuestions(raw.guessQuestions, fallbackResult.guessQuestions),
    followUp: normalizeText(raw.followUp)
  }
}

function stripWeatherLead(answer) {
  return normalizeText(answer)
    .replace(/^[^。！？]*?(暂无|没有|没查到)[^。！？]*[。！？]?/, "")
    .replace(/^[^。！？]*?(实时天气|天气数据)[^。！？]*[。！？]?/, "")
    .trim()
}

function ensureWeatherAnswer(result, weatherResult) {
  if (!result || !weatherResult || !weatherResult.ok) return result

  const answer = normalizeText(result.answer)
  const weatherAnswer = normalizeText(weatherResult.answer)
  const lacksWeatherFacts = !/(°C|气温|体感|降水|风速|小雨|中雨|大雨|晴|阴|多云)/.test(answer)
  const deniesWeather = /(暂无|没有|没查到|查不到)[^。！？]*?(实时天气|天气数据|天气)/.test(answer)

  if (deniesWeather) {
    const rest = stripWeatherLead(answer)
    return {
      ...result,
      answer: rest ? `${weatherAnswer} ${rest}` : weatherAnswer
    }
  }

  if (lacksWeatherFacts) {
    return {
      ...result,
      answer: `${weatherAnswer} ${answer}`.trim()
    }
  }

  return result
}

async function requestModelAnswer(input, candidates, options = {}) {
  const client = getOpenAIClient()
  if (!client) {
    throw new Error("missing CLOUDBASE_API_KEY for AI model")
  }

  const fallbackCards = candidates.slice(0, 3).map((item) => item.card)
  const fallbackResult = options.fallbackResult || buildFallbackResult(input, fallbackCards)
  const prompt = buildGenericPrompt({
    question: input.question,
    historyText: formatHistoryText(input.history),
    locationText: formatLocationText(input.location),
    userProfileText: formatUserProfileText(input.userProfile),
    preferencesText: formatPreferencesText(input.preferences),
    weatherContext: normalizeText(options.weatherContext),
    candidatesText: formatCandidatesText(candidates)
  })

  const completion = await client.chat.completions.create({
    model: AI_MODEL,
    temperature: 0.7,
    messages: [
      { role: "system", content: basePersonaPrompt },
      { role: "system", content: outputSchemaPrompt },
      { role: "user", content: prompt }
    ]
  })

  const content =
    completion &&
    completion.choices &&
    completion.choices[0] &&
    completion.choices[0].message &&
    completion.choices[0].message.content

  if (!content) {
    throw new Error("DeepSeek returned empty content")
  }

  const parsed = JSON.parse(extractJsonObject(content))
  return normalizeModelResult(parsed, fallbackCards, fallbackResult)
}

async function loadCandidates(input) {
  let candidates = []
  let fallbackCards = []

  try {
    const candidateResult = await getContentCandidates(db, input)
    candidates = (candidateResult.candidates || []).map((item) => ({
      ...item,
      card: item.card || null
    }))
    fallbackCards = candidateResult.fallbackCards || []
  } catch (error) {
    console.error("[yuxiaoheAgent] getContentCandidates failed", error)
    candidates = []
    fallbackCards = []
  }

  candidates = candidates.map((item) => ({
    ...item,
    card: item.card || {
      id: "",
      type: item.type || "content",
      title: "",
      summary: "",
      priceText: "",
      regionText: "",
      tags: [],
      cover: "/images/activities/lz-yuzhong-strawberry-family-day.jpg"
    }
  }))

  return {
    candidates,
    fallbackCards
  }
}

exports.main = async function main(event) {
  console.warn("[yuxiaoheAgent] legacy implementation invoked; mainline agent service should be preferred")
  const input = parsePayload(event)
  const route = routeIntent(input.question)

  if (!input.question) {
    return {
      answer: "你可以直接告诉小禾想问什么，小禾先帮你理一理。",
      cards: [],
      tips: "",
      guessQuestions: [
        "附近有什么适合周末的",
        "有没有适合亲子的活动",
        "想找一个放松一点的去处"
      ],
      followUp: ""
    }
  }

  if (route.intent === "weather") {
    try {
      const weatherResult = await weatherTool(input)
      console.log("[yuxiaoheAgent] weather tool result", {
        ok: weatherResult && weatherResult.ok,
        answer: weatherResult && weatherResult.answer
      })
      if (!weatherResult.ok) {
        return buildWeatherFallbackResult(input)
      }

      const { candidates, fallbackCards } = await loadCandidates(input)
      if (isWeatherRecommendationQuestion(input.question)) {
        return buildWeatherRecommendationResult(input, weatherResult, fallbackCards)
      }

      try {
        const aiResult = await requestModelAnswer(input, candidates, {
          weatherContext: formatWeatherContext(weatherResult),
          fallbackResult: {
            ...weatherResult,
            guessQuestions: normalizeGuessQuestions(
              weatherResult.guessQuestions,
              buildWeatherFallbackResult(input).guessQuestions
            )
          }
        })
        return ensureWeatherAnswer(aiResult, weatherResult)
      } catch (aiError) {
        console.error("[yuxiaoheAgent] AI failed after weather tool, fallback to tool result", aiError)
        return weatherResult
      }
    } catch (error) {
      console.error("[yuxiaoheAgent] weather tool failed", error)
      return buildWeatherFallbackResult(input)
    }
  }

  if (route.intent === "where_am_i") {
    return buildWhereAmIResult(input)
  }

  const { candidates, fallbackCards } = await loadCandidates(input)

  try {
    const aiResult = await requestModelAnswer(input, candidates)
    console.log("[yuxiaoheAgent] AI success", {
      provider: AI_PROVIDER,
      model: AI_MODEL,
      cardCount: aiResult.cards.length
    })
    return aiResult
  } catch (error) {
    console.error("[yuxiaoheAgent] AI failed, fallback to local result", error)
    return buildFallbackResult(input, fallbackCards)
  }
}
