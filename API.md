# Telegram Uploader API 文档

Base URL: `https://telegram-uploader-4an.pages.dev`

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

获取当前用户的统计数据及所有上传记录。

```
GET /api/user/stats
Authorization: Bearer <api_key>
```

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
      "caption": "test upload",
      "file_path": "Season 1/Episode 5/",
      "status": "success",
      "created_at": "2026-06-04 14:18:32"
    }
  ]
}
```

---

## 3. 上传文件

上传 `.cas` 文件到 Telegram 频道。文件内容必须为 base64 编码的 JSON，其中需包含 `size` 字段作为实际文件大小。

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

**.cas 文件格式示例：**

```json
{"size": 1234567890, "name": "video.mp4", ...}
```

Base64 编码后作为 `.cas` 文件内容上传。

**响应 `200`：**

```json
{
  "success": true,
  "actual_size": 1234567890
}
```

**错误响应：**

```json
{ "error": "Only .cas files are allowed" }
{ "error": "Invalid .cas file: cannot parse content" }
{ "error": "Telegram API error", "description": "..." }
```

上传成功后会自动更新该用户的 `upload_count` 和 `total_size`。

---

## 4. 上传排行榜

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

## 5. 管理 - 注册码列表

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

## 6. 管理 - 生成注册码

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

## 鉴权说明

除 `/api/register` 外，所有接口均需在请求头中携带 API Key：

```
Authorization: Bearer <api_key>
```

管理员接口（`/api/admin/*`）还需用户 `is_admin` 为 `1`，否则返回 `403`。

## 通用错误

| HTTP 状态码 | 说明 |
|-------------|------|
| 400 | 请求参数错误 |
| 401 | API Key 缺失或无效 |
| 403 | 需要管理员权限 |
| 405 | 请求方法不允许 |
| 500 | 服务器内部错误 |
