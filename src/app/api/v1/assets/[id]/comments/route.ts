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
            package_id: id,
            async: false,
            biz_type: "skill_market",
            only_machine_audit: false,
            extra: {
                penetrate_data: "{}",
            },
            resources: [
                {
                    id: `comment${id}`,
                    name: "",
                    type: "TEXT",
                    scene: "skill_market:comment",
                    context: `${content?.trim()}`,
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
        // 内容审核必须成功才允许创建 comments
        const text = await res.text().catch(() => "");
        let body: unknown = text;
        console.log("res", res, "text", text, "body", body);
        try {
            body = text ? JSON.parse(text) : {};
        } catch {}
        if (!res.ok || JSON.parse(text).data.decision === "BLOCK") {
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
