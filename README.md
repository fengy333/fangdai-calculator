# 房贷计算器

纯静态的在线房贷计算器：支持商业贷款、公积金贷款、组合贷款，以及等额本息 / 等额本金两种还款方式的月供、利息与逐期还款明细测算。

零构建、零依赖、零后端，全部计算在浏览器本地完成，输入的贷款数据不会上传到任何服务器。部署在 Cloudflare Pages。

---

## 目录结构

```
├── index.html            首页（房贷计算器）
├── about.html            关于我们
├── privacy.html          隐私政策
├── 404.html              Cloudflare Pages 自定义 404
├── post/
│   ├── index.html        房贷知识栏目首页（访问路径 /post/）
│   └── 1~10.html         10 篇房贷知识文章
├── css/
│   ├── my-common.min.css     基础样式
│   ├── my-houseloan.min.css  计算器样式
│   └── site.css              内页与通用组件样式
├── js/
│   ├── zepto.min.js              DOM 操作
│   ├── houseloan_calculator.js   计算逻辑
│   ├── common_tpl.js             模板片段
│   ├── site-config.js        ★ 全站唯一配置入口（域名 / 统计 / Cookie）
│   └── site.js               通用脚本：SEO 标签注入、Cookie 同意、按需加载
├── images/
├── _headers              Cloudflare Pages 响应头（安全头 + 缓存策略）
├── _redirects            Cloudflare Pages 重定向
├── wrangler.toml         Cloudflare Pages 部署配置
├── robots.txt            爬虫规则
├── sitemap.xml           站点地图
├── ads.txt               占位文件（未启用）
└── package.json          本地预览与部署命令
```

---

## 一、本地预览

用 Wrangler 起本地服务（能同时模拟 `_headers` / `_redirects`，最接近线上环境）：

```bash
npx wrangler pages dev . --port 8788
# 或
npm run dev
```

打开 http://localhost:8788 即可。也可以直接把 `index.html` 拖进浏览器，但那样不会应用 `_headers`。

---

## 二、部署到 Cloudflare Pages

### 方式 A：Git 集成（推荐，之后 push 自动发布）

1. 把这个项目推到一个 GitHub / GitLab 仓库。

   ```bash
   git init -b main
   git add .
   git commit -m "init"
   git remote add origin <你的仓库地址>
   git push -u origin main
   ```

2. 打开 Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**，选中该仓库。

3. 构建设置填（这是纯静态站，没有构建步骤）：

   | 配置项 | 填写内容 |
   | --- | --- |
   | Framework preset | `None` |
   | Build command | **留空，不要填** |
   | Build output directory | `/` |

4. 点 **Save and Deploy**，一两分钟后会拿到一个 `xxx.pages.dev` 的免费域名。

以后每次 `git push` 都会自动重新部署。

> 别给这个仓库开 GitHub Pages。`_headers` 和 `_redirects` 以下划线开头，Jekyll 会直接忽略它们，安全响应头和 301 全部失效，还会和 Cloudflare Pages 的内容重复、产生双份索引。

### 方式 B：命令行直接上传（不想用 Git 时最快）

```bash
npx wrangler login
npm run deploy
# 等价于：npx wrangler pages deploy . --project-name=fangdai-calculator
```

首次执行会提示创建项目，回车确认即可。命令会把当前目录作为发布内容上传。

---

## 三、绑定自己的域名

1. 先把域名的 DNS 托管到 Cloudflare（在 Cloudflare 添加站点，然后到你的域名注册商处把 NS 改成 Cloudflare 给的两条地址）。
2. 进入 **Workers & Pages → 你的项目 → Custom domains → Set up a custom domain**，填你的域名（例如 `fangdai.example.com`），Cloudflare 会自动加好 DNS 记录并签发 HTTPS 证书。
3. 回到本项目，把 `js/site-config.js` 里的 `siteUrl` 改成你的域名：

   ```js
   siteUrl: 'https://你的域名.com',
   ```

   > 只改这一处即可。`canonical`、`og:url`、结构化数据、分享图地址都会自动跟着变。
   > 另外记得同步替换 `robots.txt` 和 `sitemap.xml` 里的域名（搜索替换即可）。

4. 在 Cloudflare 的 **SSL/TLS** 里把加密模式设为 `Full`，并打开 **Always Use HTTPS**。

---

## 四、上线前检查清单

- [ ] `js/site-config.js` 里 `siteUrl` 已改成真实域名
- [ ] `js/site-config.js` 里 `contact.email` 已换成真实邮箱
- [ ] `robots.txt`、`sitemap.xml` 里的域名已替换
- [ ] 在 Google Search Console 提交 `sitemap.xml`
- [ ] 手机浏览器上过一遍首页和文章页

---

## 五、常见问题

**站内 HTML 里还写死了域名吗？**
没有。域名集中在 `js/site-config.js` 一处，另外 `robots.txt`、`sitemap.xml` 各一处。

**站内配置与本地数据文件会暴露吗？**
不会。`_redirects` 里已把 `.workbuddy/`、`package.json`、`wrangler.toml`、`README.md` 等非站点文件统一重定向到首页（`_redirects` 的优先级高于静态资源匹配），`.assetsignore` 则让 wrangler 上传时直接跳过它们。如果你往项目里加了新的本地文件，记得同步维护这两处。

**`_headers` / `_redirects` 不生效？**
这两个文件必须位于**发布目录的根目录**。本项目以仓库根目录作为发布目录，所以它们放在根目录是对的。另外注意 Git 集成方式下，Cloudflare 仍会读取仓库里的这两个文件。

**为什么 HTML 不做长缓存？**
因为 CSS/JS 文件名没有内容哈希。HTML 用 `must-revalidate`、CSS/JS 缓存一天，改完能较快生效；如果给文件名加哈希，就可以放心用 `immutable` 长缓存。

**想换域名做全站迁移？**
在 `_redirects` 里取消最后两行注释，填上新旧域名即可做 301 全站迁移。

---

## 六、内容规范

文章里出现的月供、利息数字，应当按文中标注的条件（如「贷款 100 万、30 年、年利率 4.2%、等额本息」）用标准公式算准后再写，保证读者能在本站计算器里复现；涉及政策的部分以官方公告为依据。不写无法验证的数据，不做夸张承诺。

---

## 七、如何新增一篇文章

1. 复制 `post/10.html` 改名为 `post/11.html`，改掉 `<title>`、`keywords`、`description`、`<h1>` 和正文。
2. 样式不用复制——文章样式已统一放在 `css/site.css`，新文章只要像模板一样引入 `../css/site.css` 就够了。
3. 文章底部「相关阅读」加 3~4 条指向其他文章的内链，形成网状结构。
4. 同步做四件事：`post/index.html` 加一条列表项、首页侧栏「房贷知识」加一条、`sitemap.xml` 加一个 `<url>`、正文知识列表按需补一条。
5. 重新部署后，到 Google Search Console 提交该 URL。

> 小技巧：文章里的示例数字建议真的算一遍再写。用本站计算器按你标注的条件算一遍，把结果抄进文章，既准确又能自圆其说。

---

## 八、一个已修复的历史问题

原模板在 `my-common.min.css` 的桌面端媒体查询里，用 `display: none !important` 强制隐藏了 `#business_atc_recmd_mod`、`#repay_atc_recmd_mod` 这两个知识模块，导致 JS 的 `.show()` 在桌面端始终无效、正文里的文章列表一直不显示（移动端正常）。现在这些模块承载了真实内容，已在 `css/site.css` 末尾用同权重 `!important` 覆盖恢复显示。如果你想恢复「桌面端隐藏」的原设计，删掉 `site.css` 里「恢复知识模块显示」那一段即可。

排查这类「内容不显示」的问题时，先搜一遍 CSS 里的 `!important` 覆盖。

---

## 九、技术说明

- 无构建流程、无框架、无运行时依赖，改完文件直接刷新即可。
- 计算逻辑全部在浏览器本地执行，用户输入的贷款数据不会上传到任何服务器。
- 兼容性：使用到的 `IntersectionObserver`、`localStorage` 等均为现代浏览器标准 API；如仍需支持 IE，请自行加 polyfill。
