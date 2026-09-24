# 后端：本地自托管的展馆 API

版本：2026-09-23 · 零依赖（`node:http` + `node:sqlite`），不需要外部账号或云服务。

## 怎么跑

```powershell
npm run server      # 启动后端：http://127.0.0.1:8787（数据落 server/hall.sqlite）
npm run dev         # 另开一个终端启动前端：http://localhost:5173
```

环境变量：`PORT`（默认 8787）、`HALL_DB`（默认 `server/hall.sqlite`，`:memory:` 可跑内存库）、`HALL_ORIGIN`（CORS 来源，默认 `*`）。

前端默认连 `http://localhost:8787`；可用 `VITE_API_BASE` 覆盖。**后端没启动时不会报错**：前端探测失败后如实显示「本机模式 · 只在本机」，行为与之前完全一致。

## 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查，返回存储类型与各表计数 |
| POST | `/api/auth/register` | 注册自建账号并设置 HttpOnly 会话 |
| POST | `/api/auth/login` | 登录自建账号并设置 HttpOnly 会话 |
| POST | `/api/auth/logout` | 撤销当前会话 |
| GET | `/api/auth/me` | 读取当前登录账号 |
| PATCH | `/api/profile` | 更新昵称、账号、简介和头像色 |
| POST | `/api/identity` | 旧版兼容：用昵称/账号换一个设备令牌 |
| GET | `/api/wishes` | 愿望列表（带 `cheered` 表示"我是否按过"） |
| POST | `/api/wishes` | 发愿望（需令牌） |
| POST | `/api/wishes/:id/cheer` | 「我也想要」按设备切换 |
| POST | `/api/wishes/:id/claim` | 接单；重复接单 409 |
| POST | `/api/wishes/:id/deliver` | 交付；非接单人 403，重复交付 409 |
| GET | `/api/posts` | 帖子列表（含回复与 `liked`） |
| POST | `/api/posts` | 发帖（需令牌） |
| POST | `/api/posts/:id/replies` | 回复（需令牌） |
| POST | `/api/posts/:id/like` | 点赞切换（需令牌） |

错误统一为 `{ error: { code, message } }`，状态码：400 参数、401 未认证、403 无权、404 不存在、409 冲突、413 请求体过大、500 内部错误。

## 身份：自建账号与兼容令牌

- `POST /api/auth/register` 或 `/api/auth/login` 设置 `vh_session` HttpOnly Cookie；密码只存 scrypt 摘要，服务端保存会话摘要并支持退出撤销。
- 登录资料包含昵称、账号、简介和头像色，`PATCH /api/profile` 更新后可在不同设备读取。
- 旧版 `POST /api/identity` 仍返回设备令牌，便于离线兼容；新界面优先使用账号会话。
- 服务端按账号/令牌判定作者、接单人和点赞人，因此愿望与论坛可以多人共享。

## 一致性边界（重要）

| 数据 | 在线时 | 离线时 |
| --- | --- | --- |
| 愿望、帖子/回复、点赞 | 走服务端（本机仅作离线回退） | 本机存储 |
| 本机身份资料（昵称/头像色） | 本机；在线时用它注册设备令牌 | 本机 |
| 展品评论与点赞、积分与徽章 | **仍只在本机**（未接服务端） | 本机 |

在线时页面显示的是**服务端数据**，本机草稿仍在 localStorage 里、离线时才会出现（愿望墙底栏会写明这一点）。写入失败时页面报错并**不落本地**——宁可让你重试，也不假装成功。

## 仍未做

- **公网部署**：域名、TLS、反向代理、备份与运维仍需按部署清单配置。
- **账号增强**：邮箱验证、密码找回、封禁、风控和第三方 OAuth/OIDC 都没做。
- **真实资金**：与本仓库其他部分一致，未做；见 [money-and-auth.md](./money-and-auth.md)。
- 展品评论/点赞与积分未上服务端；没有实时推送（靠手动刷新或重新进入页面）。
