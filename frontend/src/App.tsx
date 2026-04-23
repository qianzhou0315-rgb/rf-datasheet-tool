import { useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import UploadPage from "./pages/Upload";
import LibraryPage from "./pages/Library";
import LoginPage from "./pages/Login";

function useAuth() {
  const [authed, setAuthed] = useState(() => localStorage.getItem("rf_auth") === "1");
  const [role, setRole] = useState(() => localStorage.getItem("rf_role") || "viewer");
  const login = (r: string) => { setAuthed(true); setRole(r); };
  const logout = () => {
    localStorage.removeItem("rf_auth");
    localStorage.removeItem("rf_role");
    setAuthed(false);
    setRole("viewer");
  };
  return { authed, role, login, logout };
}

export default function App() {
  const { authed, role, login, logout } = useAuth();

  if (!authed) {
    return <LoginPage onLogin={login} />;
  }

  const isAdmin = role === "admin";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-700 text-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-8">
          <span className="font-bold text-lg tracking-wide">RF Datasheet Tool</span>
          <nav className="flex gap-4 flex-1">
            {isAdmin && (
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-1 rounded text-sm font-medium transition ${
                    isActive ? "bg-white text-blue-700" : "text-blue-100 hover:bg-blue-600"
                  }`
                }
              >
                上传 Datasheet
              </NavLink>
            )}
            <NavLink
              to="/library"
              className={({ isActive }) =>
                `px-3 py-1 rounded text-sm font-medium transition ${
                  isActive ? "bg-white text-blue-700" : "text-blue-100 hover:bg-blue-600"
                }`
              }
            >
              器件库
            </NavLink>
          </nav>
          <button
            onClick={logout}
            className="text-xs text-blue-200 hover:text-white transition"
          >
            退出登录
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Routes>
          {isAdmin && <Route path="/" element={<UploadPage />} />}
          <Route path="/library" element={<LibraryPage />} />
          <Route path="*" element={<LibraryPage />} />
        </Routes>
      </main>
    </div>
  );
}
