import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fetchDevices, deleteDevice, Device } from "../api";

const DEVICE_TYPES = ["全部", "PA", "LNA", "Filter", "Switch"];

const PRESET_BANDS = [
  { label: "n77", min: 3300, max: 4200 },
  { label: "n78", min: 3300, max: 3800 },
  { label: "n79", min: 4400, max: 5000 },
  { label: "n41", min: 2496, max: 2690 },
  { label: "n28", min: 700, max: 960 },
];

// Column definitions per device type
const COLUMNS: Record<string, { key: string; label: string; unit?: string }[]> =
  {
    PA: [
      { key: "vcc_v", label: "Vcc", unit: "V" },
      { key: "icc_ma", label: "Icc", unit: "mA" },
      { key: "gain_db", label: "增益 Typ", unit: "dB" },
      { key: "gain_min_db", label: "增益 Min", unit: "dB" },
      { key: "p1db_dbm", label: "P1dB", unit: "dBm" },
      { key: "psat_dbm", label: "Psat", unit: "dBm" },
      { key: "pae_percent", label: "PAE", unit: "%" },
      { key: "s11_db", label: "S11", unit: "dB" },
      { key: "s22_db", label: "S22", unit: "dB" },
    ],
    LNA: [
      { key: "vcc_v", label: "Vcc", unit: "V" },
      { key: "icc_ma", label: "Icc", unit: "mA" },
      { key: "gain_db", label: "增益 Typ", unit: "dB" },
      { key: "gain_min_db", label: "增益 Min", unit: "dB" },
      { key: "nf_db", label: "NF Typ", unit: "dB" },
      { key: "nf_max_db", label: "NF Max", unit: "dB" },
      { key: "iip3_dbm", label: "IIP3", unit: "dBm" },
      { key: "s11_db", label: "S11", unit: "dB" },
    ],
    Filter: [
      { key: "insertion_loss_db", label: "IL Typ", unit: "dB" },
      { key: "insertion_loss_max_db", label: "IL Max", unit: "dB" },
      { key: "rejection_db", label: "带外抑制", unit: "dB" },
      { key: "return_loss_db", label: "回波损耗", unit: "dB" },
      { key: "package", label: "封装" },
    ],
    Switch: [
      { key: "vcc_v", label: "Vcc", unit: "V" },
      { key: "insertion_loss_db", label: "IL Typ", unit: "dB" },
      { key: "insertion_loss_max_db", label: "IL Max", unit: "dB" },
      { key: "isolation_db", label: "隔离 Typ", unit: "dB" },
      { key: "isolation_min_db", label: "隔离 Min", unit: "dB" },
      { key: "p1db_dbm", label: "P1dB", unit: "dBm" },
      { key: "ports", label: "端口" },
    ],
  };

function fmt(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return String(v);
  return String(v);
}

function DeviceTypeTab({
  type,
  devices,
  onDelete,
}: {
  type: string;
  devices: Device[];
  onDelete: (id: number) => void;
}) {
  const cols = COLUMNS[type] || [];

  if (devices.length === 0)
    return <p className="text-gray-400 text-sm py-4">暂无 {type} 器件</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b whitespace-nowrap">
              型号
            </th>
            <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b whitespace-nowrap">
              厂家
            </th>
            <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b whitespace-nowrap">
              频段 (MHz)
            </th>
            {cols.map((c) => (
              <th
                key={c.key}
                className="text-right px-3 py-2 font-semibold text-gray-600 border-b whitespace-nowrap"
              >
                {c.label}
                {c.unit && (
                  <span className="text-gray-400 font-normal ml-1">
                    ({c.unit})
                  </span>
                )}
              </th>
            ))}
            <th className="px-3 py-2 border-b" />
          </tr>
        </thead>
        <tbody>
          {devices.map((d) => (
            <tr key={d.id} className="hover:bg-blue-50 transition border-b">
              <td className="px-3 py-2 font-medium text-blue-700 whitespace-nowrap">
                <a
                  href={d.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {d.name}
                </a>
              </td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                {d.manufacturer || "—"}
              </td>
              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                {d.freq_min_mhz}–{d.freq_max_mhz}
              </td>
              {cols.map((c) => (
                <td
                  key={c.key}
                  className="px-3 py-2 text-right text-gray-800 whitespace-nowrap"
                >
                  {fmt(d.specs?.[c.key])}
                </td>
              ))}
              <td className="px-3 py-2 text-right">
                <button
                  onClick={() => onDelete(d.id)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LibraryPage() {
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState("全部");
  const [freqMin, setFreqMin] = useState<string>("");
  const [freqMax, setFreqMax] = useState<string>("");
  const [activePreset, setActivePreset] = useState<string>("");

  const params = {
    device_type: activeType === "全部" ? undefined : activeType,
    freq_min: freqMin ? Number(freqMin) : undefined,
    freq_max: freqMax ? Number(freqMax) : undefined,
  };

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ["devices", params],
    queryFn: () => fetchDevices(params),
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteDevice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["devices"] });
      toast.success("已删除");
    },
  });

  const handleDelete = (id: number) => {
    if (confirm("确定删除该器件？")) doDelete(id);
  };

  const applyPreset = (label: string, min: number, max: number) => {
    setActivePreset(label);
    setFreqMin(String(min));
    setFreqMax(String(max));
  };

  const clearFilter = () => {
    setFreqMin("");
    setFreqMax("");
    setActivePreset("");
  };

  // Group devices by type for "全部" tab
  const grouped =
    activeType === "全部"
      ? (["PA", "LNA", "Filter", "Switch"] as const).reduce(
          (acc, t) => {
            acc[t] = devices.filter((d) => d.device_type === t);
            return acc;
          },
          {} as Record<string, Device[]>
        )
      : { [activeType]: devices };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">器件库</h1>
        <span className="text-sm text-gray-500">{devices.length} 个器件</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-500 mr-1">频段预设：</span>
          {PRESET_BANDS.map((b) => (
            <button
              key={b.label}
              onClick={() => applyPreset(b.label, b.min, b.max)}
              className={`text-xs px-3 py-1 rounded-full border transition ${
                activePreset === b.label
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-300 text-gray-600 hover:border-blue-400"
              }`}
            >
              {b.label}
            </button>
          ))}
          {(freqMin || freqMax) && (
            <button
              onClick={clearFilter}
              className="text-xs text-gray-400 hover:text-red-500 ml-2"
            >
              清除筛选
            </button>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <input
            type="number"
            value={freqMin}
            onChange={(e) => {
              setFreqMin(e.target.value);
              setActivePreset("");
            }}
            placeholder="最低频率 MHz"
            className="w-36 border rounded px-3 py-1.5 text-sm"
          />
          <span className="text-gray-400">—</span>
          <input
            type="number"
            value={freqMax}
            onChange={(e) => {
              setFreqMax(e.target.value);
              setActivePreset("");
            }}
            placeholder="最高频率 MHz"
            className="w-36 border rounded px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {DEVICE_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setActiveType(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              activeType === t
                ? "bg-white shadow text-blue-700"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tables */}
      {isLoading ? (
        <div className="text-center text-gray-400 py-10">加载中...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, devs]) => (
            <div key={type} className="bg-white rounded-xl shadow p-4">
              {activeType === "全部" && (
                <h2 className="font-semibold text-gray-700 mb-3">
                  {type}
                  <span className="ml-2 text-xs text-gray-400 font-normal">
                    {devs.length} 个
                  </span>
                </h2>
              )}
              <DeviceTypeTab
                type={type}
                devices={devs}
                onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
