import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import toast from "react-hot-toast";
import { uploadDatasheet } from "../api";
import { useQueryClient } from "@tanstack/react-query";

export default function UploadPage() {
  const qc = useQueryClient();
  const [queue, setQueue] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<
    { name: string; status: "pending" | "ok" | "error"; msg?: string }[]
  >([]);

  const onDrop = useCallback((accepted: File[]) => {
    setQueue((q) => [...q, ...accepted]);
    setResults((r) => [
      ...r,
      ...accepted.map((f) => ({ name: f.name, status: "pending" as const })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    disabled: processing,
  });

  const startUpload = async () => {
    if (queue.length === 0) return;
    setProcessing(true);
    for (let i = 0; i < queue.length; i++) {
      const file = queue[i];
      setResults((r) =>
        r.map((x, idx) => (idx === i ? { ...x, status: "pending" } : x))
      );
      try {
        const res = await uploadDatasheet(file);
        setResults((r) =>
          r.map((x, idx) =>
            idx === i
              ? { ...x, status: "ok", msg: `${res.device_type}: ${res.name}` }
              : x
          )
        );
        qc.invalidateQueries({ queryKey: ["devices"] });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "失败";
        setResults((r) =>
          r.map((x, idx) => (idx === i ? { ...x, status: "error", msg } : x))
        );
      }
    }
    setProcessing(false);
    setQueue([]);
    qc.invalidateQueries({ queryKey: ["devices"] });
    toast.success("处理完成");
  };

  const clearAll = () => {
    setQueue([]);
    setResults([]);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">上传 Datasheet</h1>
      <p className="text-sm text-gray-500">
        直接上传 PDF，AI 自动识别器件类型并提取全频段参数。
      </p>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-blue-400 bg-white"
        } ${processing ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps()} />
        <p className="text-gray-500 text-sm">
          {isDragActive
            ? "松开以添加文件"
            : "拖拽 PDF 文件到此处，或点击选择文件（支持批量）"}
        </p>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-xl shadow p-5 space-y-2">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-gray-700">处理队列</h2>
            {!processing && (
              <button
                onClick={clearAll}
                className="text-xs text-gray-400 hover:text-red-500"
              >
                清空
              </button>
            )}
          </div>
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  r.status === "ok"
                    ? "bg-green-500"
                    : r.status === "error"
                    ? "bg-red-500"
                    : "bg-yellow-400"
                }`}
              />
              <span className="flex-1 truncate text-gray-700">{r.name}</span>
              {r.msg && (
                <span
                  className={`text-xs ${
                    r.status === "ok" ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {r.msg}
                </span>
              )}
              {r.status === "pending" && processing && (
                <span className="text-xs text-gray-400 animate-pulse">
                  处理中...
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {queue.length > 0 && !processing && (
        <button
          onClick={startUpload}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition"
        >
          开始提取 ({queue.length} 个文件)
        </button>
      )}

      {processing && (
        <div className="w-full bg-gray-100 text-gray-500 font-semibold py-3 rounded-xl text-center text-sm animate-pulse">
          AI 提取中，请勿关闭页面...
        </div>
      )}
    </div>
  );
}
