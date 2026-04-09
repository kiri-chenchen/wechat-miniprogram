# 红旅文章导入说明

## 需要先上传的图片

按下面路径上传到当前云环境：

- `knowledge/covers/redtour-shenjialing-gongjian-cover.jpg`
- `knowledge/covers/redtour-xuezhan-shenjialing-cover.jpg`
- `knowledge/content/redtour-shenjialing-gongjian-1.jpg`
- `knowledge/content/redtour-shenjialing-gongjian-2.jpg`

本地文件与云路径映射见：

- [`redTourArticleMedia.upload-map.json`](/E:/三创赛/docs/redTourArticleMedia.upload-map.json)

## 导入文章

1. 在微信开发者工具中上传并部署云函数 [`seedKnowledgeArticles`](/E:/三创赛/cloudfunctions/seedKnowledgeArticles/index.js)
2. 运行该云函数一次
3. 云函数会把两篇 `redtour` 文章幂等写入 `knowledgeArticles` 集合

## 导入结果

- 首次运行：返回 `created: 2`
- 再次运行：返回 `updated: 2`

## 文章源文件

- [`redTourKnowledgeArticles.import.json`](/E:/三创赛/docs/redTourKnowledgeArticles.import.json)
- [`redTourKnowledgeArticles.import.lines.json`](/E:/三创赛/docs/redTourKnowledgeArticles.import.lines.json)
