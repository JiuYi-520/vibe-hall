# 有了服务器怎么用：VIBE HALL 部署清单

版本：2026-09-23 · 目标：一台阿里云轻量应用服务器 / ECS，**一条命令同时提供前端与 API**。

## 0. 先决定两件事

| 选择 | 后果 |
| --- | --- |
| **地域：香港/新加坡** | **免 ICP 备案**，买完就能用；价格一般不在免费试用范围（约 ¥24-30/月起，以控制台为准） |
| **地域：大陆** | 可能落在新用户免费试用（1-3 个月）；用**域名 + 80/443** 对外必须**先 ICP 备案**（个人可备，审核约 3-20 天） |

不管哪种：**实名认证是前提**；试用到期记得释放实例或转付费，并**设置预算告警**（超量会按量计费）。

## 1. 买机器与放行端口

1. 镜像选 Ubuntu 22.04+ 或 Alibaba Cloud Linux（都行）。
2. 规格：1 核 1G 起就够（本站是静态文件 + 单进程 Node + SQLite）。
3. 安全组/防火墙放行：`22`（SSH）与你的服务端口（下面示例用 `8787`）。若用备案域名走 80/443，再放行 80/443。

> 不要额外开放数据库端口——本项目的数据库就是服务器上的一个文件，不需要对公网暴露。

## 2. 装 Node（需要 20+，推荐 22/24）

```bash
node -v            # 若已 >= 20 可跳过
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
# Alibaba Cloud Linux / CentOS 系
sudo dnf module install nodejs:22/common -y
```

## 3. 把代码放上去

```bash
git clone https://github.com/JiuYi-520/vibe-hall.git && cd vibe-hall
npm ci             # 没有 lock 文件就用 npm install
npm run build      # 产出 dist/（前端静态文件）
```

## 4. 启动：一条命令（前端 + API 同源）

```bash
HOST=0.0.0.0 PORT=8787 STATIC_ROOT=dist HALL_DB=/srv/vibe-hall/hall.sqlite npm start
```

然后浏览器打开 `http://<服务器公网IP>:8787` 就能用：

- 前端由**同一个进程**托管（`STATIC_ROOT=dist`），所以**不需要 nginx、不需要第二个端口、也不需要配 CORS**。
- 前端默认**先试同源**、再试 `http://localhost:8787`；也可以用 `VITE_API_BASE`（构建时）钉死到别处。
- 首次启动会自动建库；`HALL_DB` 指向的目录要先存在：`sudo mkdir -p /srv/vibe-hall && sudo chown $USER /srv/vibe-hall`。

如果只想起后端（前端交给静态托管）：

```bash
HOST=0.0.0.0 PORT=8787 HALL_DB=/srv/vibe-hall/hall.sqlite npm run server
```

## 5. 常驻：systemd

`/etc/systemd/system/vibe-hall.service`：

```ini
[Unit]
Description=VIBE HALL (frontend + api)
After=network.target

[Service]
User=vibe
WorkingDirectory=/home/vibe/vibe-hall
Environment=HOST=0.0.0.0
Environment=PORT=8787
Environment=STATIC_ROOT=dist
Environment=HALL_DB=/srv/vibe-hall/hall.sqlite
# 登录 Cookie 与跨域请求只允许站点自己的来源；换域名后同步修改
Environment=HALL_ORIGIN=http://<服务器公网IP>:8787
ExecStart=/usr/bin/node server/app.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now vibe-hall
sudo systemctl status vibe-hall
curl http://127.0.0.1:8787/api/health
```

## 6. 域名与 HTTPS（可选，但强烈建议）

1. 域名解析到服务器 IP（大陆节点需先完成 ICP 备案）。
2. 阿里云可申请**免费 DV 证书**（有效期通常 3 个月，到期要换）。
3. 用 nginx 反代到 8787，示例：

```nginx
server {
  listen 443 ssl;
  server_name hall.example.com;
  ssl_certificate     /etc/nginx/ssl/hall.pem;
  ssl_certificate_key /etc/nginx/ssl/hall.key;
  client_max_body_size 1m;
  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

> 前端页面是 https 时，浏览器会拦掉 http 的 API（混合内容）——所以要么都走 https，要么都先 http。

## 7. 备份与维护

```bash
# 每天 3 点备份一次（SQLite 官方推荐的 .backup，不锁库）
0 3 * * * sqlite3 /srv/vibe-hall/hall.sqlite ".backup '/srv/vibe-hall/backup/hall-$(date +\%F).sqlite'"
```

- 数据全在 `HALL_DB` 那一个文件里，**别放在临时目录**，也别提交进 Git（`.gitignore` 已排除 `server/hall.sqlite*`）。
- 更新版本：`git pull && npm ci && npm run build && sudo systemctl restart vibe-hall`。
- 排错：`journalctl -u vibe-hall -f`；页面显示「本机模式」多半是端口/安全组/HOST 没对，用 `curl http://127.0.0.1:8787/api/health` 先确认本机能通。

## 8. 上线前请知道的安全边界

- 身份是**设备令牌**：换浏览器就等于换人，令牌丢了找不回，也无法封禁。公网长期用，迟早要接真实登录。
- 目前只有**基础限流**（默认 60 秒内 300 次/IP，超出返回 429）；没有 WAF、没有验证码、没有敏感词审核。
- 展品评论/点赞与积分**仍只存在访客本机**，不会共享。
- 真实资金未做（见 [money-and-auth.md](./money-and-auth.md)）。
