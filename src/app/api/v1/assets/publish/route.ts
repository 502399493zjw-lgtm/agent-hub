import { NextRequest, NextResponse } from "next/server";
import {
    createAsset,
    getAssetById,
    updateAsset,
    findUserById,
    getDb,
} from "@/lib/db";
import {
    addCoins,
    USER_REP_EVENTS,
    SHRIMP_COIN_EVENTS,
} from "@/lib/db/economy";
import {
    authenticateAndCheckBan,
    unauthorizedResponse,
    bannedResponse,
    inviteRequiredResponse,
} from "@/lib/api-auth";
import {
    computePackageSha256,
    findDuplicateByHash,
    findSimilarAssets,
} from "@/lib/dedup";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { execSync } from "child_process";

// ─────────────────────────────────────────────────────────────────────────────
// 本路由实现了 /api/v1/assets/publish 端点（发布或更新资产包）
// 主要流程：
// 1) 鉴权 + 邀请码/封禁校验
// 2) 读取 multipart/form-data：解析 metadata JSON + 包文件(package)
// 3) 对包文件进行类型校验与解压，收集文本文件用于内容校验
// 4) 按资产类型（skill/plugin/channel/trigger/experience）做结构校验
// 5) 服务端补全 displayName/description/readme
// 6) 查重（哈希层面）+ 相似度检测（内容层面）
// 7) 写入数据库（创建或更新），保存包文件
// 8) 返回结果（携带 warnings 等信息）
// ─────────────────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB：单个上传文件大小上限（防止过大）
const PACKAGES_DIR = path.join(process.cwd(), "data", "packages"); // 包文件持久化目录

export const dynamic = "force-dynamic"; // 强制动态（避免被静态化/缓存）

// ─── 发布校验辅助函数 ────────────────────────────────────────────────────────

/**
 * 解析 Frontmatter（--- 分隔的头部 + 正文），返回 { frontmatter, body }
 */
function parseFrontmatter(content: string): {
    frontmatter: Record<string, string>;
    body: string;
} {
    const fm: Record<string, string> = {};
    let body = content;
    // 使用正则匹配头部与正文，头部与正文间以 --- 分隔
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)/);
    if (match) {
        // 逐行解析 key: value；忽略空行与注释行
        for (const line of match[1].split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#")) continue;
            const kv = trimmed.match(/^([\w-]+)\s*:\s*(.*)/);
            if (kv) {
                let val = kv[2].trim();
                // 去掉可能包裹的引号
                if (
                    (val.startsWith('"') && val.endsWith('"')) ||
                    (val.startsWith("'") && val.endsWith("'"))
                ) {
                    val = val.slice(1, -1);
                }
                fm[kv[1]] = val;
            }
        }
        body = match[2].trim();
    }
    return { frontmatter: fm, body };
}

/**
 * 从 README 文本提取：
 * - 标题（第一处 “# 标题”）
 * - 描述（第一段非空且非标题/分隔/引用的文本）
 */
function extractFromReadme(content: string): {
    title: string;
    description: string;
} {
    let title = "",
        description = "";
    for (const line of content.split("\n")) {
        const t = line.trim();
        // 先找 H1 标题
        if (!title) {
            const m = t.match(/^#\s+(.+)$/);
            if (m) {
                title = m[1].trim();
                continue;
            }
        }
        // 再找首个描述段落
        if (
            title &&
            !description &&
            t &&
            !t.startsWith("#") &&
            !t.startsWith("---") &&
            !t.startsWith(">")
        ) {
            description = t;
            break;
        }
    }
    return { title, description };
}

// 校验结果结构体（便于返回详细错误与提取信息）
interface ValidationResult {
    valid: boolean; // 是否通过
    error?: string; // 错误提示（人类可读）
    missing?: string[]; // 缺失项清单
    hint?: string; // 修正建议
    required?: Record<string, string>; // 必填项状态（✅/❌）
    extractedDisplayName?: string; // 从包内容提取的展示名
    extractedDescription?: string; // 从包内容提取的描述
    extractedReadme?: string; // 从包内容提取的 README 文本
}

/**
 * 按资产类型进行结构校验，并在必要时从文本文件提取展示名/描述/README。
 * @param type 资产类型
 * @param textFiles 解压后收集到的文本文件映射（路径→内容）
 * @param metadata 前端提供的可选字段（优先使用），缺失时用提取值补全
 */
function validatePackageByType(
    type: string,
    textFiles: Map<string, string>,
    metadata: { displayName?: string; description?: string; readme?: string },
): ValidationResult {
    const missing: string[] = [];
    // 以下变量为可补全字段的临时容器
    let dn = metadata.displayName || "";
    let desc = metadata.description || "";
    let readme = metadata.readme || "";

    switch (type) {
        case "skill": {
            // skill 类型要求存在 SKILL.md，并且 frontmatter 里具备 name/displayName/description 且正文不为空
            const skillMd = textFiles.get("SKILL.md");
            if (!skillMd) {
                return {
                    valid: false,
                    error: "发布校验失败：缺少 SKILL.md",
                    missing: ["SKILL.md"],
                    hint: "请创建 SKILL.md，包含 frontmatter（name, description）和技能说明正文。",
                    required: { "SKILL.md": "❌" },
                };
            }
            const { frontmatter: fm, body } = parseFrontmatter(skillMd);
            if (!fm.name && !fm.displayName && !fm["display-name"])
                missing.push("SKILL.md frontmatter: name");
            if (!fm.description)
                missing.push("SKILL.md frontmatter: description");
            if (!body) missing.push("SKILL.md 正文（frontmatter 之后的内容）");
            if (missing.length) {
                return {
                    valid: false,
                    error: "SKILL.md 信息不完整",
                    missing,
                    hint: "SKILL.md 需要 frontmatter（name, description）和正文。",
                    required: {
                        "SKILL.md": "✅",
                        name:
                            fm.name || fm.displayName || fm["display-name"]
                                ? "✅"
                                : "❌",
                        description: fm.description ? "✅" : "❌",
                        body: body ? "✅" : "❌",
                    },
                };
            }
            // 用 frontmatter/正文补齐展示名、描述与 README
            dn = dn || fm.displayName || fm["display-name"] || fm.name;
            desc = desc || fm.description;
            readme = readme || body;
            break;
        }

        case "plugin":
        case "channel": {
            // plugin/channel 类型要求：openclaw.plugin.json（含 id；channel 还需 channels 非空）+ README.md
            const pj = textFiles.get("openclaw.plugin.json");
            if (!pj) {
                return {
                    valid: false,
                    error: `缺少 openclaw.plugin.json`,
                    missing: ["openclaw.plugin.json"],
                    hint: `${type} 类型必须包含 openclaw.plugin.json。`,
                };
            }
            let pd: Record<string, unknown>;
            try {
                pd = JSON.parse(pj);
            } catch {
                return {
                    valid: false,
                    error: "openclaw.plugin.json JSON 格式错误",
                    missing: ["valid JSON"],
                };
            }
            if (!pd.id) missing.push("openclaw.plugin.json: id");
            if (
                type === "channel" &&
                (!Array.isArray(pd.channels) ||
                    !(pd.channels as unknown[]).length)
            ) {
                missing.push("openclaw.plugin.json: channels 数组");
            }
            const rm = textFiles.get("README.md");
            if (!rm) missing.push("README.md");
            if (missing.length) {
                return {
                    valid: false,
                    error: `发布校验失败：${missing.join("、")}`,
                    missing,
                    hint: `${type} 需要 openclaw.plugin.json（含 id${type === "channel" ? " + channels" : ""}）和 README.md。`,
                };
            }
            const ri = extractFromReadme(rm!);
            dn = dn || (pd.name as string) || ri.title;
            desc = desc || (pd.description as string) || ri.description;
            readme = readme || rm!;
            if (!dn) missing.push("displayName");
            if (!desc) missing.push("description");
            if (missing.length) {
                return {
                    valid: false,
                    error: `无法提取 ${missing.join("、")}`,
                    missing,
                    hint: "请在 openclaw.plugin.json 添加 name/description，或确保 README.md 有标题和描述。",
                };
            }
            break;
        }

        case "trigger":
        case "experience": {
            // trigger/experience 类型：只要求 README.md，标题与描述必须能从 README 中提取
            const rm = textFiles.get("README.md");
            if (!rm) {
                return {
                    valid: false,
                    error: `缺少 README.md`,
                    missing: ["README.md"],
                    hint: `${type} 类型必须包含 README.md（标题 + 描述段落）。`,
                };
            }
            const ri = extractFromReadme(rm);
            if (!ri.title) missing.push("README.md 标题（# xxx）");
            if (!ri.description) missing.push("README.md 描述段落");
            if (missing.length) {
                return {
                    valid: false,
                    error: "README.md 信息不完整",
                    missing,
                    hint: "README.md 需要标题行（# 名称）和描述段落。",
                    required: {
                        "README.md": "✅",
                        title: ri.title ? "✅" : "❌",
                        description: ri.description ? "✅" : "❌",
                    },
                };
            }
            dn = dn || ri.title;
            desc = desc || ri.description;
            readme = readme || rm;
            break;
        }
    }

    // 校验通过，返回可能提取到的字段
    return {
        valid: true,
        extractedDisplayName: dn,
        extractedDescription: desc,
        extractedReadme: readme,
    };
}

// ─── POST 处理器 ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        // 1) 鉴权 + 封禁检查
        const { auth: authResult, banned } =
            await authenticateAndCheckBan(request);
        if (!authResult) return unauthorizedResponse();
        if (banned) return bannedResponse();

        // 邀请码限制：必须持有邀请码才可发布
        const dbUser = findUserById(authResult.userId);
        if (!dbUser?.invite_code) return inviteRequiredResponse();

        // 2) 读取 multipart 表单（metadata + package + 其他文件）
        const formData = await request.formData();

        // console.log(
        //     "读取 multipart 表单（metadata + package + 其他文件）",
        //     formData.get("metadata"),
        // );

        // debugger;

        // 2.1 元数据（JSON 或 Blob(JSON)）是必填项：兼容外部以 Blob 方式上传 metadata
        const metaEntry = formData.get("metadata");
        let metadataRaw: string | null = null;
        if (typeof metaEntry === "string") {
            metadataRaw = metaEntry;
        } else if (metaEntry && typeof (metaEntry as any).text === "function") {
            try {
                // 兼容 File/Blob：读取文本内容作为 JSON 字符串
                metadataRaw = await (metaEntry as any).text();
            } catch {
                metadataRaw = null;
            }
        }
        if (!metadataRaw) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required field: metadata (JSON)",
                },
                { status: 400 },
            );
        }

        // 2.2 解析 metadata；displayName/description/readme 可缺省，由服务端从包中提取
        let metadata: {
            name: string;
            displayName: string;
            type: string;
            description: string;
            tags?: string[];
            version: string;
            longDescription?: string;
            category?: string;
            configSubtype?: string;
            readme?: string;
        };
        try {
            metadata = JSON.parse(metadataRaw);
            // console.log("metadata", metadata);
        } catch {
            return NextResponse.json(
                { success: false, error: "Invalid metadata JSON" },
                { status: 400 },
            );
        }

        const { name, type, version } = metadata;
        // 仅强制 name/type/version；其他字段可后续从包中补全
        if (!name || !type || !version) {
            return NextResponse.json(
                {
                    success: false,
                    error: "metadata must include: name, type, version",
                },
                { status: 400 },
            );
        }

        // 允许的类型校验
        const validTypes = [
            "skill",
            "experience",
            "plugin",
            "trigger",
            "channel",
        ];
        if (!validTypes.includes(type)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
                },
                { status: 400 },
            );
        }

        // 3) 遍历表单文件，记录元信息并识别包文件
        const uploadedFiles: {
            path: string;
            size: number;
            sha256: string;
            contentType: string;
            buffer: Buffer;
        }[] = [];
        let packageFile: { buffer: Buffer; ext: string } | null = null;

        for (const [key, value] of formData.entries()) {
            if (key === "metadata") continue; // 跳过 metadata 字段本身
            if (value instanceof File) {
                // 限制文件大小（友好错误提示）
                if (value.size > MAX_FILE_SIZE) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: `File ${value.name} exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
                        },
                        { status: 400 },
                    );
                }
                const buf = Buffer.from(await value.arrayBuffer());
                const sha256 = crypto
                    .createHash("sha256")
                    .update(buf)
                    .digest("hex");

                // 识别包文件：key === "package"；仅允许 zip/skill/tar.gz/tgz
                if (key === "package") {
                    const origName = value.name || "package.tar.gz";
                    const isZip =
                        origName.endsWith(".zip") ||
                        origName.endsWith(".skill");
                    const isTarGz =
                        origName.endsWith(".tar.gz") ||
                        origName.endsWith(".tgz");
                    if (!isZip && !isTarGz) {
                        return NextResponse.json(
                            {
                                success: false,
                                error: "Package must be .tar.gz, .tgz, .zip, or .skill file",
                            },
                            { status: 400 },
                        );
                    }
                    packageFile = {
                        buffer: buf,
                        ext: isZip
                            ? origName.endsWith(".skill")
                                ? "skill"
                                : "zip"
                            : "tar.gz",
                    };
                }

                uploadedFiles.push({
                    path: value.name || key,
                    size: buf.length,
                    sha256,
                    contentType: value.type || "application/octet-stream",
                    buffer: buf,
                });
            }
        }

        // 包文件是必需的
        if (!packageFile) {
            return NextResponse.json(
                {
                    success: false,
                    error: "missing_package",
                    message:
                        '发布资产必须包含文件包（.tar.gz / .tgz / .zip / .skill）。水产市场要求"发了就能用"。',
                },
                { status: 400 },
            );
        }

        // 4) 解压包并收集文本文件（单次遍历）
        let packageFilesMetadata: {
            path: string;
            size: number;
            sha256: string;
            contentType: string;
        }[] = [];
        const textFiles = new Map<string, string>();
        // 需要收集正文内容的扩展名（作为文本读取）
        const TEXT_EXTS = [
            ".md",
            ".json",
            ".yaml",
            ".yml",
            ".txt",
            ".js",
            ".ts",
            ".py",
            ".sh",
        ];

        if (packageFile) {
            // 在系统临时目录创建工作目录
            const tmpDir = fs.mkdtempSync(
                path.join(os.tmpdir(), "openclawmp-pkg-"),
            );
            const tmpPkg = path.join(tmpDir, `pkg.${packageFile.ext}`);
            const extractDir = path.join(tmpDir, "extracted");
            fs.mkdirSync(extractDir, { recursive: true });
            fs.writeFileSync(tmpPkg, packageFile.buffer);

            try {
                // 根据扩展名使用 tar 或 unzip 解压；开启两种 tar 方式以兼容 strip-components 失败的情况
                if (packageFile.ext === "tar.gz") {
                    try {
                        execSync(
                            `tar xzf "${tmpPkg}" -C "${extractDir}" --strip-components=1 2>/dev/null`,
                            { stdio: "pipe" },
                        );
                    } catch {
                        try {
                            execSync(
                                `tar xzf "${tmpPkg}" -C "${extractDir}" 2>/dev/null`,
                                { stdio: "pipe" },
                            );
                        } catch {
                            /* ignore 解压失败 */
                        }
                    }
                } else {
                    try {
                        execSync(
                            `unzip -o -q "${tmpPkg}" -d "${extractDir}" 2>/dev/null`,
                            { stdio: "pipe" },
                        );
                    } catch {
                        /* ignore 解压失败 */
                    }
                }

                // 遍历解压目录：收集文件元信息 + 读取文本内容
                const walkDir = (dir: string, prefix: string): void => {
                    for (const entry of fs.readdirSync(dir, {
                        withFileTypes: true,
                    })) {
                        const rel = prefix
                            ? `${prefix}/${entry.name}`
                            : entry.name;
                        if (entry.isDirectory()) {
                            walkDir(path.join(dir, entry.name), rel);
                        } else if (entry.isFile()) {
                            const fullPath = path.join(dir, entry.name);
                            const buf = fs.readFileSync(fullPath);
                            const sha = crypto
                                .createHash("sha256")
                                .update(buf)
                                .digest("hex");
                            const ext = path.extname(entry.name).toLowerCase();
                            // 简单的 content-type 推断（仅用于展示/统计）
                            const ct =
                                ext === ".md"
                                    ? "text/markdown"
                                    : ext === ".json"
                                      ? "application/json"
                                      : ext === ".js" || ext === ".ts"
                                        ? "text/javascript"
                                        : ext === ".py"
                                          ? "text/x-python"
                                          : ext === ".sh"
                                            ? "text/x-shellscript"
                                            : ext === ".yaml" || ext === ".yml"
                                              ? "text/yaml"
                                              : "application/octet-stream";
                            packageFilesMetadata.push({
                                path: rel,
                                size: buf.length,
                                sha256: sha,
                                contentType: ct,
                            });

                            // 若为关注的文本扩展名，则读取为 UTF-8 文本加入 textFiles
                            if (TEXT_EXTS.includes(ext)) {
                                try {
                                    textFiles.set(rel, buf.toString("utf-8"));
                                } catch {
                                    /* ignore 非 UTF-8 或读取失败 */
                                }
                            }
                        }
                    }
                };
                walkDir(extractDir, "");
            } finally {
                // 清理临时目录
                try {
                    fs.rmSync(tmpDir, { recursive: true, force: true });
                } catch {
                    /* ignore */
                }
            }
        }

        // 5) 基于类型的结构校验（必要时从包中提取字段）
        const validation = validatePackageByType(type, textFiles, {
            displayName: metadata.displayName,
            description: metadata.description,
            readme: metadata.readme,
        });

        if (!validation.valid) {
            return NextResponse.json(
                {
                    success: false,
                    error: "publish_validation_failed",
                    message: validation.error,
                    missing: validation.missing,
                    hint: validation.hint,
                    required: validation.required,
                },
                { status: 400 },
            );
        }

        // 6) 服务端补全：优先 metadata，其次校验阶段提取的值，最后兜底
        const finalDisplayName =
            metadata.displayName || validation.extractedDisplayName || name;
        const finalDescription =
            metadata.description || validation.extractedDescription || "";
        const finalReadme = metadata.readme || validation.extractedReadme || "";

        // 7) 去重（L2：包 SHA256 指纹）
        const packageSha256 = computePackageSha256(packageFile.buffer);
        console.log("packageSha256", packageSha256);

        // 如果是更新同名资产，需要把自身从查重中排除
        const db = getDb();
        const existingAssets = db
            .prepare("SELECT id FROM assets WHERE name = ? AND author_id = ?")
            .all(name, authResult.userId) as { id: string }[];
        const existingId =
            existingAssets.length > 0 ? existingAssets[0].id : undefined;

        const hashDuplicate = findDuplicateByHash(packageSha256, existingId);
        if (hashDuplicate) {
            return NextResponse.json(
                {
                    success: false,
                    error: "duplicate_package",
                    message:
                        "此资产包已由其他用户发布，内容完全相同（SHA256 匹配）。",
                    duplicate: {
                        assetId: hashDuplicate.assetId,
                        assetName: hashDuplicate.assetName,
                        authorName: hashDuplicate.authorName,
                    },
                },
                { status: 400 },
            );
        }

        // 8) 相似度检测（L3）：基于 README 内容的近似查重
        const warnings: string[] = [];
        if (finalReadme) {
            const similarAssets = findSimilarAssets(
                type,
                finalReadme,
                existingId,
            );

            // >95%：视为过于相似，拒绝发布
            const tooSimilar = similarAssets.filter((a) => a.similarity > 0.95);
            if (tooSimilar.length > 0) {
                const top = tooSimilar[0];
                return NextResponse.json(
                    {
                        success: false,
                        error: "content_too_similar",
                        message: `资产内容与已有资产过于相似（相似度 ${(top.similarity * 100).toFixed(1)}%），疑似重复发布。`,
                        similar: tooSimilar.map((a) => ({
                            assetId: a.assetId,
                            assetName: a.assetName,
                            authorName: a.authorName,
                            similarity: `${(a.similarity * 100).toFixed(1)}%`,
                        })),
                    },
                    { status: 400 },
                );
            }

            // 80%-95%：允许但附带 warnings 提示
            const moderatelySimilar = similarAssets.filter(
                (a) => a.similarity > 0.8 && a.similarity <= 0.95,
            );
            if (moderatelySimilar.length > 0) {
                for (const a of moderatelySimilar) {
                    warnings.push(
                        `内容与「${a.assetName}」（by ${a.authorName}）相似度 ${(a.similarity * 100).toFixed(1)}%，请确认非重复发布。`,
                    );
                }
            }
        }

        // 9) 持久化到数据库（更新或创建）
        // 构建文件元数据列表：优先解压得到的文件；否则使用上传文件（去掉包本身）
        const filesMetadata =
            packageFilesMetadata.length > 0
                ? packageFilesMetadata
                : uploadedFiles
                      .filter(
                          (f) =>
                              f.path !==
                              (packageFile ? `pkg.${packageFile.ext}` : ""),
                      )
                      .map((f) => ({
                          path: f.path,
                          size: f.size,
                          sha256: f.sha256,
                          contentType: f.contentType,
                      }));

        let asset;
        if (existingAssets.length > 0) {
            // 更新同名资产：写入新版本/描述/README/文件列表/包哈希
            updateAsset(existingId!, {
                displayName: finalDisplayName,
                description: finalDescription,
                version,
                tags: metadata.tags,
                category: metadata.category,
                longDescription: metadata.longDescription,
                readme: finalReadme,
                files: filesMetadata as unknown as Array<{
                    name: string;
                    type: string;
                }>,
                packageSha256,
            });
            asset = getAssetById(existingId!)!;

            // 记账：发布新版本获得声望与虾米币
            addCoins(
                authResult.userId,
                "reputation",
                USER_REP_EVENTS.publish_version,
                "publish_version",
                existingId!,
            );
            addCoins(
                authResult.userId,
                "shrimp_coin",
                SHRIMP_COIN_EVENTS.publish_version,
                "publish_version",
                existingId!,
            );
        } else {
            // 创建新资产
            asset = createAsset({
                name,
                displayName: finalDisplayName,
                type,
                description: finalDescription,
                version,
                authorId: authResult.userId,
                authorName: dbUser.name,
                authorAvatar: dbUser.avatar,
                tags: metadata.tags,
                category: metadata.category,
                longDescription: metadata.longDescription,
                readme: finalReadme,
                configSubtype: metadata.configSubtype,
                packageSha256,
            });
            if (filesMetadata.length > 0) {
                updateAsset(asset.id, {
                    files: filesMetadata as unknown as Array<{
                        name: string;
                        type: string;
                    }>,
                });
            }
        }

        // 10) 保存包文件至磁盘（data/packages/{asset.id}.{ext}）
        if (packageFile) {
            fs.mkdirSync(PACKAGES_DIR, { recursive: true });
            const packagePath = path.join(
                PACKAGES_DIR,
                `${asset.id}.${packageFile.ext}`,
            );
            fs.writeFileSync(packagePath, packageFile.buffer);
        }

        // 11) 返回成功响应（若存在相似性 warnings 一并返回）
        const response: Record<string, unknown> = {
            success: true,
            data: {
                id: asset.id,
                name: asset.name,
                version: asset.version,
                url: `https://openclawmp.cc/api/v1/assets/${asset.id}/download`,
                hash: packageSha256,
                files: filesMetadata,
                packageFile: packageFile
                    ? `${asset.id}.${packageFile.ext}`
                    : null,
            },
        };
        if (warnings.length > 0) {
            response.warnings = warnings;
        }

        return NextResponse.json(response, {
            status: existingAssets.length > 0 ? 200 : 201,
        });
    } catch (err) {
        // 兜底异常处理（记录摘要日志）
        console.error(
            "POST /api/v1/assets/publish error:",
            err instanceof Error ? err.message : "Unknown",
        );
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        );
    }
}
