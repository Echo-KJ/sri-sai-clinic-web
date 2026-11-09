
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Doctor = {
  doctor_id: number;
  doctor_name: string;
  specialization: string | null;
  phone: string | null;
  is_active: boolean;
};

type Appointment = {
  appointment_id: number;
  status: string;
  appointment_date: string;
};

type DoctorSchedule = {
  schedule_id: number;
  doctor_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
};

type DoctorLeave = {
  leave_id: number;
  doctor_id: number;
  start_date: string;
  end_date: string;
  reason: string | null;
};

const days = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const emptyDoctorForm = {
  doctor_name: "",
  specialization: "",
  phone: "",
  is_active: true,
};

const emptyScheduleForm = {
  day_of_week: "1",
  start_time: "10:00",
  end_time: "12:00",
  slot_duration_minutes: "30",
};

export default function AdminDashboard() {
  const [adminName, setAdminName] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [leaves, setLeaves] = useState<DoctorLeave[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [today, setToday] = useState("");

  const [form, setForm] = useState(emptyDoctorForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [scheduleDoctorId, setScheduleDoctorId] = useState("");
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [leaveDoctorId, setLeaveDoctorId] = useState("");
  const [leaveForm, setLeaveForm] = useState({
    start_date: "",
    end_date: "",
    reason: "",
  });
  const [savingLeave, setSavingLeave] = useState(false);

  const loadData = useCallback(async (date: string) => {
    const start = new Date(`${date}T12:00:00+05:30`);
    start.setUTCDate(start.getUTCDate() - 6);

    const startDate = [
      start.getUTCFullYear(),
      String(start.getUTCMonth() + 1).padStart(2, "0"),
      String(start.getUTCDate()).padStart(2, "0"),
    ].join("-");

    const [doctorResult, appointmentResult, scheduleResult, leaveResult] =
      await Promise.all([
        supabase
          .from("doctors")
          .select("doctor_id, doctor_name, specialization, phone, is_active")
          .order("doctor_name"),

        supabase
          .from("appointments")
          .select("appointment_id, status, appointment_date")
          .gte("appointment_date", startDate)
          .lte("appointment_date", date),

        supabase
          .from("doctor_schedules")
          .select(
            "schedule_id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes"
          )
          .order("day_of_week")
          .order("start_time"),

        supabase
          .from("doctor_leaves")
          .select("leave_id, doctor_id, start_date, end_date, reason")
          .order("start_date"),
      ]);

    if (
      doctorResult.error ||
      appointmentResult.error ||
      scheduleResult.error ||
      leaveResult.error
    ) {
      setError("Unable to load admin data. Check your permissions.");
      return;
    }

    const doctorList = (doctorResult.data || []) as Doctor[];

    setDoctors(doctorList);
    setAppointments((appointmentResult.data || []) as Appointment[]);
    setSchedules((scheduleResult.data || []) as DoctorSchedule[]);
    setLeaves((leaveResult.data || []) as DoctorLeave[]);

    setLeaveDoctorId((current) => {
      if (current && doctorList.some((d) => String(d.doctor_id) === current)) {
        return current;
      }
      const firstDoctor = doctorList.find((d) => d.is_active) || doctorList[0];
      return firstDoctor ? String(firstDoctor.doctor_id) : "";
    });

    setScheduleDoctorId((current) => {
      if (current && doctorList.some((d) => String(d.doctor_id) === current)) {
        return current;
      }

      const firstDoctor =
        doctorList.find((d) => d.is_active) || doctorList[0];

      return firstDoctor ? String(firstDoctor.doctor_id) : "";
    });
  }, []);

  useEffect(() => {
    async function initialize() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        window.location.href = "/staff/login";
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", data.user.id)
        .single();

      if (error || profile?.role !== "admin") {
        window.location.href = "/staff/dashboard";
        return;
      }

      setAdminName(profile.full_name);

      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      setToday(date);
      await loadData(date);
      setLoading(false);
    }

    initialize();
  }, [loadData]);

  // DOCTOR MANAGEMENT

  async function saveDoctor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const { error } = await supabase.rpc("save_doctor", {
      p_doctor_id: editingId,
      p_doctor_name: form.doctor_name,
      p_specialization: form.specialization,
      p_phone: form.phone,
      p_is_active: form.is_active,
    });

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setMessage(
      editingId
        ? "Doctor updated successfully."
        : "Doctor added successfully."
    );

    setForm(emptyDoctorForm);
    setEditingId(null);

    if (today) await loadData(today);
    setSaving(false);
  }

  function editDoctor(doctor: Doctor) {
    setEditingId(doctor.doctor_id);

    setForm({
      doctor_name: doctor.doctor_name,
      specialization: doctor.specialization || "",
      phone: doctor.phone || "",
      is_active: doctor.is_active,
    });

    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyDoctorForm);
    setError("");
    setMessage("");
  }

  // SCHEDULE MANAGEMENT

  async function saveSchedule(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!scheduleDoctorId) {
      setError("Please select a doctor.");
      return;
    }

    setSavingSchedule(true);
    setError("");
    setMessage("");

    const { error } = await supabase.rpc("save_doctor_schedule", {
      p_schedule_id: editingScheduleId,
      p_doctor_id: Number(scheduleDoctorId),
      p_day_of_week: Number(scheduleForm.day_of_week),
      p_start_time: scheduleForm.start_time,
      p_end_time: scheduleForm.end_time,
      p_slot_duration_minutes: Number(
        scheduleForm.slot_duration_minutes
      ),
    });

    if (error) {
      setError(error.message);
      setSavingSchedule(false);
      return;
    }

    setMessage(
      editingScheduleId
        ? "Doctor schedule updated successfully."
        : "Doctor schedule added successfully."
    );

    setScheduleForm(emptyScheduleForm);
    setEditingScheduleId(null);

    if (today) await loadData(today);
    setSavingSchedule(false);
  }

  function editSchedule(schedule: DoctorSchedule) {
    setScheduleDoctorId(String(schedule.doctor_id));
    setEditingScheduleId(schedule.schedule_id);

    setScheduleForm({
      day_of_week: String(schedule.day_of_week),
      start_time: schedule.start_time.slice(0, 5),
      end_time: schedule.end_time.slice(0, 5),
      slot_duration_minutes: String(schedule.slot_duration_minutes),
    });

    setError("");
    setMessage("");

    document
      .getElementById("schedule-manager")
      ?.scrollIntoView({ behavior: "smooth" });
  }

  function cancelScheduleEdit() {
    setEditingScheduleId(null);
    setScheduleForm(emptyScheduleForm);
    setError("");
    setMessage("");
  }

  async function deleteSchedule(scheduleId: number) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this schedule?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    const { error } = await supabase.rpc("delete_doctor_schedule", {
      p_schedule_id: scheduleId,
    });

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Schedule deleted successfully.");

    if (today) await loadData(today);
  }

  // DOCTOR LEAVE MANAGEMENT

  async function saveLeave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!leaveDoctorId) {
      setError("Please select a doctor.");
      return;
    }

    if (!leaveForm.start_date || !leaveForm.end_date) {
      setError("Please select both leave dates.");
      return;
    }

    if (leaveForm.end_date < leaveForm.start_date) {
      setError("Leave end date cannot be before the start date.");
      return;
    }

    setSavingLeave(true);
    setError("");
    setMessage("");

    const { error } = await supabase.from("doctor_leaves").insert({
      doctor_id: Number(leaveDoctorId),
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      reason: leaveForm.reason.trim() || null,
    });

    if (error) {
      setError(error.message);
      setSavingLeave(false);
      return;
    }

    setMessage("Doctor leave added successfully. Booking slots during this period will be unavailable.");
    setLeaveForm({ start_date: "", end_date: "", reason: "" });

    if (today) await loadData(today);
    setSavingLeave(false);
  }

  async function deleteLeave(leaveId: number) {
    const confirmed = window.confirm(
      "Delete this leave entry? Booking availability may return for these dates if the doctor has a schedule."
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    const { error } = await supabase
      .from("doctor_leaves")
      .delete()
      .eq("leave_id", leaveId);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Doctor leave deleted successfully.");
    if (today) await loadData(today);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/staff/login";
  }

  const count = (status: string) =>
    appointments.filter((a) => a.status === status).length;

  const selectedDoctorSchedules = schedules.filter(
    (s) => String(s.doctor_id) === scheduleDoctorId
  );

  const selectedDoctor = doctors.find(
    (d) => String(d.doctor_id) === scheduleDoctorId
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        Loading admin dashboard...
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
              Admin Dashboard · {adminName}
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-lg border bg-white px-4 py-2 text-sm"
          >
            Log out
          </button>
        </header>

        {error && (
          <p className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {message && (
          <p className="mb-5 rounded-lg bg-green-50 p-3 text-sm text-green-800">
            {message}
          </p>
        )}

        {/* DOCTOR FORM */}

        <section className="mb-8 rounded-xl border bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold">
            {editingId ? "Edit Doctor" : "Add New Doctor"}
          </h2>

          <form onSubmit={saveDoctor} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Doctor Name
              </label>
              <input
                value={form.doctor_name}
                onChange={(e) =>
                  setForm({ ...form, doctor_name: e.target.value })
                }
                required
                maxLength={100}
                placeholder="Enter doctor name"
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Specialization
              </label>
              <input
                value={form.specialization}
                onChange={(e) =>
                  setForm({ ...form, specialization: e.target.value })
                }
                placeholder="e.g. General Physician"
                className="w-full rounded-lg border p-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Phone Number
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
                placeholder="Enter phone number"
                className="w-full rounded-lg border p-3"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked })
                }
                className="h-4 w-4"
              />
              Doctor is active and available for public bookings
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-blue-700 px-5 py-3 font-medium text-white disabled:bg-slate-400"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Doctor"
                    : "Add Doctor"}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg border px-5 py-3"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </section>

        {/* WEEKLY REPORT */}

        <h2 className="mb-4 text-lg font-semibold">
          Weekly Appointment Report
        </h2>

        <p className="mb-4 text-sm text-slate-500">
          Appointments during the last 7 calendar days, including today.
        </p>

        <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Total appointments", appointments.length],
            ["Booked", count("booked")],
            ["Arrived", count("arrived")],
            ["No-show", count("no_show")],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-white p-4">
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-2 text-3xl font-bold">{value}</p>
            </div>
          ))}
        </section>

        <section className="mb-8 rounded-xl border bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold">
            Appointment Summary
          </h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-sm text-slate-500">Completed</p>
              <p className="text-xl font-semibold">{count("completed")}</p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Cancelled</p>
              <p className="text-xl font-semibold">{count("cancelled")}</p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Active doctors</p>
              <p className="text-xl font-semibold">
                {doctors.filter((d) => d.is_active).length}
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">Total doctors</p>
              <p className="text-xl font-semibold">{doctors.length}</p>
            </div>
          </div>
        </section>

        {/* DOCTOR LIST */}

        <section className="mb-8 overflow-hidden rounded-xl border bg-white">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">Doctor Management</h2>
            <p className="mt-1 text-sm text-slate-500">
              Add, edit, or deactivate clinic doctors.
            </p>
          </div>

          {doctors.length === 0 ? (
            <p className="p-6 text-slate-500">No doctors found.</p>
          ) : (
            <div className="divide-y">
              {doctors.map((doctor) => (
                <div
                  key={doctor.doctor_id}
                  className="flex flex-wrap items-center justify-between gap-3 p-5"
                >
                  <div>
                    <p className="font-semibold">{doctor.doctor_name}</p>
                    <p className="text-sm text-slate-500">
                      {doctor.specialization || "Specialization not set"}
                    </p>
                    <p className="text-sm text-slate-500">
                      {doctor.phone || "Phone not set"}
                    </p>
                    <p className="text-xs text-slate-400">
                      Doctor ID: {doctor.doctor_id}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        doctor.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {doctor.is_active ? "Active" : "Inactive"}
                    </span>

                    <button
                      onClick={() => editDoctor(doctor)}
                      className="rounded-lg border px-3 py-2 text-sm"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SCHEDULE MANAGER */}

        <section
          id="schedule-manager"
          className="mb-8 rounded-xl border bg-white p-5"
        >
          <h2 className="mb-2 text-lg font-semibold">
            Doctor Schedule Management
          </h2>

          <p className="mb-5 text-sm text-slate-500">
            Configure working days, sessions, and appointment slot duration.
          </p>

          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium">
              Select Doctor
            </label>

            <select
              value={scheduleDoctorId}
              onChange={(e) => {
                setScheduleDoctorId(e.target.value);
                setEditingScheduleId(null);
                setScheduleForm(emptyScheduleForm);
                setError("");
                setMessage("");
              }}
              className="w-full rounded-lg border bg-white p-3"
            >
              <option value="">Choose a doctor</option>

              {doctors
                .filter((doctor) => doctor.is_active)
                .map((doctor) => (
                  <option
                    key={doctor.doctor_id}
                    value={doctor.doctor_id}
                  >
                    {doctor.doctor_name}
                  </option>
                ))}
            </select>
          </div>

          {selectedDoctor && (
            <>
              <div className="mb-5 rounded-lg bg-slate-50 p-3">
                <p className="font-medium">{selectedDoctor.doctor_name}</p>
                <p className="text-sm text-slate-500">
                  {selectedDoctor.specialization || "Specialization not set"}
                </p>
              </div>

              <form
                onSubmit={saveSchedule}
                className="mb-8 space-y-4 rounded-lg border p-4"
              >
                <h3 className="font-semibold">
                  {editingScheduleId
                    ? "Edit Working Session"
                    : "Add Working Session"}
                </h3>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Working Day
                  </label>

                  <select
                    value={scheduleForm.day_of_week}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        day_of_week: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border bg-white p-3"
                  >
                    {days.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Start Time
                    </label>

                    <input
                      type="time"
                      value={scheduleForm.start_time}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          start_time: e.target.value,
                        })
                      }
                      required
                      className="w-full rounded-lg border p-3"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      End Time
                    </label>

                    <input
                      type="time"
                      value={scheduleForm.end_time}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          end_time: e.target.value,
                        })
                      }
                      required
                      className="w-full rounded-lg border p-3"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">
                    Appointment Slot Duration
                  </label>

                  <select
                    value={scheduleForm.slot_duration_minutes}
                    onChange={(e) =>
                      setScheduleForm({
                        ...scheduleForm,
                        slot_duration_minutes: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border bg-white p-3"
                  >
                    {[10, 15, 20, 30, 45, 60].map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutes
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={savingSchedule}
                    className="rounded-lg bg-blue-700 px-5 py-3 font-medium text-white disabled:bg-slate-400"
                  >
                    {savingSchedule
                      ? "Saving..."
                      : editingScheduleId
                        ? "Update Session"
                        : "Add Session"}
                  </button>

                  {editingScheduleId !== null && (
                    <button
                      type="button"
                      onClick={cancelScheduleEdit}
                      className="rounded-lg border px-5 py-3"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>

              <h3 className="mb-3 font-semibold">
                Existing Working Sessions
              </h3>

              {selectedDoctorSchedules.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                  No schedules configured for this doctor yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedDoctorSchedules.map((schedule) => {
                    const day = days.find(
                      (d) => d.value === schedule.day_of_week
                    );

                    return (
                      <div
                        key={schedule.schedule_id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                      >
                        <div>
                          <p className="font-semibold">
                            {day?.label || "Unknown day"}
                          </p>

                          <p className="text-sm text-slate-600">
                            {schedule.start_time.slice(0, 5)} –{" "}
                            {schedule.end_time.slice(0, 5)}
                          </p>

                          <p className="text-xs text-slate-500">
                            {schedule.slot_duration_minutes}-minute slots
                          </p>
                        </div>

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => editSchedule(schedule)}
                            className="rounded-lg border px-3 py-2 text-sm"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              deleteSchedule(schedule.schedule_id)
                            }
                            className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* DOCTOR LEAVE MANAGER */}

        <section className="mb-8 rounded-xl border bg-white p-5">
          <h2 className="mb-2 text-lg font-semibold">
            Doctor Leave Management
          </h2>
          <p className="mb-5 text-sm text-slate-500">
            Add leave dates to temporarily block public appointment bookings for a doctor.
          </p>

          <div className="mb-5">
            <label className="mb-2 block text-sm font-medium">
              Select Doctor
            </label>
            <select
              value={leaveDoctorId}
              onChange={(e) => setLeaveDoctorId(e.target.value)}
              className="w-full rounded-lg border bg-white p-3"
            >
              <option value="">Choose a doctor</option>
              {doctors
                .filter((doctor) => doctor.is_active)
                .map((doctor) => (
                  <option key={doctor.doctor_id} value={doctor.doctor_id}>
                    {doctor.doctor_name}
                  </option>
                ))}
            </select>
          </div>

          <form
            onSubmit={saveLeave}
            className="mb-8 space-y-4 rounded-lg border p-4"
          >
            <h3 className="font-semibold">Add Doctor Leave</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Leave Start Date
                </label>
                <input
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, start_date: e.target.value })
                  }
                  required
                  className="w-full rounded-lg border p-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  Leave End Date
                </label>
                <input
                  type="date"
                  min={leaveForm.start_date || undefined}
                  value={leaveForm.end_date}
                  onChange={(e) =>
                    setLeaveForm({ ...leaveForm, end_date: e.target.value })
                  }
                  required
                  className="w-full rounded-lg border p-3"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Reason (optional)
              </label>
              <input
                type="text"
                maxLength={200}
                value={leaveForm.reason}
                onChange={(e) =>
                  setLeaveForm({ ...leaveForm, reason: e.target.value })
                }
                placeholder="e.g. Personal leave, conference"
                className="w-full rounded-lg border p-3"
              />
            </div>

            <button
              type="submit"
              disabled={savingLeave || !leaveDoctorId}
              className="rounded-lg bg-blue-700 px-5 py-3 font-medium text-white disabled:bg-slate-400"
            >
              {savingLeave ? "Saving..." : "Add Leave"}
            </button>
          </form>

          <h3 className="mb-3 font-semibold">Existing Leave Records</h3>

          {leaves.filter((leave) => String(leave.doctor_id) === leaveDoctorId)
            .length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              No leave records for this doctor.
            </p>
          ) : (
            <div className="space-y-3">
              {leaves
                .filter((leave) => String(leave.doctor_id) === leaveDoctorId)
                .map((leave) => {
                  const doctor = doctors.find(
                    (d) => d.doctor_id === leave.doctor_id
                  );

                  return (
                    <div
                      key={leave.leave_id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-semibold">
                          {leave.start_date === leave.end_date
                            ? leave.start_date
                            : `${leave.start_date} to ${leave.end_date}`}
                        </p>
                        <p className="text-sm text-slate-600">
                          {doctor?.doctor_name || "Doctor"}
                        </p>
                        {leave.reason && (
                          <p className="text-sm text-slate-500">
                            {leave.reason}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => deleteLeave(leave.leave_id)}
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        <footer className="mt-6">
          <a
            href="/staff/dashboard"
            className="inline-block rounded-lg bg-blue-700 px-4 py-3 text-sm font-medium text-white"
          >
            Receptionist Dashboard
          </a>
        </footer>

      </div>
    </main>
  );
}
