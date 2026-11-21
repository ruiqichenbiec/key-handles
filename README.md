# key-handles

一个 Claude Code 插件：密钥直接发给 Claude Code，模型拿到的只是一个代号。原文不发给模型，也不写进本机的会话记录。

> 现在是原型，已经在 Windows 上实测跑通（范围见下面"实测结果"）。想第一时间用上，点个 star，进度都在这里更新。

演示视频（B站）：[API key想直接贴给 AI？我做了个 Claude Code 插件替你挡住](https://www.bilibili.com/video/BV1xJyiz3E58/)

## 它解决什么问题

同时用几家模型，就有几把密钥要管。

- 直接把密钥发给 Claude Code：密钥原文会发给模型，还会明文留在本机的会话记录和输入历史里。
- 自己管：要记住一堆密钥，或者专门搭网关、写工具把它们藏起来。

官方仓库有人提过这个需求（[anthropics/claude-code#88380](https://github.com/anthropics/claude-code/issues/88380)），2026-10-12 被自动程序以 not planned 关闭。

## 它怎么做

1. **提交时拦截。** 你发出的消息里如果有密钥，插件在提交的那一步把它换成代号，原文不发给模型。
2. **代号带说明。** 模型收到的是 `[[secret:anthropic-key#1 provider=Anthropic format=sk-ant-api03-*]]`：一个代号，加上这把密钥是哪一家的、什么格式。
3. **执行时换回。** 模型用代号写命令或文件。工具执行时，插件在本机把代号换回真实密钥。
4. **输出再遮蔽。** 命令输出或读到的文件里带着密钥，模型看到的也还是代号。
5. **本机记录里没有原文。** 会话记录和输入历史里存的都是代号。

## 实测结果

同一条带假密钥的消息，在本机记录里搜索密钥原文：

| | 不带插件 | 带插件 |
|---|---|---|
| 会话记录（`~/.claude/projects/…/<session>.jsonl`） | 6 处 | 0 处 |
| 输入历史（`~/.claude/history.jsonl`） | 1 处 | 0 处 |

带插件时逐项测过的情况（全部通过，模型每次拿到的都是代号）：

- 在输入框里逐字输入带密钥的消息
- 粘贴三行文字，其中一行是密钥
- 粘贴 31 行配置（界面折叠成 `[Pasted text +30 lines]`）
- Bash 命令的输出里有密钥
- Read 工具读到的文件里有密钥
- 模型在命令里写代号，执行后磁盘上的文件里是真实密钥

测试环境：Windows 11，Claude Code 命令行 2.1.308（终端交互界面和无界面模式），模型 Haiku，全部使用假密钥。细节见 [docs/tested.md](docs/tested.md)。

## 现在的限制

- 只认一种格式：`sk-ant-api03-*`。其他厂商的密钥还不认。
- 只有一个代号，密钥只存在内存里，会话结束就没了。
- 只处理明文。base64 等编码过的密钥没有测，按现在的写法拦不住。
- 没测过：Claude 桌面应用、macOS、Linux、其他版本的 Claude Code。
- 只用假密钥测过。它证明的是"替换"这条链路，不是各家接口都能调通。

## 接下来

密钥只是第一步。接下来要做的（都还没做）：

1. **本地隐私分类器。** 专门管个人隐私：模型要读到隐私内容的时候，先在本机被分类器拦下来，不发出去。
2. **文档脱敏。** 文档里的敏感信息先在本机脱敏，再交给模型。

密钥这部分也会继续补：

- 认识更多厂商的密钥格式，一把密钥一个代号
- 密钥存进系统的凭据管理器，不只放在内存
- 每次使用前可以选：允许一次、本次会话允许、总是允许
- 守卫出错时一律拦下，不放行（提交这一步已经做了，工具调用这一步还没有）

## 告诉我你需要什么

开一个 issue，说三件事就够：你同时用哪几家模型、用什么系统、最担心密钥在哪里泄露。

## 原型代码

[`prototype/`](prototype/) 是录演示视频时用的那份代码，一共一个文件：[`prototype/hooks/register.ts`](prototype/hooks/register.ts)。

在我的机器上（Claude Code 2.1.308）这样加载，其他版本没有试过：

```
claude --plugin-dir prototype
```

**只用假密钥试。** 例如 `sk-ant-api03-FAKE-DEMO-KEY-0123456789abcdef`。

---

**English.** A prototype Claude Code plugin: paste an API key into Claude Code and the model only receives a handle. The key is swapped out when the prompt is submitted, swapped back locally when a tool runs, and masked again in tool output, so it reaches neither the model nor the local transcript. Tested on Windows with Claude Code CLI 2.1.308 and fake keys only; one key format (`sk-ant-api03-*`). Next: a local privacy classifier that stops the model from reading personal data, and redaction of documents before they reach the model. Star the repo to follow progress.

## 许可证

MIT，见 [LICENSE](LICENSE)。
