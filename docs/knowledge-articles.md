# 农旅宝典文章集合说明

## 集合名

`knowledgeArticles`

## 最小必填字段

- `channel`: 文章频道，取值 `agri`、`culture` 或 `redtour`
- `status`: 发布状态，前端当前只读取 `published`
- `title`: 文章标题
- `publishTime`: 发布时间文本，建议格式 `2026-03-19 10:30`
- `tags`: 字符串数组，例如 `["种植", "农技"]`
- `wordCount`: 字数，数字
- `summary`: 摘要
- `cover`: 云存储文件 ID 或可直接访问的图片地址
- `author`: 作者名
- `content`: 正文数组

## 可选字段

- `views`: 阅读数，数字
- `likes`: 点赞数，数字
- `favorites`: 收藏数，数字
- `comments`: 评论数，数字
- `shareCount`: 分享数，数字
- `isPinned`: 是否置顶，布尔值
- `updatedAt`: 更新时间
- `commentList`: 评论数组
- `location`: 地点对象

## 正文内容结构

正文字段 `content` 是数组，每一项支持三种类型：

1. 段落

```json
{
  "type": "paragraph",
  "text": "这里是一段正文。"
}
```

2. 小标题

```json
{
  "type": "heading",
  "text": "一、播种前准备"
}
```

3. 配图

```json
{
  "type": "image",
  "src": "cloud://你的环境ID/knowledge/covers/example.jpg"
}
```

兼容写法：

- 小标题也支持 `type: "h2"`
- 图片也支持 `type: "img"`

## 地点结构

```json
{
  "name": "百花谷示范园",
  "address": "甘肃省某市某区某路",
  "latitude": 35.123,
  "longitude": 103.456
}
```

## 示例文档

```json
{
  "channel": "agri",
  "status": "published",
  "title": "春季蔬菜种植指南：从整地到移栽一次讲清",
  "publishTime": "2026-03-19 10:30",
  "tags": ["种植", "农技"],
  "wordCount": 1268,
  "summary": "适合乡村农户和家庭菜园的新手入门文章。",
  "cover": "cloud://你的环境ID/knowledge/covers/spring-vegetable.jpg",
  "views": 320,
  "likes": 96,
  "favorites": 42,
  "comments": 12,
  "shareCount": 8,
  "author": "农旅e站运营部",
  "isPinned": false,
  "content": [
    {
      "type": "paragraph",
      "text": "春耕时节，蔬菜种植要先把土壤条件摸清楚。"
    },
    {
      "type": "heading",
      "text": "一、播种前准备"
    },
    {
      "type": "image",
      "src": "cloud://你的环境ID/knowledge/content/seed-prepare.jpg"
    }
  ],
  "location": {
    "name": "百花谷示范园",
    "address": "甘肃省某市某区某路",
    "latitude": 35.123,
    "longitude": 103.456
  },
  "commentList": [],
  "updatedAt": "2026-03-19 10:30"
}
```

## 维护约束

- 删除文章时，直接在控制台删除对应文档即可，前端列表会自动消失。
- 下线文章时，把 `status` 改为非 `published` 即可。
- 更换封面或正文配图时，只需要更新云文件 ID，不需要改前端代码。
