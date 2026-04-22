import { Routes, Route, NavLink } from "react-router-dom";
import UploadPage from "./pages/Upload";
import LibraryPage from "./pages/Library";

const NAV_ITEMS = [
  { to: "/", label: "上传 Datasheet" },
  { to: "/library", label: "器件库" },
];

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-700 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-8">
          <span className="font-bold text-lg tracking-wide">RF Datasheet Tool</span>
          <nav className="flex gap-4">
            {NAV_ITEMS.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) =>
                  `px-3 py-1 rounded text-sm font-medium transition ${
                    isActive
                      ? "bg-white text-blue-700"
                      : "text-blue-100 hover:bg-blue-600"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/library" element={<LibraryPage />} />
        </Routes>
      </main>
    </div>
  );
}
