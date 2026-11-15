import type { Root } from "mdast";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, test } from "vitest";

import remarkLenientImage from "@/compiler/remarkLenientImage";

const processor = unified().use(remarkParse).use(remarkLenientImage);

function parse(markdown: string) {
  return processor.runSync(processor.parse(markdown)) as Root;
}

function firstParagraphChildren(markdown: string) {
  const tree = parse(markdown);
  const paragraph = tree.children.find((node) => node.type === "paragraph");
  if (!paragraph || paragraph.type !== "paragraph")
    throw new Error("no paragraph");
  return paragraph.children;
}

describe("remarkLenientImage", () => {
  test("keeps images that CommonMark already understands", () => {
    const children = firstParagraphChildren("![](https://example.com/a.png)");
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      type: "image",
      url: "https://example.com/a.png",
    });
  });

  test("keeps angle-bracket destinations with spaces", () => {
    const children = firstParagraphChildren(
      "![test](<E:/my pics/a.png>)",
    );
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      type: "image",
      url: "E:/my pics/a.png",
      alt: "test",
    });
  });

  test("recovers a bare Windows path containing spaces", () => {
    const children = firstParagraphChildren(
      "![test](E:\\Other\\github project\\test.jpeg)",
    );
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      type: "image",
      url: "E:\\Other\\github project\\test.jpeg",
      alt: "test",
    });
  });

  test("recovers a bare POSIX path containing spaces", () => {
    const children = firstParagraphChildren("![a](/home/me/my pics/a.png)");
    expect(children).toHaveLength(1);
    expect(children[0]).toMatchObject({
      type: "image",
      url: "/home/me/my pics/a.png",
    });
  });

  test("keeps surrounding text around the recovered image", () => {
    const children = firstParagraphChildren("见 ![a](C:\\a b.png) 效果");
    expect(children.map((node) => node.type)).toEqual([
      "text",
      "image",
      "text",
    ]);
    expect(children[1]).toMatchObject({ type: "image", url: "C:\\a b.png" });
    expect(children[2]).toMatchObject({ type: "text", value: " 效果" });
  });

  test("leaves inline code untouched", () => {
    const children = firstParagraphChildren("`![a](C:\\a b.png)`");
    expect(children.map((node) => node.type)).toEqual(["inlineCode"]);
  });

  test("leaves fenced code blocks untouched", () => {
    const tree = parse("```\n![a](C:\\a b.png)\n```");
    expect(tree.children[0]).toMatchObject({ type: "code" });
  });

  test("ignores text that does not look like an image address", () => {
    const children = firstParagraphChildren("![a](C:\\a b.png) 之后");
    // 有空格但确实以图片扩展名结尾 → 仍然识别为图片
    expect(children[0]).toMatchObject({ type: "image" });
    const notImage = firstParagraphChildren("![a](C:\\a b.txt)");
    expect(notImage[0]).toMatchObject({ type: "text" });
  });
});
