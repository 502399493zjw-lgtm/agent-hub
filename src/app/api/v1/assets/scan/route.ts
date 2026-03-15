import { NextRequest, NextResponse } from "next/server";
import PQueue from "p-queue";
import { updateAsset, findUserById, getDb } from "@/lib/db";
import {
    authenticateAndCheckBan,
    unauthorizedResponse,
    bannedResponse,
    inviteRequiredResponse,
} from "@/lib/api-auth";

const ENDPOINT =
    process.env.SKILL_SCAN_ENDPOINT ||
    "http://scp-test.i-stepfun.net/scp/v1/risk/rich_text";
const TOKEN = process.env.SKILL_SCAN_API_KEY || "";

export async function POST(request: NextRequest) {
    // 1. 初始化队列：设置并发数为 10
    const queue = new PQueue({ concurrency: 10 });

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
        // console.log("formData", formData);
        // 2.1 元数据（JSON 或 Blob(JSON)）是必填项：兼容外部以 Blob 方式上传 metadata
        const metaEntry = formData.get("metadata");
        const packageUrl = formData.get("url");
        const packageSha256 = formData.get("hash");
        const assetId = formData.get("id");
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
            // 规范化 url/hash 字段（支持字符串或 Blob）
            const toText = async (v: unknown): Promise<string> => {
                if (typeof v === "string") return v;
                if (v && typeof (v as any).text === "function") {
                    try {
                        return await (v as any).text();
                    } catch {
                        return "";
                    }
                }
                return v ? String(v) : "";
            };

            const urlStr = await toText(packageUrl);
            const hashStr = await toText(packageSha256);
            const assetIdStr =
                typeof assetId === "string"
                    ? assetId
                    : assetId
                      ? String(assetId)
                      : "";
            // 发起审核：将数据库状态置为 pending
            try {
                let targetId = assetIdStr;
                if (!targetId) {
                    const row = getDb()
                        .prepare(
                            "SELECT id FROM assets WHERE name = ? AND author_id = ? ORDER BY updated_at DESC LIMIT 1",
                        )
                        .get(metadata.name, authResult.userId) as
                        | { id: string }
                        | undefined;
                    targetId = row?.id || "";
                }
                if (targetId) {
                    updateAsset(targetId, {
                        scanStatus: "pending",
                        scanMessage: "审核进行中",
                    });
                }
            } catch (error) {
                const err = (error ?? {}) as Record<string, unknown>;
                console.error("updateAsset error", {
                    message:
                        typeof err["message"] === "string"
                            ? (err["message"] as string)
                            : String(error),
                    code: err["code"],
                    errno: err["errno"],
                });
            }

            const baseSeed = assetIdStr || metadata.name || "pkg";
            const hashSeed = (hashStr || "").slice(0, 12);
            const timeSeed = Date.now().toString(36);
            const packageId = [baseSeed, hashSeed, timeSeed]
                .filter(Boolean)
                .join("_");
            const tagsText = Array.isArray(metadata.tags)
                ? (metadata.tags as string[]).join(",")
                : metadata.tags
                  ? String(metadata.tags)
                  : "";

            const tasks = [
                {
                    url: ENDPOINT,
                    token: TOKEN,
                    payload: {
                        user_info: {
                            user_id: authResult.userId,
                        },
                        package_id: packageId,
                        async: false,
                        biz_type: "skill_scan",
                        only_machine_audit: false,
                        extra: {
                            penetrate_data: "{}",
                            skill_package_hash: hashStr || "",
                            skill_package_name: metadata.name || "",
                        },
                        resources: [
                            {
                                id: `package_${packageId}`,
                                name: metadata.name,
                                type: "TEXT",
                                scene: "skill_scan:package",
                                context: urlStr,
                            },
                        ],
                    },
                },
                // 2) skill_market（名称/标签/内容）
                {
                    url: ENDPOINT,
                    token: TOKEN,
                    payload: {
                        user_info: {
                            user_id: authResult.userId,
                        },
                        package_id: packageId,
                        async: false,
                        biz_type: "skill_market",
                        only_machine_audit: false,
                        extra: {
                            penetrate_data: "{}",
                        },
                        resources: [
                            {
                                id: `name_${packageId}`,
                                name: metadata.name,
                                type: "TEXT",
                                scene: "skill_market:name",
                                context: metadata.name,
                            },
                            {
                                id: `label_${packageId}`,
                                name: metadata.name,
                                type: "TEXT",
                                scene: "skill_market:label",
                                context: tagsText,
                            },
                            {
                                id: `content_${packageId}`,
                                name: metadata.name,
                                type: "TEXT",
                                scene: "skill_market:content",
                                context:
                                    metadata.readme ||
                                    metadata.description ||
                                    "",
                            },
                        ],
                    },
                },
            ].filter((t) => t.url && t.token);

            // 加入队列并并发执行（受限于顶部 concurrency）
            const results: Array<{
                ok: boolean;
                status: number;
                body: unknown;
            }> = await Promise.all(
                tasks.map((task) =>
                    queue.add(async () => {
                        const res = await fetch(task.url, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${task.token}`,
                            },
                            body: JSON.stringify(task.payload),
                        });
                        // console.log("参数：", JSON.stringify(task.payload));
                        const text = await res.text().catch(() => "");
                        let body: unknown = text;
                        try {
                            body = text ? JSON.parse(text) : {};
                        } catch {
                            // 不是 JSON 时也记录为字符串
                            body = text;
                        }
                        // console.log("status:", res.status, body);
                        return { ok: res.ok, status: res.status, body };
                    }),
                ),
            );

            // 若任一任务失败（非 PASS）则更新 DB 为 failed 并返回失败；两者都 PASS 才返回成功
            const withDecisions = results.map((r) => {
                let decision = "";
                try {
                    const b = r.body as any;
                    const raw = (
                        b?.data?.decision ??
                        b?.decision ??
                        ""
                    ).toString();
                    decision = raw.toUpperCase();
                } catch (error) {
                    const err = (error ?? {}) as Record<string, unknown>;
                    console.error("updateAsset error", {
                        message:
                            typeof err["message"] === "string"
                                ? (err["message"] as string)
                                : String(error),
                        code: err["code"],
                        errno: err["errno"],
                    });
                }
                const passed = r.ok && decision === "PASS";
                return { ...r, decision, passed };
            });
            const firstFail = withDecisions.find((r) => !r.passed);

            try {
                let targetId =
                    typeof assetId === "string"
                        ? assetId
                        : assetId
                          ? String(assetId)
                          : "";
                if (!targetId) {
                    const row = getDb()
                        .prepare(
                            "SELECT id FROM assets WHERE name = ? AND author_id = ? ORDER BY updated_at DESC LIMIT 1",
                        )
                        .get(metadata.name, authResult.userId) as
                        | { id: string }
                        | undefined;
                    targetId = row?.id || "";
                }
                if (firstFail) {
                    if (targetId) {
                        updateAsset(targetId, {
                            scanStatus: "failed",
                            scanMessage:
                                firstFail.decision === "BLOCK"
                                    ? "审核未通过（BLOCK）"
                                    : "外部审核接口返回失败",
                        });
                    }
                } else {
                    if (targetId) {
                        updateAsset(targetId, {
                            scanStatus: "success",
                            scanMessage: "审核通过了（PASS）",
                        });
                    }
                }
            } catch (error) {
                const err = (error ?? {}) as Record<string, unknown>;
                console.error("updateAsset error", {
                    message:
                        typeof err["message"] === "string"
                            ? (err["message"] as string)
                            : String(error),
                    code: err["code"],
                    errno: err["errno"],
                });
            }

            if (firstFail) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "scan_failed",
                        status: firstFail.status ?? 502,
                        data: withDecisions,
                        scan_status: "failed",
                        scan_message:
                            firstFail.decision === "BLOCK"
                                ? "审核未通过（BLOCK）"
                                : "审核返回失败",
                    },
                    { status: 502 },
                );
            }

            return NextResponse.json(
                {
                    success: true,
                    data: {
                        results: withDecisions,
                        scan_status: "success",
                        scan_message: "审核通过（PASS）",
                    },
                },
                { status: 200 },
            );
        } catch {
            return NextResponse.json(
                { success: false, error: "Invalid metadata JSON" },
                { status: 400 },
            );
        }
    } catch (error) {
        console.error(
            "POST /api/v1/assets/scan error:",
            error instanceof Error ? error.message : String(error),
        );
        return NextResponse.json(
            { success: false, error: "Internal server error" },
            { status: 500 },
        );
    }
}
