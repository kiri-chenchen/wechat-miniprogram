import https from "https";
import {
  buildPlatformGroundingContext,
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
  "刮风",
  "风大",
  "穿什么",
  "穿啥",
  "天气预报",
];

const LOCATION_KEYWORDS = [
  "我在哪",
  "我现在在哪",
  "我现在在哪里",
  "当前位置",
  "你知道我在哪",
  "知道我现在在哪",
  "我在什么地方",
  "我在哪儿",
];

function normalizeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

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

  if (!text) {
    return { intent: "empty" };
  }

  if (WEATHER_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return { intent: "weather" };
  }

  if (LOCATION_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return { intent: "where_am_i" };
  }

  return { intent: "agent" };
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
  if (exactAdminMatch && exactAdminMatch[1]) {
    return exactAdminMatch[1];
  }

  const firstPhrase = cleaned.split(/[,\uFF0C\u3002\uFF1F?!()\s]/u).find(Boolean);
  return normalizeText(firstPhrase);
}

async function placeSuggestion(keyword, region = "") {
  const apiKey = process.env.TENCENT_MAP_KEY || process.env.TENCENT_MAP_API_KEY || "";
  if (!apiKey || !keyword) {
    return [];
  }

  const params = new URLSearchParams({
    key: apiKey,
    keyword,
    region,
    region_fix: "0",
    page_size: "10",
  });
  const url = `https://apis.map.qq.com/ws/place/v1/suggestion?${params.toString()}`;
  const result = await requestJson(url);
  if (result?.status !== 0 || !Array.isArray(result?.data)) {
    return [];
  }

  return result.data.map((item) => ({
    title: item.title || "",
    id: item.id || "",
    adcode: item.adcode || "",
    province: item.province || "",
    city: item.city || "",
    district: item.district || "",
    latitude: item.location?.lat || "",
    longitude: item.location?.lng || "",
    address: item.address || "",
    type: item.type || 0,
  }));
}

async function reverseGeocoder({ latitude, longitude }) {
  const apiKey = process.env.TENCENT_MAP_KEY || process.env.TENCENT_MAP_API_KEY || "";
  if (!apiKey || !latitude || !longitude) {
    return null;
  }

  const params = new URLSearchParams({
    key: apiKey,
    location: `${latitude},${longitude}`,
    get_poi: "0",
  });
  const url = `https://apis.map.qq.com/ws/geocoder/v1/?${params.toString()}`;
  const result = await requestJson(url);
  if (result?.status !== 0 || !result?.result) {
    return null;
  }

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
  if (!apiKey) {
    return null;
  }

  const url = `https://apis.map.qq.com/ws/location/v1/ip?key=${encodeURIComponent(apiKey)}`;
  const result = await requestJson(url);
  if (result?.status !== 0 || !result?.result) {
    return null;
  }

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
        explicitPlace,
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
        explicitPlace,
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
        explicitPlace,
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
      explicitPlace,
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
      parts.push(`今天有一定降水概率，大约 ${rainProb}% ，出门前可以留意一下天气变化。`);
    } else {
      parts.push(`今天降水概率不高，大约 ${rainProb}% 。`);
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

function pickWeatherFriendlyCandidates(candidates, weatherAnswer) {
  const answer = normalizeText(weatherAnswer);
  const isRainy = /(下雨|小雨|中雨|大雨|降水|阵雨)/.test(answer);
  const isCold = /(气温偏低|当前约\s*\d+°C|体感约\s*\d+°C)/.test(answer) && /-?\d+°C/.test(answer);
  const isSunny = /(晴|大体晴朗)/.test(answer);

  return normalizeArray(candidates)
    .map((candidate) => {
      const haystack = [
        normalizeText(candidate.title),
        normalizeText(candidate.summary),
        normalizeArray(candidate.tags).join(" "),
      ].join(" ");

      let score = 0;
      if (isRainy) {
        if (/(手作|民宿|古镇|室内|慢游|体验|美食|摄影)/.test(haystack)) score += 4;
        if (/(徒步|采摘|草原|露营)/.test(haystack)) score -= 3;
      }
      if (isCold) {
        if (/(民宿|手作|古镇|体验|美食)/.test(haystack)) score += 3;
        if (/(草莓|采摘|徒步|草原|摄影)/.test(haystack)) score -= 1;
      }
      if (isSunny) {
        if (/(采摘|摄影|徒步|草原|田园|观景)/.test(haystack)) score += 3;
      }

      return { candidate, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.candidate)
    .slice(0, 3);
}

function buildWeatherRecommendationText(candidates = []) {
  if (!candidates.length) {
    return "";
  }

  const names = candidates.map((item) => item.title).filter(Boolean).slice(0, 3);
  if (!names.length) {
    return "";
  }

  const leadText = names.length === 1 ? names[0] : `${names.slice(0, -1).join("、")} 和 ${names[names.length - 1]}`;
  const first = candidates[0];
  const summary = normalizeText(first?.summary);
  return `结合现在这个天气，小禾会优先建议你看看 ${leadText}。${summary ? `${first.title} 比较适合，${summary}` : "它们会比纯户外暴晒或受天气影响较大的安排更稳妥一些。"}`
}

async function buildWeatherDirectResponse(question, contextPayload = {}) {
  const resolved = await resolveLocation(contextPayload, question);
  if (!resolved) {
    return "小禾这会儿还没法准确判断你想查哪个地方的天气。你可以直接说“兰州今天天气怎么样”，或者先开启定位，小禾就能查得更准一些。";
  }

  if (!resolved.latitude || !resolved.longitude) {
    return `小禾已经识别到你想问的大概地区是 ${resolved.label || "目标地区"}，但目前还没拿到可用的天气坐标信息。你可以换一个更具体的区县名再试一次。`;
  }

  const weatherData = await fetchOpenMeteoWeather(resolved.latitude, resolved.longitude);
  const locationLabel = normalizeText(resolved.label) || "你当前所在地区";
  const weatherAnswer = buildWeatherAnswer(locationLabel, weatherData);
  const groundingContext = await buildPlatformGroundingContext({
    ...contextPayload,
    question,
    location: {
      ...(contextPayload.location || {}),
      province: resolved.province || contextPayload.location?.province || "",
      city: resolved.city || contextPayload.location?.city || "",
      district: resolved.district || contextPayload.location?.district || "",
      latitude: resolved.latitude || contextPayload.location?.latitude || "",
      longitude: resolved.longitude || contextPayload.location?.longitude || "",
    },
  });
  const weatherFriendly = pickWeatherFriendlyCandidates(groundingContext.candidates, weatherAnswer);
  const recommendationText = buildWeatherRecommendationText(weatherFriendly);

  return recommendationText ? `${weatherAnswer} ${recommendationText}` : weatherAnswer;
}

async function buildWhereAmIDirectResponse(contextPayload = {}) {
  const resolved = await resolveLocation(contextPayload, "");
  if (!resolved) {
    return "小禾这会儿还没拿到你的定位信息。你可以先开启定位权限，或者直接告诉我你所在的城市，小禾就能继续帮你看附近内容。";
  }

  const label =
    normalizeText(resolved.label) ||
    [resolved.province, resolved.city, resolved.district].filter(Boolean).join("") ||
    "你当前所在地区";

  return `小禾目前判断你大概在 ${label}。如果你愿意，我可以继续按这个位置帮你看附近活动、景点、民宿，或者顺便查一下天气。`;
}

export async function buildDirectAnswer({ question = "", contextPayload = {} } = {}) {
  const route = routeIntent(question);

  if (route.intent === "weather") {
    return buildWeatherDirectResponse(question, contextPayload);
  }

  if (route.intent === "where_am_i") {
    return buildWhereAmIDirectResponse(contextPayload);
  }

  return "";
}
