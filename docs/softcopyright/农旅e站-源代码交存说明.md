# 农旅e站源代码交存说明

## 1. 目的

本文档用于指导“农旅e站”软件著作权申请中的源程序鉴别材料整理工作，确保提交的源代码材料符合“一般交存”常见要求，并尽量与项目实际结构保持一致。

## 2. 交存方式建议

建议选择：

`程序鉴别材料：一般交存`

一般交存的常见整理方式为：

1. 提交源程序前连续 30 页
2. 提交源程序后连续 30 页
3. 合计约 60 页

如果整理后的源程序总页数不足 60 页，则通常全部提交。

## 3. 本项目建议纳入交存范围的代码

建议优先纳入以下核心源码：

1. `miniprogram/app.js`
2. `miniprogram/app.json`
3. `miniprogram/app.wxss`
4. `miniprogram/config/`
5. `miniprogram/pages/` 下主要业务页面源码
6. `cloudfunctions/` 下主要云函数源码

建议重点保留的业务模块包括：

1. 首页模块
2. 登录模块
3. 活动模块
4. 景点模块
5. 酒店模块
6. 商城模块
7. 订单模块
8. 收藏与评价模块
9. 知识学院模块
10. 智能问答模块
11. 用户中心模块

## 4. 不建议纳入交存范围的内容

以下内容通常不建议放入源程序鉴别材料：

1. `node_modules/`
2. 图片、图标等静态资源
3. 自动生成文件
4. 与程序逻辑无关的缓存文件
5. 第三方依赖源码
6. 临时脚本与调试缓存

## 5. 推荐的源码整理思路

为避免交存材料混乱，建议先单独整理一份“软著交存源码目录”，只保留核心代码文件，再基于该目录导出 PDF。推荐思路如下：

1. 保留小程序入口文件
2. 保留核心页面的 `.js`、`.json`、`.wxml`、`.wxss`
3. 保留配置文件和公共工具文件
4. 保留主要云函数的核心实现文件
5. 去除依赖包、图片和无关测试文件

## 6. 推荐的页面与功能覆盖

为了让鉴别材料能够体现软件完整功能，建议优先覆盖以下页面或功能代码：

1. `pages/home/home`
2. `pages/login/login`
3. `pages/activityDetail/activityDetail`
4. `pages/scenicDetail/scenicDetail`
5. `pages/hotel/hotel`
6. `pages/hotelDetail/hotelDetail`
7. `pages/mall/mall`
8. `pages/cart/cart`
9. `pages/order/order`
10. `pages/myOrders/myOrders`
11. `pages/academy/academy`
12. `pages/knowledgeDetail/knowledgeDetail`
13. `pages/askXiaohe/askXiaohe`
14. `pages/askXiaoheChat/askXiaoheChat`
15. `pages/me/me`

同时可配合主要云函数：

1. `cloudfunctions/login`
2. `cloudfunctions/getactivities`
3. `cloudfunctions/getactivitydetail`
4. `cloudfunctions/getknowledgearticles`
5. `cloudfunctions/getknowledgearticledetail`
6. `cloudfunctions/activityOrder`
7. `cloudfunctions/productCart`
8. `cloudfunctions/productOrder`
9. `cloudfunctions/userManage`
10. `cloudfunctions/agent-yuxiaohe-1grmumm967563411`

## 7. PDF 排版建议

源代码导出为 PDF 时，建议采用如下规范：

1. 使用 A4 页面
2. 使用等宽字体
3. 每页控制在约 50 行
4. 保留页码
5. 显示文件路径或文件名
6. 黑白打印效果需清晰可读
7. 代码不要用截图粘贴，尽量使用文本方式导出

## 8. 前 30 页与后 30 页的截取规则

正确的截取方法是：

1. 将整理后的完整源码按顺序排版并导出成完整 PDF
2. 从第 1 页开始连续保留前 30 页
3. 从最后 1 页向前连续保留后 30 页
4. 将前 30 页与后 30 页合并为最终提交 PDF

注意事项：

1. 不能随意从中间挑选 60 页替代
2. 前后页应连续
3. 如总页数不足 60 页，则提交全部源码页

## 9. 推荐的实际制作步骤

建议按以下顺序操作：

1. 复制一份用于交存的精简源码目录
2. 删除不需要的依赖和静态资源
3. 按文件顺序打印或导出为完整 PDF
4. 检查页码是否连续
5. 截取前 30 页和后 30 页
6. 合并为 `农旅e站_源程序鉴别材料.pdf`

## 10. 文件命名建议

建议统一使用以下命名：

1. `农旅e站_源程序鉴别材料.pdf`
2. `农旅e站_软件使用说明书.pdf`

## 11. 自查清单

提交前建议逐项确认：

1. 是否已去除 `node_modules`
2. 是否保留了核心业务代码
3. 是否覆盖主要业务模块和智能问答功能
4. 是否有页码
5. 是否可清晰阅读
6. 是否确实为前连续 30 页和后连续 30 页
7. 是否导出为 PDF 格式
