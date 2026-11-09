"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Doctor = {
  doctor_id: number;
  doctor_name: string;
  specialization: string | null;
};

type Slot = {
  slot_time: string;
};

export default function Home() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");

  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");

  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Today's date in local calendar format
const [minDate, setMinDate] = useState("");

useEffect(() => {
  const today = new Date();

  const formattedDate =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  setMinDate(formattedDate);
}, []);
  // Load active doctors
  useEffect(() => {
    async function loadDoctors() {
      const { data, error } = await supabase
        .from("doctors")
        .select("doctor_id, doctor_name, specialization")
        .eq("is_active", true)
        .order("doctor_name");

      if (error) {
        setError("Could not load doctors. Please refresh the page.");
      } else {
        setDoctors((data || []) as Doctor[]);
      }

      setLoadingDoctors(false);
    }

    loadDoctors();
  }, []);

  // Load available slots whenever doctor or date changes
  useEffect(() => {
    async function loadSlots() {
      setSlots([]);
      setSelectedSlot("");

      if (!doctorId || !date) return;

      setLoadingSlots(true);
      setError("");
      setSuccess("");

      const { data, error } = await supabase.rpc(
        "get_available_slots",
        {
          p_doctor_id: Number(doctorId),
          p_date: date,
        }
      );

      if (error) {
        setError("Could not load appointment slots. Please try again.");
      } else {
        setSlots((data || []) as Slot[]);
      }

      setLoadingSlots(false);
    }

    loadSlots();
  }, [doctorId, date]);

  async function handleBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!doctorId || !date || !selectedSlot) {
      setError("Please select a doctor, date and time.");
      return;
    }

    setBooking(true);

    const { data, error } = await supabase.rpc("book_appointment", {
      p_doctor_id: Number(doctorId),
      p_date: date,
      p_time: selectedSlot,
      p_patient_name: patientName.trim(),
      p_patient_phone: patientPhone.trim(),
    });

    if (error) {
      setError(error.message);
      setBooking(false);
      return;
    }

    const appointment = data?.[0];

    setSuccess(
      `Your appointment is confirmed! Booking ID: ${appointment?.appointment_id ?? "Confirmed"}`
    );

    setPatientName("");
    setPatientPhone("");
    setSelectedSlot("");

    // Refresh slots after successful booking
    const { data: updatedSlots } = await supabase.rpc(
      "get_available_slots",
      {
        p_doctor_id: Number(doctorId),
        p_date: date,
      }
    );

    setSlots((updatedSlots || []) as Slot[]);
    setBooking(false);
  }

  function formatTime(time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    const displayHour = hours % 12 || 12;

    return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-2xl">

        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 text-2xl font-bold text-white">
            S
          </div>

          <h1 className="text-3xl font-bold text-slate-900">
            Sri Sai Clinic
          </h1>

          <p className="mt-2 text-slate-600">
            Book your doctor appointment online
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">

          <h2 className="mb-6 text-xl font-semibold text-slate-900">
            Book an Appointment
          </h2>

          <form onSubmit={handleBooking} className="space-y-6">

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Select Doctor
              </label>

              <select
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 outline-none focus:border-blue-600"
              >
                <option value="">
                  {loadingDoctors ? "Loading doctors..." : "Choose a doctor"}
                </option>

                {doctors.map((doctor) => (
                  <option key={doctor.doctor_id} value={doctor.doctor_id}>
                    {doctor.doctor_name}
                    {doctor.specialization
                      ? ` — ${doctor.specialization}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Appointment Date
              </label>

              <input
                type="date"
                min={minDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 p-3 text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-slate-700">
                Available Time Slots
              </label>

              {!doctorId || !date ? (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                  Select a doctor and date to see available times.
                </p>
              ) : loadingSlots ? (
                <p className="text-sm text-slate-500">
                  Checking available slots...
                </p>
              ) : slots.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                  No available slots for this date. Try another date.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => (
                    <button
                      key={slot.slot_time}
                      type="button"
                      onClick={() => setSelectedSlot(slot.slot_time)}
                      className={`rounded-lg border p-3 text-sm font-medium transition ${
                        selectedSlot === slot.slot_time
                          ? "border-blue-700 bg-blue-700 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-blue-500"
                      }`}
                    >
                      {formatTime(slot.slot_time)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Patient Name
              </label>

              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Enter your full name"
                maxLength={100}
                required
                className="w-full rounded-lg border border-slate-300 p-3 text-slate-900 outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Phone Number
              </label>

              <input
  type="tel"
  value={patientPhone}
  onChange={(e) => setPatientPhone(e.target.value.replace(/\D/g, ""))}
  placeholder="Enter 10-digit mobile number"
  maxLength={10}
  minLength={10}
  pattern="[0-9]{10}"
  required
  className="w-full rounded-lg border border-slate-300 p-3 text-slate-900 outline-none focus:border-blue-600"
/>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg bg-green-50 p-4 text-sm font-medium text-green-800">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={booking || !selectedSlot || loadingSlots}
              className="w-full rounded-lg bg-blue-700 p-3.5 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {booking ? "Booking..." : "Confirm Appointment"}
            </button>

          </form>
        </section>

        <p className="mt-6 text-center text-sm text-slate-500">
          Sri Sai Clinic · Kothagudem
        </p>
      </div>
    </main>
  );
}