import { useState, useEffect } from "react";
import api from "../api/client";
import { Plane, Plus, MapPin, Calendar, Users, Trash2, LogOut, ArrowRight } from "lucide-react";

export default function DashboardPage({ user, onLogout, onSelectTrip }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", destination: "", startDate: "", endDate: "", budget: "", membersText: user.name });
  const [submitting, setSubmitting] = useState(false);

  const fetchTrips = async () => {
    try {
      const { data } = await api.get("/trips");
      setTrips(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTrips(); }, []);

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const members = form.membersText.split(",").map((m) => m.trim()).filter(Boolean);
      await api.post("/trips", {
        title: form.title,
        destination: form.destination,
        startDate: form.startDate,
        endDate: form.endDate,
        budget: parseFloat(form.budget),
        members: members.length > 0 ? members : [user.name],
      });
      setShowModal(false);
      setForm({ title: "", destination: "", startDate: "", endDate: "", budget: "", membersText: user.name });
      fetchTrips();
    } catch (err) { alert(err.response?.data?.error || "Failed to create trip"); }
    finally { setSubmitting(false); }
  };

  const handleDeleteTrip = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Delete this trip?")) return;
    try {
      await api.delete("/trips/" + id);
      setTrips(trips.filter((t) => t.id !== id));
    } catch (err) { alert("Failed to delete trip"); }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 text-indigo-600">
            <Plane className="w-7 h-7" />
            <span className="text-xl font-bold text-slate-900">TripSplit AI</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">Hi, {user.name}</span>
            <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Your Trips</h1>
            <p className="text-slate-500 text-sm">Plan itineraries with AI and split group expenses effortlessly.</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm">
            <Plus className="w-5 h-5" /> New Trip
          </button>
        </div>
        {loading ? <p className="text-slate-500">Loading your trips...</p> : trips.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No trips yet</h3>
            <button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium">Create First Trip</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map((trip) => (
              <div key={trip.id} onClick={() => onSelectTrip(trip.id)} className="group bg-white rounded-2xl p-6 border border-slate-200 hover:border-indigo-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className="inline-flex items-center gap-1 text-xs font-medium bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full">
                      <MapPin className="w-3.5 h-3.5" /> {trip.destination}
                    </span>
                    <button onClick={(e) => handleDeleteTrip(e, trip.id)} className="text-slate-400 hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 mb-2">{trip.title}</h3>
                  <div className="space-y-1.5 text-sm text-slate-500 mb-4">
                    <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /><span>{new Date(trip.startDate).toLocaleDateString()} – {new Date(trip.endDate).toLocaleDateString()}</span></div>
                    <div className="flex items-center gap-2"><Users className="w-4 h-4 text-slate-400" /><span>{trip.members.join(", ")}</span></div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div><p className="text-xs text-slate-400">Budget</p><p className="font-bold text-slate-900">₹{trip.budget.toLocaleString()}</p></div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600">Open <ArrowRight className="w-4 h-4" /></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Plan a New Trip</h2>
            <form onSubmit={handleCreateTrip} className="space-y-4">
              <input type="text" placeholder="Trip Title" required className="w-full px-3.5 py-2 border border-slate-200 rounded-lg" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <input type="text" placeholder="Destination" required className="w-full px-3.5 py-2 border border-slate-200 rounded-lg" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" required className="w-full px-3 py-2 border border-slate-200 rounded-lg" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                <input type="date" required className="w-full px-3 py-2 border border-slate-200 rounded-lg" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
              <input type="number" placeholder="Total Budget (₹)" required className="w-full px-3.5 py-2 border border-slate-200 rounded-lg" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              <input type="text" placeholder="Members (comma-separated)" required className="w-full px-3.5 py-2 border border-slate-200 rounded-lg" value={form.membersText} onChange={(e) => setForm({ ...form, membersText: e.target.value })} />
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 text-sm bg-indigo-600 text-white font-medium rounded-lg">{submitting ? "Creating..." : "Create Trip"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}