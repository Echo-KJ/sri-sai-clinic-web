"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Appointment = {
  appointment_id: number;
  patient_name: string;
  patient_phone: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  doctors: { doctor_name: string } | null;
};

type StaffProfile = {
  role: string;
  full_name: string;
};

export default function StaffDashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [walkInName, setWalkInName] = useState("");
const [walkInPhone, setWalkInPhone] = useState("");
const [walkInTime, setWalkInTime] = useState("");
const [walkInDoctor, setWalkInDoctor] = useState("1");
const [walkInMessage, setWalkInMessage] = useState("");
async function createWalkIn(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  setWalkInMessage("");

  const { data, error } = await supabase.rpc(
    "create_walk_in_appointment",
    {
      p_doctor_id: Number(walkInDoctor),
      p_date: today,
      p_time: walkInTime,
      p_patient_name: walkInName.trim(),
      p_patient_phone: walkInPhone.trim(),
    }
  );

  if (error) {
    setWalkInMessage(error.message);
    return;
  }

  setWalkInMessage(`Walk-in registered. Appointment ID: ${data}`);
  setWalkInName("");
  setWalkInPhone("");
  setWalkInTime("");

  await loadAppointments(today);
}

  const loadAppointments = useCallback(async (date: string) => {
    const { data, error } = await supabase
      .from("appointments")
      .select(`
        appointment_id,
        patient_name,
        patient_phone,
        appointment_date,
        appointment_time,
        status,
        doctors ( doctor_name )
      `)
      .eq("appointment_date", date)
      .order("appointment_time");

    if (error) {
      setError("Could not load appointments. Check staff permissions.");
      return;
    }

    setAppointments((data || []) as unknown as Appointment[]);
  }, []);

  useEffect(() => {
    async function initialize() {
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        window.location.href = "/staff/login";
        return;
      }

      const { data: staff, error: profileError } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", authData.user.id)
        .single();

      if (profileError || !staff || !["admin", "receptionist"].includes(staff.role)) {
        await supabase.auth.signOut();
        window.location.href = "/staff/login";
        return;
      }

      setProfile(staff);

      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      setToday(date);
      await loadAppointments(date);
      setLoading(false);
    }

    initialize();
  }, [loadAppointments]);

  async function changeStatus(id: number, status: string) {
    setError("");
    setMessage("");

    const { error } = await supabase.rpc("update_appointment_status", {
      p_appointment_id: id,
      p_new_status: status,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setMessage(`Appointment #${id} updated to ${status.replace("_", " ")}.`);
    await loadAppointments(today);
  }

   function sendWhatsAppReminder(appointment: Appointment) {
  let phone = appointment.patient_phone.replace(/\D/g, "");

  // Add India's country code for 10-digit mobile numbers
  if (phone.length === 10) {
    phone = "91" + phone;
  }

  const message = `Hello ${appointment.patient_name},

This is a reminder from Sri Sai Clinic, Kothagudem.

Your appointment with ${appointment.doctors?.doctor_name || "the doctor"} is scheduled for ${appointment.appointment_date} at ${formatTime(appointment.appointment_time)}.

Please arrive a little early.

Thank you,
Sri Sai Clinic`;

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  window.open(url, "_blank", "noopener,noreferrer");
}

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/staff/login";
  }

  function formatTime(time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    const period = hours >= 12 ? "PM" : "AM";
    return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
  }

  const counts = {
    total: appointments.length,
    booked: appointments.filter((a) => a.status === "booked").length,
    arrived: appointments.filter((a) => a.status === "arrived").length,
    completed: appointments.filter((a) => a.status === "completed").length,
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading clinic dashboard...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Sri Sai Clinic
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Receptionist Dashboard · {profile?.full_name}
            </p>
          </div>

          <div className="flex gap-2">
  

  <button
    onClick={logout}
    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
  >
    Log out
  </button>
</div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <section className="mb-6 rounded-xl border bg-white p-5">
  <h2 className="mb-4 text-lg font-semibold">
    Register Walk-in Patient
  </h2>

  <form onSubmit={createWalkIn} className="grid gap-3 sm:grid-cols-2">
    <input
      value={walkInName}
      onChange={(e) => setWalkInName(e.target.value)}
      placeholder="Patient name"
      required
      maxLength={100}
      className="rounded-lg border p-3"
    />

    <input
      value={walkInPhone}
      onChange={(e) => setWalkInPhone(e.target.value)}
      placeholder="Patient phone"
      required
      maxLength={20}
      className="rounded-lg border p-3"
    />

    <input
      type="time"
      value={walkInTime}
      onChange={(e) => setWalkInTime(e.target.value)}
      required
      className="rounded-lg border p-3"
    />

    <input
      type="number"
      value={walkInDoctor}
      onChange={(e) => setWalkInDoctor(e.target.value)}
      required
      min="1"
      placeholder="Doctor ID"
      className="rounded-lg border p-3"
    />

    <button
      type="submit"
      className="rounded-lg bg-blue-700 p-3 font-semibold text-white sm:col-span-2"
    >
      Register Walk-in
    </button>
  </form>

  {walkInMessage && (
    <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
      {walkInMessage}
    </p>
  )}
</section>
          {[
            ["Today's appointments", counts.total],
            ["Booked", counts.booked],
            ["Arrived", counts.arrived],
            ["Completed", counts.completed],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-white p-4">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
            </div>
          ))}
        </section>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            {message}
          </p>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">Today's Appointments</h2>
            <div className="mt-2">
  <label className="mr-2 text-sm text-slate-500">
    Appointment date:
  </label>
  <input
    type="date"
    value={today}
    onChange={(e) => {
      setToday(e.target.value);
      loadAppointments(e.target.value);
    }}
    className="rounded-lg border border-slate-300 p-2 text-sm"
  />
</div>
          </div>

          {appointments.length === 0 ? (
            <p className="p-8 text-center text-slate-500">
              No appointments scheduled for today.
            </p>
          ) : (
            <div className="divide-y">
              {appointments.map((appointment) => (
                <article key={appointment.appointment_id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {appointment.patient_name}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {appointment.patient_phone}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {appointment.doctors?.doctor_name || "Doctor"} ·{" "}
                        {formatTime(appointment.appointment_time)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Booking #{appointment.appointment_id}
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                      {appointment.status.replace("_", " ")}
                    </span>
                  </div>

                  {["booked", "arrived"].includes(appointment.status) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {appointment.status === "booked" && (
                        <>
                          <button
                            onClick={() => changeStatus(appointment.appointment_id, "arrived")}
                            className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white"
                          >
                            Arrived
                          </button>

                           <button
  onClick={() => sendWhatsAppReminder(appointment)}
  className="rounded-lg border border-green-300 px-3 py-2 text-sm font-medium text-green-700"
>
  WhatsApp Reminder
</button>

                          <button
                            onClick={() => changeStatus(appointment.appointment_id, "no_show")}
                            className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800"
                          >
                            No-show
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => changeStatus(appointment.appointment_id, "cancelled")}
                        className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700"
                      >
                        Cancel
                      </button>

                      {profile?.role === "admin" && appointment.status === "arrived" && (
                        <button
                          onClick={() => changeStatus(appointment.appointment_id, "completed")}
                          className="rounded-lg bg-green-700 px-3 py-2 text-sm font-medium text-white"
                        >
                          Completed
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
