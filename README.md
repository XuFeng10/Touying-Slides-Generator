# Touying Slides Generator

用 Markdown 快速制作 [touying](https://github.com/touying-labs/touying) 风格的 Typst 演示文稿，可用于赛后讲评等场景。

> 本项目是 [CNOI Statement Generator](https://github.com/Mr-Python-in-China/cnoi-statement-generator) 的精简派生版本：移除了 CNOI / tuack 题面（PDF）模板，只保留 touying 演示文稿模板。上游项目按 AGPL-3.0 发布，本派生作品同样适用该协议，详见 [LICENSE](./LICENSE)。

## 特色

- [x] 纯前端架构，所有排版计算都在本地完成（Typst WASM + Web Worker），可打包为桌面应用
- [x] 使用 Markdown 编写幻灯片，支持 `pause`、`meanwhile` 等演讲指令
- [x] 在线编辑与实时预览（SVG 多页渲染）
- [x] 6 套 touying 主题：simple / metropolis / dewdrop / aqua / university / stargazer
- [x] 自动保存工作副本，支持本机文件读写、导入导出 JSON
- [x] 支持直接上传本地图片并设置图片大小
- [x] 导出幻灯片 PDF，或导出 Typst 源代码 ZIP
- [x] 无需体积达 4GB 的 LaTeX 环境

## 兼容性

需要支持 WebAssembly、Web Worker 与 Cache Storage 的现代浏览器。已测试 Firefox 88+、Chrome 88+、Edge 88+、Opera 75+、Safari 16+。

## 开发与部署

项目使用 Vite + React Router（关闭 SSR、预渲染为静态站点）。Markdown 先经 unified / remark 转成 Typst 源码，再由 [typst.ts](https://github.com/Myriad-Dreamin/typst.ts) 编译为 SVG（预览）或 PDF（导出）。

需要 Node.js 22+ 与 pnpm 11+：

```shell
pnpm install
pnpm run build
```

产物输出到 `./build/client`，用任意静态服务器公开即可；本地预览用 `pnpm run preview`。

`pnpm install` 的 `prepare` 阶段会依次执行 `update-example-template`（把模板的 typst 文件复制到示例目录）、`compile-examples`（用 Node 版 Typst 编译器生成示例预览图）和 `router-typegen`。编译 touying 模板需要下载 `@preview/touying`、`@preview/mitex` 等 Typst 包，因此 **首次安装与首次编译需要联网**。若离线构建导致示例预览图缺失，应用会自动回退到内置占位图，不影响启动。

## 目录说明

- `templates/touying/` — 唯一模板：内容 schema、配置面板、字体、Typst 模板、remark 插件
- `examples/touying-demo/` — 新建文档的起点内容（应用只有这一个模板，新建即用它，不再弹模板选择）
- `src/compiler/` — Markdown → Typst → SVG / PDF 的编译 Worker
- `src/storage/` — 浏览器 IndexedDB、浏览器文件系统、Electron 原生对话框三种存储后端
- `electron/` — 桌面版外壳（主进程 + 预加载脚本）
- `public/typst-packages/` — 随应用分发的 Typst 包，使桌面版可离线编译

## 桌面版（Electron）

桌面版复用同一份静态构建产物，主进程通过自定义 `app://` 协议托管 `build/client`，不需要起本地 HTTP 服务；所有渲染与编译仍然在 Chromium 内完成，不依赖任何后端。

```shell
pnpm run electron:dev     # 开发：起 dev server 后自动拉起 Electron 窗口
pnpm run electron:build   # 打包安装包（输出到 dist/）
pnpm run electron:build:dir  # 只打未压缩目录，便于验证
```

首次打包会下载 Electron 二进制与 electron-builder 的辅助工具；国内网络较慢时可先设置镜像：

```shell
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
export ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
```

几个与网页版不同的地方：

- **文件读写**走系统原生对话框（`src/storage/electron/index.tsx`），路径形如 `electron/<绝对路径>`，会记入「最近打开」；Electron 下浏览器版的文件系统入口会自动隐藏，避免两套入口并存。
- **离线编译**：`public/typst-packages/preview/*.tar.gz` 会在编译前载入内存，优先于 `packages.typst.org` 使用；包里没有的 typst 包仍会联网拉取。新增依赖时运行 `pnpm run fetch-typst-packages` 并更新 `src/compiler/typstPackages.ts`。
- **字体**随应用一起打包（`assets/typst/fonts`，编译时传入 Worker），不再请求 `queryLocalFonts` 访问本机字体，也没有字体下载步骤。
- **导出 PDF / ZIP / JSON** 会弹出系统保存对话框，不再走浏览器下载。
- `app://` 下 Cache Storage 不支持 `put`（Chromium 限制），因此缓存写入失败会被静默忽略，只影响二次加载速度，不影响编译。


## 许可证

上游项目参考了 [tuack](https://gitee.com/mulab/oi_tools) 的模板文件，结合其 Web 服务性质使用 AGPL 3.0。本派生作品沿用同一协议，详见 [LICENSE](./LICENSE)。
