// 下载 touying 模板依赖的 typst 包，放进 public/typst-packages。
// 这些 tar.gz 会随构建产物一起打包，使桌面版可以完全离线编译。
// 用法：node scripts/fetch-typst-packages.mjs [--force]
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = "https://packages.typst.org";

// 与 templates/touying/typst/header.typ 中的 import 保持一致
const PACKAGES = [
  { namespace: "preview", name: "touying", version: "0.6.1" },
  { namespace: "preview", name: "mitex", version: "0.2.5" },
];

const force = process.argv.includes("--force");

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

for (const pkg of PACKAGES) {
  const dir = path.join(ROOT, "public", "typst-packages", pkg.namespace);
  const filePath = path.join(dir, `${pkg.name}-${pkg.version}.tar.gz`);
  if (!force && (await exists(filePath))) {
    console.log(`跳过 ${path.relative(ROOT, filePath)}（已存在）`);
    continue;
  }
  const url = `${REGISTRY}/${pkg.namespace}/${pkg.name}-${pkg.version}.tar.gz`;
  console.log(`下载 ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载失败 ${url}: HTTP ${response.status}`);
  }
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
  console.log(`已保存 ${path.relative(ROOT, filePath)}`);
}
