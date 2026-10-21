import mongoose from "mongoose";

import settings from "../config/settings.js";
import Transaction from "../models/Transaction.js";

const DAY = 24 * 60 * 60 * 1000;

const offsetMs = () =>
  settings.earningsUtcOffsetHours * 60 * 60 * 1000;

export const periodStarts = (now = new Date()) => {
  const local = new Date(now.getTime() + offsetMs());

  const day = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate()
  );

  const sinceMonday = (local.getUTCDay() + 6) % 7;

  const month = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    1
  );

  return {
    today: new Date(day - offsetMs()),
    week: new Date(day - sinceMonday * DAY - offsetMs()),
    month: new Date(month - offsetMs()),
  };
};

const earningsSince = (courierId, since) =>
  Transaction.find({
    courier: new mongoose.Types.ObjectId(String(courierId)),
    type: "earning",
    status: "completed",
    createdAt: { $gte: since },
  })
    .select("amount createdAt")
    .lean();

export const periodEarnings = async (courierId) => {
  const starts = periodStarts();

  const since = new Date(
    Math.min(starts.week.getTime(), starts.month.getTime())
  );

  const rows = await earningsSince(courierId, since);

  const sum = (from) =>
    rows
      .filter((row) => row.createdAt >= from)
      .reduce((total, row) => total + (row.amount || 0), 0);

  return {
    today: sum(starts.today),
    weekly: sum(starts.week),
    monthly: sum(starts.month),
  };
};

export const weekEarnings = async (courierId) => {
  const { week } = periodStarts();

  const rows = await earningsSince(courierId, week);

  const days = [0, 0, 0, 0, 0, 0, 0];

  for (const row of rows) {
    const index = Math.floor(
      (row.createdAt.getTime() - week.getTime()) / DAY
    );

    if (index >= 0 && index < 7) {
      days[index] += row.amount || 0;
    }
  }

  return days;
};
