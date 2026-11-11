import z from "zod";

import type { DocumentBase } from "@/types/document";

import { getZDocument } from "./documentZod";
import { importContentZod } from "./importTemplate";

export async function documentToJson(doc: DocumentBase) {
  return JSON.stringify(
    await getZDocument(await importContentZod(doc.templateId)).encodeAsync(doc),
  );
}

export async function jsonToDocument(str: string): Promise<DocumentBase> {
  const obj = JSON.parse(str);
  const docBase = await getZDocument(z.any()).parseAsync(obj);
  if (docBase.templateId !== "touying")
    throw new Error(
      `不支持的文档模板 "${docBase.templateId}"：本应用仅支持 touying 演示文稿`,
    );
  return getZDocument(await importContentZod(docBase.templateId)).parseAsync(
    obj,
  );
}
