import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fetchDevices, deleteDevice, exportDevices, Device, Band, SwitchLogic } from "../api";

const DEVICE_TYPES = ["全部", "PA", "LNA", "Filter", "Switch"];

const PRESET_BANDS = [
  { label: "n77", min: 3300, max: 4200 },
  { label: "n78", min: 3300, max: 3800 },
  { label: "n79", min: 4400, max: 5000 },
  { label: "n41", min: 2496, max: 2690 },
  { label: "n28", min: 700, max: 960 },
  { label: "n1", min: 1920, max: 2170 },
];

function fmt(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function BandCols({ band, type }: { band: Band; type: string }) {
  if (type === "PA") return (
    <>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.vcc_v)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.icc_ma)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.gain_db)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.gain_min_db)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.p1db_dbm)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.psat_dbm)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.pae_percent)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.s11_db)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.s22_db)}</td>
    </>
  );
  if (type === "LNA") return (
    <>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.vcc_v)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.icc_ma)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.gain_db)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.gain_min_db)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.nf_db)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.nf_max_db)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.iip3_dbm)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.op1db_dbm)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.oip3_dbm)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.s11_db)}</td>
    </>
  );
  if (type === "Filter") return (
    <>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.insertion_loss_db)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.insertion_loss_max_db)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.rejection_db)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.return_loss_db)}</td>
    </>
  );
  if (type === "Switch") return (
    <>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.vcc_v)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.insertion_loss_db)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.insertion_loss_max_db)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.isolation_db)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.isolation_min_db)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.p1db_dbm)}</td>
      <td className="px-2 py-2 text-right text-gray-800 whitespace-nowrap">{fmt(band.ports)}</td>
    </>
  );
  return null;
}

const TYPE_COLS: Record<string, { label: string; unit?: string }[]> = {
  PA: [
    { label: "Vcc", unit: "V" }, { label: "Icc", unit: "mA" },
    { label: "增益Typ", unit: "dB" }, { label: "增益Min", unit: "dB" },
    { label: "P1dB", unit: "dBm" }, { label: "Psat", unit: "dBm" },
    { label: "PAE", unit: "%" }, { label: "S11", unit: "dB" }, { label: "S22", unit: "dB" },
  ],
  LNA: [
    { label: "Vcc", unit: "V" }, { label: "Icc", unit: "mA" },
    { label: "增益Typ", unit: "dB" }, { label: "增益Min", unit: "dB" },
    { label: "NF Typ", unit: "dB" }, { label: "NF Max", unit: "dB" },
    { label: "IIP3", unit: "dBm" }, { label: "OP1dB", unit: "dBm" }, { label: "OIP3", unit: "dBm" },
    { label: "S11", unit: "dB" },
  ],
  Filter: [
    { label: "IL Typ", unit: "dB" }, { label: "IL Max", unit: "dB" },
    { label: "带外抑制", unit: "dB" }, { label: "回波损耗", unit: "dB" },
  ],
  Switch: [
    { label: "Vcc", unit: "V" },
    { label: "IL Typ", unit: "dB" }, { label: "IL Max", unit: "dB" },
    { label: "隔离Typ", unit: "dB" }, { label: "隔离Min", unit: "dB" },
    { label: "P1dB", unit: "dBm" }, { label: "端口" },
  ],
};

function DeviceTable({ type, devices, onDelete }: {
  type: string;
  devices: Device[];
  onDelete: (id: number) => void;
}) {
  const cols = TYPE_COLS[type] || [];
  if (devices.length === 0)
    return <p className="text-gray-400 text-sm py-4">暂无 {type} 器件</p>;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-2 py-2 font-semibold text-gray-600 border-b whitespace-nowrap">型号</th>
            <th className="text-left px-2 py-2 font-semibold text-gray-600 border-b whitespace-nowrap">厂家</th>
            <th className="text-left px-2 py-2 font-semibold text-gray-600 border-b whitespace-nowrap">封装</th>
            <th className="text-right px-2 py-2 font-semibold text-gray-600 border-b whitespace-nowrap">Pin</th>
            <th className="text-left px-2 py-2 font-semibold text-gray-600 border-b whitespace-nowrap">频段(MHz)</th>
            <th className="text-left px-2 py-2 font-semibold text-gray-600 border-b whitespace-nowrap">频段名</th>
            {cols.map((c, i) => (
              <th key={i} className="text-right px-2 py-2 font-semibold text-gray-600 border-b whitespace-nowrap">
                {c.label}{c.unit && <span className="text-gray-400 font-normal ml-1">({c.unit})</span>}
              </th>
            ))}
            <th className="text-left px-2 py-2 font-semibold text-gray-600 border-b whitespace-nowrap">使能</th>
            <th className="text-left px-2 py-2 font-semibold text-gray-600 border-b whitespace-nowrap">开关逻辑</th>
            <th className="px-2 py-2 border-b" />
          </tr>
        </thead>
        <tbody>
          {devices.map((d) => {
            const bands = d.bands && d.bands.length > 0 ? d.bands : [{ freq_min_mhz: d.freq_min_mhz, freq_max_mhz: d.freq_max_mhz } as Band];
            const switchStr = d.switch_logic
              ? d.switch_logic.map((s: SwitchLogic) => `${s.ctrl}→${s.path}`).join("; ")
              : "—";
            return bands.map((band, bi) => (
              <tr key={`${d.id}-${bi}`} className={`hover:bg-blue-50 transition border-b ${bi > 0 ? "bg-gray-50" : ""}`}>
                {bi === 0 && (
                  <>
                    <td rowSpan={bands.length} className="px-2 py-2 font-medium text-blue-700 whitespace-nowrap border-r">
                      <a href={d.pdf_url} target="_blank" rel="noreferrer" className="hover:underline">{d.name}</a>
                    </td>
                    <td rowSpan={bands.length} className="px-2 py-2 text-gray-600 whitespace-nowrap border-r">{fmt(d.manufacturer)}</td>
                    <td rowSpan={bands.length} className="px-2 py-2 text-gray-600 whitespace-nowrap border-r">{fmt(d.package)}</td>
                    <td rowSpan={bands.length} className="px-2 py-2 text-right text-gray-600 whitespace-nowrap border-r">{fmt(d.pin_count)}</td>
                  </>
                )}
                <td className="px-2 py-2 text-gray-600 whitespace-nowrap">
                  {band.freq_min_mhz}–{band.freq_max_mhz}
                </td>
                <td className="px-2 py-2 text-gray-500 whitespace-nowrap text-xs">{fmt(band.band_name)}</td>
                <BandCols band={band} type={type} />
                {bi === 0 && (
                  <>
                    <td rowSpan={bands.length} className="px-2 py-2 text-gray-600 whitespace-nowrap text-xs border-l">{fmt(d.enable_level)}</td>
                    <td rowSpan={bands.length} className="px-2 py-2 text-gray-600 text-xs border-l max-w-xs">{switchStr}</td>
                    <td rowSpan={bands.length} className="px-2 py-2 text-right border-l">
                      <button onClick={() => onDelete(d.id)} className="text-xs text-red-400 hover:text-red-600">删除</button>
                    </td>
                  </>
                )}
              </tr>
            ));
          })}
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

  const handleExport = () => {
    exportDevices(params);
  };

  const grouped =
    activeType === "全部"
      ? (["PA", "LNA", "Filter", "Switch"] as const).reduce((acc, t) => {
          acc[t] = devices.filter((d) => d.device_type === t);
          return acc;
        }, {} as Record<string, Device[]>)
      : { [activeType]: devices };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">器件库</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{devices.length} 个器件</span>
          <button
            onClick={handleExport}
            className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg transition"
          >
            导出 Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-500 mr-1">频段筛选：</span>
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
            <button onClick={clearFilter} className="text-xs text-gray-400 hover:text-red-500 ml-2">
              清除筛选
            </button>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <input
            type="number"
            value={freqMin}
            onChange={(e) => { setFreqMin(e.target.value); setActivePreset(""); }}
            placeholder="最低频率 MHz"
            className="w-36 border rounded px-3 py-1.5 text-sm"
          />
          <span className="text-gray-400">—</span>
          <input
            type="number"
            value={freqMax}
            onChange={(e) => { setFreqMax(e.target.value); setActivePreset(""); }}
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
              activeType === t ? "bg-white shadow text-blue-700" : "text-gray-600 hover:text-gray-800"
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
                  <span className="ml-2 text-xs text-gray-400 font-normal">{devs.length} 个</span>
                </h2>
              )}
              <DeviceTable type={type} devices={devs} onDelete={handleDelete} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
