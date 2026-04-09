Page({
  data: {
    text: {
      title: "问小禾",
      subtitle: "问附近推荐、玩法灵感和出行建议",
      introTitle: "和小禾聊聊你想怎么出发",
      introDesc:
        "无论你是想找附近活动、周末短途、亲子玩法，还是想按预算和偏好筛一轮，小禾都会先结合平台里的真实内容帮你收一收思路。",
      primaryAction: "开始和小禾聊",
      secondaryAction: "去搜索页看看",
      sectionTitle: "你可以这样问小禾",
    },
    exampleQuestions: [
      "兰州周边这周末有什么适合放松的地方？",
      "想带家人去近一点的农旅活动，有推荐吗？",
      "如果下雨，小禾会更建议去哪里？",
    ],
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }

    wx.navigateTo({
      url: "/pages/search/search",
    });
  },

  goChat() {
    wx.navigateTo({
      url: "/pages/askXiaoheChat/askXiaoheChat",
    });
  },

  goSearch() {
    wx.navigateTo({
      url: "/pages/search/search",
    });
  },

  useExample(e) {
    const question = e.currentTarget.dataset.question || "";
    if (!question) return;

    wx.navigateTo({
      url: `/pages/askXiaoheChat/askXiaoheChat?q=${encodeURIComponent(question)}`,
    });
  },
});
