import axios from "axios";

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || "") + "/api",
});

export interface Device {
  id: number;
  name: string;
  manufacturer: string;
  device_type: "PA" | "LNA" | "Filter" | "Switch";
  freq_min_mhz: number;
  freq_max_mhz: number;
  pdf_url: string;
  created_at: string;
  specs: Record<string, number | string | null>;
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
  file: File,
  freq_min: number,
  freq_max: number
): Promise<{ id: number; name: string; device_type: string }> => {
  const form = new FormData();
  form.append("file", file);
  form.append("freq_min", String(freq_min));
  form.append("freq_max", String(freq_max));
  const { data } = await api.post("/upload", form);
  return data;
};

export const updateSpecs = async (
  id: number,
  specs: Record<string, string | number | null>
): Promise<void> => {
  await api.put(`/devices/${id}/specs`, specs);
};

export const deleteDevice = async (id: number): Promise<void> => {
  await api.delete(`/devices/${id}`);
};
