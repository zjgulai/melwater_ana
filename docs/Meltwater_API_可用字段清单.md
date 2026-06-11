---
name: meltwater-api-field-list
description: Meltwater API 可用字段清单，涵盖 api.json 模板的全部字段。当需要从 Meltwater 拉取 VOC 原始数据或了解 Mention 数据结构时使用。
---

# Meltwater API 可用字段清单

> 基于 `api.json` 输出模板，覆盖 Listening Search / Export 返回的 Mention 全部字段。

## 一、文档元数据

| 字段路径 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `id` | string | Meltwater 平台唯一文档ID | `"1779206280000_sbb0suUtpiLCRroFjI6YBhBcHn4A"` |
| `published_date` | datetime | 源发布时间（UTC） | `"2026-05-19T15:58:39.000Z"` |
| `indexed_date` | datetime | Meltwater入库时间（UTC） | `"2026-05-19T15:59:04.000Z"` |
| `url` | string | 文档原始URL | `"https://www.reddit.com/r/.../comment/..."` |
| `content_type` | string | 内容类型 | `news article` / `social post` / `forum post` / `forum post reply` / `review` / `comment` / `blog post` / `repost` / `reply` / `video` / `audio` / `quote` / `direct message` |
| `external_id` | string | 源平台文档ID（X专用） | `"1781005504061268063"` |

## 二、来源信息

| 字段路径 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `source.name` | string | 来源名称 | `"reddit.com/r/PlusSizePregnancy"` / `"New York Times"` |
| `source.type` | string | 来源类型 | `online news` / `rss` / `blog` / `forum` / `reviews` / `comments` / `social network` |
| `source.domain` | string | 来源域名 | `"reddit.com"` / `"bbc.com"` |
| `source.url` | string | 来源URL | `"https://www.reddit.com"` |
| `source.information_type` | string | 信息大类 | `news` / `social` |
| `source.id` | string | 来源在Meltwater的唯一ID | `"social:tiktok"` |
| `source.outlet_types` | array(string) | 媒体分类 | `["magazine", "blog"]` |

## 三、作者信息

| 字段路径 | 类型 | 说明 | 适用来源 |
|---|---|---|---|
| `author.name` | string | 作者姓名 | 新闻/Blog/论坛/Facebook/YouTube等 |
| `author.handle` | string | 作者用户名/Handle | Blog/Reddit/Facebook/Instagram/X等 |
| `author.profile_url` | string | 作者主页链接 | Blog/Reddit/YouTube/Instagram/X等 |
| `author.external_id` | string | 作者在源平台ID（X专用） | X |

## 四、内容文本（核心VOC）

| 字段路径 | 类型 | 说明 | ⚠️ 限制 |
|---|---|---|---|
| `content.title` | string | 文档标题 | 新闻/Blog/论坛/YouTube有；X/Reddit评论无 |
| `content.body` | string | 正文文本 | 新闻前140字；FB/IG全文；**X/Reddit为null** |
| `content.opening_text` | string | 开头文本 | 新闻/Blog/论坛/社媒评论 |
| `content.byline` | string | 署名行 | 仅新闻 |
| `content.image` | string | 主图URL | 新闻/Blog/论坛/社媒 |
| `content.hashtags` | array(string) | 话题标签 | `["#breastpump", "#momlife"]` |
| `content.mentions` | array(string) | @提及 | `["@BBC", "@CNN"]` |
| `content.emojis` | array(string) | 表情符号 | `["😂", "🔥"]` |
| `content.links` | array(string) | 文中链接 | `["http://..."]` |

## 五、NLP富化数据

| 字段路径 | 类型 | 说明 | 示例/可选值 |
|---|---|---|---|
| `enrichments.sentiment` | string | 文档级情感标签 | `positive` / `negative` / `neutral` / `unknown` |
| `enrichments.language_code` | string | 语言代码 | `en` / `fr` / `zh-Hans` / `zh-Hant` |
| `enrichments.keyphrases` | array(string) | 关键词提取 | `["best suggestions", "maternity bras", "work"]` |
| `enrichments.named_entities` | array(object) | 命名实体+实体级情感 | `[{name, sentiment, type}]` |
| `enrichments.named_entities[].name` | string | 实体名称 | `"Momcozy"` / `"Amazon"` |
| `enrichments.named_entities[].sentiment` | string | 实体级情感 | `positive` / `negative` / `neutral` |
| `enrichments.named_entities[].type` | string | 实体类型 | `organization` / `person` / `place` |

## 六、地理位置

| 字段路径 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `location.country_code` | string | 2字母国家码 | `"us"` / `"gb"` / `"zz"`（未知） |
| `location.city` | string | 城市 | `"London"` / `"New York"` |
| `location.state` | string | 州/省 | `"California"` / `"Florida"` |
| `location.region` | string | 地区 | `"Rhode Island"` |
| `location.geo.latitude` | numeric | 纬度 | `43.64801` |
| `location.geo.longitude` | numeric | 经度 | `-93.36827` |

## 七、来源影响力指标

| 字段路径 | 类型 | 说明 | 适用来源 |
|---|---|---|---|
| `source.metrics.reach` | numeric | 来源触达量（粉丝数/访问量估算） | 新闻/X/Facebook/Reddit |
| `source.metrics.ave` | numeric | 广告价值等值 | 新闻/X/Facebook/Reddit |
| `source.metrics.global_reach` | numeric | 全球触达估算 | 新闻/X/Facebook/Reddit |
| `source.metrics.national_reach` | numeric | 本国触达估算 | 新闻/X/Facebook/Reddit |
| `source.metrics.local_reach` | numeric | 本地触达估算 | 新闻/X/Facebook/Reddit |
| `source.metrics.reach_desktop` | numeric | 桌面端访问量估算 | 新闻 |
| `source.metrics.reach_mobile` | numeric | 移动端访问量估算 | 新闻 |
| `source.metrics.national_viewership` | numeric | 本国观众数 | 新闻/广播 |

## 八、文档传播指标

| 字段路径 | 类型 | 说明 | 适用来源 |
|---|---|---|---|
| `metrics.editorial_echo` | numeric | 编辑回声（被其他文章引用次数） | 新闻 |
| `metrics.social_echo.total` | numeric | 社交回声（被分享到社媒总次数） | 新闻 |
| `metrics.social_echo.x` | numeric | X平台分享次数 | 新闻 |
| `metrics.social_echo.facebook` | numeric | Facebook分享次数 | 新闻 |
| `metrics.social_echo.reddit` | numeric | Reddit分享次数 | 新闻 |
| `metrics.views` | numeric | 浏览量 | X/Twitch/Bilibili/优酷 |
| `metrics.estimated_views` | numeric | 新闻预估浏览量 | 新闻 |
| `metrics.earned_media_value` | numeric | 媒体价值(EMV) | 多源 |
| `metrics.episode_reach` | numeric | 单集触达 | 广播 |

## 九、互动指标

| 字段路径 | 类型 | 说明 | 适用来源 |
|---|---|---|---|
| `metrics.engagement.total` | numeric | 总互动量 | 新闻/Blog/论坛/X/Facebook/Instagram/TikTok等 |
| `metrics.engagement.likes` | numeric | 点赞数 | Blog/X/Facebook/TikTok |
| `metrics.engagement.replies` | numeric | 回复数 | 评论/Facebook/Instagram/Reddit/TikTok等 |
| `metrics.engagement.comments` | numeric | 评论数 | Facebook/Instagram/TikTok |
| `metrics.engagement.shares` | numeric | 分享数 | Facebook/Pinterest/TikTok等 |
| `metrics.engagement.quotes` | numeric | 引用数 | X |
| `metrics.engagement.reposts` | numeric | 转发数 | X |
| `metrics.engagement.reactions` | numeric | 总反应数 | Blog/X/Facebook/Instagram/Reddit/TikTok等 |

## 十、匹配上下文

| 字段路径 | 类型 | 说明 | 示例 |
|---|---|---|---|
| `matched.inputs` | array(object) | 命中的搜索/标签 | `[{type:"search", name:"Momcozy", id:18922074}]` |
| `matched.keywords` | array(string) | 命中的关键词 | `["MomCozy", "nursing", "bras"]` |
| `matched.hit_sentence` | string | 命中的句子片段 | `"...announced today that they plan to launch..."` |

## 十一、讨论串结构

| 字段路径 | 类型 | 说明 |
|---|---|---|
| `thread.title` | string | 帖子/讨论串标题 |
| `thread.url` | string | 帖子/讨论串URL |
| `parent.url` | string | 父级文档URL（回复的上级） |

## 十二、客户自定义

| 字段路径 | 类型 | 说明 | 备注 |
|---|---|---|---|
| `custom.tags` | array(string) | Meltwater内打的标签 | `["已回复", "在跟进", "产品质量"]` |
| `custom.custom_categories` | array(object) | 命中的自定义分类 | `[{id:47822, name:"排除市场报告"}]`，仅Export |
| `custom.custom_fields` | array(object) | 自定义字段值 | 仅Explore+ |
| `custom.hidden` | boolean | 是否在应用中隐藏 | |
| `custom.visible` | string | 可见性 | `public` / `private` |

---

## 覆盖的媒体源

News · RSS · Blogs · Comments · Reviews · Forums · X (Twitter) · Facebook · Instagram · Reddit · YouTube · Twitch · Pinterest · 抖音 · 小红书 · 微信 · B站 · 优酷 · KakaoTalk · TikTok · LineVoom · Broadcast · LinkedIn

## 关键限制

| 限制项 | 说明 |
|---|---|
| X/Reddit 原文不可获取 | `content.body` 为 null，仅返回 post ID，需调用平台 API "rehydrate" 获取原文 |
| Search 单次上限 1000 条 | 10 页 × 100 条/页，大批量需走 Export 异步导出 |
| Export 单次上限 200 万条 | 超出自动采样降至此数 |
| 新闻正文截断 | body 仅前 140 字符，opening_text 同理 |
