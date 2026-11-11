import { listen, sendToMain } from "@mr.python/promise-worker-ts";
import type { PromiseWorkerTagged } from "@mr.python/promise-worker-ts";
import {
  createTypstCompiler,
  createTypstRenderer,
  FetchPackageRegistry,
  loadFonts,
  MemoryAccessModel,
  type TypstCompiler,
  type TypstRenderer,
} from "@myriaddreamin/typst.ts";
import { CompileFormatEnum } from "@myriaddreamin/typst.ts/compiler";
import {
  disableDefaultFontAssets,
  withAccessModel,
  withPackageRegistry,
} from "@myriaddreamin/typst.ts/options.init";
import { Mutex } from "async-mutex";

import type { CompiledContent, PrecompileContent } from "@/types/document";
import {
  importTypstContents,
  importUnifiedPlugins,
} from "@/utils/importTemplate";

import getProcessor from "./getProcessor";

const typstAccessModel = new MemoryAccessModel();

type PackageSpec = Parameters<FetchPackageRegistry["resolvePath"]>[0];

/** 随应用分发、无需联网即可使用的 typst 包（tar.gz 原始字节）。 */
export type BundledTypstPackage = {
  namespace: string;
  name: string;
  version: string;
  data: ArrayBuffer;
};

/**
 * 优先使用随应用一起分发的 typst 包（public/typst-packages），
 * 找不到时再回落到官方 registry —— 这样桌面版断网也能编译，
 * 而模板里新引入的包仍然可用（需要联网拉取一次）。
 */
class LocalFirstPackageRegistry extends FetchPackageRegistry {
  private readonly localPackages: Map<string, Uint8Array>;

  constructor(am: MemoryAccessModel, packages: BundledTypstPackage[] | undefined) {
    super(am);
    this.localPackages = new Map(
      (packages ?? []).map((pkg) => [
        `${pkg.namespace}/${pkg.name}/${pkg.version}`,
        new Uint8Array(pkg.data),
      ]),
    );
  }

  override pullPackageData(path: PackageSpec): Uint8Array | undefined {
    const bundled = this.localPackages.get(
      `${path.namespace}/${path.name}/${path.version}`,
    );
    if (bundled) return bundled;
    return super.pullPackageData(path);
  }
}


let processor: ReturnType<typeof getProcessor>;
let compiler: TypstCompiler;
let renderer: TypstRenderer;

const mappedShadow: Map<string, Uint8Array> = new Map();

function mapShadow(filename: string, data: Uint8Array) {
  mappedShadow.set(filename, data);
  compiler.mapShadow(filename, data);
}
function unmapShadow(filename: string) {
  mappedShadow.delete(filename);
  compiler.unmapShadow(filename);
}
function addSource(filename: string, data: string) {
  mappedShadow.set(filename, new TextEncoder().encode(data));
  compiler.addSource(filename, data);
}

listen<InitMessage>("init", async (data) => {
  compiler = createTypstCompiler();
  renderer = createTypstRenderer();
  await Promise.all([
    compiler.init({
      getModule: () => data.typstCompilerWasm,
      beforeBuild: [
        disableDefaultFontAssets(),
        loadFonts(data.fontBuffers.map((x) => new Uint8Array(x))),
        withAccessModel(typstAccessModel),
        withPackageRegistry(
          new LocalFirstPackageRegistry(typstAccessModel, data.typstPackages),
        ),
      ],
    }),
    renderer.init({
      getModule: () => data.typstRendererWasm,
    }),
    (async () => {
      processor = getProcessor(await importUnifiedPlugins(data.template));
    })(),
  ]);
  for (const [filename, content] of await importTypstContents(data.template))
    addSource(filename, content);
});

const SHADOW_CACHE_AGE = 1000 * 30;
const shadowCacheTime = new Map<string, number>();
let lastProblemCount = 0;
let lastExtraContents = new Set<string>();
function compilerPrepare(
  data: PrecompileContent,
): [CompiledContent, [string, string][]] {
  const assets = new Map<string, string>();
  const compiledProblems = data.problems.map((problem) => {
    const res = processor.processSync(problem.markdown);
    for (const v of res.data.assets || []) assets.set(v.filename, v.assetUrl);
    return {
      ...problem,
      typst: res.toString(),
    };
  });
  const compiledExtraContents = Object.fromEntries(
    Object.entries(data.extraContents).map(([key, content]) => {
      const res = processor.processSync(content.markdown);
      for (const v of res.data.assets || []) assets.set(v.filename, v.assetUrl);
      return [
        key,
        {
          ...content,
          typst: res.toString(),
        },
      ] as const;
    }),
  );
  return [
    {
      ...data,
      problems: compiledProblems,
      extraContents: compiledExtraContents,
    },
    Array.from(assets.entries()),
  ];
}

async function typstPrepare(content: PrecompileContent) {
  const now = Date.now();
  for (const [filename, expire] of Array.from(shadowCacheTime.entries()))
    if (expire === -1) shadowCacheTime.set(filename, now + SHADOW_CACHE_AGE);
    else if (now > expire) {
      unmapShadow("/" + filename);
      shadowCacheTime.delete(filename);
    }
  const [compiledContent, assets] = compilerPrepare(content);
  await Promise.all(
    assets.map(async ([filename, assetUrl]) => {
      const cached = shadowCacheTime.get(filename);
      if (cached === undefined)
        mapShadow(
          "/" + filename,
          new Uint8Array(
            await sendToMain<FetchAssetMessage>("fetchAsset", assetUrl),
          ),
        );
      shadowCacheTime.set(filename, -1);
    }),
  );
  addSource("/content.json", JSON.stringify(compiledContent));
  for (const filename of lastExtraContents) unmapShadow(`/${filename}.typ`);
  lastExtraContents = new Set<string>();
  for (const [filename, content] of Object.entries(
    compiledContent.extraContents,
  )) {
    lastExtraContents.add(filename);
    addSource(`/extra-${filename}.typ`, content.typst);
  }
  for (let i = 0; i < compiledContent.problems.length; ++i)
    addSource(`/problem-${i}.typ`, compiledContent.problems[i].typst);
  for (let i = compiledContent.problems.length; i < lastProblemCount; ++i)
    unmapShadow(`/problem-${i}.typ`);
  lastProblemCount = content.problems.length;
}

const mutex = new Mutex();

listen<CompileTypstMessage>("compileTypst", async (data) =>
  mutex.runExclusive(async () => {
    await typstPrepare(data);
    const result = await compiler.compile({
      format: CompileFormatEnum.pdf,
      mainFilePath: "/main.typ",
    });
    if (!result.result) throw result.diagnostics;
    return result.result;
  }),
);

listen<RenderTypstMessage>("renderTypst", async (data) =>
  mutex.runExclusive(async () => {
    await typstPrepare(data);
    const result = await compiler.compile({
      format: CompileFormatEnum.vector,
      mainFilePath: "/main.typ",
    });
    const vector = result.result;
    if (!vector) throw result.diagnostics;
    return await renderer.runWithSession(async (session) => {
      renderer.manipulateData({
        renderSession: session,
        action: "reset",
        data: vector,
      });
      return renderer.renderSvg({
        renderSession: session,
      });
    });
  }),
);
listen<ExportTypstSourceZipMessage>("exportTypstSourceZip", async (data) =>
  mutex.runExclusive(async () => {
    await typstPrepare(data);
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    mappedShadow.forEach((value, key) => {
      zip.file(key.slice(1), value);
    });
    return zip.generateAsync({ type: "arraybuffer" });
  }),
);

export type InitMessage = PromiseWorkerTagged<
  "init",
  {
    typstCompilerWasm: ArrayBuffer;
    typstRendererWasm: ArrayBuffer;
    fontBuffers: ArrayBuffer[];
    template: string;
    typstPackages?: BundledTypstPackage[];
  },
  void
>;
export type CompileTypstMessage = PromiseWorkerTagged<
  "compileTypst",
  PrecompileContent,
  Uint8Array
>;
export type RenderTypstMessage = PromiseWorkerTagged<
  "renderTypst",
  PrecompileContent,
  string
>;
export type FetchAssetMessage = PromiseWorkerTagged<
  "fetchAsset",
  string,
  ArrayBuffer
>;
export type ExportTypstSourceZipMessage = PromiseWorkerTagged<
  "exportTypstSourceZip",
  PrecompileContent,
  ArrayBuffer
>;
