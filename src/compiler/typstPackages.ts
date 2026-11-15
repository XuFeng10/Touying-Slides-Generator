/**
 * 随应用一起分发的 typst 包。
 *
 * touying 模板里 `#import "@preview/touying:0.6.1"` / `"@preview/mitex:0.2.5"`
 * 默认由 FetchPackageRegistry 在编译时联网拉取；桌面版需要离线可用，
 * 所以这里把对应 tar.gz 放进 public/typst-packages，由主线程预取后传给 Worker。
 *
 * 新增包时：把 `<name>-<version>.tar.gz` 放到 public/typst-packages/<namespace>/，
 * 并在下表补一行即可（缺文件不会报错，会自动回落到联网拉取）。
 */
export type LocalTypstPackage = {
  namespace: string;
  name: string;
  version: string;
  data: ArrayBuffer;
};

const BUNDLED_PACKAGES = [
  { namespace: "preview", name: "touying", version: "0.6.1" },
  { namespace: "preview", name: "mitex", version: "0.2.5" },
] as const;

function packageUrl(namespace: string, name: string, version: string): string {
  return `${import.meta.env.BASE_URL}typst-packages/${namespace}/${name}-${version}.tar.gz`;
}

let cache: Promise<LocalTypstPackage[]> | undefined;

/**
 * 有些静态服务器（Vite dev / vite preview）看到 `.tar.gz` 就认为内容已经压过，
 * 于是额外加上 `Content-Encoding: gzip`，浏览器又替你解压一次 —— 结果
 * `arrayBuffer()` 拿到的其实是没压缩的 tar，而 Typst 的 untar 只认 gzip，
 * 会报 `invalid gzip header`。这里检测魔数，必要时补一次压缩，
 * 让开发预览、浏览器构建和桌面端表现一致。
 */
async function ensureGzip(data: ArrayBuffer): Promise<ArrayBuffer> {
  const head = new Uint8Array(data, 0, Math.min(2, data.byteLength));
  if (head[0] === 0x1f && head[1] === 0x8b) return data;
  if (typeof CompressionStream === "undefined") return data;
  const compressed = new Blob([data])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return new Response(compressed).arrayBuffer();
}

export function loadLocalTypstPackages(): Promise<LocalTypstPackage[]> {
  cache ??= Promise.all(
    BUNDLED_PACKAGES.map(async (pkg): Promise<LocalTypstPackage | undefined> => {
      const url = packageUrl(pkg.namespace, pkg.name, pkg.version);
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { ...pkg, data: await ensureGzip(await response.arrayBuffer()) };
      } catch (e) {
        console.warn(`未找到内置 typst 包 ${url}，将回落到联网拉取。`, e);
        return undefined;
      }
    }),
  ).then((packages) => packages.filter((pkg) => pkg !== undefined));
  return cache;
}
