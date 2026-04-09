import { buildConversationStateResult } from './src/utils.js';

const contextPayload = {
  location: {
    province: '',
    city: '',
    district: '',
    displayName: '兰州大学(榆中校区)',
    locationText: '甘肃省兰州市榆中县夏官营镇人民政府向西880米',
    latitude: 35.94330593332986,
    longitude: 104.15807373046874
  },
  platformDataset: { activities: [], scenics: [], hotels: [], products: [] },
  currentTaskState: {
    mainline: '',
    subType: '',
    collected: {},
    missingField: '',
    lastAskedField: '',
    candidateIds: [],
    feedbackType: '',
    intentConfidence: 0
  },
  history: [
    { role: 'user', text: '帮我定制一个五一和男朋友去天水玩的攻略，预算3000吧' },
    { role: 'assistant', text: '小禾正在整理合适的内容' }
  ]
};

buildConversationStateResult({
  question: '帮我定制一个五一和男朋友去天水玩的攻略，预算3000吧',
  contextPayload,
  cloudbaseUserId: ''
}).then((result) => {
  console.log(JSON.stringify(result, null, 2));
}).catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
