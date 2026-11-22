# S喵在线大赌场 · 整点补给自动领取

一个 Tampermonkey（油猴）用户脚本，用于 [casino.soliumbra.com](https://casino.soliumbra.com/)（Discord 小群自娱自乐的虚拟积分牌室）的整点补给与每日签到自动领取。

## 功能

- 整点补给：整点放行后自动领取
- 每日签到：按网站返回的 `nextDailyAt` 精准定时（通常是 0 点），到点自动领取
- 救济金 / 游乐铜板：默认关闭，可在脚本开头手动开启

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展
2. 浏览器进入 `edge://extensions`（或 `chrome://extensions`），打开 Tampermonkey 的**详细信息**，开启**允许用户脚本**（Chrome/Edge 138+ 必须）
3. 打开 [soliumbra-auto-claim.user.js](./soliumbra-auto-claim.user.js) 原始文件，Tampermonkey 会自动弹出安装页
4. 打开赌场页面并用 Discord 登录一次即可

## 工作原理

脚本仅调用网站自身页面就在使用的官方接口（`GET /api/me` 查询状态，`POST /api/wallet/claim/*` 领取），与手动点按钮发出的请求完全相同。

## 安全与频率声明

- **本脚本不会对服务端造成压力，更不构成任何形式的 DDoS 攻击。**
- 平时每 **30 秒**查询一次状态；临近整点 2 分钟内加密为每 **5 秒**；每日签到则按网站返回的精确时间戳**到点一次性领取**。
- 每个奖励**每轮只请求一次**：领取成功或被服务端拒绝后即标记跳过，绝不重试轰炸。
- 领取动作每天合计产生的请求量与一位正常玩家手动点几次按钮相当，仅省去手动操作。

## 免责声明

- 本脚本仅供该 Discord 群内部娱乐使用，tokens 为群里自娱自乐的记分，不兑换任何真实货币。
- 请遵守网站的使用规则；若网站管理方不希望使用自动化领取，请停用本脚本。
- 使用本脚本产生的一切后果由使用者自行承担。
