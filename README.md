# 农旅e站微信小程序

一个基于微信云开发的农旅服务小程序仓库，包含小程序前端、云函数、文档资料以及本地 Agent 调试代码。

## 项目结构

```text
.
├─ miniprogram/              # 小程序前端代码
├─ cloudfunctions/           # 微信云函数
├─ docs/                     # 项目文档与导入数据
├─ agent-yuxiaohe-local/     # 本地 Agent 调试代码
├─ project.config.json       # 微信开发者工具项目配置
└─ uploadCloudFunction.sh    # 云函数上传脚本
```

## 当前功能范围

- 首页、消息、购物车、我的等基础页面
- 活动、酒店、景点、商城等农旅业务页面
- 收藏、订单、报名、评价等用户流程
- 知识学院与内容详情页
- `askXiaohe` / `askXiaoheChat` 智能问答能力
- 基于云函数的登录、内容查询、下单、用户管理等服务

## 开发环境

- 微信开发者工具
- 微信云开发环境
- Node.js 18 及以上

## 本地启动

### 1. 克隆仓库

```bash
git clone https://github.com/kiri-chenchen/wechat-miniprogram.git
cd wechat-miniprogram
```

### 2. 用微信开发者工具打开项目

- 打开微信开发者工具
- 选择“导入项目”
- 项目目录选择当前仓库根目录
- `AppID` 使用 [`project.config.json`](/E:/三创赛/project.config.json) 中的配置，或按你的开发账号重新绑定

### 3. 配置云开发环境

- 在微信开发者工具中确认已开通云开发
- 检查云环境 ID 是否与当前项目一致
- 按需部署 [`cloudfunctions/`](/E:/三创赛/cloudfunctions) 下的云函数

### 4. 本地 Agent 调试

如果需要调试本地 Agent：

```bash
cd agent-yuxiaohe-local
npm install
```

然后基于 `.env.example` 或你自己的本地配置创建 `.env` 文件。`.env` 已被仓库忽略，不会上传。

## 云函数说明

常用云函数目录位于 [`cloudfunctions/`](/E:/三创赛/cloudfunctions)：

- `login`：登录与身份初始化
- `getactivities` / `getactivitydetail`：活动查询
- `getknowledgearticles` / `getknowledgearticledetail`：知识内容查询
- `activityOrder`：活动报名与订单流程
- `userManage`：用户管理
- `xiaoheChat` / `yuxiaoheAgent`：智能问答能力

部分云函数依赖第三方服务或云环境配置，部署前请先核对环境变量与账号权限。

## 需要保护的本地配置

以下内容不要提交到仓库：

- `project.private.config.json`
- 任意 `.env` 文件
- 微信开发者工具本地缓存
- 构建产物与临时文件

## 提交流程

```bash
git add .
git commit -m "feat: xxx"
git push
```

## 仓库协作建议

- 功能开发走分支，不直接在 `main` 上堆叠大改动
- 合并前至少自己完整跑一遍关键页面和关键云函数
- 涉及密钥、环境变量、私有配置时，一律只放本地，不入库
