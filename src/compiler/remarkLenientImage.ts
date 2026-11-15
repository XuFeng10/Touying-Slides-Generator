/**
 * 容忍「带空格的本地图片路径」。
 *
 * `![图](E:\Other\github project\test.jpeg)` 这种写法在 CommonMark 里是**非法**的
 * （链接地址里不允许裸空格），remark 会把它当成普通文字，图片就消失了。
 * 但手动写绝对路径时几乎必然会碰到空格，Typora 里也是直接写路径。
 *
 * 这里在解析之后做一次收尾：如果某段文字其实是「图片语法 + 带空格的地址」，
 * 就把它还原成真正的 image 节点。只处理看起来像图片地址的字符串，
 * 代码块、行内代码不受影响。
 */
import type mdast from "mdast";
import { type Plugin } from "unified";
import { visit } from "unist-util-visit";

const IMAGE_TEXT_RE = /!\[([^\]\n]*)\]\(([^()\n]+)\)/g;
const ADDRESS_START_RE = /^(?:[a-zA-Z]:[\\/]|\\\\|\/|\.{1,2}[\\/]|https?:\/\/)/;
const IMAGE_EXT_RE = /\.(?:png|jpe?g|gif|svg|webp|bmp|avif|ico)$/i;

function splitText(value: string): mdast.PhrasingContent[] | undefined {
  if (!value.includes("![")) return undefined;

  const parts: mdast.PhrasingContent[] = [];
  let cursor = 0;
  let changed = false;

  for (const match of value.matchAll(IMAGE_TEXT_RE)) {
    const [raw, alt, rawUrl] = match;
    const url = rawUrl.trim();
    // 没有空格时 remark 本来就能正确解析，交给它自己处理
    if (!/\s/.test(url)) continue;
    if (!ADDRESS_START_RE.test(url)) continue;
    if (!IMAGE_EXT_RE.test(url)) continue;

    const start = match.index ?? 0;
    if (start > cursor)
      parts.push({ type: "text", value: value.slice(cursor, start) });
    parts.push({ type: "image", url, alt, title: null });
    cursor = start + raw.length;
    changed = true;
  }

  if (!changed) return undefined;
  if (cursor < value.length)
    parts.push({ type: "text", value: value.slice(cursor) });
  return parts;
}

const remarkLenientImage: Plugin<[], mdast.Root, mdast.Root> = () => {
  return (tree) => {
    visit(tree, "paragraph", (node) => {
      if (!node.children.some((child) => child.type === "text")) return;
      node.children = node.children.flatMap((child) => {
        if (child.type !== "text") return [child];
        return splitText(child.value) ?? [child];
      });
    });
  };
};

export default remarkLenientImage;
