
import { useState, useEffect } from "react";
import api from "../api/client";
import { getActivityImage, getCategoryFallbackSvg } from "../utils/activityVisuals";
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

const CATEGORIES = Object.keys(FALLBACK_PHOTOS);

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN");

const safeDate = (value) => {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleDateString("en-IN");
};

export default function TripDetailPage({ tripId, onBack }) {
  const [trip, setTrip] = useState(null);
  const [settlementData, setSettlementData] = useState({
    totalSpent: 0,
    remainingBudget: 0,
    settlements: [],
    balances: {}
  });
  const [discoverData, setDiscoverData] = useState({
    nearbyPlaces: [],
    resources: []
  });

  const [activeTab, setActiveTab] = useState("itinerary");
  const [distanceFilter, setDistanceFilter] = useState("all");
  const [selectedDayForAdd, setSelectedDayForAdd] = useState(1);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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

  // =====================================
  // LOAD TRIP DATA
  // =====================================

  const loadTripData = async () => {
    try {
      setLoadError("");

      const results = await Promise.allSettled([
        api.get(`/trips/${tripId}`),
        api.get(`/trips/${tripId}/settlements`),
        api.get(`/trips/${tripId}/discover`)
      ]);

      // Trip data is essential.
      const tripResult = results[0];

      if (tripResult.status === "rejected") {
        throw tripResult.reason;
      }

      const tripData = tripResult.value?.data;

      if (!tripData || typeof tripData !== "object") {
        throw new Error("Invalid trip response from server");
      }

      setTrip(tripData);

      // Settlement data is optional.
      if (results[1].status === "fulfilled") {
        const data = results[1].value?.data || {};

        setSettlementData({
          totalSpent: Number(data.totalSpent || 0),
          remainingBudget: Number(data.remainingBudget || 0),
          settlements: Array.isArray(data.settlements)
            ? data.settlements
            : [],
          balances:
            data.balances &&
            typeof data.balances === "object" &&
            !Array.isArray(data.balances)
              ? data.balances
              : {}
        });
      } else {
        console.error("Settlement loading failed:", results[1].reason);
      }

      // Discover data is optional.
      if (results[2].status === "fulfilled") {
        const data = results[2].value?.data || {};

        setDiscoverData({
          ...data,
          nearbyPlaces: Array.isArray(data.nearbyPlaces)
            ? data.nearbyPlaces
            : [],
          resources: Array.isArray(data.resources)
            ? data.resources
            : []
        });
      } else {
        console.error("Discover loading failed:", results[2].reason);
      }

      const members = Array.isArray(tripData.members)
        ? tripData.members
        : [];

      setExpForm((prev) => ({
        ...prev,
        paidBy: members.includes(prev.paidBy)
          ? prev.paidBy
          : members[0] || "",
        splitAmong: prev.splitAmong.filter((m) =>
          members.includes(m)
        ).length > 0
          ? prev.splitAmong.filter((m) => members.includes(m))
          : members
      }));

    } catch (error) {
      console.error("Trip loading error:", error);
      setLoadError(
        error.response?.data?.error ||
        error.message ||
        "Unable to load trip."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setTrip(null);
    loadTripData();
  }, [tripId]);

  // =====================================
  // GENERATE AI ITINERARY
  // =====================================

  const handleGenerateAI = async (e) => {
    e.preventDefault();
    setGeneratingAI(true);
    try {
      const searched = preferences.trim();
      const { data } = await api.post("/trips/" + tripId + "/ai-itinerary", { preferences: searched, replaceExisting: true });
      setPreferences("");
      await loadTripData();
      if (data && data.discovery) {
        setDiscoverData(data.discovery);
      } else if (searched) {
        const discRes = await api.get("/trips/" + tripId + "/discover?q=" + encodeURIComponent(searched));
        setDiscoverData(discRes.data);
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to generate itinerary");
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();

    try {
      await api.post(`/trips/${tripId}/activities`, {
        ...actForm,
        dayNumber: Number(actForm.dayNumber),
        estimatedCost: Number(actForm.estimatedCost || 0)
      });

      setActForm({
        dayNumber: 1,
        title: "",
        category: "Sightseeing",
        estimatedCost: "",
        notes: ""
      });

      await loadTripData();

    } catch (error) {
      alert(
        error.response?.data?.error ||
        "Failed to add activity"
      );
    }
  };

  // =====================================
  // DELETE ACTIVITY
  // =====================================

  const handleDeleteActivity = async (id) => {
    if (!window.confirm("Delete this activity?")) return;

    try {
      await api.delete(`/trips/${tripId}/activities/${id}`);
      await loadTripData();
    } catch (error) {
      alert("Failed to delete activity");
    }
  };

  // =====================================
  // AI EXPENSE
  // =====================================

  const handleAIExpense = async (e) => {
    e.preventDefault();

    if (!aiExpenseText.trim()) return;

    setParsingExpense(true);

    try {
      await api.post(`/trips/${tripId}/ai-expense`, {
        text: aiExpenseText
      });

      setAiExpenseText("");
      await loadTripData();

    } catch (error) {
      alert(
        error.response?.data?.error ||
        "Failed to process expense"
      );
    } finally {
      setParsingExpense(false);
    }
  };

  // =====================================
  // MANUAL EXPENSE
  // =====================================

  const handleManualExpense = async (e) => {
    e.preventDefault();

    if (!expForm.splitAmong.length) {
      alert("Select at least one member.");
      return;
    }

    if (!expForm.paidBy) {
      alert("Select who paid.");
      return;
    }

    try {
      await api.post(`/trips/${tripId}/expenses`, {
        ...expForm,
        amount: Number(expForm.amount)
      });

      setExpForm((prev) => ({
        ...prev,
        description: "",
        amount: ""
      }));

      await loadTripData();

    } catch (error) {
      alert(
        error.response?.data?.error ||
        "Failed to add expense"
      );
    }
  };

  // =====================================
  // DELETE EXPENSE
  // =====================================

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Delete this expense?")) return;

    try {
      await api.delete(`/trips/${tripId}/expenses/${id}`);
      await loadTripData();
    } catch (error) {
      alert("Failed to delete expense");
    }
  };

  // =====================================
  // SPLIT MEMBERS
  // =====================================

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

  // =====================================
  // LOADING AND ERROR
  // =====================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">
          Loading trip details...
        </p>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4 p-6">
        <p className="text-red-600">
          {loadError || "Trip could not be loaded."}
        </p>

        <button
          onClick={loadTripData}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg"
        >
          Retry
        </button>

        <button
          onClick={onBack}
          className="text-indigo-600"
        >
          Back to Trips
        </button>
      </div>
    );
  }

  // =====================================
  // SAFE DATA
  // =====================================

  const activities = Array.isArray(trip.activities)
    ? trip.activities
    : [];

  const expenses = Array.isArray(trip.expenses)
    ? trip.expenses
    : [];

  const members = Array.isArray(trip.members)
    ? trip.members
    : [];

  const settlements = Array.isArray(settlementData.settlements)
    ? settlementData.settlements
    : [];

  const balances = settlementData.balances || {};

  const budget = Number(trip.budget || 0);
  const totalSpent = Number(settlementData.totalSpent || 0);

  const remainingBudget = Number.isFinite(
    Number(settlementData.remainingBudget)
  )
    ? Number(settlementData.remainingBudget)
    : Math.max(0, budget - totalSpent);

  const budgetPercent = Math.min(
    100,
    Math.round((totalSpent / Math.max(budget, 1)) * 100)
  );

  const groupedDays = activities.reduce((acc, activity) => {
    const day = activity.dayNumber || 1;

    if (!acc[day]) acc[day] = [];

    acc[day].push(activity);

    return acc;
  }, {});

  const nearbyPlaces = discoverData.nearbyPlaces || [];

  const filteredPlaces = nearbyPlaces.filter((place) => {
    const distance = Number(place.distanceKm);

    if (!Number.isFinite(distance) || distance > 400) {
      return false;
    }

    if (distanceFilter === "near") return distance < 100;
    if (distanceFilter === "mid") return distance >= 100 && distance <= 250;
    if (distanceFilter === "far") return distance > 250 && distance <= 400;

    return true;
  });

  const dayOptions = Array.from(
    { length: 7 },
    (_, index) => index + 1
  );

  const getPhoto = (activity) => {
    const match = nearbyPlaces.find(
      (place) =>
        place.title?.toLowerCase() === activity.title?.toLowerCase()
    );

    return (
      match?.imageUrl ||
      FALLBACK_PHOTOS[activity.category] ||
      FALLBACK_PHOTOS.Sightseeing
    );
  };

  // =====================================
  // MAIN UI
  // =====================================

  return (
    <div className="min-h-screen bg-slate-50 pb-12">

      {/* HEADER */}

      <div className="relative h-56 bg-slate-900 overflow-hidden">

        <img
          src={discoverData.heroImage || FALLBACK_PHOTOS.Nature}
          alt={trip.destination || "Trip"}
          className="w-full h-full object-cover opacity-65"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-transparent" />

        <div className="absolute inset-0 max-w-5xl mx-auto px-6 py-5 flex flex-col justify-between text-white">

          <button
            onClick={onBack}
            className="self-start inline-flex items-center gap-2 text-xs bg-white/15 hover:bg-white/25 px-3 py-2 rounded-full"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Trips
          </button>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">

            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-indigo-300 mb-1">

                <MapPin className="w-4 h-4" />

                {trip.destination}, {discoverData.country || "India"}

                {discoverData.weather && (
                  <span className="inline-flex items-center gap-1 bg-white/15 px-2 py-1 rounded-full text-white">
                    <CloudSun className="w-4 h-4" />
                    {discoverData.weather}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold">
                {trip.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-2">

                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {safeDate(trip.startDate)} – {safeDate(trip.endDate)}
                </span>

                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {members.join(", ")}
                </span>

              </div>
            </div>

            {/* BUDGET */}

            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-3 min-w-[230px]">

              <div className="flex justify-between text-xs mb-2">
                <span>Spent: ₹{money(totalSpent)}</span>
                <span>Budget: ₹{money(budget)}</span>
              </div>

              <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden">
                <div
                  className={budgetPercent > 90 ? "bg-red-400 h-full" : "bg-emerald-400 h-full"}
                  style={{ width: `${budgetPercent}%` }}
                />
              </div>

              <p className="text-right text-xs text-emerald-300 mt-2">
                Remaining: ₹{money(remainingBudget)}
              </p>

            </div>
          </div>
        </div>
      </div>

      {/* NAVIGATION */}

      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10 shadow-sm">

        <div className="max-w-5xl mx-auto flex flex-wrap gap-2">

          <button
            onClick={() => setActiveTab("itinerary")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              activeTab === "itinerary"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            AI Itinerary ({activities.length})
          </button>

          <button
            onClick={() => setActiveTab("discover")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center gap-2 ${
              activeTab === "discover"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Compass className="w-4 h-4" />
            400 km Explorer ({nearbyPlaces.length})
          </button>

          <button
            onClick={() => setActiveTab("expenses")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold ${
              activeTab === "expenses"
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Expense Splitter ({expenses.length})
          </button>

        </div>
      </div>

      <main className="max-w-5xl mx-auto p-4 sm:p-6">

        {/* ================================= */}
        {/* ITINERARY */}
        {/* ================================= */}

        {activeTab === "itinerary" && (

          <div className="space-y-6">

            {/* AI PLAN */}

            <section className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 text-white">

              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5" />
                <h2 className="text-lg font-bold">
                  Auto-Generate 100 km Radius Plan
                </h2>
              </div>

              <p className="text-sm text-indigo-100 mb-4">
                Discover attractions, hill stations, heritage forts,
                waterfalls and landmarks within 100 km of {trip.destination}.
              </p>

              <form onSubmit={handleGenerateAI} className="flex flex-col sm:flex-row gap-3">

                <input
                  type="text"
                  placeholder="Preferences: waterfalls, forts, food, wildlife..."
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/15 border border-white/25 text-white placeholder-indigo-200 outline-none"
                />

                <button
                  type="submit"
                  disabled={generatingAI}
                  className="bg-white text-indigo-700 px-5 py-3 rounded-xl font-semibold disabled:opacity-50"
                >
                  {generatingAI ? "Discovering..." : "Generate Plan"}
                </button>

              </form>
            </section>

            {/* CUSTOM ACTIVITY */}

            <section className="bg-white rounded-xl p-5 border border-slate-200">

              <h2 className="font-bold text-lg mb-4">
                Add Custom Activity
              </h2>

              <form onSubmit={handleAddActivity} className="grid sm:grid-cols-2 gap-3">

                <input
                  type="number"
                  min="1"
                  placeholder="Day #"
                  required
                  value={actForm.dayNumber}
                  onChange={(e) => setActForm({ ...actForm, dayNumber: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                />

                <select
                  value={actForm.category}
                  onChange={(e) => setActForm({ ...actForm, category: e.target.value })}
                  className="px-3 py-2 border rounded-lg bg-white"
                >
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Activity title"
                  required
                  value={actForm.title}
                  onChange={(e) => setActForm({ ...actForm, title: e.target.value })}
                  className="sm:col-span-2 px-3 py-2 border rounded-lg"
                />

                <input
                  type="number"
                  min="0"
                  placeholder="Estimated Cost (₹)"
                  value={actForm.estimatedCost}
                  onChange={(e) => setActForm({ ...actForm, estimatedCost: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                />

                <input
                  type="text"
                  placeholder="Notes"
                  value={actForm.notes}
                  onChange={(e) => setActForm({ ...actForm, notes: e.target.value })}
                  className="px-3 py-2 border rounded-lg"
                />

                <button
                  type="submit"
                  className="sm:col-span-2 flex justify-center items-center gap-2 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Stop
                </button>

              </form>
            </section>

            {/* ITINERARY DAYS */}

            {Object.keys(groupedDays).length === 0 ? (

              <div className="bg-white rounded-xl p-8 text-center border">
                <MapPin className="mx-auto text-slate-300 w-10 h-10 mb-3" />
                <p className="text-slate-500">
                  No activities yet. Generate an AI plan or add your first stop.
                </p>
              </div>

            ) : (

              Object.entries(groupedDays)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([day, items]) => (

                  <section key={day} className="bg-white rounded-xl border p-5">

                    <h3 className="font-bold text-lg mb-4">
                      Day {day}
                    </h3>

                    <div className="space-y-4">

                      {items.map((act, itemIdx) => (

                        <div key={act.id} className="flex flex-col sm:flex-row gap-4 border-b last:border-0 pb-4 last:pb-0">

                          <img
                            src={getPhoto(act)}
                            alt={act.title || "Activity"}
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = FALLBACK_PHOTOS.Sightseeing;
                            }}
                            className="w-full sm:w-28 h-24 object-cover rounded-lg"
                          />

                          <div className="flex-1 min-w-0">

                            <h4 className="font-semibold">
                              {act.title}
                            </h4>

                            <p className="text-xs text-indigo-600">
                              {act.category}
                            </p>

                            {act.notes && (
                              <p className="text-sm text-slate-500 mt-1">
                                {act.notes}
                              </p>
                            )}

                            <p className="font-semibold text-sm mt-2">
                              ₹{money(act.estimatedCost)}
                            </p>

                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteActivity(act.id)}
                            className="self-start text-red-500 p-2"
                            title="Delete activity"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                        </div>

                      ))}

                    </div>
                  </section>

                ))

            )}

          </div>
        )}

        {/* ================================= */}
        {/* DISCOVER */}
        {/* ================================= */}

        {activeTab === "discover" && (

          <div className="space-y-6">

            {/* RESOURCES */}

            <section className="bg-white rounded-xl border p-5">

              <h2 className="text-xl font-bold mb-4">
                Essential Travel Resources ({discoverData.country || "India"})
              </h2>

              <div className="grid sm:grid-cols-2 gap-3">

                {discoverData.resources.map((resource, index) => (

                  <div key={resource.title || index} className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold">{resource.title}</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      {resource.detail}
                    </p>
                  </div>

                ))}

                {discoverData.resources.length === 0 && (
                  <p className="text-slate-500 text-sm">
                    No travel resources available.
                  </p>
                )}

              </div>
            </section>

            {/* PLACES */}

            <section className="bg-white rounded-xl border p-5">

              <h2 className="text-xl font-bold">
                Destinations Within 400 km of{" "}
                {discoverData.destination || trip.destination}
              </h2>

              <p className="text-sm text-slate-500 mt-1 mb-4">
                Filter destinations and add them directly to your itinerary.
              </p>

              {/* FILTER */}

              <div className="flex flex-wrap gap-2 mb-5">

                {[
                  ["all", "All (≤400 km)"],
                  ["near", "< 100 km"],
                  ["mid", "100–250 km"],
                  ["far", "250–400 km"]
                ].map(([value, label]) => (

                  <button
                    type="button"
                    key={value}
                    onClick={() => setDistanceFilter(value)}
                    className={`px-3 py-2 rounded-full text-sm border ${
                      distanceFilter === value
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
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
                  onChange={(e) => setSelectedDayForAdd(Number(e.target.value))}
                  className="border rounded-lg px-3 py-2 bg-white"
                >
                  {dayOptions.map((day) => (
                    <option key={day} value={day}>
                      Day {day}
                    </option>
                  ))}
                </select>

              </div>

              {/* DESTINATION CARDS */}

              <div className="grid sm:grid-cols-2 gap-4">

                {filteredPlaces.map((place, index) => (

                  <div
                    key={place.id || place.title || index}
                    className="border rounded-xl overflow-hidden"
                  >

                    {place.imageUrl && (
                      <img
                        src={place.imageUrl}
                        alt={place.title}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        className="w-full h-40 object-cover"
                      />
                    )}

                    <div className="p-4">

                      <div className="flex justify-between gap-2 mb-2">

                        <span className="text-xs text-indigo-600 font-semibold">
                          {place.distanceLabel || `${place.distanceKm} km`}
                        </span>

                        <span className="text-xs text-slate-500">
                          {place.category || "Sightseeing"}
                        </span>

                      </div>

                      <h3 className="font-bold text-lg">
                        {place.title}
                      </h3>

                      <p className="text-sm text-slate-500 mt-2">
                        {place.notes}
                      </p>

                      {place.food && (
                        <p className="text-sm text-emerald-600 mt-2">
                          Must try: {place.food}
                        </p>
                      )}

                      <div className="flex justify-between items-center mt-4">

                        <span className="font-semibold">
                          ₹{money(place.cost)}
                        </span>

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await api.post(`/trips/${tripId}/activities`, {
                                dayNumber: selectedDayForAdd,
                                title: place.title,
                                category: place.category || "Sightseeing",
                                estimatedCost: Number(place.cost || 0),
                                notes: `${place.distanceLabel || `${place.distanceKm} km`} • ${place.notes || ""}`
                              });

                              await loadTripData();
                              alert(`Added ${place.title} to Day ${selectedDayForAdd}!`);

                            } catch (error) {
                              alert(
                                error.response?.data?.error ||
                                "Unable to add destination"
                              );
                            }
                          }}
                          className="bg-indigo-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-indigo-700"
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
                  No destinations found within this distance range.
                </p>
              )}

            </section>

          </div>
        )}

        {/* ================================= */}
        {/* EXPENSES */}
        {/* ================================= */}

        {activeTab === "expenses" && (

          <div className="space-y-6">

            {/* AI EXPENSE */}

            <section className="bg-white rounded-xl border p-5">

              <h2 className="text-lg font-bold mb-3">
                Quick AI Expense Entry
              </h2>

              <form onSubmit={handleAIExpense} className="flex flex-col sm:flex-row gap-3">

                <input
                  type="text"
                  placeholder="e.g., Rahul paid 1200 for lunch split between Soham and Rahul"
                  value={aiExpenseText}
                  onChange={(e) => setAiExpenseText(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2"
                />

                <button
                  type="submit"
                  disabled={parsingExpense}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
                >
                  {parsingExpense ? "Parsing..." : "Add with AI"}
                </button>

              </form>

            </section>

            {/* MANUAL EXPENSE */}

            <section className="bg-white rounded-xl border p-5">

              <h2 className="text-lg font-bold mb-4">
                Manual Expense Entry
              </h2>

              
            </section>

            {/* EXPENSE HISTORY */}

            <section className="bg-white rounded-xl border p-5">

              <h2 className="text-lg font-bold mb-4">
                Expense History
              </h2>

              {expenses.length === 0 ? (

                <p className="text-slate-500">
                  No expenses logged yet.
                </p>

              ) : (

                <div className="space-y-3">

                  {expenses.map((expense) => (

                    <div key={expense.id} className="flex justify-between items-center gap-3 border-b pb-3">

                      <div className="min-w-0">

                        <p className="font-semibold">
                          {expense.description}
                        </p>

                        <p className="text-xs text-slate-500">
                          Paid by <strong>{expense.paidBy}</strong>
                          {" • "}
                          Split with {(Array.isArray(expense.splitAmong) ? expense.splitAmong : []).join(", ")}
                        </p>

                      </div>

                      <div className="flex items-center gap-3 shrink-0">

                        <span className="font-semibold">
                          ₹{money(expense.amount)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="text-red-500"
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

            <section className="bg-white rounded-xl border p-5">

              <div className="flex items-center gap-2 mb-4">
                <ArrowRightLeft className="w-5 h-5 text-indigo-600" />

                <h2 className="text-lg font-bold">
                  Who Owes Whom
                </h2>
              </div>

              {settlements.length === 0 ? (

                <p className="flex items-center gap-2 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-5 h-5" />
                  All settled up!
                </p>

              ) : (

                <div className="space-y-3">

                  {settlements.map((item, index) => (

                    <div key={item.id || index} className="flex justify-between items-center">

                      <span className="text-sm">
                        {item.from} owes {item.to}
                      </span>

                      <span className="font-bold">
                        ₹{money(item.amount)}
                      </span>

                    </div>

                  ))}

                </div>

              )}

            </section>

            {/* NET BALANCES */}

            <section className="bg-white rounded-xl border p-5">

              <h2 className="text-lg font-bold mb-4">
                Net Balances
              </h2>

              {Object.keys(balances).length === 0 ? (

                <p className="text-sm text-slate-500">
                  No balance information available.
                </p>

              ) : (

                Object.entries(balances).map(([person, balance]) => {

                  const amount = Number(balance || 0);

                  return (
                    <div
                      key={person}
                      className="flex justify-between py-2 border-b border-slate-100"
                    >

                      <span>{person}</span>

                      <span className={`font-semibold ${
                        amount >= 0
                          ? "text-emerald-600"
                          : "text-red-500"
                      }`}>
                        {amount >= 0 ? "+" : "-"}₹{money(Math.abs(amount))}
                      </span>

                    </div>
                  );
                })

              )}

            </section>

          </div>
        )}

      </main>
    </div>
  );
}
