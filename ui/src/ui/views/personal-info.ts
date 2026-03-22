import { html, nothing } from "lit";
import type { PersonalInfoData } from "../controllers/personal-info.ts";

export type PersonalInfoProps = {
  loading: boolean;
  saving: boolean;
  data: PersonalInfoData | null;
  form: PersonalInfoData | null;
  dirty: boolean;
  error: string | null;
  success: string | null;
  onFieldChange: (field: keyof PersonalInfoData, value: string) => void;
  onSave: () => void;
  onRefresh: () => void;
};

export function renderPersonalInfo(props: PersonalInfoProps) {
  const { form } = props;
  return html`
    <section class="card">
      <div class="row" style="justify-content: space-between; align-items: flex-start;">
        <div>
          <div class="card-title">個人情報</div>
          <div class="card-sub">
            AI助手に紐づく従業員情報を管理します。保存時にGRCサーバーへ自動同期されます。
          </div>
        </div>
        <button
          class="btn"
          ?disabled=${props.loading}
          @click=${props.onRefresh}
        >
          ${props.loading ? "読み込み中…" : "再読み込み"}
        </button>
      </div>

      ${
        props.error
          ? html`<div class="callout danger" style="margin-top: 12px;">
              ${props.error}
            </div>`
          : nothing
      }
      ${
        props.success
          ? html`<div class="callout success" style="margin-top: 12px;">
              ${props.success}
            </div>`
          : nothing
      }

      ${
        form
          ? html`
              <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 16px;">
                <label class="field">
                  <span class="field-label">従業員ID</span>
                  <input
                    type="text"
                    .value=${form.employeeId ?? ""}
                    placeholder="例: EMP-001"
                    @input=${(e: Event) =>
                      props.onFieldChange("employeeId", (e.target as HTMLInputElement).value)}
                  />
                </label>

                <label class="field">
                  <span class="field-label">従業員名</span>
                  <input
                    type="text"
                    .value=${form.employeeName ?? ""}
                    placeholder="例: 山田 太郎"
                    @input=${(e: Event) =>
                      props.onFieldChange("employeeName", (e.target as HTMLInputElement).value)}
                  />
                </label>

                <label class="field">
                  <span class="field-label">連絡先メールアドレス</span>
                  <input
                    type="email"
                    .value=${form.employeeEmail ?? ""}
                    placeholder="例: taro.yamada@example.com"
                    @input=${(e: Event) =>
                      props.onFieldChange("employeeEmail", (e.target as HTMLInputElement).value)}
                  />
                </label>

                <label class="field">
                  <span class="field-label">GRC URL</span>
                  <input
                    type="url"
                    .value=${form.grcUrl ?? ""}
                    placeholder="例: https://grc.myaiportal.net"
                    @input=${(e: Event) =>
                      props.onFieldChange("grcUrl", (e.target as HTMLInputElement).value)}
                  />
                </label>

                <div
                  class="callout"
                  style="margin-top: 4px; opacity: 0.7; font-size: 0.85em;"
                >
                  <div><strong>Node ID:</strong> ${form.nodeId || "未接続"}</div>
                </div>

                <div class="row" style="margin-top: 8px; gap: 8px;">
                  <button
                    class="btn primary"
                    ?disabled=${!props.dirty || props.saving}
                    @click=${props.onSave}
                  >
                    ${props.saving ? "保存中…" : "保存"}
                  </button>
                </div>
              </div>
            `
          : props.loading
            ? html`<div class="muted" style="margin-top: 16px;">読み込み中…</div>`
            : html`<div class="muted" style="margin-top: 16px;">個人情報を読み込めませんでした。</div>`
      }
    </section>
  `;
}
