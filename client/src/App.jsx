import { useState } from "react";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import TripDetailPage from "./pages/TripDetailPage";

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [selectedTripId, setSelectedTripId] = useState(null);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setSelectedTripId(null);
  };

  if (!user) return <AuthPage onAuthSuccess={setUser} />;
  if (selectedTripId) return <TripDetailPage tripId={selectedTripId} onBack={() => setSelectedTripId(null)} />;
  return <DashboardPage user={user} onLogout={handleLogout} onSelectTrip={(id) => setSelectedTripId(id)} />;
}
