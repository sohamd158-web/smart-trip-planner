import { useState, useEffect } from "react";
import api from "../api/client";
import { ArrowLeft, Sparkles, Plus, Trash2, Calendar, Users, ArrowRightLeft, CheckCircle2, MapPin } from "lucide-react";

export default function TripDetailPage({ tripId, onBack }) {
  const [trip, setTrip] = useState(null);
  const [settlementData, setSettlementData] = useState(null);
  const [activeTab, setActiveTab] = useState("itinerary");
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);
  const [actForm, setActForm] = useState({ dayNumber: 1, title: "", category: "Sightseeing", estimatedCost: "", notes: "" });
  const [aiExpenseText, setAiExpenseText] = useState("");
  const [parsingExpense, setParsingExpense] = useState(false);
  const [expForm, setExpForm] = useState({ description: "", amount: "", paidBy: "", splitAmong: [] });

  const loadTripData = async () => {
    try {
      const [tripRes, setRes] = await Promise.all([
        api.get("/trips/" + tripId),
        api.get("/trips/" + tripId + "/settlements"),
      ]);
      setTrip(tripRes.data);
      setSettlementData(setRes.data);
      if (tripRes.data.members.length > 0 && !expForm.paidBy) {
        setExpForm((prev) => ({
          ...prev,
          paidBy: tripRes.data.members[0],
          splitAmong: tripRes.data.members,
        }));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTripData(); }, [tripId]);
  const handleGenerateAI = async (e) => {
    e.preventDefault();
    setGeneratingAI(true);
    try {
      await api.post("/trips/" + tripId + "/ai-itinerary", { preferences });
      setPreferences("");
      await loadTripData();
    } catch (err) { alert(err.response?.data?.error || "Failed to generate itinerary"); }
    finally { setGeneratingAI(false); }
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    try {
      await api.post("/trips/" + tripId + "/activities", actForm);
      setActForm({ dayNumber: 1, title: "", category: "Sightseeing", estimatedCost: "", notes: "" });
      await loadTripData();
    } catch (err) { alert("Failed to add activity"); }
  };

  const handleDeleteActivity = async (id) => {
    await api.delete("/trips/" + tripId + "/activities/" + id);
    await loadTripData();
  };

  const handleAIExpense = async (e) => {
    e.preventDefault();
    if (!aiExpenseText.trim()) return;
    setParsingExpense(true);
    try {
      await api.post("/trips/" + tripId + "/ai-expense", { text: aiExpenseText });
      setAiExpenseText("");
      await loadTripData();
    } catch (err) { alert(err.response?.data?.error || "Failed to parse expense"); }
    finally { setParsingExpense(false); }
  };

  const handleManualExpense = async (e) => {
    e.preventDefault();
    await api.post("/trips/" + tripId + "/expenses", { ...expForm, amount: parseFloat(expForm.amount) });
    setExpForm((prev) => ({ ...prev, description: "", amount: "" }));
    await loadTripData();
  };

  const handleDeleteExpense = async (id) => {
    await api.delete("/trips/" + tripId + "/expenses/" + id);
    await loadTripData();
  };

  const toggleSplitMember = (member) => {
    setExpForm((prev) => {
      const updated = prev.splitAmong.includes(member)
        ? prev.splitAmong.filter((m) => m !== member)
        : [...prev.splitAmong, member];
      return { ...prev, splitAmong: updated.length > 0 ? updated : [member] };
    });
  };
  if (loading || !trip) return <div className="min-h-screen bg-slate-50 p-8 text-center text-slate-500">Loading trip...</div>;

  const budgetPercent = Math.min(100, Math.round(((settlementData?.totalSpent || 0) / Math.max(trip.budget, 1)) * 100));
  const groupedDays = trip.activities.reduce((acc, act) => {
    acc[act.dayNumber] = acc[act.dayNumber] || [];
    acc[act.dayNumber].push(act);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-600 mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to All Trips
          </button>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-indigo-600 text-sm font-medium mb-1"><MapPin className="w-4 h-4" /> {trip.destination}</div>
              <h1 className="text-2xl font-bold text-slate-900">{trip.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1.5">
                <span className="inline-flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(trip.startDate).toLocaleDateString()} – {new Date(trip.endDate).toLocaleDateString()}</span>
                <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {trip.members.join(", ")}</span>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 min-w-[240px]">
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-500">Spent: ₹{(settlementData?.totalSpent || 0).toLocaleString()}</span>
                <span className="text-slate-900">Budget: ₹{trip.budget.toLocaleString()}</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div className={"h-full " + (budgetPercent > 90 ? "bg-red-500" : "bg-indigo-600")} style={{ width: budgetPercent + "%" }} />
              </div>
              <p className="text-right text-xs text-slate-500 mt-1">Remaining: <strong className="text-emerald-600">₹{(settlementData?.remainingBudget || 0).toLocaleString()}</strong></p>
            </div>
          </div>
          <div className="flex gap-2 mt-6 border-t border-slate-100 pt-4">
            <button onClick={() => setActiveTab("itinerary")} className={"px-4 py-2 rounded-lg text-sm font-semibold " + (activeTab === "itinerary" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100")}>AI Itinerary ({trip.activities.length})</button>
            <button onClick={() => setActiveTab("expenses")} className={"px-4 py-2 rounded-lg text-sm font-semibold " + (activeTab === "expenses" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100")}>Expense Splitter ({trip.expenses.length})</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6">
        {activeTab === "itinerary" ? (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-md">
              <div className="flex items-center gap-2 mb-2"><Sparkles className="w-5 h-5" /><h2 className="text-lg font-bold">Generate Day-by-Day Plan with AI</h2></div>
              <form onSubmit={handleGenerateAI} className="flex flex-col sm:flex-row gap-3 mt-3">
                <input type="text" placeholder="e.g., waterfalls, root bridges, street food..." className="flex-1 px-4 py-2.5 rounded-xl bg-white/15 border border-white/25 text-white placeholder-indigo-200" value={preferences} onChange={(e) => setPreferences(e.target.value)} />
                <button type="submit" disabled={generatingAI} className="px-6 py-2.5 bg-white text-indigo-700 font-semibold rounded-xl">{generatingAI ? "Generating..." : "Generate Plan"}</button>
              </form>
            </div>
            <form onSubmit={handleAddActivity} className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-3">
              <input type="number" min="1" placeholder="Day #" required className="px-3 py-2 border border-slate-200 rounded-lg text-sm" value={actForm.dayNumber} onChange={(e) => setActForm({ ...actForm, dayNumber: e.target.value })} />
              <input type="text" placeholder="Activity title" required className="sm:col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm" value={actForm.title} onChange={(e) => setActForm({ ...actForm, title: e.target.value })} />
              <input type="number" placeholder="Est. Cost (₹)" className="px-3 py-2 border border-slate-200 rounded-lg text-sm" value={actForm.estimatedCost} onChange={(e) => setActForm({ ...actForm, estimatedCost: e.target.value })} />
              <button type="submit" className="bg-slate-900 text-white text-sm font-medium rounded-lg py-2 px-4 flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Add Stop</button>
            </form>
            {Object.keys(groupedDays).length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 text-slate-500">No activities yet. Click Generate Plan above!</div>
            ) : Object.entries(groupedDays).map(([day, items]) => (
              <div key={day} className="bg-white rounded-2xl p-6 border border-slate-200">
                <h3 className="text-base font-bold text-indigo-600 mb-4">Day {day}</h3>
                <div className="space-y-3">
                  {items.map((act) => (
                    <div key={act.id} className="flex items-start justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                      <div>
                        <div className="flex items-center gap-2"><span className="font-semibold text-slate-900">{act.title}</span><span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{act.category}</span></div>
                        {act.notes && <p className="text-xs text-slate-500 mt-1">{act.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-700">₹{act.estimatedCost.toLocaleString()}</span>
                        <button onClick={() => handleDeleteActivity(act.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl p-5 border border-indigo-200">
                <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm mb-2"><Sparkles className="w-4 h-4" /> Quick AI Expense Entry</div>
                <form onSubmit={handleAIExpense} className="flex gap-2">
                  <input type="text" placeholder="e.g., Rahul paid 1200 for lunch split between Soham and Rahul" className="flex-1 px-3.5 py-2 border border-slate-200 rounded-xl text-sm" value={aiExpenseText} onChange={(e) => setAiExpenseText(e.target.value)} />
                  <button type="submit" disabled={parsingExpense} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl">{parsingExpense ? "Parsing..." : "Add with AI"}</button>
                </form>
              </div>
              <form onSubmit={handleManualExpense} className="bg-white rounded-2xl p-5 border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-800">Manual Expense Entry</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="text" placeholder="Description" required className="px-3 py-2 border border-slate-200 rounded-lg text-sm" value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} />
                  <input type="number" placeholder="Amount (₹)" required className="px-3 py-2 border border-slate-200 rounded-lg text-sm" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} />
                  <select className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" value={expForm.paidBy} onChange={(e) => setExpForm({ ...expForm, paidBy: e.target.value })}>
                    {trip.members.map((m) => <option key={m} value={m}>Paid by {m}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-slate-500 mr-1">Split among:</span>
                    {trip.members.map((m) => (
                      <button type="button" key={m} onClick={() => toggleSplitMember(m)} className={"text-xs px-2.5 py-1 rounded-full border " + (expForm.splitAmong.includes(m) ? "bg-indigo-50 border-indigo-400 text-indigo-700 font-medium" : "border-slate-200 text-slate-400")}>{m}</button>
                    ))}
                  </div>
                  <button type="submit" className="px-4 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg">Log Expense</button>
                </div>
              </form>
              <div className="bg-white rounded-2xl p-5 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Expense History</h3>
                {trip.expenses.length === 0 ? <p className="text-sm text-slate-400">No expenses logged yet.</p> : (
                  <div className="space-y-2.5">
                    {trip.expenses.map((exp) => (
                      <div key={exp.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div>
                          <p className="font-semibold text-sm text-slate-900">{exp.description}</p>
                          <p className="text-xs text-slate-500">Paid by <strong>{exp.paidBy}</strong> • Split with {exp.splitAmong.join(", ")}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900">₹{exp.amount.toLocaleString()}</span>
                          <button onClick={() => handleDeleteExpense(exp.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200 h-fit">
              <div className="flex items-center gap-2 text-slate-900 font-bold mb-4"><ArrowRightLeft className="w-5 h-5 text-indigo-600" /><h2>Who Owes Whom</h2></div>
              {!settlementData || settlementData.settlements.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 p-3.5 rounded-xl"><CheckCircle2 className="w-5 h-5" /> All settled up!</div>
              ) : (
                <div className="space-y-3">
                  {settlementData.settlements.map((s, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between">
                      <div className="text-sm"><span className="font-bold text-slate-900">{s.from}</span><span className="text-slate-500"> owes </span><span className="font-bold text-slate-900">{s.to}</span></div>
                      <span className="font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg text-sm">₹{s.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Net Balances</h3>
                <div className="space-y-2">
                  {settlementData && Object.entries(settlementData.balances).map(([person, bal]) => (
                    <div key={person} className="flex justify-between text-sm">
                      <span className="text-slate-700">{person}</span>
                      <span className={"font-semibold " + (bal >= 0 ? "text-emerald-600" : "text-red-500")}>{bal >= 0 ? "+₹" + bal.toLocaleString() : "-₹" + Math.abs(bal).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
