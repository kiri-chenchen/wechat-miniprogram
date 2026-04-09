import https from "https";
import {
  MAINLINE,
  buildConversationWorkflow,
  detectMainline,
  normalizeText,
} from "./utils.js";

const WEATHER_KEYWORDS = [
  "天气",
  "气温",
  "温度",
  "下雨",
  "降雨",
  "雨吗",
  "冷不冷",
  "热不热",
  "穿什么",
  "穿啥",
  "天气预报",
];

const LOCATION_KEYWORDS = [
  "我在哪",
  "我现在在哪",
  "当前位置",
  "定位",
  "我的位置",
];

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number)) : "";
}

function routeIntent(question) {
  const text = normalizeText(question);
  if (!text) return { intent: "empty" };
  if (WEATHER_KEYWORDS.some((keyword) => text.includes(keyword))) return { intent: "weather" };
  if (LOCATION_KEYWORDS.some((keyword) => text.includes(keyword))) return { intent: "where_am_i" };
  return { intent: "other" };
}

function stripWeatherTerms(question = "") {
  return normalizeText(question)
    .replace(/(今天天气怎么样|天气怎么样|天气如何|天气咋样)/g, "")
    .replace(/(今天|现在|这两天|这周末|天气|气温|温度|会下雨|下雨|冷不冷|热不热|怎么样|如何|咋样|适合穿什么)/g, "")
    .replace(/^(请问|帮我看下|帮我看看|帮我查下|帮我查查)/g, "")
    .trim();
}

function detectExplicitPlace(question = "") {
  const cleaned = stripWeatherTerms(question);
  if (!cleaned) return "";

  const exactAdminMatch = cleaned.match(/([\u4e00-\u9fa5]{2,12}(?:省|市|州|县|区))/u);
  if (exactAdminMatch?.[1]) return exactAdminMatch[1];

  return cleaned.split(/[,\uFF0C\u3002\uFF1F?!()\s]/u).find(Boolean) || "";
}

async function placeSuggestion(keyword, region = "") {
  const apiKey = process.env.TENCENT_MAP_KEY || process.env.TENCENT_MAP_API_KEY || "";
  if (!apiKey || !keyword) return [];

  const params = new URLSearchParams({
    key: apiKey,
    keyword,
    region,
    region_fix: "0",
    page_size: "10",
  });

  const url = `https://apis.map.qq.com/ws/place/v1/suggestion?${params.toString()}`;
  const result = await requestJson(url);
  if (result?.status !== 0 || !Array.isArray(result?.data)) return [];

  return result.data.map((item) => ({
    title: item.title || "",
    adcode: item.adcode || "",
    province: item.province || "",
    city: item.city || "",
    district: item.district || "",
    latitude: item.location?.lat || "",
    longitude: item.location?.lng || "",
  }));
}

async function reverseGeocoder({ latitude, longitude }) {
  const apiKey = process.env.TENCENT_MAP_KEY || process.env.TENCENT_MAP_API_KEY || "";
  if (!apiKey || !latitude || !longitude) return null;

  const params = new URLSearchParams({
    key: apiKey,
    location: `${latitude},${longitude}`,
    get_poi: "0",
  });

  const url = `https://apis.map.qq.com/ws/geocoder/v1/?${params.toString()}`;
  const result = await requestJson(url);
  if (result?.status !== 0 || !result?.result) return null;

  const component = result.result.address_component || {};
  const location = result.result.location || {};
  return {
    province: component.province || "",
    city: component.city || "",
    district: component.district || "",
    locationText: result.result.address || "",
    adcode: component.adcode || "",
    location: {
      lat: location.lat || "",
      lng: location.lng || "",
    },
  };
}

async function ipLocation() {
  const apiKey = process.env.TENCENT_MAP_KEY || process.env.TENCENT_MAP_API_KEY || "";
  if (!apiKey) return null;

  const url = `https://apis.map.qq.com/ws/location/v1/ip?key=${encodeURIComponent(apiKey)}`;
  const result = await requestJson(url);
  if (result?.status !== 0 || !result?.result) return null;

  const adInfo = result.result.ad_info || {};
  const location = result.result.location || {};
  return {
    province: adInfo.province || "",
    city: adInfo.city || "",
    district: adInfo.district || "",
    locationText: [adInfo.province, adInfo.city, adInfo.district].filter(Boolean).join(""),
    adcode: adInfo.adcode || "",
    location: {
      lat: location.lat || "",
      lng: location.lng || "",
    },
  };
}

async function resolveLocation(contextPayload = {}, question = "") {
  const location = contextPayload.location || {};
  const explicitPlace = detectExplicitPlace(question);
  const region = [location.province, location.city, location.district].filter(Boolean).join("");

  if (explicitPlace) {
    const suggestion = await placeSuggestion(explicitPlace, region || explicitPlace);
    if (suggestion.length) {
      const picked = suggestion[0];
      return {
        label: [picked.province, picked.city, picked.district].filter(Boolean).join("") || picked.title,
        province: picked.province,
        city: picked.city,
        district: picked.district,
        adcode: picked.adcode,
        latitude: picked.latitude,
        longitude: picked.longitude,
      };
    }
  }

  if (location.latitude && location.longitude) {
    const reversed = await reverseGeocoder({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    if (reversed) {
      return {
        label: [reversed.province, reversed.city, reversed.district].filter(Boolean).join("") || reversed.locationText,
        province: reversed.province,
        city: reversed.city,
        district: reversed.district,
        adcode: reversed.adcode,
        latitude: reversed.location?.lat,
        longitude: reversed.location?.lng,
      };
    }
  }

  if (location.city || location.district) {
    const fallbackKeyword = normalizeText(location.city || location.district);
    const suggestion = await placeSuggestion(fallbackKeyword, region);
    if (suggestion.length) {
      const picked = suggestion[0];
      return {
        label: [picked.province, picked.city, picked.district].filter(Boolean).join("") || picked.title,
        province: picked.province,
        city: picked.city,
        district: picked.district,
        adcode: picked.adcode,
        latitude: picked.latitude,
        longitude: picked.longitude,
      };
    }
  }

  const ipResolved = await ipLocation();
  if (ipResolved) {
    return {
      label: [ipResolved.province, ipResolved.city, ipResolved.district].filter(Boolean).join("") || ipResolved.locationText,
      province: ipResolved.province,
      city: ipResolved.city,
      district: ipResolved.district,
      adcode: ipResolved.adcode,
      latitude: ipResolved.location?.lat,
      longitude: ipResolved.location?.lng,
    };
  }

  return null;
}

async function fetchOpenMeteoWeather(latitude, longitude) {
  const url =
    "https://api.open-meteo.com/v1/forecast?forecast_days=1&timezone=Asia%2FShanghai" +
    `&latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max";

  return requestJson(url);
}

function mapWeatherCode(code) {
  const mapping = {
    0: "晴",
    1: "大体晴朗",
    2: "多云",
    3: "阴",
    45: "有雾",
    48: "雾凇",
    51: "小毛毛雨",
    53: "毛毛雨",
    55: "较强毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    80: "小阵雨",
    81: "阵雨",
    82: "强阵雨",
    95: "雷阵雨",
  };
  return mapping[Number(code)] || "天气情况待确认";
}

function buildWeatherAnswer(locationLabel, weatherData) {
  const current = weatherData?.current || {};
  const daily = weatherData?.daily || {};
  const weatherText = mapWeatherCode(current.weather_code);
  const temp = formatNumber(current.temperature_2m);
  const feelTemp = formatNumber(current.apparent_temperature);
  const minTemp = Array.isArray(daily.temperature_2m_min) ? formatNumber(daily.temperature_2m_min[0]) : "";
  const maxTemp = Array.isArray(daily.temperature_2m_max) ? formatNumber(daily.temperature_2m_max[0]) : "";
  const rainProb = Array.isArray(daily.precipitation_probability_max)
    ? formatNumber(daily.precipitation_probability_max[0])
    : "";
  const wind = formatNumber(current.wind_speed_10m);

  const metrics = [];
  if (temp) metrics.push(`当前约 ${temp}°C`);
  if (feelTemp) metrics.push(`体感约 ${feelTemp}°C`);
  if (minTemp && maxTemp) metrics.push(`今天 ${minTemp}°C - ${maxTemp}°C`);
  if (wind) metrics.push(`风速约 ${wind} km/h`);

  const parts = [];
  parts.push(`${locationLabel}今天${weatherText ? `大致是${weatherText}` : "天气已更新"}${metrics.length ? `，${metrics.join("，")}` : ""}。`);

  if (rainProb) {
    const rainNumber = Number(rainProb);
    if (Number.isFinite(rainNumber) && rainNumber >= 60) {
      parts.push(`今天降水概率较高，大约 ${rainProb}% ，建议带伞。`);
    } else if (Number.isFinite(rainNumber) && rainNumber >= 30) {
      parts.push(`今天有一定降水概率，大约 ${rainProb}% ，出门前可以留意天气变化。`);
    } else {
      parts.push(`今天降水概率不高，大约 ${rainProb}%。`);
    }
  }

  if (temp) {
    const tempNumber = Number(temp);
    if (tempNumber <= 8) {
      parts.push("气温偏低，建议穿外套或稍厚一点的衣服。");
    } else if (tempNumber >= 28) {
      parts.push("体感可能偏热，注意补水和防晒。");
    } else {
      parts.push("整体体感相对适中，按日常出行穿着准备就行。");
    }
  }

  return parts.join("");
}

async function buildWeatherDirectResponse(question, contextPayload = {}) {
  const result = await buildWeatherQueryResult({
    question,
    contextPayload,
  });
  return result.answer;
}

async function buildWhereAmIDirectResponse(contextPayload = {}) {
  const result = await buildLocationQueryResult({
    contextPayload,
  });
  return result.answer;
}

export async function buildWeatherQueryResult({
  question = "",
  contextPayload = {},
} = {}) {
  const resolved = await resolveLocation(contextPayload, question);
  if (!resolved) {
    return {
      success: false,
      subType: "weather",
      resolvedLocation: null,
      weather: null,
      answer: "实时天气暂不可用，因为我还没能准确识别你要查询的地区。你可以直接说城市名，比如“兰州今天天气怎么样”。",
    };
  }

  if (!resolved.latitude || !resolved.longitude) {
    return {
      success: false,
      subType: "weather",
      resolvedLocation: {
        label: normalizeText(resolved.label),
        province: normalizeText(resolved.province),
        city: normalizeText(resolved.city),
        district: normalizeText(resolved.district),
        adcode: normalizeText(resolved.adcode),
        latitude: normalizeText(resolved.latitude),
        longitude: normalizeText(resolved.longitude),
      },
      weather: null,
      answer: `我已经识别到你想问的大概地区是${resolved.label || "目标地区"}，但位置坐标还没拿到，所以实时天气暂不可用。你可以换一个更具体的区县名再试一次。`,
    };
  }

  try {
    const weatherData = await fetchOpenMeteoWeather(resolved.latitude, resolved.longitude);
    const locationLabel = normalizeText(resolved.label) || "你当前所在地区";
    const current = weatherData?.current || {};
    const daily = weatherData?.daily || {};

    return {
      success: true,
      subType: "weather",
      resolvedLocation: {
        label: normalizeText(resolved.label),
        province: normalizeText(resolved.province),
        city: normalizeText(resolved.city),
        district: normalizeText(resolved.district),
        adcode: normalizeText(resolved.adcode),
        latitude: normalizeText(resolved.latitude),
        longitude: normalizeText(resolved.longitude),
      },
      weather: {
        weatherText: mapWeatherCode(current.weather_code),
        temperature: formatNumber(current.temperature_2m),
        apparentTemperature: formatNumber(current.apparent_temperature),
        minTemperature: Array.isArray(daily.temperature_2m_min) ? formatNumber(daily.temperature_2m_min[0]) : "",
        maxTemperature: Array.isArray(daily.temperature_2m_max) ? formatNumber(daily.temperature_2m_max[0]) : "",
        precipitationProbability: Array.isArray(daily.precipitation_probability_max)
          ? formatNumber(daily.precipitation_probability_max[0])
          : "",
        windSpeed: formatNumber(current.wind_speed_10m),
      },
      answer: buildWeatherAnswer(locationLabel, weatherData),
    };
  } catch (error) {
    return {
      success: false,
      subType: "weather",
      resolvedLocation: {
        label: normalizeText(resolved.label),
        province: normalizeText(resolved.province),
        city: normalizeText(resolved.city),
        district: normalizeText(resolved.district),
        adcode: normalizeText(resolved.adcode),
        latitude: normalizeText(resolved.latitude),
        longitude: normalizeText(resolved.longitude),
      },
      weather: null,
      answer: "实时天气暂不可用，刚才查询天气服务时失败了。你可以稍后再试。",
    };
  }
}

export async function buildLocationQueryResult({
  contextPayload = {},
} = {}) {
  const resolved = await resolveLocation(contextPayload, "");
  if (!resolved) {
    return {
      success: false,
      subType: "location",
      resolvedLocation: null,
      answer: "当前位置信息暂时不可用，请稍后再试。你可以先开启定位权限，或者直接告诉我你所在的城市。",
    };
  }

  const label =
    normalizeText(resolved.label) ||
    [resolved.province, resolved.city, resolved.district].filter(Boolean).join("") ||
    "你当前所在地区";

  return {
    success: true,
    subType: "location",
    resolvedLocation: {
      label: normalizeText(label),
      province: normalizeText(resolved.province),
      city: normalizeText(resolved.city),
      district: normalizeText(resolved.district),
      adcode: normalizeText(resolved.adcode),
      latitude: normalizeText(resolved.latitude),
      longitude: normalizeText(resolved.longitude),
    },
    answer: `我目前判断你大概在${label}。如果你想，我也可以继续帮你查这个地区的实时天气。`,
  };
}

function buildBuddyMissingFieldResponse(workflow = {}) {
  return workflow?.missingField?.ask || "我先帮你把这次找搭子的信息收清楚，你更想找什么样的同伴？";
}

function buildBuddyNoCandidateResponse() {
  return "当前没有合适候选。你可以补充一下时间、出发地或同行偏好，我再继续帮你缩小范围。";
}

function buildGuideMissingFieldResponse(workflow = {}) {
  return workflow?.missingField?.ask || "我先帮你把这次攻略信息收清楚，你打算什么时候去？";
}

function buildFeedbackDirectResponse(workflow = {}) {
  const feedbackType = workflow?.feedbackType || "产品反馈";
  if (feedbackType === "情绪倾诉") {
    return "我接住你现在这份情绪。你愿意的话，可以再告诉我刚刚最让你难受的点是什么，我会认真听。";
  }

  if (feedbackType === "平台建议") {
    return "这条建议我记下了。你要是愿意，可以再补一句你最希望它先改哪一处，我好把重点收得更准。";
  }

  return "我收到你的反馈了。要是你愿意，可以再补一点具体场景或步骤，这样我能更准确地整理问题。";
}

export async function buildDirectAnswer({
  question = "",
  contextPayload = {},
  cloudbaseUserId = "",
} = {}) {
  const route = routeIntent(question);
  if (route.intent === "weather") {
    return buildWeatherDirectResponse(question, contextPayload);
  }
  if (route.intent === "where_am_i") {
    return buildWhereAmIDirectResponse(contextPayload);
  }

  const mainline = detectMainline(question, contextPayload);
  const workflow = await buildConversationWorkflow({
    question,
    contextPayload,
    cloudbaseUserId,
  });

  console.log("[agent-yuxiaohe] buildDirectAnswer", {
    question: normalizeText(question),
    mainline,
    isReady: workflow?.isReady,
    missingField: workflow?.missingField?.key || workflow?.missingField?.label || "",
    collected: workflow?.fields || {},
    feedbackType: workflow?.feedbackType || "",
  });

  if (mainline === MAINLINE.BUDDY) {
    if (!workflow.isReady) {
      return buildBuddyMissingFieldResponse(workflow);
    }

    if (!workflow.buddyCandidates?.length) {
      return buildBuddyNoCandidateResponse();
    }

    return "";
  }

  if (mainline === MAINLINE.GUIDE && !workflow.isReady) {
    return buildGuideMissingFieldResponse(workflow);
  }

  if (mainline === MAINLINE.FEEDBACK && normalizeText(question).length <= 18) {
    return buildFeedbackDirectResponse(workflow);
  }

  return "";
}
