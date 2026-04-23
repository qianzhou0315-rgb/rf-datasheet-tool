import { useState, FormEvent } from "react";

const USERS: Record<string, { password: string; role: string }> = {
  TRX: { password: "productsystemTRX", role: "viewer" },
  admin: { password: "adminTRX", role: "admin" },
};

export default function LoginPage({ onLogin }: { onLogin: (role: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const user = USERS[username];
    if (user && user.password === password) {
      localStorage.setItem("rf_auth", "1");
      localStorage.setItem("rf_role", user.role);
      onLogin(user.role);
    } else {
      setError("用户名或密码错误");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-1 text-center">RF Datasheet Tool</h1>
        <p className="text-sm text-gray-400 text-center mb-8">请登录以继续</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition"
          >
            登录
          </button>
        </form>
      </div>
    </div>
  );
}
