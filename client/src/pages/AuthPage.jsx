import { useState, useEffect } from "react";
import api from "../api/client";
import { Plane, Mail, Lock, User, Loader2 } from "lucide-react";

export default function AuthPage({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [serverReady, setServerReady] = useState(false);

  useEffect(() => {
    api.get("/health").then(() => setServerReady(true)).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const payload = isLogin
        ? { email: form.email.trim(), password: form.password }
        : { name: form.name.trim() || form.email.split("@").at(0), email: form.email.trim(), password: form.password };

      const { data } = await api.post(endpoint, payload);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onAuthSuccess(data.user);
    } catch (err) {
      const serverMsg = err.response?.data?.error;
      if (serverMsg) {
        setError(serverMsg);
      } else if (err.code === "ECONNABORTED" || err.message === "Network Error") {
        setError("Backend server is waking up from sleep (~20s). Please click " + (isLogin ? "Log In" : "Sign Up") + " again now.");
      } else {
        setError("Error (" + (err.response?.status || "Network") + "): " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 max-w-md w-full p-8">
        <div className="flex items-center justify-center gap-2 text-indigo-600 mb-2">
          <Plane className="w-7 h-7" />
          <span className="text-2xl font-bold text-slate-900">TripSplit AI</span>
        </div>
        <h2 className="text-center text-lg font-bold text-slate-800 mb-1">
          {isLogin ? "Welcome back" : "Create your account"}
        </h2>
        <p className="text-center text-xs text-slate-400 mb-6">
          {serverReady ? "Connected to live cloud server" : "Connecting to cloud server..."}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Your full name"
                required
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          )}
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="email"
              placeholder="Email address (e.g., soham@test.com)"
              required
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="password"
              placeholder="Password (min 6 characters)"
              required
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Connecting..." : isLogin ? "Log In" : "Sign Up"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-6">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setError(""); }}
            className="text-indigo-600 font-semibold hover:underline"
          >
            {isLogin ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
