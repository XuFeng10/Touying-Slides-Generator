import Dexie from "dexie";

import type {
  ContentBase,
  DocumentContentOnly,
  DocumentMeta,
} from "@/types/document";
import resolveUniqueDocumentName from "@/utils/resolveUniqueDocumentName";

/**
 * Dexie database schema.
 *
 * 版本 2 的 upgrade 是上游项目遗留的历史数据迁移链（迁移旧版题面数据）。
 * 保留整条版本链是为了让已有浏览器数据库仍能正常升级；本应用只会打开
 * touying 模板的文档，这些历史记录不参与渲染。
 */
class AppDatabase extends Dexie {
  // Using Table instead of EntityTable to support non-inlined keys
  documents_content!: Dexie.Table<DocumentContentOnly, string>;
  documents_meta!: Dexie.Table<DocumentMeta, string>;

  fs_handles!: Dexie.Table<
    { filename: string; handles: FileSystemFileHandle[] },
    string
  >;

  recently_opened!: Dexie.Table<
    { pathKey: string; name: string; openedAt: Date; previewImage?: Blob },
    string
  >;

  constructor() {
    // 沿用上游数据库名，避免已有浏览器中的文档和最近打开记录丢失
    super("cnoi-statement-generator");
    this.version(1).stores({
      config: "",
      images: "uuid",
    });
    this.version(2)
      .stores({
        config: null,
        images: null,
        documents: "uuid",
      })
      .upgrade(async (tx) => {
        const images = Object.fromEntries(
          (await tx.table("images").toArray()).map(
            (img: { uuid: string; blob: Blob }) => [img.uuid, img.blob],
          ),
        );
        const oldConfigs = (await tx
          .table("config")
          .toArray()) as import("@/types/_oldContestData").StoredContestData[];
        for (const old of oldConfigs) {
          const doc = {
            content: {
              title: old.title,
              date: old.date,
              dayname: old.dayname,
              subtitle: old.subtitle,
              noi_style: old.noi_style,
              file_io: old.file_io,
              use_pretest: old.use_pretest,
              code_font: "fira-mono",
              support_languages: old.support_languages.map((x) => ({
                uuid: crypto.randomUUID(),
                name: x.name,
                compile_options: x.compile_options,
              })),
              problems: old.problems.map((x) => ({
                uuid: crypto.randomUUID(),
                type: x.type,
                title: x.title,
                name: x.name,
                dir: x.dir,
                exec: x.exec,
                input: x.input,
                output: x.output,
                time_limit: x.time_limit,
                memory_limit: x.memory_limit,
                testcase: x.testcase,
                point_equal: x.point_equal,
                submit_filename: x.submit_filename,
                pretestcase: x.pretestcase,
                markdown: x.statementMarkdown,
                advancedEditing: true,
              })),
              extraContents: {
                precaution: {
                  markdown: old.precautionMarkdown,
                },
              },
              images: old.images.map((img) => ({
                uuid: img.uuid,
                name: img.name,
                blob: images[img.uuid],
              })),
            } as ContentBase,
            name: old.title,
            templateId: "cnoi",
            modifiedAt: new Date().toISOString(),
          };
          await tx.table("documents").put(doc);
        }
      });

    this.version(3)
      .stores({
        documents: null,
        documents_content: "uuid",
        documents_meta: "uuid",
      })
      .upgrade(async (tx) => {
        await tx
          .table("documents")
          .toArray()
          .then((docs) =>
            docs.map((doc) => ({ uuid: doc.uuid, content: doc.content })),
          )
          .then((docs) => tx.table("documents_content").bulkPut(docs));
        const docs = await tx.table("documents").toArray();
        const metas: DocumentMeta[] = docs.map((doc) => ({
          name: doc.name,
          templateId: doc.templateId,
          modifiedAt: doc.modifiedAt,
          previewImage: undefined,
        }));
        await tx.table("documents_meta").bulkPut(metas);
      });

    this.version(4)
      .stores({
        documents_content_by_name: "name",
        documents_meta_by_name: "name",
      })
      .upgrade(async (tx) => {
        const oldMetaEntries = (await tx
          .table("documents_meta")
          .toArray()) as Array<DocumentMeta & { uuid: string }>;
        const oldContentEntries = (await tx
          .table("documents_content")
          .toArray()) as Array<{ uuid: string; content: ContentBase }>;
        const contentByUuid = new Map(
          oldContentEntries.map(
            (entry) => [entry.uuid, entry.content] as const,
          ),
        );
        const seenNames = new Set<string>();
        const newContentEntries: DocumentContentOnly[] = [];
        const newMetaEntries: DocumentMeta[] = [];

        for (const oldMeta of oldMetaEntries) {
          const content = contentByUuid.get(oldMeta.uuid);
          if (!content) continue;

          const uniqueName = resolveUniqueDocumentName(oldMeta.name, seenNames);
          seenNames.add(uniqueName);

          newContentEntries.push({
            name: uniqueName,
            content,
          });
          newMetaEntries.push({
            name: uniqueName,
            templateId: oldMeta.templateId,
            modifiedAt: oldMeta.modifiedAt,
            // @ts-expect-error old schema
            previewImage: oldMeta.previewImage,
          });
        }

        await tx.table("documents_content_by_name").bulkPut(newContentEntries);
        await tx.table("documents_meta_by_name").bulkPut(newMetaEntries);
      });

    this.version(5).stores({
      documents_content: null,
      documents_meta: null,
      documents_content_by_name: "name",
      documents_meta_by_name: "name",
    });

    this.version(6)
      .stores({
        documents_content_by_name: null,
        documents_meta_by_name: null,
        documents_content: "name",
        documents_meta: "name",
      })
      .upgrade(async (tx) => {
        const oldContentEntries = (await tx
          .table("documents_content_by_name")
          .toArray()) as DocumentContentOnly[];
        const oldMetaEntries = (await tx
          .table("documents_meta_by_name")
          .toArray()) as DocumentMeta[];

        await tx.table("documents_content").bulkPut(oldContentEntries);
        await tx.table("documents_meta").bulkPut(oldMetaEntries);
      });

    this.version(7)
      .stores({
        documents_content: "name",
        documents_meta: "name",
      })
      .upgrade(async (tx) => {
        const oldMetaEntries = (await tx
          .table("documents_meta")
          .toArray()) as Array<DocumentMeta & { modifiedAt: string }>;

        const newMetaEntries = oldMetaEntries.map((meta) => ({
          ...meta,
          modifiedAt: new Date(meta.modifiedAt),
        }));

        await tx.table("documents_meta").bulkPut(newMetaEntries);
      });

    this.version(8).stores({
      fs_handles: "filename",
    });

    this.version(9).stores({
      fs_handles: "filename",
    });

    this.version(10).stores({
      recently_opened: "pathKey",
    });
  }
}

const db = new AppDatabase();

export default db;
