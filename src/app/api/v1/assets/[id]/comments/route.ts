import { NextRequest, NextResponse } from "next/server";
import {
    getCommentsByAssetId,
    getAssetById,
    findUserById,
    createComment,
    userHasInviteAccess,
} from "@/lib/db";
import {
    authenticateRequest,
    unauthorizedResponse,
    inviteRequiredResponse,
} from "@/lib/api-auth";

import crypto from "crypto";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";
const ENDPOINT =
    process.env.SKILL_SCAN_ENDPOINT ||
    "http://scp-test.i-stepfun.net/scp/v1/risk/rich_text";
const TOKEN = process.env.SKILL_SCAN_API_KEY || "";

// ENDPOINT 调用日志（与 scan 路由同目录与文件）
const LOG_DIR = process.env.SCAN_LOG_DIR || path.join(process.cwd(), "data", "logs");
const LOG_FILE = path.join(LOG_DIR, "skill-scan-endpoint.log");
try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.closeSync(fs.openSync(LOG_FILE, 'a'));
} catch {}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const s = getCommentsByAssetId(id);
    return NextResponse.json(
        { success: true, data: s },
        {
            headers: {
                "Cache-Control":
                    "public, s-maxage=60, stale-while-revalidate=300",
            },
        },
    );
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const authResult = await authenticateRequest(request);
    if (!authResult) return unauthorizedResponse();
    if (!userHasInviteAccess(authResult.userId))
        return inviteRequiredResponse();

    const { id } = await params;
    if (!getAssetById(id)) {
        return NextResponse.json(
            { success: false, error: "Asset not found" },
            { status: 404 },
        );
    }

    try {
        const { content, rating, commenterType } = await request.json();

        if (!content || typeof content !== "string" || !content.trim()) {
            return NextResponse.json(
                { success: false, error: "评论内容不能为空" },
                { status: 400 },
            );
        }

        let params = {
            user_info: {
                user_id: authResult.userId,
            },
            // 资源维度幂等 & 全局唯一（<=64）
            package_id: crypto
                .createHash("sha256")
                .update(`${id}:${authResult.userId}`)
                .digest("hex")
                .slice(0, 48),
            async: false,
            biz_type: "skill_market",
            only_machine_audit: false,
            extra: {
                penetrate_data: "{}",
            },
            resources: [
                {
                    id: `comment_${crypto
                        .createHash("sha256")
                        .update(`${id}:${authResult.userId}:${content?.trim()}`)
                        .digest("hex")
                        .slice(0, 60)}`,
                    name: "",
                    type: "TEXT",
                    scene: "skill_market:comment",
                    context: `${content?.trim()}`,
                },
            ],
        };

        // 调用内容审核 + 记录 ENDPOINT 请求/响应日志
        const requestBody = JSON.stringify(params);
        const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${TOKEN}`,
            },
            body: requestBody,
        });
        const text = await res.text().catch(() => "");
        let body: unknown = text;
        try { body = text ? JSON.parse(text) : {}; } catch { body = text; }

        // 追加两行 NDJSON 日志（request + response）
        try {
            const nowIso = new Date().toISOString();
            const reqLine = JSON.stringify({
                ts: nowIso,
                userId: authResult.userId,
                assetId: id,
                packageId: params.package_id,
                direction: "request",
                url: ENDPOINT,
                headers: { "Content-Type": "application/json" },
                body: params,
            });
            const resLine = JSON.stringify({
                ts: nowIso,
                userId: authResult.userId,
                assetId: id,
                packageId: params.package_id,
                direction: "response",
                status: res.status,
                ok: res.ok,
                body,
            });
            fs.appendFile(LOG_FILE, reqLine + "\n" + resLine + "\n", () => {});
        } catch {}

        // 内容审核必须成功才允许创建 comments
        if (!res.ok || (typeof body === 'object' && body !== null && (body as any).data?.decision === "BLOCK")) {
            return NextResponse.json(
                {
                    success: false,
                    error: "评论内容审核未通过",
                    status: res.status,
                    data: body,
                },
                { status: 400 },
            );
        }

        const user = findUserById(authResult.userId);
        const comment = createComment({
            assetId: id,
            userId: authResult.userId,
            userName: user?.name ?? "Anonymous",
            userAvatar: user?.avatar ?? "",
            content: content.trim(),
            rating: typeof rating === "number" ? rating : 0,
            commenterType: commenterType === "agent" ? "agent" : "user",
        });

        return NextResponse.json(
            { success: true, data: comment },
            { status: 201 },
        );
    } catch {
        return NextResponse.json(
            { success: false, error: "Invalid request" },
            { status: 400 },
        );
    }
}
