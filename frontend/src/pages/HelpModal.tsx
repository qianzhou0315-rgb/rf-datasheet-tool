export default function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ width: "90vw", maxWidth: 760, maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">器件库使用指南</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl font-bold leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm text-gray-700">

          <section>
            <h3 className="font-semibold text-blue-700 mb-2">一、上传 Datasheet</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>使用 <span className="font-medium">admin</span> 账号登录后，点击顶部"上传 Datasheet"页面</li>
              <li>拖拽或点击选择 PDF 文件，支持批量上传</li>
              <li>点击"开始提取"，AI 自动识别器件类型并提取所有频段参数</li>
              <li>上传成功后器件库自动刷新，<span className="text-blue-600 font-medium">无需手动删除旧记录</span>——同名器件会自动覆盖更新</li>
              <li>上传过程中请勿关闭页面</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-blue-700 mb-2">二、支持的器件类型</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                ["PA", "功率放大器，含增益/P1dB/Psat/PAE"],
                ["LNA", "低噪声放大器，含增益/NF/IIP3/OIP3"],
                ["Filter", "滤波器，含插损/带外抑制/回波损耗"],
                ["Switch", "射频开关，含插损/隔离度/功率容量"],
                ["FEM", "前端模组，含TX/RX双路径参数"],
                ["Balun", "巴伦/变压器，含幅度/相位不平衡"],
                ["Splitter", "功分器/合路器，含隔离度/平衡度"],
                ["RF-Connector", "射频连接器，含VSWR/阻抗/功率容量"],
              ].map(([type, desc]) => (
                <div key={type} className="flex gap-2 items-start bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-semibold text-blue-600 w-20 flex-shrink-0">{type}</span>
                  <span className="text-gray-500 text-xs">{desc}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-blue-700 mb-2">三、频段筛选</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>点击预设频段按钮（n77 / n78 / n79 / n41 / n28 / n1 / 2.4G / 5G WiFi）快速筛选</li>
              <li>也可手动输入最低/最高频率（MHz）进行自定义筛选</li>
              <li>筛选后表格<span className="font-medium">只显示频率范围有重叠的频段行</span>，其余频段自动隐藏</li>
              <li>点击"清除筛选"恢复显示全部频段</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-blue-700 mb-2">四、编辑参数</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>每条器件右侧有 <span className="font-medium text-blue-600">编辑</span> 按钮，点击弹出参数编辑器</li>
              <li>编辑器按器件类型只显示相关字段，支持修改所有频段参数</li>
              <li>可新增或删除频段行</li>
              <li>从图表读取的近似值请加 <code className="bg-gray-100 px-1 rounded">~</code> 前缀，如 <code className="bg-gray-100 px-1 rounded">~22.5</code></li>
              <li>点击"保存"后器件库立即更新</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-blue-700 mb-2">五、Datasheet 预览与下载</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>点击每行的 <span className="font-medium text-blue-600">预览</span> 按钮，在线查看原始 PDF</li>
              <li>点击 <span className="font-medium text-gray-600">↓</span> 按钮下载 PDF 到本地</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-blue-700 mb-2">六、导出 Excel</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>点击右上角"导出 Excel"按钮，下载当前筛选结果</li>
              <li>Excel 按器件类型分 Sheet，每种类型包含对应的所有参数列</li>
              <li>可结合频段筛选和类型标签页导出特定子集</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-blue-700 mb-2">七、账号权限</h3>
            <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1">
              <div className="flex gap-4">
                <span className="font-medium w-16">TRX</span>
                <span className="text-gray-500">只读权限，仅可查看器件库、筛选、预览、下载、导出</span>
              </div>
              <div className="flex gap-4">
                <span className="font-medium w-16">admin</span>
                <span className="text-gray-500">完整权限，额外可上传 Datasheet、编辑参数、删除器件</span>
              </div>
            </div>
          </section>

        </div>

        <div className="px-6 py-3 border-t text-right">
          <button
            onClick={onClose}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-5 py-2 rounded-lg transition"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
