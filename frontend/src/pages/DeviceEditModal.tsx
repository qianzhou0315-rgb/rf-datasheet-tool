import { useState } from "react";
import { Device, Band, updateDevice } from "../api";
import toast from "react-hot-toast";

const BAND_FIELDS: { key: keyof Band; label: string }[] = [
  { key: "freq_min_mhz", label: "频率下限(MHz)" },
  { key: "freq_max_mhz", label: "频率上限(MHz)" },
  { key: "band_name", label: "频段名" },
  { key: "vcc_v", label: "Vcc(V)" },
  { key: "icc_ma", label: "Icc(mA)" },
  { key: "gain_db", label: "增益Typ(dB)" },
  { key: "gain_min_db", label: "增益Min(dB)" },
  { key: "p1db_dbm", label: "P1dB(dBm)" },
  { key: "psat_dbm", label: "Psat(dBm)" },
  { key: "pae_percent", label: "PAE(%)" },
  { key: "nf_db", label: "NF Typ(dB)" },
  { key: "nf_max_db", label: "NF Max(dB)" },
  { key: "iip3_dbm", label: "IIP3(dBm)" },
  { key: "op1db_dbm", label: "OP1dB(dBm)" },
  { key: "oip3_dbm", label: "OIP3(dBm)" },
  { key: "s11_db", label: "S11(dB)" },
  { key: "s22_db", label: "S22(dB)" },
  { key: "insertion_loss_db", label: "IL Typ(dB)" },
  { key: "insertion_loss_max_db", label: "IL Max(dB)" },
  { key: "rejection_db", label: "带外抑制(dB)" },
  { key: "return_loss_db", label: "回波损耗(dB)" },
  { key: "isolation_db", label: "隔离Typ(dB)" },
  { key: "isolation_min_db", label: "隔离Min(dB)" },
  { key: "power_handling_dbm", label: "功率容量(dBm)" },
  { key: "ports", label: "端口" },
  { key: "tx_gain_db", label: "TX增益(dB)" },
  { key: "tx_p1db_dbm", label: "TX P1dB(dBm)" },
  { key: "tx_psat_dbm", label: "TX Psat(dBm)" },
  { key: "rx_gain_db", label: "RX增益(dB)" },
  { key: "rx_nf_db", label: "RX NF(dB)" },
  { key: "amplitude_balance_db", label: "幅度不平衡(dB)" },
  { key: "phase_balance_deg", label: "相位不平衡(°)" },
  { key: "impedance_ohm", label: "阻抗(Ω)" },
  { key: "vswr", label: "VSWR" },
];

// Fields relevant to each device type
const TYPE_BAND_FIELDS: Record<string, (keyof Band)[]> = {
  PA: ["freq_min_mhz", "freq_max_mhz", "band_name", "vcc_v", "icc_ma", "gain_db", "gain_min_db", "p1db_dbm", "psat_dbm", "pae_percent", "s11_db", "s22_db"],
  LNA: ["freq_min_mhz", "freq_max_mhz", "band_name", "vcc_v", "icc_ma", "gain_db", "gain_min_db", "nf_db", "nf_max_db", "iip3_dbm", "op1db_dbm", "oip3_dbm", "s11_db"],
  Filter: ["freq_min_mhz", "freq_max_mhz", "band_name", "insertion_loss_db", "insertion_loss_max_db", "rejection_db", "return_loss_db"],
  Switch: ["freq_min_mhz", "freq_max_mhz", "band_name", "vcc_v", "insertion_loss_db", "insertion_loss_max_db", "isolation_db", "isolation_min_db", "p1db_dbm", "power_handling_dbm", "ports"],
  FEM: ["freq_min_mhz", "freq_max_mhz", "band_name", "vcc_v", "icc_ma", "tx_gain_db", "tx_p1db_dbm", "tx_psat_dbm", "rx_gain_db", "rx_nf_db", "ports"],
  Balun: ["freq_min_mhz", "freq_max_mhz", "band_name", "insertion_loss_db", "return_loss_db", "amplitude_balance_db", "phase_balance_deg", "impedance_ohm"],
  Splitter: ["freq_min_mhz", "freq_max_mhz", "band_name", "insertion_loss_db", "return_loss_db", "isolation_db", "amplitude_balance_db", "phase_balance_deg", "power_handling_dbm", "ports"],
  "RF-Connector": ["freq_min_mhz", "freq_max_mhz", "band_name", "insertion_loss_db", "return_loss_db", "vswr", "impedance_ohm", "power_handling_dbm"],
};

function emptyBand(): Band {
  return { freq_min_mhz: 0, freq_max_mhz: 0 };
}

export default function DeviceEditModal({ device, onClose, onSaved }: {
  device: Device;
  onClose: () => void;
  onSaved: (d: Device) => void;
}) {
  const [bands, setBands] = useState<Band[]>(
    device.bands && device.bands.length > 0 ? JSON.parse(JSON.stringify(device.bands)) : [emptyBand()]
  );
  const [saving, setSaving] = useState(false);

  const relevantKeys = TYPE_BAND_FIELDS[device.device_type] || BAND_FIELDS.map(f => f.key);
  const visibleFields = BAND_FIELDS.filter(f => relevantKeys.includes(f.key));

  const updateBandField = (bi: number, key: keyof Band, value: string) => {
    setBands(prev => prev.map((b, i) => i === bi ? { ...b, [key]: value === "" ? null : value } : b));
  };

  const addBand = () => setBands(prev => [...prev, emptyBand()]);

  const removeBand = (bi: number) => {
    if (bands.length <= 1) return;
    setBands(prev => prev.filter((_, i) => i !== bi));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await updateDevice(device.id, { bands });
      toast.success("保存成功");
      onSaved(saved);
      onClose();
    } catch (e) {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col"
        style={{ width: "95vw", maxWidth: 1100, height: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b">
          <div>
            <span className="font-bold text-gray-800 text-lg">{device.name}</span>
            <span className="ml-3 text-sm text-gray-400">{device.device_type} · 编辑频段参数</span>
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={addBand}
              className="text-sm bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded-lg border border-blue-200"
            >
              + 添加频段
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl font-bold leading-none">×</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse min-w-max">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-2 py-2 border text-gray-500 font-medium whitespace-nowrap">#</th>
                  {visibleFields.map(f => (
                    <th key={f.key} className="px-2 py-2 border text-gray-600 font-semibold whitespace-nowrap">{f.label}</th>
                  ))}
                  <th className="px-2 py-2 border" />
                </tr>
              </thead>
              <tbody>
                {bands.map((band, bi) => (
                  <tr key={bi} className={bi % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-2 py-1 border text-center text-gray-400">{bi + 1}</td>
                    {visibleFields.map(f => (
                      <td key={f.key} className="px-1 py-1 border">
                        <input
                          type="text"
                          value={(band[f.key] as string) ?? ""}
                          onChange={e => updateBandField(bi, f.key, e.target.value)}
                          className="w-20 px-1.5 py-0.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          placeholder="—"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1 border text-center">
                      <button
                        onClick={() => removeBand(bi)}
                        className="text-red-400 hover:text-red-600 text-xs"
                        disabled={bands.length <= 1}
                      >删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            提示：从图表读取的近似值请加 ~ 前缀（如 ~22.5）。空值留空即可。
          </p>
        </div>
      </div>
    </div>
  );
}
