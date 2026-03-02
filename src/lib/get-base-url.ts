/**
 * 动态获取应用的基础 URL
 * 支持多域名部署（openclawmp.cc、openclawmp.com 等）
 *
 * 优先级：
 * 1. 从请求头动态构造（生产环境）
 * 2. localhost fallback（开发环境）
 */

import { NextRequest } from "next/server";

/**
 * 从 NextRequest 获取基础 URL
 * @param request - Next.js Request 对象
 * @param prefix - 子域名前缀（例如：'hub', 'api', 'cdn' 等）
 */
export function getBaseUrl(request: NextRequest, prefix = ""): string {
  // 从请求头动态获取
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  let host = request.headers.get("host") || request.headers.get("x-forwarded-host");

  // 如果没有请求头，使用 localhost fallback（开发环境）
  if (!host) {
    const port = process.env.PORT || 3000;
    return `http://localhost:${port}`;
  }

  // 提取二级主域名（去除所有子域名前缀）
  // 例如：www.openclawmp.cc → openclawmp.cc
  //       hub.openclawmp.cc → openclawmp.cc
  //       api.test.openclawmp.cc → openclawmp.cc
  const parts = host.split(".");
  if (parts.length > 2 && !host.includes("localhost")) {
    // 取最后两部分作为主域名（domain.tld）
    host = parts.slice(-2).join(".");
  }

  // 如果指定了子域名前缀，添加到主域名前
  if (prefix) {
    host = `${prefix}.${host}`;
  }

  return `${protocol}://${host}`;
}
