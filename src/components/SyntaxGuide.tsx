import { Drawer } from "antd";
import { useCallback, useRef, type FC, type ReactNode } from "react";

import "./SyntaxGuide.css";

type Section = {
  id: string;
  title: string;
  body: ReactNode;
};

const Code: FC<{ children: string; caption?: string }> = ({
  children,
  caption,
}) => (
  <div className="syntax-guide-code">
    {caption && <div className="syntax-guide-code-caption">{caption}</div>}
    <pre>
      <code>{children}</code>
    </pre>
  </div>
);

const Note: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="syntax-guide-note">{children}</p>
);

const SECTIONS: Section[] = [
  {
    id: "start",
    title: "五分钟上手",
    body: (
      <>
        <p>
          左侧写 Markdown，右侧实时预览幻灯片。整个文档由若干「页」组成，
          <strong>用标题层级来分页</strong>，缩放到任何屏幕比例都不会变形。
        </p>
        <ol>
          <li>点击首页「新建文档」，自动打开一份可编辑的示例。</li>
          <li>在左侧 Markdown 面板里修改内容，右侧预览会在输入停顿后自动刷新。</li>
          <li>在左侧「配置」面板里填写标题、作者、主题等封面信息。</li>
          <li>
            用 <kbd>Ctrl</kbd> + <kbd>S</kbd> 保存，或导出 PDF 分发。
          </li>
        </ol>
        <Note>
          预览不是在浏览器里画出来的图片，而是真正的 Typst 排版结果，导出的 PDF
          与预览完全一致。
        </Note>
      </>
    ),
  },
  {
    id: "structure",
    title: "幻灯片结构",
    body: (
      <>
        <p>标题层级决定分页方式，这是与普通 Markdown 文档最大的差别：</p>
        <table className="syntax-guide-table">
          <thead>
            <tr>
              <th>写法</th>
              <th>效果</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code># 一级标题</code>
              </td>
              <td>开启新的一节，多数主题会插入一张节标题页</td>
            </tr>
            <tr>
              <td>
                <code>## 二级标题</code>
              </td>
              <td>开启新的一页幻灯片，标题显示在页面顶部</td>
            </tr>
            <tr>
              <td>
                <code>### 三级标题</code>
              </td>
              <td>当前页内的小标题，不换页</td>
            </tr>
            <tr>
              <td>
                <code>---</code>
              </td>
              <td>手动分页，必须独占一行且前后各留一个空行</td>
            </tr>
          </tbody>
        </table>
        <Code caption="一个最小的两页文档">{`# 第一节

## 第一页

这里是第一页的内容。

## 第二页

这里是第二页的内容。

---

不使用标题也可以手动分页。`}</Code>
        <Note>
          三级及更深的标题（<code>###</code>、<code>####</code>）只做页内分层，
          不要指望它们分页。
        </Note>
      </>
    ),
  },
  {
    id: "text",
    title: "文本格式",
    body: (
      <>
        <table className="syntax-guide-table">
          <thead>
            <tr>
              <th>写法</th>
              <th>效果</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>**粗体**</code>
              </td>
              <td>
                <strong>粗体</strong>
              </td>
            </tr>
            <tr>
              <td>
                <code>*斜体*</code>
              </td>
              <td>
                <em>斜体</em>
              </td>
            </tr>
            <tr>
              <td>
                <code>~~删除线~~</code>
              </td>
              <td>
                <del>删除线</del>
              </td>
            </tr>
            <tr>
              <td>
                <code>`行内代码`</code>
              </td>
              <td>
                <code>行内代码</code>，等宽字体高亮
              </td>
            </tr>
            <tr>
              <td>
                <code>[文字](https://typst.app)</code>
              </td>
              <td>可点击的超链接</td>
            </tr>
          </tbody>
        </table>
        <Code caption="强制换行：行尾留两个空格">{`第一行  
第二行（同一段落内换行）`}</Code>
        <Note>
          不支持内嵌 HTML 标签，写了会原样显示为代码。需要更复杂的效果时，
          可以用 <code>:::figure</code> 等指令，或直接导出 Typst 源码手写。
        </Note>
      </>
    ),
  },
  {
    id: "list",
    title: "列表与引用",
    body: (
      <>
        <Code>{`- 无序列表
- 第二项
  - 缩进两级表示子项

1. 有序列表
2. 第二项

> 引用块：适合放结论、原话或提示。`}</Code>
        <Note>
          有序列表可以写成 <code>3.</code> 开头，编号会从 3 开始。
        </Note>
      </>
    ),
  },
  {
    id: "code",
    title: "代码块",
    body: (
      <>
        <p>
          用三个反引号包裹，第一行写语言标识，会按该语言做语法高亮：
        </p>
        <Code>{`\`\`\`cpp
for (int i = 1; i <= n; ++i) sum += a[i];
\`\`\``}</Code>
        <p>
          常用标识：<code>cpp</code>、<code>python</code>、<code>rust</code>、
          <code>typ</code>、<code>bash</code>。不写语言时按纯文本处理。
        </p>
        <Note>代码块内的 Markdown 不会被解析，可以放心写 `*`、`#` 等符号。</Note>
      </>
    ),
  },
  {
    id: "table",
    title: "表格与单元格合并",
    body: (
      <>
        <Code caption="基础表格：第二行决定对齐方式">{`| 选手 | 总分 | 备注 |
| :--- | ---: | :---: |
| Alice | 300 | 金牌 |
| Bob | 240 | 银牌 |`}</Code>
        <p>
          合并单元格用占位符：单元格内容只写 <code>{"<"}</code> 表示
          <strong>与左侧单元格合并</strong>，只写 <code>^</code> 表示
          <strong>与上方单元格合并</strong>。
        </p>
        <Code caption="把「Alice」横跨两列、把总分纵向合并">{`| 选手 | 总分 | 备注 |
| :--- | ---: | :---: |
| Alice | 300 | 金牌 |
| < | 240 | 银牌 |
| Bob | ^ | 替补 |`}</Code>
        <Note>
          被合并的单元格里除了 <code>{"<"}</code> / <code>^</code> 不要写别的内容；
          竖线数量要与表头一致，否则解析会出错。
        </Note>
      </>
    ),
  },
  {
    id: "math",
    title: "数学公式",
    body: (
      <>
        <p>
          行内公式用一对美元符号，独立公式用两对，语法是 LaTeX 的一个子集
          （由 mitex 提供支持）。
        </p>
        <Code>{`行内：时间复杂度为 $O(n \\log n)$。

独立公式：

$$
\\sum_{i=1}^{n} a_i = \\frac{n(n+1)}{2}
$$`}</Code>
        <Note>
          支持 <code>\frac</code>、<code>\sum</code>、<code>\sqrt</code>、
          <code>\begin{"{cases}"}</code> 等常用命令；冷门宏包命令可能不被支持。
        </Note>
      </>
    ),
  },
  {
    id: "image",
    title: "图片",
    body: (
      <>
        <p>
          图片就是 Markdown 里的一句话：圆括号里写<strong>图片地址</strong>。
          地址可以是本机绝对路径，也可以是网络链接 —— 和 Typora 的用法一致，
          图片不会被复制进文档，文件改动后重新预览就能看到。
        </p>
        <Code caption="引用本机图片">{`![test](E:\\Other\\github project\\test.jpeg)

![logo](E:/assets/logo.png)`}</Code>
        <Code caption="引用网络图片（需要联网）">{`![](https://cdn.luogu.com.cn/upload/image_hosting/j3hx8cbn.png)`}</Code>
        <ul>
          <li>
            <strong>拖拽</strong>：把图片文件从资源管理器拖到左侧面板，松手即插入，
            插在光标落下的位置，写进去的就是它的绝对路径。
          </li>
          <li>
            <strong>面板右上角「图片」按钮</strong>：弹出系统文件选择框，
            可一次选多张，逐个插入路径。
          </li>
          <li>
            <strong>粘贴截图</strong>：截图后 <kbd>Ctrl</kbd> + <kbd>V</kbd>{" "}
            会插入图片内容本身（这类图片没有磁盘路径，会被打包进文档）。
          </li>
        </ul>
        <Note>
          路径里有空格或括号时，用尖括号把地址包起来最稳：
          <code>{"![](<E:\\my pics\\a.png>)"}</code>。
          直接写带空格的路径一般也能识别，但不要依赖这一点。
        </Note>
        <Code caption="用花括号控制尺寸：单位支持 pt / mm / cm / in / em / %">{`![test](E:/assets/logo.png){width=60%}

![test](E:/assets/logo.png){width=8cm,height=5cm}`}</Code>
        <Code caption="需要图注时包一层 figure">{`:::figure{caption="图 1：并查集的合并过程"}
![test](E:/assets/logo.png){width=70%}
:::`}</Code>
        <Note>
          支持 PNG / JPEG / GIF / SVG / WebP。本机路径用的是<strong>绝对路径</strong>，
          换电脑或挪动文件后会失效；导出 PDF 时图片会被真正嵌入，
          所以发出去的 PDF 不依赖原文件。
        </Note>
      </>
    ),
  },
  {
    id: "animation",
    title: "分步动画",
    body: (
      <>
        <p>
          用两条冒号的指令可以让同一页的内容分步出现，适合讲解算法过程：
        </p>
        <Code>{`## 二分查找

先看中间位置。

::pause

如果目标更小，收缩右边界。

::pause

否则收缩左边界。

::meanwhile

上面是一组动画，这里开始新的一组。`}</Code>
        <table className="syntax-guide-table">
          <thead>
            <tr>
              <th>指令</th>
              <th>含义</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>::pause</code>
              </td>
              <td>指令之后的内容推迟到下一页出现（导出 PDF 时成为多页）</td>
            </tr>
            <tr>
              <td>
                <code>::meanwhile</code>
              </td>
              <td>重置动画状态，用于在同一页里做多组独立动画</td>
            </tr>
          </tbody>
        </table>
        <Note>
          动画以「页」为边界，进入下一页后自动重置，不需要手动清理。
        </Note>
      </>
    ),
  },
  {
    id: "config",
    title: "配置面板与主题",
    body: (
      <>
        <p>左侧「配置」面板里的字段会渲染到封面页：</p>
        <table className="syntax-guide-table">
          <thead>
            <tr>
              <th>字段</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>标题 / 副标题</td>
              <td>封面主标题与副标题</td>
            </tr>
            <tr>
              <td>作者 / 单位 / 日期</td>
              <td>封面下方的署名信息，留空则不显示</td>
            </tr>
            <tr>
              <td>主题</td>
              <td>
                Simple、Metropolis、Dewdrop、Aqua、University、Stargazer
                六套配色与版式
              </td>
            </tr>
          </tbody>
        </table>
        <Note>
          主题只影响样式，不影响内容；同一份 Markdown 换主题后版式会自动适配。
          图片在正文里用路径引用，配置面板不再管理图片。
        </Note>
      </>
    ),
  },
  {
    id: "save",
    title: "保存与导出",
    body: (
      <>
        <table className="syntax-guide-table">
          <thead>
            <tr>
              <th>操作</th>
              <th>位置</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>保存 / 另存为</td>
              <td>文件菜单</td>
              <td>存为 .csg 文档，图片一并存入，可再次打开继续编辑</td>
            </tr>
            <tr>
              <td>下载到本地</td>
              <td>文件菜单</td>
              <td>导出为 JSON，便于备份或版本管理</td>
            </tr>
            <tr>
              <td>导出 PDF</td>
              <td>文件菜单</td>
              <td>最终成品，动画会展开为多页</td>
            </tr>
            <tr>
              <td>导出 Typst 源代码</td>
              <td>文件菜单</td>
              <td>
                得到 zip，可用 <code>typst compile main.typ</code>
                自行编译或二次加工
              </td>
            </tr>
          </tbody>
        </table>
      </>
    ),
  },
  {
    id: "keys",
    title: "快捷键",
    body: (
      <table className="syntax-guide-table">
        <thead>
          <tr>
            <th>快捷键</th>
            <th>功能</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <kbd>Ctrl</kbd> + <kbd>O</kbd>
            </td>
            <td>打开文档</td>
          </tr>
          <tr>
            <td>
              <kbd>Ctrl</kbd> + <kbd>S</kbd>
            </td>
            <td>保存</td>
          </tr>
          <tr>
            <td>
              <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>
            </td>
            <td>另存为</td>
          </tr>
          <tr>
            <td>
              <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd>
            </td>
            <td>导出 PDF</td>
          </tr>
          <tr>
            <td>
              <kbd>Ctrl</kbd> + <kbd>V</kbd>
            </td>
            <td>粘贴（含图片）</td>
          </tr>
        </tbody>
      </table>
    ),
  },
  {
    id: "faq",
    title: "常见问题",
    body: (
      <>
        <p>
          <strong>预览一直空白？</strong>
          首次打开需要初始化排版引擎（几秒），之后会很快。若持续空白，
          先检查 Markdown 是否有未闭合的代码块或表格。
        </p>
        <p>
          <strong>图片显示不出来？</strong>
          本机图片要写<strong>完整的绝对路径</strong>（<code>E:\pics\a.png</code>
          或 <code>E:/pics/a.png</code>），相对路径 <code>./a.png</code>{" "}
          不会被识别；路径变了、文件被删了同样会失败。
          网络图片要先确认这台机器能上网，且地址本身可以直接打开。
        </p>
        <p>
          <strong>分页没生效？</strong>
          <code>---</code> 必须独占一行，且前后各有一个空行；
          写在段落末尾会变成一条装饰线。
        </p>
        <p>
          <strong>表格错位？</strong>
          每行的竖线数量要和表头一致，合并单元格只写 <code>{"<"}</code> 或{" "}
          <code>^</code>。
        </p>
        <p>
          <strong>想要 Markdown 做不到的效果？</strong>
          导出 Typst 源代码，在 <code>main.typ</code> 里直接写 Typst ——
          模板本身就是完整的 Touying。
        </p>
      </>
    ),
  },
];

const SyntaxGuide: FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollTo = useCallback((id: string) => {
    contentRef.current
      ?.querySelector(`#syntax-${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <Drawer
      className="syntax-guide-drawer"
      title="Markdown 语法说明"
      placement="right"
      size="min(1000px, 94vw)"
      open={open}
      onClose={onClose}
      styles={{ body: { padding: 0 } }}
    >
      <div className="syntax-guide">
        <nav className="syntax-guide-toc">
          <div className="syntax-guide-toc-title">目录</div>
          {SECTIONS.map(({ id, title }) => (
            <button key={id} type="button" onClick={() => scrollTo(id)}>
              {title}
            </button>
          ))}
        </nav>
        <article className="syntax-guide-content" ref={contentRef}>
          {SECTIONS.map(({ id, title, body }) => (
            <section key={id} id={`syntax-${id}`}>
              <h2>{title}</h2>
              {body}
            </section>
          ))}
        </article>
      </div>
    </Drawer>
  );
};

export default SyntaxGuide;
