import type { NavigateFunction } from "react-router";

import { navigateToEditorWithDoc } from "@/router/editor/navigationState";
import { toImmerContent } from "@/utils/contestDataUtils";
import { exampleDocuments, loadExampleContent } from "@/utils/exampleDocuments";

/**
 * 应用只保留 touying 一个模板，因此「新建文档」不再弹出模板选择，
 * 直接用内置示例的内容开一份未保存的新文稿。
 */
const DEFAULT_EXAMPLE = "touying-demo";

export async function createDefaultDocument(navigate: NavigateFunction) {
  const name = exampleDocuments[DEFAULT_EXAMPLE]
    ? DEFAULT_EXAMPLE
    : Object.keys(exampleDocuments)[0];
  if (!name) throw new Error("No example document available");

  const { meta } = exampleDocuments[name];
  const content = await loadExampleContent(name);

  navigateToEditorWithDoc(
    navigate,
    {
      name: meta.title,
      templateId: meta.template,
      content: toImmerContent(content),
    },
    ["tmp", crypto.randomUUID()],
  );
}
