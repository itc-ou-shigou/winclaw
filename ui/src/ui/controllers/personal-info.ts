import type { GatewayBrowserClient } from "../gateway.ts";

export type PersonalInfoData = {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  grcUrl: string;
  nodeId: string | null;
};

export type PersonalInfoState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  personalInfoLoading: boolean;
  personalInfoSaving: boolean;
  personalInfo: PersonalInfoData | null;
  personalInfoForm: PersonalInfoData | null;
  personalInfoError: string | null;
  personalInfoDirty: boolean;
  personalInfoSuccess: string | null;
};

export async function loadPersonalInfo(state: PersonalInfoState) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.personalInfoLoading) {
    return;
  }
  state.personalInfoLoading = true;
  state.personalInfoError = null;
  state.personalInfoSuccess = null;
  try {
    const res = (await state.client.request("personal-info.get", {})) as PersonalInfoData;
    state.personalInfo = res;
    state.personalInfoForm = { ...res };
    state.personalInfoDirty = false;
  } catch (err) {
    state.personalInfoError = String(err);
  } finally {
    state.personalInfoLoading = false;
  }
}

export async function savePersonalInfo(state: PersonalInfoState) {
  if (!state.client || !state.connected || !state.personalInfoForm) {
    return;
  }
  state.personalInfoSaving = true;
  state.personalInfoError = null;
  state.personalInfoSuccess = null;
  try {
    const res = (await state.client.request("personal-info.save", {
      employeeId: state.personalInfoForm.employeeId,
      employeeName: state.personalInfoForm.employeeName,
      employeeEmail: state.personalInfoForm.employeeEmail,
      grcUrl: state.personalInfoForm.grcUrl,
    })) as { ok: boolean; grcSynced?: boolean; grcError?: string };
    state.personalInfoDirty = false;
    let msg = "保存しました";
    if (res.grcSynced) {
      msg += " (GRC同期完了)";
    } else if (res.grcError) {
      msg += ` (GRC同期失敗: ${res.grcError})`;
    }
    state.personalInfoSuccess = msg;
    // Reload to get fresh data
    await loadPersonalInfo(state);
  } catch (err) {
    state.personalInfoError = String(err);
  } finally {
    state.personalInfoSaving = false;
  }
}

export function updatePersonalInfoField(
  state: PersonalInfoState,
  field: keyof PersonalInfoData,
  value: string,
) {
  if (!state.personalInfoForm) return;
  state.personalInfoForm = { ...state.personalInfoForm, [field]: value };
  state.personalInfoDirty = true;
  state.personalInfoSuccess = null;
}
