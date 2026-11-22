
import { useState, useEffect } from "react";
import api from "../api/client";
import {
  ArrowLeft,
  Calendar,
  Users,
  MapPin,
  Compass,
  CloudSun,
  Trash2,
  Sparkles,
  Plus,
  ArrowRightLeft,
  CheckCircle2
} from "lucide-react";

const FALLBACK_PHOTOS = {
  Heritage: "https://images.unsplash.com/photo-1599661046827-dacff0c0f09a?w=800",
  Nature: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=800",
  Adventure: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800",
  Culture: "https://images.unsplash.com/photo-1514222134-b57cbb8ce073?w=800",
  Food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800",
  Wildlife: "https://images.unsplash.com/photo-1472396961693-142e6e269027?w=800",
  Sightseeing: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800",
  Landmark: "https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=800"
};

export default function TripDetailPage({ tripId, onBack }) {

  // ================= STATE =================

  const [trip, setTrip] = useState(null);
  const [settlementData, setSettlementData] = useState(null);
  const [discoverData, setDiscoverData] = useState(null);

  const [activeTab, setActiveTab] = useState("itinerary");
  const [distanceFilter, setDistanceFilter] = useState("all");
  const [selectedDayForAdd, setSelectedDayForAdd] = useState(1);

  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);

  const [actForm, setActForm] = useState({
    dayNumber: 1,
    title: "",
    category: "Sightseeing",
    estimatedCost: "",
    notes: ""
  });

  const [aiExpenseText, setAiExpenseText] = useState("");
  const [parsingExpense, setParsingExpense] = useState(false);

  const [expForm, setExpForm] = useState({
    description: "",
    amount: "",
    paidBy: "",
    splitAmong: []
  });

  // ================= LOAD TRIP DATA =================

  const loadTripData = async () => {
    try {
      const [tripRes, setRes, discRes] = await Promise.all([
        api.get("/trips/" + tripId),
        api.get("/trips/" + tripId + "/settlements"),
        api.get("/trips/" + tripId + "/discover")
      ]);

      setTrip(tripRes.data);
      setSettlementData(setRes.data);
      setDiscoverData(discRes.data);

      if (tripRes.data.members?.length > 0) {
        setExpForm((prev) => ({
          ...prev,
          paidBy: prev.paidBy || tripRes.data.members[0],
          splitAmong:
            prev.splitAmong.length > 0
              ? prev.splitAmong
              : tripRes.data.members
        }));
      }

    } catch (err) {
      console.error("Failed to load trip:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTripData();
  }, [tripId]);

  // ================= AI ITINERARY =================

  const handleGenerateAI = async (e) => {
    e.preventDefault();

    setGeneratingAI(true);

    try {
      await api.post(
        "/trips/" + tripId + "/ai-itinerary",
        {
          preferences,
          replaceExisting: true
        }
      );

      setPreferences("");
      await loadTripData();

    } catch (err) {
      alert(
        err.response?.data?.error ||
        "Failed to generate itinerary"
      );
    } finally {
      setGeneratingAI(false);
    }
  };

  // ================= ADD ACTIVITY =================

  const handleAddActivity = async (e) => {
    e.preventDefault();

    try {
      await api.post(
        "/trips/" + tripId + "/activities",
        {
          ...actForm,
          dayNumber: Number(actForm.dayNumber),
          estimatedCost: Number(actForm.estimatedCost || 0)
        }
      );

      setActForm({
        dayNumber: 1,
        title: "",
        category: "Sightseeing",
        estimatedCost: "",
        notes: ""
      });

      await loadTripData();

    } catch (err) {
      alert(
        err.response?.data?.error ||
        "Failed to add activity"
      );
    }
  };

  // ================= DELETE ACTIVITY =================

  const handleDeleteActivity = async (id) => {
    if (!window.confirm("Delete this activity?")) return;

    try {
      await api.delete(
        "/trips/" + tripId + "/activities/" + id
      );

      await loadTripData();

    } catch (err) {
      alert("Failed to delete activity");
    }
  };

  // ================= AI EXPENSE =================

  const handleAIExpense = async (e) => {
    e.preventDefault();

    if (!aiExpenseText.trim()) return;

    setParsingExpense(true);

    try {
      await api.post(
        "/trips/" + tripId + "/ai-expense",
        { text: aiExpenseText }
      );

      setAiExpenseText("");
      await loadTripData();

    } catch (err) {
      alert(
        err.response?.data?.error ||
        "Failed to parse expense"
      );
    } finally {
      setParsingExpense(false);
    }
  };

  // ================= MANUAL EXPENSE =================

  const handleManualExpense = async (e) => {
    e.preventDefault();

    if (!expForm.splitAmong.length) {
      alert("Select at least one member for the expense split.");
      return;
    }

    try {
      await api.post(
        "/trips/" + tripId + "/expenses",
        {
          ...expForm,
          amount: parseFloat(expForm.amount)
        }
      );

      setExpForm((prev) => ({
        ...prev,
        description: "",
        amount: ""
      }));

      await loadTripData();

    } catch (err) {
      alert(
        err.response?.data?.error ||
        "Failed to add expense"
      );
    }
  };

  // ================= DELETE EXPENSE =================

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Delete this expense?")) return;

    try {
      await api.delete(
        "/trips/" + tripId + "/expenses/" + id
      );

      await loadTripData();

    } catch (err) {
      alert("Failed to delete expense");
    }
  };

  // ================= SPLIT MEMBERS =================

  const toggleSplitMember = (member) => {
    setExpForm((prev) => {
      const updated = prev.splitAmong.includes(member)
        ? prev.splitAmong.filter((m) => m !== member)
        : [...prev.splitAmong, member];

      return {
        ...prev,
        splitAmong: updated
      };
    });
  };

  // ================= LOADING =================

  if (loading || !trip) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 text-center text-slate-500">
        Loading destination & 400 km explorer...
      </div>
    );
  }

  // ================= CALCULATIONS =================

  const activities = trip.activities || [];
  const expenses = trip.expenses || [];
  const members = trip.members || [];

  const budget = Number(trip.budget || 0);
  const totalSpent = Number(settlementData?.totalSpent || 0);

  const budgetPercent = Math.min(
    100,
    Math.round((totalSpent / Math.max(budget, 1)) * 100)
  );

  const groupedDays = trip.activities.reduce((acc, act) => {
    acc[act.dayNumber] = acc[act.dayNumber] || [];
    acc[act.dayNumber].push(act);
    return acc;
  }, {});

  const DISTINCT_PHOTOS = [
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com",
    "https://unsplash.com"
  ];

  const allUniquePhotos = [...destGallery, ...DISTINCT_PHOTOS];
  const orderedIds = trip.activities.map((a) => a.id);

  const getPhotoForActivity = (act, idx = 0) => {
    const seq = orderedIds.indexOf(act.id);
    const uniqueIndex = seq >= 0 ? seq : (Number(act.dayNumber) - 1) * 2 + idx;
    return allUniquePhotos[uniqueIndex % allUniquePhotos.length];
  };

  const filteredPlaces = (
    discoverData?.nearbyPlaces || []
  ).filter((p) => {

    if (distanceFilter === "near") {
      return p.distanceKm <= 100;
    }

    if (distanceFilter === "mid") {
      return p.distanceKm > 100 && p.distanceKm <= 250;
    }

    if (distanceFilter === "far") {
      return p.distanceKm > 250 && p.distanceKm <= 400;
    }

    return p.distanceKm <= 400;
  });

  const dayOptions = Array.from(
    { length: 7 },
    (_, i) => i + 1
  );

  // ================= MAIN UI =================

  return (
    <div className="min-h-screen bg-slate-50 pb-12">

      {/* ================= HEADER ================= */}

      <div className="relative h-48 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 overflow-hidden">

        

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent" />

        <div className="absolute inset-0 max-w-5xl mx-auto px-6 py-5 flex flex-col justify-between text-white">

          <button
            onClick={onBack}
            className="self-start inline-flex items-center gap-1.5 text-xs bg-white/15 hover:bg-white/25 backdrop-blur-sm px-3 py-1.5 rounded-full"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Trips
          </button>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">

            <div>

              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-indigo-300 mb-1">

                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {trip.destination}, {discoverData?.country || "India"}
                </span>

                {discoverData?.weather && (
                  <span className="inline-flex items-center gap-1 bg-white/15 px-2.5 py-0.5 rounded-full text-white">
                    <CloudSun className="w-3.5 h-3.5" />
                    {discoverData.weather}
                  </span>
                )}

              </div>

              <h1 className="text-2xl sm:text-3xl font-bold">
                {trip.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-1">

                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(trip.startDate).toLocaleDateString()}
                  {" – "}
                  {new Date(trip.endDate).toLocaleDateString()}
                </span>

                <span className="inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {members.join(", ")}
                </span>

              </div>

            </div>

            {/* Budget Card */}

            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 min-w-[230px]">

              <div className="flex justify-between text-xs mb-1">
                <span>
                  Spent: ₹{totalSpent.toLocaleString("en-IN")}
                </span>

                <span>
                  Budget: ₹{budget.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">

                <div
                  className={
                    "h-full " +
                    (budgetPercent > 90
                      ? "bg-red-400"
                      : "bg-emerald-400")
                  }
                  style={{ width: budgetPercent + "%" }}
                />

              </div>

              <p className="text-right text-xs text-emerald-300 mt-1">
                Remaining: ₹
                {Number(
                  settlementData?.remainingBudget ??
                  Math.max(0, budget - totalSpent)
                ).toLocaleString("en-IN")}
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* ================= NAVIGATION TABS ================= */}

      <div className="bg-white border-b border-slate-200 px-6 py-3 sticky top-0 z-10 shadow-sm">

        <div className="max-w-5xl mx-auto flex flex-wrap gap-2">

          <button
            onClick={() => setActiveTab("itinerary")}
            className={
              "px-4 py-2 rounded-lg text-sm font-semibold transition " +
              (activeTab === "itinerary"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-100")
            }
          >
            AI Itinerary ({activities.length})
          </button>

          <button
            onClick={() => setActiveTab("discover")}
            className={
              "px-4 py-2 rounded-lg text-sm font-semibold transition inline-flex items-center gap-1.5 " +
              (activeTab === "discover"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-100")
            }
          >
            <Compass className="w-4 h-4" />
            400 km Explorer & Resources ({discoverData?.totalPlacesFound || 0})
          </button>

          <button
            onClick={() => setActiveTab("expenses")}
            className={
              "px-4 py-2 rounded-lg text-sm font-semibold transition " +
              (activeTab === "expenses"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-100")
            }
          >
            Expense Splitter ({expenses.length})
          </button>

        </div>

      </div>

      {/* ================= MAIN CONTENT ================= */}

      <main className="max-w-5xl mx-auto p-6">

        {/* ================================================= */}
        {/*                  ITINERARY TAB                    */}
        {/* ================================================= */}

        {activeTab === "itinerary" && (

          <div className="space-y-6">

            {/* AI GENERATOR */}

            <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white shadow-md">

              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5" />

                <h2 className="text-lg font-bold">
                  Auto-Generate 400 km Radius Plan
                </h2>
              </div>

              <p className="text-sm text-indigo-100 mb-4">
                Automatically picks diverse real attractions,
                hill stations, and landmarks within 400 km of{" "}
                {trip.destination}.
              </p>

              <form
                onSubmit={handleGenerateAI}
                className="flex flex-col sm:flex-row gap-3"
              >

                <input
                  type="text"
                  placeholder="Preferences: waterfalls, heritage forts, local food, wildlife..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/15 border border-white/25 text-white placeholder-indigo-200 focus:outline-none"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                />

                <button
                  type="submit"
                  disabled={generatingAI}
                  className="px-5 py-2.5 bg-white text-indigo-700 rounded-xl font-semibold hover:bg-indigo-50 disabled:opacity-50"
                >
                  {generatingAI ? "Discovering..." : "Generate Plan"}
                </button>

              </form>

            </div>

            {/* ADD CUSTOM ACTIVITY */}

            <div className="bg-white rounded-xl p-5 border border-slate-200">

              <h2 className="text-lg font-bold mb-4">
                Add Custom Activity
              </h2>

              <form
                onSubmit={handleAddActivity}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >

                <input
                  type="number"
                  min="1"
                  max={dayOptions.length}
                  placeholder="Day #"
                  required
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  value={actForm.dayNumber}
                  onChange={(e) =>
                    setActForm({
                      ...actForm,
                      dayNumber: e.target.value
                    })
                  }
                />

                <select
                  value={actForm.category}
                  onChange={(e) =>
                    setActForm({
                      ...actForm,
                      category: e.target.value
                    })
                  }
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  {Object.keys(FALLBACK_PHOTOS).map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Custom activity title"
                  required
                  className="sm:col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  value={actForm.title}
                  onChange={(e) =>
                    setActForm({
                      ...actForm,
                      title: e.target.value
                    })
                  }
                />

                <input
                  type="number"
                  min="0"
                  placeholder="Estimated Cost (₹)"
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  value={actForm.estimatedCost}
                  onChange={(e) =>
                    setActForm({
                      ...actForm,
                      estimatedCost: e.target.value
                    })
                  }
                />

                <input
                  type="text"
                  placeholder="Activity notes"
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  value={actForm.notes}
                  onChange={(e) =>
                    setActForm({
                      ...actForm,
                      notes: e.target.value
                    })
                  }
                />

                <button
                  type="submit"
                  className="sm:col-span-2 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Stop
                </button>

              </form>

            </div>

            {/* ITINERARY DISPLAY */}

            <div className="space-y-5">

              {Object.keys(groupedDays).length === 0 ? (

                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">

                  <MapPin className="w-10 h-10 text-slate-300 mx-auto mb-3" />

                  <p className="text-slate-500">
                    Click Generate Plan above to populate unique places within 400 km!
                  </p>

                </div>

              ) : (

                Object.entries(groupedDays)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([day, items]) => (

                    <div
                      key={day}
                      className="bg-white border border-slate-200 rounded-xl p-5"
                    >

                      <h3 className="font-bold text-lg mb-4">
                        Day {day}
                      </h3>

                      <div className="space-y-4">

                        {items.map((act, idx) => (

                          <div
                            key={act.id}
                            className="flex flex-col sm:flex-row gap-4 border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                          >

                            <img
                              src={getPhotoForActivity(act, idx)} onError={(e) => { e.currentTarget.src = UNIQUE_CARD_PHOTOS[idx % UNIQUE_CARD_PHOTOS.length]; }}
                              alt={act.title}
                              className="w-full sm:w-28 h-24 object-cover rounded-lg"
                            />

                            <div className="flex-1 min-w-0">

                              <h4 className="font-semibold text-slate-800">
                                {act.title}
                              </h4>

                              <p className="text-xs text-indigo-600 mt-1">
                                {act.category}
                              </p>

                              {act.notes && (
                                <p className="text-sm text-slate-500 mt-2">
                                  {act.notes}
                                </p>
                              )}

                              <p className="font-semibold text-sm mt-2">
                                ₹{Number(act.estimatedCost || 0).toLocaleString("en-IN")}
                              </p>

                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteActivity(act.id)}
                              className="self-start text-slate-400 hover:text-red-500 p-2"
                              title="Delete activity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                          </div>

                        ))}

                      </div>

                    </div>

                  ))

              )}

            </div>

          </div>

        )}

        {/* ================================================= */}
        {/*                   DISCOVER TAB                    */}
        {/* ================================================= */}

        {activeTab === "discover" && (

          <div className="space-y-6">

            {/* TRAVEL RESOURCES */}

            <section className="bg-white rounded-xl p-5 border border-slate-200">

              <h2 className="text-xl font-bold mb-4">
                Essential Travel Resources ({discoverData?.country || "India"})
              </h2>

              <div className="grid gap-3 sm:grid-cols-2">

                {discoverData?.resources?.map((r, idx) => (

                  <div
                    key={idx}
                    className="bg-slate-50 p-4 rounded-lg"
                  >

                    <h3 className="font-semibold">
                      {r.title}
                    </h3>

                    <p className="text-sm text-slate-500 mt-1">
                      {r.detail}
                    </p>

                  </div>

                ))}

                {(!discoverData?.resources ||
                  discoverData.resources.length === 0) && (
                  <p className="text-sm text-slate-500">
                    No travel resources available.
                  </p>
                )}

              </div>

            </section>

            {/* DESTINATIONS */}

            <section className="bg-white rounded-xl p-5 border border-slate-200">

              <h2 className="text-xl font-bold">
                Destinations Within 400 km of{" "}
                {discoverData?.destination || trip.destination}
              </h2>

              <p className="text-sm text-slate-500 mt-1 mb-4">
                Filter by road distance and add stops directly to your itinerary.
              </p>

              {/* DISTANCE FILTER */}

              <div className="flex flex-wrap gap-2 mb-5">

                {[
                  ["all", "All (≤400 km)"],
                  ["near", "< 100 km"],
                  ["mid", "100–250 km"],
                  ["far", "250–400 km"]
                ].map(([val, label]) => (

                  <button
                    key={val}
                    type="button"
                    onClick={() => setDistanceFilter(val)}
                    className={
                      "px-3 py-1.5 rounded-full font-medium border transition " +
                      (distanceFilter === val
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-600 border-slate-200")
                    }
                  >
                    {label}
                  </button>

                ))}

              </div>

              {/* SELECT DAY */}

              <div className="flex items-center gap-3 mb-5">

                <label className="text-sm font-medium">
                  Add to Day:
                </label>

                <select
                  value={selectedDayForAdd}
                  onChange={(e) =>
                    setSelectedDayForAdd(Number(e.target.value))
                  }
                  className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-semibold"
                >

                  {dayOptions.map((d) => (

                    <option key={d} value={d}>
                      Day {d}
                    </option>

                  ))}

                </select>

              </div>

              {/* DESTINATION CARDS */}

              <div className="grid gap-4 sm:grid-cols-2">

                {filteredPlaces.map((p, idx) => (

                  <div
                    key={p.id || `${p.title}-${idx}`}
                    className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition"
                  >

                    {p.imageUrl && (
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        className="w-full h-40 object-cover"
                      />
                    )}

                    <div className="p-4">

                      <div className="flex justify-between gap-2 mb-2">

                        <span className="text-xs font-semibold text-indigo-600">
                          {p.distanceLabel || `${p.distanceKm} km`}
                        </span>

                        <span className="text-xs text-slate-500">
                          {p.category}
                        </span>

                      </div>

                      <h3 className="font-bold text-lg">
                        {p.title}
                      </h3>

                      <p className="text-sm text-slate-500 mt-2">
                        {p.notes}
                      </p>

                      {p.food && (
                        <p className="text-sm text-emerald-600 mt-2">
                          Must try: {p.food}
                        </p>
                      )}

                      <div className="flex justify-between items-center mt-4">

                        <span className="font-semibold">
                          ₹{Number(p.cost || 0).toLocaleString("en-IN")}
                        </span>

                        <button
                          type="button"
                          onClick={async () => {

                            try {

                              await api.post(
                                "/trips/" + tripId + "/activities",
                                {
                                  dayNumber: selectedDayForAdd,
                                  title: p.title,
                                  category: p.category || "Sightseeing",
                                  estimatedCost: Number(p.cost || 0),
                                  notes:
                                    (p.distanceLabel || `${p.distanceKm} km`) +
                                    " • " +
                                    (p.notes || "")
                                }
                              );

                              await loadTripData();

                              alert(
                                `Added ${p.title} to Day ${selectedDayForAdd}!`
                              );

                            } catch (err) {

                              console.error(err);

                              alert(
                                err.response?.data?.error ||
                                "Unable to add destination"
                              );

                            }

                          }}
                          className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition"
                        >
                          + Add to Day {selectedDayForAdd}
                        </button>

                      </div>

                    </div>

                  </div>

                ))}

              </div>

              {filteredPlaces.length === 0 && (

                <p className="text-center text-slate-500 py-8">
                  No destinations found for this distance filter.
                </p>

              )}

            </section>

          </div>

        )}

        {/* ================================================= */}
        {/*                    EXPENSE TAB                    */}
        {/* ================================================= */}

        {activeTab === "expenses" && (

          <div className="space-y-6">

            {/* AI EXPENSE ENTRY */}

            <section className="bg-white rounded-xl p-5 border border-slate-200">

              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-indigo-600" />

                <h2 className="text-lg font-bold">
                  Quick AI Expense Entry
                </h2>
              </div>

              <form
                onSubmit={handleAIExpense}
                className="flex flex-col sm:flex-row gap-3"
              >

                <input
                  type="text"
                  placeholder="e.g., Rahul paid 1200 for lunch split between Soham and Rahul"
                  className="flex-1 px-3.5 py-2 border border-slate-200 rounded-xl text-sm"
                  value={aiExpenseText}
                  onChange={(e) => setAiExpenseText(e.target.value)}
                />

                <button
                  type="submit"
                  disabled={parsingExpense}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {parsingExpense ? "Parsing..." : "Add with AI"}
                </button>

              </form>

            </section>

            {/* MANUAL EXPENSE */}

            <section className="bg-white rounded-xl p-5 border border-slate-200">

              <h2 className="text-lg font-bold mb-4">
                Manual Expense Entry
              </h2>

              <form
                onSubmit={handleManualExpense}
                className="space-y-3"
              >

                <input
                  type="text"
                  placeholder="Description"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  value={expForm.description}
                  onChange={(e) =>
                    setExpForm({
                      ...expForm,
                      description: e.target.value
                    })
                  }
                />

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="Amount (₹)"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  value={expForm.amount}
                  onChange={(e) =>
                    setExpForm({
                      ...expForm,
                      amount: e.target.value
                    })
                  }
                />

                <select
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  value={expForm.paidBy}
                  onChange={(e) =>
                    setExpForm({
                      ...expForm,
                      paidBy: e.target.value
                    })
                  }
                >

                  <option value="">
                    Paid by
                  </option>

                  {members.map((m) => (

                    <option key={m} value={m}>
                      {m}
                    </option>

                  ))}

                </select>

                {/* SPLIT MEMBERS */}

                <div>

                  <p className="text-sm font-medium mb-2">
                    Split among:
                  </p>

                  <div className="flex flex-wrap gap-2">

                    {members.map((m) => (

                      <button
                        type="button"
                        key={m}
                        onClick={() => toggleSplitMember(m)}
                        className={
                          "text-xs px-2.5 py-1 rounded-full border " +
                          (expForm.splitAmong.includes(m)
                            ? "bg-indigo-50 border-indigo-400 text-indigo-700 font-medium"
                            : "border-slate-200 text-slate-400")
                        }
                      >
                        {m}
                      </button>

                    ))}

                  </div>

                </div>

                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg"
                >
                  Log Expense
                </button>

              </form>

            </section>

            {/* EXPENSE HISTORY */}

            <section className="bg-white rounded-xl p-5 border border-slate-200">

              <h2 className="text-lg font-bold mb-4">
                Expense History
              </h2>

              {expenses.length === 0 ? (

                <p className="text-slate-500">
                  No expenses logged yet.
                </p>

              ) : (

                <div className="space-y-3">

                  {expenses.map((exp) => (

                    <div
                      key={exp.id}
                      className="flex justify-between items-center gap-3 border-b border-slate-100 pb-3"
                    >

                      <div className="min-w-0">

                        <p className="font-semibold">
                          {exp.description}
                        </p>

                        <p className="text-xs text-slate-500">
                          Paid by <strong>{exp.paidBy}</strong>
                          {" • "}
                          Split with {(exp.splitAmong || []).join(", ")}
                        </p>

                      </div>

                      <div className="flex items-center gap-3 shrink-0">

                        <span className="font-semibold">
                          ₹{Number(exp.amount).toLocaleString("en-IN")}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-slate-400 hover:text-red-500"
                          title="Delete expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                      </div>

                    </div>

                  ))}

                </div>

              )}

            </section>

            {/* WHO OWES WHOM */}

            <section className="bg-white rounded-xl p-5 border border-slate-200">

              <div className="flex items-center gap-2 mb-4">

                <ArrowRightLeft className="w-5 h-5 text-indigo-600" />

                <h2 className="text-lg font-bold">
                  Who Owes Whom
                </h2>

              </div>

              {!settlementData ||
              settlementData.settlements?.length === 0 ? (

                <div className="flex items-center gap-2 text-emerald-600 font-medium">

                  <CheckCircle2 className="w-5 h-5" />

                  All settled up!

                </div>

              ) : (

                <div className="space-y-3">

                  {settlementData.settlements.map((s, idx) => (

                    <div
                      key={s.id || idx}
                      className="flex justify-between items-center border-b border-slate-100 pb-3"
                    >

                      <span className="text-sm">
                        <strong>{s.from}</strong> owes{" "}
                        <strong>{s.to}</strong>
                      </span>

                      <span className="font-bold text-slate-800">
                        ₹{Number(s.amount).toLocaleString("en-IN")}
                      </span>

                    </div>

                  ))}

                </div>

              )}

            </section>

            {/* NET BALANCES */}

            <section className="bg-white rounded-xl p-5 border border-slate-200">

              <h2 className="text-lg font-bold mb-4">
                Net Balances
              </h2>

              {settlementData &&
                Object.entries(settlementData.balances || {}).map(
                  ([person, bal]) => (

                    <div
                      key={person}
                      className="flex justify-between py-2 border-b border-slate-100"
                    >

                      <span>{person}</span>

                      <span
                        className={
                          "font-semibold " +
                          (bal >= 0
                            ? "text-emerald-600"
                            : "text-red-500")
                        }
                      >
                        {bal >= 0 ? "+" : "-"}₹
                        {Math.abs(bal).toLocaleString("en-IN")}
                      </span>

                    </div>

                  )
                )}

            </section>

          </div>

        )}

      </main>

    </div>
  );
}
