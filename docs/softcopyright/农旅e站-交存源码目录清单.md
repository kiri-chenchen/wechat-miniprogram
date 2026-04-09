# 农旅e站交存源码目录清单

## 1. 用途说明

本文档用于指导“农旅e站”软件著作权申请中源程序鉴别材料的整理顺序。目标是保留能够完整体现软件核心业务链路的代码，同时避免将依赖包、临时文件和无关文件纳入交存材料。

建议做法是先按照本文档整理一份“软著交存源码目录”，再基于该目录导出完整源码 PDF，最后截取前连续 30 页和后连续 30 页。

## 2. 建议纳入交存的源码范围

建议优先纳入以下三类代码：

1. 小程序入口与全局配置代码
2. 核心业务页面代码
3. 关键云函数代码

## 3. 推荐交存顺序

以下顺序可直接作为源码整理和 PDF 排版顺序。

### 3.1 小程序入口与基础配置

1. `miniprogram/app.js`
2. `miniprogram/app.json`
3. `miniprogram/app.wxss`
4. `miniprogram/envList.js`
5. `miniprogram/sitemap.json`
6. `miniprogram/config/agent.js`

### 3.2 公共组件与公共工具

1. `miniprogram/components/cloudTipModal/index.js`
2. `miniprogram/components/cloudTipModal/index.json`
3. `miniprogram/components/cloudTipModal/index.wxml`
4. `miniprogram/components/cloudTipModal/index.wxss`
5. `miniprogram/utils/activityCoverTags.js`
6. `miniprogram/utils/askConversationStore.js`
7. `miniprogram/utils/collectionStore.js`
8. `miniprogram/utils/knowledgeArticle.js`
9. `miniprogram/utils/mediaAssets.js`
10. `miniprogram/utils/messageStore.js`

### 3.3 首页与基础导航相关页面

1. `miniprogram/pages/home/home.js`
2. `miniprogram/pages/home/home.json`
3. `miniprogram/pages/home/home.wxml`
4. `miniprogram/pages/home/home.wxss`
5. `miniprogram/pages/message/message.js`
6. `miniprogram/pages/message/message.json`
7. `miniprogram/pages/message/message.wxml`
8. `miniprogram/pages/message/message.wxss`
9. `miniprogram/pages/cart/cart.js`
10. `miniprogram/pages/cart/cart.json`
11. `miniprogram/pages/cart/cart.wxml`
12. `miniprogram/pages/cart/cart.wxss`
13. `miniprogram/pages/me/me.js`
14. `miniprogram/pages/me/me.json`
15. `miniprogram/pages/me/me.wxml`
16. `miniprogram/pages/me/me.wxss`

### 3.4 用户登录与资料管理页面

1. `miniprogram/pages/login/login.js`
2. `miniprogram/pages/login/login.json`
3. `miniprogram/pages/login/login.wxml`
4. `miniprogram/pages/login/login.wxss`
5. `miniprogram/pages/registerProfile/registerProfile.js`
6. `miniprogram/pages/registerProfile/registerProfile.json`
7. `miniprogram/pages/registerProfile/registerProfile.wxml`
8. `miniprogram/pages/registerProfile/registerProfile.wxss`
9. `miniprogram/pages/travelerSelect/travelerSelect.js`
10. `miniprogram/pages/travelerSelect/travelerSelect.json`
11. `miniprogram/pages/travelerSelect/travelerSelect.wxml`
12. `miniprogram/pages/travelerSelect/travelerSelect.wxss`
13. `miniprogram/pages/travelerEdit/travelerEdit.js`
14. `miniprogram/pages/travelerEdit/travelerEdit.json`
15. `miniprogram/pages/travelerEdit/travelerEdit.wxml`
16. `miniprogram/pages/travelerEdit/travelerEdit.wxss`

### 3.5 活动与景点相关页面

1. `miniprogram/pages/activityDetail/activityDetail.js`
2. `miniprogram/pages/activityDetail/activityDetail.json`
3. `miniprogram/pages/activityDetail/activityDetail.wxml`
4. `miniprogram/pages/activityDetail/activityDetail.wxss`
5. `miniprogram/pages/book/book.js`
6. `miniprogram/pages/book/book.json`
7. `miniprogram/pages/book/book.wxml`
8. `miniprogram/pages/book/book.wxss`
9. `miniprogram/pages/activityOrderDetail/activityOrderDetail.js`
10. `miniprogram/pages/activityOrderDetail/activityOrderDetail.json`
11. `miniprogram/pages/activityOrderDetail/activityOrderDetail.wxml`
12. `miniprogram/pages/activityOrderDetail/activityOrderDetail.wxss`
13. `miniprogram/pages/activityReview/activityReview.js`
14. `miniprogram/pages/activityReview/activityReview.json`
15. `miniprogram/pages/activityReview/activityReview.wxml`
16. `miniprogram/pages/activityReview/activityReview.wxss`
17. `miniprogram/pages/scenicDetail/scenicDetail.js`
18. `miniprogram/pages/scenicDetail/scenicDetail.json`
19. `miniprogram/pages/scenicDetail/scenicDetail.wxml`
20. `miniprogram/pages/scenicDetail/scenicDetail.wxss`

### 3.6 酒店与住宿相关页面

1. `miniprogram/pages/hotel/hotel.js`
2. `miniprogram/pages/hotel/hotel.json`
3. `miniprogram/pages/hotel/hotel.wxml`
4. `miniprogram/pages/hotel/hotel.wxss`
5. `miniprogram/pages/hotelDetail/hotelDetail.js`
6. `miniprogram/pages/hotelDetail/hotelDetail.json`
7. `miniprogram/pages/hotelDetail/hotelDetail.wxml`
8. `miniprogram/pages/hotelDetail/hotelDetail.wxss`

### 3.7 商城与订单相关页面

1. `miniprogram/pages/mall/mall.js`
2. `miniprogram/pages/mall/mall.json`
3. `miniprogram/pages/mall/mall.wxml`
4. `miniprogram/pages/mall/mall.wxss`
5. `miniprogram/pages/productDetail/productDetail.js`
6. `miniprogram/pages/productDetail/productDetail.json`
7. `miniprogram/pages/productDetail/productDetail.wxml`
8. `miniprogram/pages/productDetail/productDetail.wxss`
9. `miniprogram/pages/order/order.js`
10. `miniprogram/pages/order/order.json`
11. `miniprogram/pages/order/order.wxml`
12. `miniprogram/pages/order/order.wxss`
13. `miniprogram/pages/myOrders/myOrders.js`
14. `miniprogram/pages/myOrders/myOrders.json`
15. `miniprogram/pages/myOrders/myOrders.wxml`
16. `miniprogram/pages/myOrders/myOrders.wxss`

### 3.8 收藏、评价与个人中心相关页面

1. `miniprogram/pages/favorites/favorites.js`
2. `miniprogram/pages/favorites/favorites.json`
3. `miniprogram/pages/favorites/favorites.wxml`
4. `miniprogram/pages/favorites/favorites.wxss`
5. `miniprogram/pages/favoritesEdit/favoritesEdit.js`
6. `miniprogram/pages/favoritesEdit/favoritesEdit.json`
7. `miniprogram/pages/favoritesEdit/favoritesEdit.wxml`
8. `miniprogram/pages/favoritesEdit/favoritesEdit.wxss`
9. `miniprogram/pages/reviewCenter/reviewCenter.js`
10. `miniprogram/pages/reviewCenter/reviewCenter.json`
11. `miniprogram/pages/reviewCenter/reviewCenter.wxml`
12. `miniprogram/pages/reviewCenter/reviewCenter.wxss`
13. `miniprogram/pages/myActivities/myActivities.js`
14. `miniprogram/pages/myActivities/myActivities.json`
15. `miniprogram/pages/myActivities/myActivities.wxml`
16. `miniprogram/pages/myActivities/myActivities.wxss`

### 3.9 内容与智能问答相关页面

1. `miniprogram/pages/academy/academy.js`
2. `miniprogram/pages/academy/academy.json`
3. `miniprogram/pages/academy/academy.wxml`
4. `miniprogram/pages/academy/academy.wxss`
5. `miniprogram/pages/knowledgeDetail/knowledgeDetail.js`
6. `miniprogram/pages/knowledgeDetail/knowledgeDetail.json`
7. `miniprogram/pages/knowledgeDetail/knowledgeDetail.wxml`
8. `miniprogram/pages/knowledgeDetail/knowledgeDetail.wxss`
9. `miniprogram/pages/askXiaohe/askXiaohe.js`
10. `miniprogram/pages/askXiaohe/askXiaohe.json`
11. `miniprogram/pages/askXiaohe/askXiaohe.wxml`
12. `miniprogram/pages/askXiaohe/askXiaohe.wxss`
13. `miniprogram/pages/askXiaoheChat/askXiaoheChat.js`
14. `miniprogram/pages/askXiaoheChat/askXiaoheChat.json`
15. `miniprogram/pages/askXiaoheChat/askXiaoheChat.wxml`
16. `miniprogram/pages/askXiaoheChat/askXiaoheChat.wxss`
17. `miniprogram/pages/qaCenter/qaCenter.js`
18. `miniprogram/pages/qaCenter/qaCenter.json`
19. `miniprogram/pages/qaCenter/qaCenter.wxml`
20. `miniprogram/pages/qaCenter/qaCenter.wxss`

### 3.10 消息与互动相关页面

1. `miniprogram/pages/messageInteraction/messageInteraction.js`
2. `miniprogram/pages/messageInteraction/messageInteraction.json`
3. `miniprogram/pages/messageInteraction/messageInteraction.wxml`
4. `miniprogram/pages/messageInteraction/messageInteraction.wxss`
5. `miniprogram/pages/messageMerchant/messageMerchant.js`
6. `miniprogram/pages/messageMerchant/messageMerchant.json`
7. `miniprogram/pages/messageMerchant/messageMerchant.wxml`
8. `miniprogram/pages/messageMerchant/messageMerchant.wxss`
9. `miniprogram/pages/messageMerchantChat/messageMerchantChat.js`
10. `miniprogram/pages/messageMerchantChat/messageMerchantChat.json`
11. `miniprogram/pages/messageMerchantChat/messageMerchantChat.wxml`
12. `miniprogram/pages/messageMerchantChat/messageMerchantChat.wxss`
13. `miniprogram/pages/messagePlatform/messagePlatform.js`
14. `miniprogram/pages/messagePlatform/messagePlatform.json`
15. `miniprogram/pages/messagePlatform/messagePlatform.wxml`
16. `miniprogram/pages/messagePlatform/messagePlatform.wxss`
17. `miniprogram/pages/messagePlatformSupport/messagePlatformSupport.js`
18. `miniprogram/pages/messagePlatformSupport/messagePlatformSupport.json`
19. `miniprogram/pages/messagePlatformSupport/messagePlatformSupport.wxml`
20. `miniprogram/pages/messagePlatformSupport/messagePlatformSupport.wxss`
21. `miniprogram/pages/messagePlatformGuarantee/messagePlatformGuarantee.js`
22. `miniprogram/pages/messagePlatformGuarantee/messagePlatformGuarantee.json`
23. `miniprogram/pages/messagePlatformGuarantee/messagePlatformGuarantee.wxml`
24. `miniprogram/pages/messagePlatformGuarantee/messagePlatformGuarantee.wxss`
25. `miniprogram/pages/messageConversation/messageConversation.js`
26. `miniprogram/pages/messageConversation/messageConversation.json`
27. `miniprogram/pages/messageConversation/messageConversation.wxml`
28. `miniprogram/pages/messageConversation/messageConversation.wxss`
29. `miniprogram/pages/messageBuddyApply/messageBuddyApply.js`
30. `miniprogram/pages/messageBuddyApply/messageBuddyApply.json`
31. `miniprogram/pages/messageBuddyApply/messageBuddyApply.wxml`
32. `miniprogram/pages/messageBuddyApply/messageBuddyApply.wxss`
33. `miniprogram/pages/messageBuddyApplyChat/messageBuddyApplyChat.js`
34. `miniprogram/pages/messageBuddyApplyChat/messageBuddyApplyChat.json`
35. `miniprogram/pages/messageBuddyApplyChat/messageBuddyApplyChat.wxml`
36. `miniprogram/pages/messageBuddyApplyChat/messageBuddyApplyChat.wxss`
37. `miniprogram/pages/buddyIntent/buddyIntent.js`
38. `miniprogram/pages/buddyIntent/buddyIntent.json`
39. `miniprogram/pages/buddyIntent/buddyIntent.wxml`
40. `miniprogram/pages/buddyIntent/buddyIntent.wxss`

### 3.11 核心云函数

1. `cloudfunctions/login/index.js`
2. `cloudfunctions/login/package.json`
3. `cloudfunctions/getactivities/index.js`
4. `cloudfunctions/getactivities/package.json`
5. `cloudfunctions/getactivitydetail/index.js`
6. `cloudfunctions/getactivitydetail/package.json`
7. `cloudfunctions/activityOrder/index.js`
8. `cloudfunctions/activityOrder/package.json`
9. `cloudfunctions/getknowledgearticles/index.js`
10. `cloudfunctions/getknowledgearticles/package.json`
11. `cloudfunctions/getknowledgearticledetail/index.js`
12. `cloudfunctions/getknowledgearticledetail/package.json`
13. `cloudfunctions/getMyOrders/index.js`
14. `cloudfunctions/getMyOrders/package.json`
15. `cloudfunctions/getMyOrderCounts/index.js`
16. `cloudfunctions/getMyOrderCounts/package.json`
17. `cloudfunctions/userManage/index.js`
18. `cloudfunctions/userManage/package.json`
19. `cloudfunctions/agent-yuxiaohe-1grmumm967563411/src/index.js`
20. `cloudfunctions/agent-yuxiaohe-1grmumm967563411/src/direct-answer.js`
21. `cloudfunctions/agent-yuxiaohe-1grmumm967563411/src/utils.js`
22. `cloudfunctions/agent-yuxiaohe-1grmumm967563411/package.json`

## 4. 建议不纳入交存的文件

以下文件或目录不建议放入交存 PDF：

1. 所有 `node_modules/`
2. 所有图片、图标和静态资源
3. `package-lock.json`
4. 调试文件，如 `tmp-debug.mjs`
5. 纯初始化或种子导入脚本，如 `seedActivities`、`seedHotels`、`seedProducts`、`seedScenics`
6. 旧方案或过渡方案代码，如 `xiaoheChat`、`yuxiaoheAgent`，除非你明确要体现旧版智能体能力

## 5. 最短路径建议

如果你想尽快完成交存材料，而不是把整套项目全部打印出来，建议最少保留以下文件集合：

1. 小程序入口文件
2. 首页模块
3. 活动详情模块
4. 酒店详情模块
5. 商城模块
6. 订单模块
7. 个人中心模块
8. 知识学院模块
9. 智能问答模块
10. 登录云函数
11. 活动查询云函数
12. 订单处理云函数
13. 用户管理云函数
14. 智能问答云函数

这种整理方式已经足够体现软件的主要功能闭环，更适合软著交存材料制作。

## 6. 实际操作建议

建议按以下步骤执行：

1. 在本地复制一份专门用于交存的源码目录
2. 按本文档顺序保留文件
3. 删除依赖包、静态资源和调试文件
4. 使用支持代码打印的编辑器导出完整 PDF
5. 检查页码后截取前 30 页和后 30 页
6. 合并生成最终的 `农旅e站_源程序鉴别材料.pdf`
