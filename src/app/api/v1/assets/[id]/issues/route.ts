import { NextRequest, NextResponse } from "next/server";
import {
    getIssuesByAssetId,
    getAssetById,
    findUserById,
    createIssue,
    userHasInviteAccess,
} from "@/lib/db";
import {
    authenticateRequest,
    unauthorizedResponse,
    inviteRequiredResponse,
} from "@/lib/api-auth";

import crypto from "crypto";

export const dynamic = "force-dynamic";
const ENDPOINT =
    process.env.SKILL_SCAN_ENDPOINT ||
    "http://scp-test.i-stepfun.net/scp/v1/risk/rich_text";
const TOKEN = process.env.SKILL_SCAN_API_KEY || "";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;
    const s = getIssuesByAssetId(id);
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
        const { title, bodyText, labels, authorType } = await request.json();

        if (!title || typeof title !== "string" || !title.trim()) {
            return NextResponse.json(
                { success: false, error: "Issue 标题不能为空" },
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
                    id: `issue_${crypto
                        .createHash("sha256")
                        .update(`${id}:${authResult.userId}:${title?.trim()}${bodyText?.trim()}`)
                        .digest("hex")
                        .slice(0, 60)}`,
                    name: "",
                    type: "TEXT",
                    scene: "skill_market:issue",
                    context: `${title?.trim()}${bodyText?.trim()}`,
                },
            ],
        };

        // 调用内容审核
        const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${TOKEN}`,
            },
            body: JSON.stringify(params),
        });
        // 内容审核必须成功才允许创建 Issue
        const text = await res.text().catch(() => "");
        let body: unknown = text;
        try {
            body = text ? JSON.parse(text) : {};
        } catch {}
        if (!res.ok || JSON.parse(text).data.decision === "BLOCK") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Issue内容审核未通过",
                    status: res.status,
                    data: body,
                },
                { status: 400 },
            );
        }

        const user = findUserById(authResult.userId);
        const issue = createIssue({
            assetId: id,
            authorId: authResult.userId,
            authorName: user?.name ?? "Anonymous",
            authorAvatar: user?.avatar ?? "",
            authorType: authorType === "agent" ? "agent" : "user",
            title: title.trim(),
            body: bodyText?.trim() ?? "",
            labels: Array.isArray(labels) ? labels : [],
        });

        return NextResponse.json(
            { success: true, data: issue },
            { status: 201 },
        );
    } catch {
        return NextResponse.json(
            { success: false, error: "Invalid request" },
            { status: 400 },
        );
    }
}
