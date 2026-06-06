# Telegram Uploader API 文档

Base URL: `https://telegram-uploader-4an.pages.dev`

所有请求均需在 Header 中携带 `Authorization: Bearer <api_key>`，`/api/register` 除外。

---

## 1. 注册

获取 API Key，用于后续接口鉴权。

```
POST /api/register
Content-Type: application/json
```

**请求体：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 用户名 |
| `code` | string | 否 | 注册码（首用户无需，后续需管理员提供） |

**响应 `201`（首用户）：**

```json
{
  "api_key": "tk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "is_admin": true
}
```

**响应 `201`（非首用户，使用注册码）：**

```json
{
  "api_key": "tk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**错误响应：**

```json
{ "error": "Name is required" }
{ "error": "Registration code is required" }
{ "error": "Invalid or already used registration code" }
```

---

## 2. 用户统计与上传历史

获取当前用户的统计数据及上传记录（支持分页）。

```
GET /api/user/stats
Authorization: Bearer <api_key>
```

**查询参数：**

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `page` | int | 1 | 页码，从 1 开始 |
| `limit` | int | 50 | 每页条数 |

**响应 `200`：**

```json
{
  "user": {
    "id": 5,
    "name": "liyk",
    "api_key": "tk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "is_admin": 1,
    "upload_count": 6,
    "total_size": 123456789,
    "created_at": "2026-06-04 13:25:32"
  },
  "uploads": [
    {
      "id": 1,
      "file_name": "video.mp4.cas",
      "file_size": 1234567890,
      "caption": "Season 1/Episode 5/\n\ntest upload",
      "file_path": "Season 1/Episode 5/",
      "content_hash": "8c12087e075aec6843e13ad93e98a64e",
      "slice_md5": "563f659c0bd0b5f007a504622a40ebc3",
      "status": "success",
      "created_at": "2026-06-04 14:18:32"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 50
}
```

`total` 为该用户总上传记录数，`page`/`limit` 为当前请求的分页参数。

---

## 3. 单文件上传

上传 `.cas` 文件到 Telegram 频道。文件内容必须为 base64 编码的 JSON，需包含 `md5` 和 `size` 字段。

```
POST /api/upload
Authorization: Bearer <api_key>
Content-Type: multipart/form-data
```

**请求字段：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | 是 | `.cas` 文件（仅限此格式） |
| `caption` | string | 否 | 文件描述 |
| `path` | string | 否 | 文件在目录中的路径（如 `Season 1/Episode 5/`） |

**.cas 文件 JSON 格式：**

```json
{
  "size": 4937563721,
  "name": "video.mkv",
  "md5": "8c12087e075aec6843e13ad93e98a64e",
  "sliceMD5": "563f659c0bd0b5f007a504622a40ebc3",
  "create_time": "1780533794"
}
```

`md5` 字段必填（用于去重），`size` 必填（用于统计）。  
`sliceMD5` / `sliceMd5` / `slice_md5` 可选（任一大写变体均可识别）。

**响应 `200`：**

```json
{
  "success": true,
  "actual_size": 4937563721
}
```

**错误响应：**

```json
{ "error": "Only .cas files are allowed" }
{ "error": "Invalid .cas file: cannot parse content" }
{ "error": "File missing md5 field in .cas JSON" }
{ "error": "Duplicate file", "content_hash": "8c12087e075aec6843e13ad93e98a64e" }
{ "error": "Telegram API error", "description": "..." }
```

- `400` — 参数或文件格式错误
- `409` — 文件已存在（基于 `.cas` JSON 中的 `md5` 字段去重）

---

## 4. 批量上传

将 1~10 个 `.cas` 文件作为一组发送到 Telegram（使用 `sendMediaGroup` 合并为一条消息）。

```
POST /api/upload/batch
Authorization: Bearer <api_key>
Content-Type: multipart/form-data
```

**请求字段：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `count` | int | 是 | 本次上传文件数量（1-10） |
| `file_{i}` | File | 是 | 第 i 个 `.cas` 文件（0-indexed） |
| `name_{i}` | string | 是 | 第 i 个文件名 |
| `path_{i}` | string | 否 | 第 i 个文件路径 |
| `caption_{i}` | string | 否 | 第 i 个文件描述 |

**响应 `200`：**

```json
{
  "success": true,
  "count": 7,
  "duplicated": [
    { "name": "video1.mp4.cas", "path": "Season 1/" },
    { "name": "video2.mp4.cas", "path": "Season 2/" }
  ]
}
```

- `count` — 实际新增上传数（排除重复和非 md5 文件后）
- `duplicated` — 因 `md5` 匹配已存在而跳过的文件列表
- 当 `count === 0` 时表示所有文件均为重复，请求成功但无新文件发送到 Telegram

**错误响应：**

```json
{ "error": "File 0: only .cas files are allowed" }
{ "error": "File 0: invalid .cas file" }
{ "error": "count must be between 1 and 10" }
```

**客户端注意：**
- 建议每次上传最多 10 个文件，间隔 1 秒再发下一批
- 响应中的 `duplicated` 可在前端以 ⏭️ 样式提示用户

---

## 5. 目录压缩上传

将整个目录的所有 `.cas` 文件打包为 zip 压缩包，上传单个 zip 文件到 Telegram。

```
POST /api/upload/dir-zip
Authorization: Bearer <api_key>
Content-Type: multipart/form-data
```

**请求字段：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | 是 | zip 压缩包 |
| `name` | string | 是 | zip 文件名 |
| `path` | string | 否 | 目录路径名 |
| `total_size` | int | 否 | 新文件原始大小总和（仅新文件，排除已存在的） |
| `md5_list` | string | 否 | 所有 `.cas` 文件 md5 的 JSON 字符串数组，如 `["md5a","md5b"]` |

**去重逻辑：**
- 客户端发送 `md5_list`（所有 `.cas` 的 md5 值数组）
- 服务端查询 DB 中是否已存在相同 md5 组合（计算 `sha256(sorted md5s)`）
- 如果完全重复 → `409 Duplicate`
- `total_size` 仅累加新增文件的 `size` 字段，用于更新用户统计

**响应 `200`：**

```json
{
  "success": true,
  "file_size": 52428800,
  "new_size": 4937563721
}
```

- `file_size` — zip 压缩包大小
- `new_size` — 新增文件原始大小总和（等于请求中的 `total_size`）

**错误响应：**

```json
{ "error": "Duplicate directory", "existing_id": 5 }
```

---

## 6. 检查文件去重状态

批量查询 md5 集合，返回哪些是新的、哪些已存在（用于 zip 上传前排重）。

```
POST /api/upload/check-md5s
Authorization: Bearer <api_key>
Content-Type: application/json
```

**请求体：**

```json
{
  "md5s": ["8c12087e075aec6843e13ad93e98a64e", "aa212087e075aec6843e13ad93e98bb22"]
}
```

**响应 `200`：**

```json
{
  "md5s": ["8c12087e075aec6843e13ad93e98a64e", "aa212087e075aec6843e13ad93e98bb22"],
  "existing_md5s": ["8c12087e075aec6843e13ad93e98a64e"],
  "new_md5s": ["aa212087e075aec6843e13ad93e98bb22"]
}
```

- `existing_md5s` — 已在数据库中的 md5
- `new_md5s` — 数据库中未出现的 md5

---

## 7. 上传排行榜

获取上传次数最多的用户排名。

```
GET /api/leaderboard
Authorization: Bearer <api_key>
```

**响应 `200`：**

```json
{
  "leaders": [
    { "name": "liyk", "upload_count": 6, "total_size": 123456789 },
    { "name": "user2", "upload_count": 3, "total_size": 98765432 }
  ],
  "me": {
    "id": 5,
    "name": "liyk",
    "upload_count": 6,
    "total_size": 123456789
  }
}
```

`leaders` 按 `upload_count` 降序排列，取前 20 名。  
`me` 为当前用户信息（即使不在前 20 名也会返回）。

---

## 8. 管理 - 注册码列表

获取所有注册码及使用状态（管理员专用）。

```
GET /api/admin/reg-codes
Authorization: Bearer <api_key>
```

**响应 `200`：**

```json
{
  "codes": [
    {
      "id": 1,
      "code": "rg_abc123def456",
      "used_by": 2,
      "used_at": "2026-06-04 14:00:00",
      "created_at": "2026-06-03 12:00:00",
      "used_by_name": "username"
    }
  ]
}
```

---

## 9. 管理 - 生成注册码

生成一个新的注册码（管理员专用）。

```
POST /api/admin/reg-codes
Authorization: Bearer <api_key>
```

**响应 `201`：**

```json
{
  "code": "rg_abc123def456"
}
```

---

## 10. 管理 - 用户列表与重置 Key

列出所有用户及重置指定用户的 API Key（管理员专用）。

### 获取用户列表

```
GET /api/admin/reset-key
Authorization: Bearer <api_key>
```

**响应 `200`：**

```json
{
  "users": [
    {
      "id": 1,
      "name": "liyk",
      "upload_count": 6,
      "total_size": 123456789,
      "created_at": "2026-06-04 13:25:32"
    }
  ]
}
```

### 重置用户 Key

```
POST /api/admin/reset-key
Authorization: Bearer <api_key>
Content-Type: application/json
```

**请求体：**

```json
{
  "user_id": 1
}
```

**响应 `200`：**

```json
{
  "new_api_key": "tk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "user_name": "liyk"
}
```

**注意：** 如果重置自己的 Key，本地存储的 API Key 会失效，需要重新登录。

---

## 鉴权说明

除 `/api/register` 外，所有接口均需在请求头中携带 API Key：

```
Authorization: Bearer <api_key>
```

管理员接口（`/api/admin/*`）还需用户 `is_admin` 为 `1`，否则返回 `403`。

---

## 通用错误

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 请求参数错误 / 文件格式无效 / 缺少 md5 字段 |
| 401 | API Key 缺失或无效 |
| 403 | 需要管理员权限 |
| 405 | 请求方法不允许 |
| 409 | 文件重复（基于 md5 检测） |
| 500 | 服务器内部错误 / Telegram API 异常 |
