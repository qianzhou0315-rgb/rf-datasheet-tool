import axios from "axios";

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || "") + "/api",
});

export interface Band {
  freq_min_mhz: number;
  freq_max_mhz: number;
  band_name?: string;
  // PA / LNA / FEM TX
  vcc_v?: string;
  icc_ma?: string;
  gain_db?: string;
  gain_min_db?: string;
  p1db_dbm?: string;
  psat_dbm?: string;
  pae_percent?: string;
  // LNA
  nf_db?: string;
  nf_max_db?: string;
  iip3_dbm?: string;
  op1db_dbm?: string;
  oip3_dbm?: string;
  s11_db?: string;
  s22_db?: string;
  // Filter / Switch / Splitter
  insertion_loss_db?: string;
  insertion_loss_max_db?: string;
  rejection_db?: string;
  return_loss_db?: string;
  isolation_db?: string;
  isolation_min_db?: string;
  ports?: string;
  // FEM
  tx_gain_db?: string;
  tx_p1db_dbm?: string;
  tx_psat_dbm?: string;
  rx_gain_db?: string;
  rx_nf_db?: string;
  // Balun / Splitter
  amplitude_balance_db?: string;
  phase_balance_deg?: string;
  impedance_ohm?: string;
  // Splitter / Connector
  power_handling_dbm?: string;
  // RF-Connector
  vswr?: string;
}

export interface SwitchLogic {
  ctrl: string;
  path: string;
}

export type DeviceType = "PA" | "LNA" | "Filter" | "Switch" | "FEM" | "Balun" | "Splitter" | "RF-Connector";

export interface Device {
  id: number;
  name: string;
  manufacturer: string;
  device_type: DeviceType;
  freq_min_mhz: number;
  freq_max_mhz: number;
  package?: string;
  pin_count?: number;
  enable_level?: string;
  switch_logic?: SwitchLogic[];
  bands: Band[];
  pdf_url: string;
  created_at: string;
}

export const fetchDevices = async (params?: {
  device_type?: string;
  freq_min?: number;
  freq_max?: number;
}): Promise<Device[]> => {
  const { data } = await api.get("/devices", { params });
  return data;
};

export const uploadDatasheet = async (
  file: File
): Promise<{ id: number; name: string; device_type: string }> => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/upload", form);
  return data;
};

export const deleteDevice = async (id: number): Promise<void> => {
  await api.delete(`/devices/${id}`);
};

export const downloadDatasheet = (id: number, name: string) => {
  const base = (import.meta.env.VITE_API_URL || "") + `/api/devices/${id}/datasheet`;
  const a = document.createElement("a");
  a.href = base;
  a.download = `${name}.pdf`;
  a.click();
};

export const exportDevices = (params?: {
  device_type?: string;
  freq_min?: number;
  freq_max?: number;
}) => {
  const base = (import.meta.env.VITE_API_URL || "") + "/api/export";
  const p = new URLSearchParams();
  if (params?.device_type) p.set("device_type", params.device_type);
  if (params?.freq_min != null) p.set("freq_min", String(params.freq_min));
  if (params?.freq_max != null) p.set("freq_max", String(params.freq_max));
  window.open(`${base}?${p.toString()}`, "_blank");
};
