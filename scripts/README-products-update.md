# products 批量更新说明

本目录下的文件只用于本地一次性更新 `products` collection，不会改现有前端页面和云函数业务逻辑。

## 文件说明

- `scripts/data/products_update_payload.json`
  - 商品批量更新数据源
  - 通过 `seedKey` 匹配已有商品文档
  - 不包含 `_id`
- `scripts/update-products-by-seedkey.js`
  - 一次性批量更新脚本
  - 只更新 `products`
  - 不会 remove 文档
  - 不会新增不存在的商品

## 使用顺序

1. 先去云存储上传图片，拿到真实的 `cloud://` 地址
2. 把 `products_update_payload.json` 里的占位符替换掉：
   - `__CLOUD_URL__ATTACHMENT_1__`
   - `__CLOUD_URL__ATTACHMENT_2__`
   - ...
3. 先用 `DRY_RUN=true` 试跑
4. 确认日志无误后，再用 `DRY_RUN=false` 真更新

## 占位符替换要求

- `cover`、`banner`、`gallery` 里当前是占位字符串
- 必须替换成真实的 `cloud://` 文件地址
- `gallery` 必须保持为数组

## 执行前准备

在仓库根目录执行：

```powershell
npm install wx-server-sdk
```

如果你要指定云环境，可以设置：

```powershell
$env:CLOUD_ENV='cloud1-3ghmr5ki7b1172fe'
```

## 先试跑

```powershell
$env:DRY_RUN='true'
node scripts/update-products-by-seedkey.js
```

试跑时：
- 只查找 `seedKey`
- 只打印将要更新哪些字段
- 不会真的 update

## 再真更新

```powershell
$env:DRY_RUN='false'
node scripts/update-products-by-seedkey.js
```

真更新时：
- 用 `seedKey` 查找已有商品
- 找到后按 payload 字段执行 update
- 不会改 `_id`
- 不会 remove 文档
- 如果 `seedKey` 不存在，只会打印 `skipped`

## 执行后建议

更新完成后，建议清空旧购物车并重新加购测试。

原因：
- `cartItems` 里有 `productSnapshot`
- 旧购物车快照不会自动回写成新商品内容

## 建议测试路径

按下面顺序回归：

1. 商城列表
2. 商品详情
3. 加入购物车
4. 确认订单
5. mock 支付
6. 商品订单详情

## 重要提醒

- 不要删旧商品再重建
- 优先按原文档 update
- 不要改 `merchantOpenid`
- 不要把价格改成元字符串，仍然保持分为单位整数
- 不要删这些关键字段：
  - `title`
  - `cover`
  - `gallery`
  - `price`
  - `stock`
  - `status`
  - `merchantOpenid`
  - `merchantName`
