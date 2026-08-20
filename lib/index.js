/**
 * Sidor_UI — Host 半（静态 Cordis 插件）
 *
 * 静态 host 插件随 DSH 宿主自动加载（持久化）。本文件是宿主侧的"服务面"：
 * 它只做依赖声明与逻辑落位，不注册任何动态 RPC（静态插件没有 harness）。
 *
 * 当前版本说明（重要）：
 * - 动态插件（pluginId `sidf-4`）的 host RPC（balance-get/set/query、upload-doc）
 *   在静态形态下由 Client 半以降级方式实现（localStorage + 直连 fetch），
 *   因此本文件的 apply 保持为空壳（仅确保包可被宿主加载）。
 * - 若未来 DSH 提供"静态插件自定义 host RPC 通道"，把 src/sidor-fx-host.js 的
 *   逻辑迁入本文件即可（依赖 sessions/fs/subprocess 均为宿主服务）。
 *
 * 参考实现见 src/sidor-fx-host.js（动态形态，harness.handle 注册）。
 */
export function apply() {
  // 预留：静态 host 服务面。
  // 需要时在此注入 sessions / fs / subprocess 实现余额查询与文档落盘，
  // 并通过官方 client→host 通道（如 connection.rpc / api-proxy）暴露。
}
